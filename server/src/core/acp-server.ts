import type { Db } from "@gitmesh/data";
import { approvalService, agentService, goalService, issueService, logActivity, policyEngineService } from "./index.js";

const JSONRPC_VERSION = "2.0" as const;

const JSONRPC_ERROR = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  UNAUTHORIZED: -32001,
  POLICY_BLOCKED: -32002,
  CHECKOUT_CONFLICT: -32003,
} as const;

type JsonRpcId = string | number;

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcSuccess {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result: unknown;
}

interface JsonRpcFailure {
  jsonrpc: "2.0";
  id: JsonRpcId | null;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcFailure;

interface AcpActor {
  type: "operator" | "agent" | "none";
  agentId?: string;
  userId?: string;
  runId?: string;
}

function buildError(id: JsonRpcId | null, code: number, message: string, data?: unknown): JsonRpcFailure {
  return {
    jsonrpc: JSONRPC_VERSION,
    id,
    error: data === undefined ? { code, message } : { code, message, data },
  };
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function acpServer(db: Db) {
  const issues = issueService(db);
  const goals = goalService(db);
  const agents = agentService(db);
  const approvals = approvalService(db);
  const policy = policyEngineService(db);

  async function resolveAgentId(actor: AcpActor, params: Record<string, unknown>): Promise<string | null> {
    if (actor.type === "agent" && actor.agentId) return actor.agentId;
    return asString(params.agentId);
  }

  async function createApproval(
    projectId: string,
    requestedByAgentId: string,
    actionType: string,
    payload: Record<string, unknown>,
  ) {
    return approvals.create(projectId, {
      type: actionType,
      requestedByAgentId,
      requestedByUserId: null,
      payload,
    });
  }

  async function handleRegister(projectId: string, actor: AcpActor, params: Record<string, unknown>) {
    const agentId = await resolveAgentId(actor, params);
    if (!agentId) {
      throw buildError(null, JSONRPC_ERROR.INVALID_PARAMS, "Missing agentId");
    }

    const agent = await agents.getById(agentId);
    if (!agent || agent.projectId !== projectId) {
      throw buildError(null, JSONRPC_ERROR.UNAUTHORIZED, "Agent cannot access this project");
    }

    const policyResult = await policy.evaluate({
      projectId,
      agentId,
      action: "acp.register",
      context: params,
    });

    if (policyResult.effect === "block") {
      throw buildError(null, JSONRPC_ERROR.POLICY_BLOCKED, policyResult.reason, {
        policyId: policyResult.policyId,
        policyVersion: policyResult.policyVersion,
      });
    }

    if (policyResult.effect === "require_approval") {
      const approval = await createApproval(projectId, agentId, "acp_register", {
        reason: policyResult.reason,
        params,
      });
      return {
        registered: false,
        approvalRequired: true,
        approvalId: approval.id,
        reason: policyResult.reason,
      };
    }

    const [openIssues, roadmap] = await Promise.all([
      issues.list(projectId, { status: "backlog,todo,in_progress,blocked" }),
      goals.list(projectId),
    ]);

    const remainingMonthlyCents = Math.max(0, agent.budgetMonthlyCents - agent.spentMonthlyCents);

    await logActivity(db, {
      projectId,
      actorType: "agent",
      actorId: agentId,
      action: "acp.register",
      entityType: "agent",
      entityId: agentId,
      agentId,
      runId: actor.runId ?? null,
      details: {
        policyVersion: policyResult.policyVersion,
        policyOutcome: policyResult.effect,
      },
    });

    return {
      registered: true,
      approvalRequired: false,
      agent: {
        id: agent.id,
        name: agent.name,
        role: agent.role,
        status: agent.status,
      },
      budget: {
        monthlyCents: agent.budgetMonthlyCents,
        spentCents: agent.spentMonthlyCents,
        remainingCents: remainingMonthlyCents,
      },
      context: {
        issueCount: openIssues.length,
        openIssues: openIssues.slice(0, 50),
        goals: roadmap,
      },
    };
  }

  async function handleCheckout(projectId: string, actor: AcpActor, params: Record<string, unknown>) {
    const agentId = await resolveAgentId(actor, params);
    const issueId = asString(params.issueId);
    if (!agentId || !issueId) {
      throw buildError(null, JSONRPC_ERROR.INVALID_PARAMS, "Missing agentId or issueId");
    }

    const policyResult = await policy.evaluate({
      projectId,
      agentId,
      action: "checkout_issue",
      context: { ...params, issueId },
    });

    if (policyResult.effect === "block") {
      throw buildError(null, JSONRPC_ERROR.POLICY_BLOCKED, policyResult.reason, {
        policyId: policyResult.policyId,
        policyVersion: policyResult.policyVersion,
      });
    }

    if (policyResult.effect === "require_approval") {
      const approval = await createApproval(projectId, agentId, "checkout_issue", {
        issueId,
        reason: policyResult.reason,
      });
      return {
        checkedOut: false,
        approvalRequired: true,
        approvalId: approval.id,
        reason: policyResult.reason,
      };
    }

    try {
      const checkedOut = await issues.checkout(
        issueId,
        agentId,
        ["backlog", "todo", "blocked", "in_progress"],
        actor.runId ?? null,
      );

      await logActivity(db, {
        projectId,
        actorType: "agent",
        actorId: agentId,
        action: "acp.task.checkout",
        entityType: "issue",
        entityId: issueId,
        agentId,
        runId: actor.runId ?? null,
        details: {
          status: checkedOut.status,
          policyVersion: policyResult.policyVersion,
          policyOutcome: policyResult.effect,
        },
      });

      return {
        checkedOut: true,
        issue: checkedOut,
        lock: {
          runId: checkedOut.checkoutRunId ?? actor.runId ?? null,
          assigneeAgentId: checkedOut.assigneeAgentId,
        },
      };
    } catch (error) {
      throw buildError(
        null,
        JSONRPC_ERROR.CHECKOUT_CONFLICT,
        error instanceof Error ? error.message : "Checkout failed",
      );
    }
  }

  async function handleComplete(projectId: string, actor: AcpActor, params: Record<string, unknown>) {
    const agentId = await resolveAgentId(actor, params);
    const issueId = asString(params.issueId);
    const status = asString(params.status) ?? "done";

    if (!agentId || !issueId) {
      throw buildError(null, JSONRPC_ERROR.INVALID_PARAMS, "Missing agentId or issueId");
    }

    const policyResult = await policy.evaluate({
      projectId,
      agentId,
      action: "complete_issue",
      context: { ...params, issueId, status },
    });

    if (policyResult.effect === "block") {
      throw buildError(null, JSONRPC_ERROR.POLICY_BLOCKED, policyResult.reason, {
        policyId: policyResult.policyId,
        policyVersion: policyResult.policyVersion,
      });
    }

    if (policyResult.effect === "require_approval") {
      const approval = await createApproval(projectId, agentId, "close_issue", {
        issueId,
        requestedStatus: status,
        reason: policyResult.reason,
      });
      return {
        completed: false,
        approvalRequired: true,
        approvalId: approval.id,
        reason: policyResult.reason,
      };
    }

    const existing = await issues.getById(issueId);
    if (!existing || existing.projectId !== projectId) {
      throw buildError(null, JSONRPC_ERROR.INVALID_PARAMS, "Issue not found for project");
    }

    const completed = await issues.update(issueId, {
      status,
      checkoutRunId: null,
      executionRunId: null,
      executionLockedAt: null,
    });

    await logActivity(db, {
      projectId,
      actorType: "agent",
      actorId: agentId,
      action: "acp.task.complete",
      entityType: "issue",
      entityId: issueId,
      agentId,
      runId: actor.runId ?? null,
      details: {
        status,
        summary: params.summary,
        policyVersion: policyResult.policyVersion,
        policyOutcome: policyResult.effect,
      },
    });

    return {
      completed: true,
      issue: completed,
    };
  }

  return {
    async execute(projectId: string, actor: AcpActor, request: JsonRpcRequest): Promise<JsonRpcResponse | null> {
      if (!request || request.jsonrpc !== JSONRPC_VERSION || typeof request.method !== "string") {
        return buildError(null, JSONRPC_ERROR.INVALID_REQUEST, "Invalid JSON-RPC request");
      }

      const params =
        typeof request.params === "object" && request.params !== null
          ? (request.params as Record<string, unknown>)
          : {};
      const id = request.id ?? null;

      try {
        let result: unknown;

        switch (request.method) {
          case "acp.register":
          case "agent.register":
            result = await handleRegister(projectId, actor, params);
            break;
          case "task.checkout":
            result = await handleCheckout(projectId, actor, params);
            break;
          case "task.complete":
            result = await handleComplete(projectId, actor, params);
            break;
          case "acp.health":
            result = {
              status: "ok",
              timestamp: new Date().toISOString(),
              projectId,
            };
            break;
          default:
            return buildError(id, JSONRPC_ERROR.METHOD_NOT_FOUND, `Method not found: ${request.method}`);
        }

        if (id === null) {
          return null;
        }

        return {
          jsonrpc: JSONRPC_VERSION,
          id,
          result,
        };
      } catch (error) {
        if (error && typeof error === "object" && "jsonrpc" in (error as Record<string, unknown>)) {
          const rpcErr = error as JsonRpcFailure;
          return {
            ...rpcErr,
            id,
          };
        }

        return buildError(
          id,
          JSONRPC_ERROR.INTERNAL_ERROR,
          error instanceof Error ? error.message : "Internal error",
        );
      }
    },
  };
}
