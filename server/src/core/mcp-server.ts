import type { Db } from "@gitmesh/data";
import { agentService } from "./agents.js";
import { approvalService } from "./approvals.js";
import { goalService } from "./goals.js";
import { issueService } from "./issues.js";
import { policyEngineService } from "./policy-engine.js";

export interface MCPToolInput {
  [key: string]: unknown;
}

export interface MCPToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  contents: string;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function mcpServer(db: Db) {
  const issuesSvc = issueService(db);
  const goalsSvc = goalService(db);
  const agentsSvc = agentService(db);
  const approvalsSvc = approvalService(db);
  const policySvc = policyEngineService(db);

  return {
    async getAvailableTools(_projectId: string, _agentId: string) {
      return [
        {
          name: "list_issues",
          description: "List issues in the project with optional filters",
          inputSchema: {
            type: "object",
            properties: {
              projectId: { type: "string", description: "Project ID" },
              status: { type: "string", description: "Filter by status" },
              limit: { type: "number", description: "Maximum results" },
            },
            required: ["projectId"],
          },
        },
        {
          name: "get_issue",
          description: "Get detailed info about a specific issue",
          inputSchema: {
            type: "object",
            properties: {
              projectId: { type: "string" },
              issueId: { type: "string" },
            },
            required: ["projectId", "issueId"],
          },
        },
        {
          name: "checkout_issue",
          description: "Atomically checkout an issue for agent work",
          inputSchema: {
            type: "object",
            properties: {
              projectId: { type: "string" },
              issueId: { type: "string" },
            },
            required: ["projectId", "issueId"],
          },
        },
        {
          name: "update_issue",
          description: "Update issue fields like status/title/priority",
          inputSchema: {
            type: "object",
            properties: {
              projectId: { type: "string" },
              issueId: { type: "string" },
              title: { type: "string" },
              description: { type: "string" },
              status: { type: "string" },
              priority: { type: "string" },
            },
            required: ["projectId", "issueId"],
          },
        },
        {
          name: "post_comment",
          description: "Post a comment on an issue",
          inputSchema: {
            type: "object",
            properties: {
              projectId: { type: "string" },
              issueId: { type: "string" },
              body: { type: "string" },
            },
            required: ["projectId", "issueId", "body"],
          },
        },
        {
          name: "add_label",
          description: "Add a label to an issue by labelId or label name",
          inputSchema: {
            type: "object",
            properties: {
              projectId: { type: "string" },
              issueId: { type: "string" },
              labelId: { type: "string" },
              label: { type: "string" },
              color: { type: "string", description: "Optional hex color for auto-created labels" },
            },
            required: ["projectId", "issueId"],
          },
        },
        {
          name: "escalate",
          description: "Escalate an action to human approval",
          inputSchema: {
            type: "object",
            properties: {
              projectId: { type: "string" },
              action: { type: "string" },
              reason: { type: "string" },
              context: { type: "object" },
            },
            required: ["projectId", "action"],
          },
        },
        {
          name: "list_goals",
          description: "List project milestones/goals and roadmap",
          inputSchema: {
            type: "object",
            properties: {
              projectId: { type: "string" },
            },
            required: ["projectId"],
          },
        },
        {
          name: "get_agent_budget",
          description: "Get remaining budget for an agent",
          inputSchema: {
            type: "object",
            properties: {
              agentId: { type: "string" },
            },
            required: ["agentId"],
          },
        },
        {
          name: "get_budget",
          description: "Alias of get_agent_budget",
          inputSchema: {
            type: "object",
            properties: {
              agentId: { type: "string" },
            },
            required: ["agentId"],
          },
        },
        {
          name: "request_approval",
          description: "Request human approval for an agent action",
          inputSchema: {
            type: "object",
            properties: {
              projectId: { type: "string" },
              agentId: { type: "string" },
              action: { type: "string" },
              reason: { type: "string" },
              context: { type: "object" },
            },
            required: ["projectId", "agentId", "action"],
          },
        },
        {
          name: "check_policy",
          description: "Check if an action is allowed by policies",
          inputSchema: {
            type: "object",
            properties: {
              projectId: { type: "string" },
              agentId: { type: "string" },
              action: { type: "string" },
              context: { type: "object" },
            },
            required: ["projectId", "agentId", "action"],
          },
        },
        {
          name: "get_policy",
          description: "Alias of check_policy",
          inputSchema: {
            type: "object",
            properties: {
              projectId: { type: "string" },
              agentId: { type: "string" },
              action: { type: "string" },
              context: { type: "object" },
            },
            required: ["projectId", "agentId", "action"],
          },
        },
      ];
    },

    async executeTool(
      toolName: string,
      input: MCPToolInput,
      projectId: string,
      agentId: string,
    ): Promise<MCPToolResult> {
      try {
        const policyCheck = await policySvc.evaluate({
          projectId,
          agentId,
          action: toolName,
          context: input,
        });

        if (policyCheck.effect === "block") {
          return {
            success: false,
            error: `Action blocked by policy: ${policyCheck.reason ?? "blocked"}`,
          };
        }

        if (policyCheck.effect === "require_approval") {
          const approval = await approvalsSvc.create(projectId, {
            type: "approve_admin_strategy",
            requestedByAgentId: agentId,
            requestedByUserId: null,
            status: "pending",
            payload: {
              action: String(input.action ?? toolName),
              reason: String(input.reason ?? policyCheck.reason ?? "Policy requires approval"),
              context: (input.context ?? input) as Record<string, unknown>,
            },
            decisionNote: null,
            decidedByUserId: null,
            decidedAt: null,
            updatedAt: new Date(),
          });

          return {
            success: false,
            data: { approvalId: approval.id, status: "pending" },
            error: `Approval required: ${policyCheck.reason ?? "policy"}`,
          };
        }

        let result: unknown;

        switch (toolName) {
          case "list_issues": {
            result = await issuesSvc.list(projectId);
            break;
          }
          case "get_issue": {
            const issueId = String(input.issueId ?? "");
            if (!issueId) return { success: false, error: "Missing issueId" };
            const issue = await issuesSvc.getById(issueId);
            if (!issue || issue.projectId !== projectId) {
              return { success: false, error: "Issue not found" };
            }
            result = issue;
            break;
          }
          case "checkout_issue": {
            const issueId = asString(input.issueId);
            if (!issueId) return { success: false, error: "Missing issueId" };
            result = await issuesSvc.checkout(
              issueId,
              agentId,
              ["backlog", "todo", "blocked", "in_progress"],
              null,
            );
            break;
          }
          case "update_issue": {
            const issueId = asString(input.issueId);
            if (!issueId) return { success: false, error: "Missing issueId" };

            const patch: Record<string, unknown> = {};
            const title = asString(input.title);
            const description = asString(input.description);
            const status = asString(input.status);
            const priority = asString(input.priority);

            if (title !== null) patch.title = title;
            if (description !== null) patch.description = description;
            if (status !== null) patch.status = status;
            if (priority !== null) patch.priority = priority;

            if (Object.keys(patch).length === 0) {
              return { success: false, error: "No update fields provided" };
            }

            result = await issuesSvc.update(issueId, patch);
            break;
          }
          case "post_comment": {
            const issueId = asString(input.issueId);
            const body = asString(input.body);
            if (!issueId) return { success: false, error: "Missing issueId" };
            if (!body) return { success: false, error: "Missing body" };
            result = await issuesSvc.addComment(issueId, body, { agentId });
            break;
          }
          case "add_label": {
            const issueId = asString(input.issueId);
            if (!issueId) return { success: false, error: "Missing issueId" };

            const issue = await issuesSvc.getById(issueId);
            if (!issue || issue.projectId !== projectId) {
              return { success: false, error: "Issue not found" };
            }

            let labelId = asString(input.labelId);
            if (!labelId) {
              const labelName = asString(input.label);
              if (!labelName) return { success: false, error: "Missing labelId or label" };

              const existingLabels = await issuesSvc.listLabels(projectId);
              const matched = existingLabels.find(
                (candidate) => candidate.name.toLowerCase() === labelName.toLowerCase(),
              );
              if (matched) {
                labelId = matched.id;
              } else {
                const color = asString(input.color) ?? "#94a3b8";
                const created = await issuesSvc.createLabel(projectId, { name: labelName, color });
                labelId = created.id;
              }
            }

            const currentLabelIds = Array.isArray(issue.labelIds) ? issue.labelIds : [];
            const mergedLabelIds = [...new Set([...currentLabelIds, labelId])];
            result = await issuesSvc.update(issueId, { labelIds: mergedLabelIds });
            break;
          }
          case "escalate": {
            const action = asString(input.action) ?? toolName;
            const approval = await approvalsSvc.create(projectId, {
              type: "approve_admin_strategy",
              requestedByAgentId: agentId,
              requestedByUserId: null,
              status: "pending",
              payload: {
                action,
                reason: String(input.reason ?? "Escalated via MCP"),
                context: (input.context ?? input) as Record<string, unknown>,
              },
              decisionNote: null,
              decidedByUserId: null,
              decidedAt: null,
              updatedAt: new Date(),
            });
            result = {
              approvalId: approval.id,
              status: approval.status,
              type: approval.type,
            };
            break;
          }
          case "list_goals": {
            result = await goalsSvc.list(projectId);
            break;
          }
          case "get_budget":
          case "get_agent_budget": {
            const lookupAgentId = String(input.agentId ?? agentId);
            const agent = await agentsSvc.getById(lookupAgentId);
            if (!agent || agent.projectId !== projectId) {
              return { success: false, error: "Agent not found" };
            }
            const monthlyBudget = agent.budgetMonthlyCents ?? 0;
            const spent = agent.spentMonthlyCents ?? 0;
            result = {
              agentId: agent.id,
              monthlyBudgetCents: monthlyBudget,
              spentMonthlyCents: spent,
              remainingMonthlyCents: Math.max(0, monthlyBudget - spent),
            };
            break;
          }
          case "request_approval": {
            const approval = await approvalsSvc.create(projectId, {
              type: "approve_admin_strategy",
              requestedByAgentId: agentId,
              requestedByUserId: null,
              status: "pending",
              payload: {
                action: String(input.action ?? "unknown"),
                reason: String(input.reason ?? "Requested via MCP"),
                context: (input.context ?? {}) as Record<string, unknown>,
              },
              decisionNote: null,
              decidedByUserId: null,
              decidedAt: null,
              updatedAt: new Date(),
            });
            result = approval;
            break;
          }
          case "get_policy":
          case "check_policy": {
            const action = String(input.action ?? "");
            if (!action) return { success: false, error: "Missing action" };
            result = await policySvc.evaluate({
              projectId,
              agentId,
              action,
              context: (input.context ?? {}) as Record<string, unknown>,
            });
            break;
          }
          default:
            return { success: false, error: `Unknown tool: ${toolName}` };
        }

        return { success: true, data: result };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },

    async getAvailableResources(projectId: string, _agentId: string): Promise<MCPResource[]> {
      return [
        {
          uri: `gitmesh://projects/${projectId}/goals`,
          name: "Project Goals",
          description: "Goal hierarchy for the selected project",
          mimeType: "application/json",
          contents: "",
        },
        {
          uri: `gitmesh://projects/${projectId}/policies`,
          name: "Project Policies",
          description: "Policy definitions and priorities",
          mimeType: "application/json",
          contents: "",
        },
      ];
    },

    async getResource(uri: string, projectId: string, _agentId: string): Promise<MCPResource | null> {
      if (uri === `gitmesh://projects/${projectId}/goals`) {
        const goals = await goalsSvc.list(projectId);
        return {
          uri,
          name: "Project Goals",
          description: "Goal hierarchy for the selected project",
          mimeType: "application/json",
          contents: JSON.stringify(goals, null, 2),
        };
      }

      if (uri === `gitmesh://projects/${projectId}/policies`) {
        const policies = await policySvc.listPolicies(projectId);
        return {
          uri,
          name: "Project Policies",
          description: "Policy definitions and priorities",
          mimeType: "application/json",
          contents: JSON.stringify(policies, null, 2),
        };
      }

      return null;
    },
  };
}
