import { and, eq } from "@gitmesh/data";
import type { Db } from "@gitmesh/data";
import { agents } from "@gitmesh/data";
import type { EnableApprovedPayload } from "@gitmesh/adapter-sdk";
import { findServerAdapter } from "../adapters/registry.js";
import { logger } from "../infra/middleware/logger.js";
import { logActivity } from "./activity-log.js";

const HIRE_APPROVED_MESSAGE =
  "Tell your user that your enablement was approved, now they should assign you a task in GitMesh Agents or ask you to create issues.";

export interface NotifyEnableApprovedInput {
  projectId: string;
  agentId: string;
  source: "join_request" | "approval";
  sourceId: string;
  approvedAt?: Date;
}

/**
 * Invokes the adapter's onEnableApproved hook when an agent is approved (join-request or hire_agent approval).
 * Failures are non-fatal: we log and write to activity, never throw.
 */
export async function notifyEnableApproved(
  db: Db,
  input: NotifyEnableApprovedInput,
): Promise<void> {
  const { projectId, agentId, source, sourceId } = input;
  const approvedAt = input.approvedAt ?? new Date();

  const row = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.projectId, projectId)))
    .then((rows) => rows[0] ?? null);

  if (!row) {
    logger.warn({ projectId, agentId, source, sourceId }, "enable hook: agent not found in project, skipping");
    return;
  }

  const adapterType = row.adapterType ?? "process";
  const adapter = findServerAdapter(adapterType);
  const onEnableApproved = adapter?.onEnableApproved;
  if (!onEnableApproved) {
    return;
  }

  const payload: EnableApprovedPayload = {
    projectId,
    agentId,
    agentName: row.name,
    adapterType,
    source,
    sourceId,
    approvedAt: approvedAt.toISOString(),
    message: HIRE_APPROVED_MESSAGE,
  };

  const adapterConfig =
    typeof row.adapterConfig === "object" && row.adapterConfig !== null && !Array.isArray(row.adapterConfig)
      ? (row.adapterConfig as Record<string, unknown>)
      : {};

  try {
    const result = await onEnableApproved(payload, adapterConfig);
    if (result.ok) {
      await logActivity(db, {
        projectId,
        actorType: "system",
        actorId: "enable_hook",
        action: "enable_hook.succeeded",
        entityType: "agent",
        entityId: agentId,
        details: { source, sourceId, adapterType },
      });
      return;
    }

    logger.warn(
      { projectId, agentId, adapterType, source, sourceId, error: result.error, detail: result.detail },
      "enable hook: adapter returned failure",
    );
    await logActivity(db, {
      projectId,
      actorType: "system",
      actorId: "enable_hook",
      action: "enable_hook.failed",
      entityType: "agent",
      entityId: agentId,
      details: { source, sourceId, adapterType, error: result.error, detail: result.detail },
    });
  } catch (err) {
    logger.error(
      { err, projectId, agentId, adapterType, source, sourceId },
      "enable hook: adapter threw",
    );
    await logActivity(db, {
      projectId,
      actorType: "system",
      actorId: "enable_hook",
      action: "enable_hook.error",
      entityType: "agent",
      entityId: agentId,
      details: {
        source,
        sourceId,
        adapterType,
        error: err instanceof Error ? err.message : String(err),
      },
    });
  }
}
