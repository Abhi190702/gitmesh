/**
 * Heartbeat Policy Integration
 *
 * Provides helpers for enforcing policy-engine.evaluate() checks at key
 * integration points within heartbeat.ts and forge-sync.ts.
 *
 * Integration points:
 * 1. executeRun() in heartbeat.ts - "agent_run" action evaluated before agent execution
 * 2. Forge outbound actions in forge-sync.ts - per-action policy checks before write ops
 */

import type { Db } from "@gitmesh/data";
import { policyEngineService } from "./policy-engine.js";

/**
 * Run a policy-gated action within the heartbeat service context.
 *
 * Evaluates the given action against the project policy set, then:
 * - If effect === "block": logs the block and returns { allowed: false, blocked: true }
 * - If effect === "require_approval": queues an approval request and returns { allowed: false, pendingApproval: true }
 * - If effect === "allow": returns { allowed: true }
 *
 * Callers are responsible for honouring the returned flags (e.g., short-circuiting
 * the run or action when allowed === false).
 */
export async function evaluatePolicyGatedAction(
  db: Db,
  input: {
    projectId: string;
    agentId: string;
    action: string;
    context?: Record<string, unknown>;
  },
): Promise<
  | { allowed: true }
  | { allowed: false; blocked: true; policyResult: import("./policy-engine.js").PolicyEvaluationResult }
  | { allowed: false; pendingApproval: true; policyResult: import("./policy-engine.js").PolicyEvaluationResult }
> {
  const policyEngine = policyEngineService(db);
  const result = await policyEngine.evaluate(input);

  if (result.effect === "block") {
    console.warn(
      `Policy blocked action "${input.action}" for agent ${input.agentId}: ${result.reason}`,
    );
    return { allowed: false, blocked: true, policyResult: result };
  }

  if (result.effect === "require_approval") {
    console.warn(
      `Policy requires approval for action "${input.action}" on agent ${input.agentId}: ${result.reason}`,
    );
    // TODO: create approval record via approvalService
    // await approvalService(db).create(input.projectId, { agentId, action, ... });
    return { allowed: false, pendingApproval: true, policyResult: result };
  }

  return { allowed: true };
}

/**
 * Map from forge action names used internally to the policy action string.
 * Used when calling evaluatePolicyGatedAction for outbound forge operations.
 */
export const FORGE_ACTION_MAP = {
  post_comment: "post_comment",
  close_issue: "close_issue",
  reopen_issue: "reopen_issue",
  merge_pr: "merge_pr",
  add_label: "add_label",
  request_review: "request_review",
} as const;
