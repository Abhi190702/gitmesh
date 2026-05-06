import { Link } from "@/lib/router";
import { Identity } from "./Identity";
import { timeAgo } from "../lib/timeAgo";
import { cn } from "../lib/utils";
import { deriveProjectUrlKey, type ActivityEvent, type Agent } from "@gitmesh/core";
import { AttestationBadge } from "../features/AttestationBadge";
import type { AttestationStatusKind } from "../api/attestations";
import { useProject } from "../context/ProjectContext";

// ── Verb mapping ─────────────────────────────────────────────────────────

const VERB_MAP: Record<string, string> = {
  "issue.created": "created",
  "issue.updated": "updated",
  "issue.checked_out": "checked out",
  "issue.released": "released",
  "issue.comment_added": "commented on",
  "issue.attachment_added": "attached file to",
  "issue.attachment_removed": "removed attachment from",
  "issue.commented": "commented on",
  "issue.deleted": "deleted",
  "agent.created": "created",
  "agent.updated": "updated",
  "agent.paused": "paused",
  "agent.resumed": "resumed",
  "agent.terminated": "terminated",
  "agent.key_created": "created API key for",
  "agent.budget_updated": "updated budget for",
  "agent.runtime_session_reset": "reset session for",
  "heartbeat.invoked": "invoked heartbeat for",
  "heartbeat.cancelled": "cancelled heartbeat for",
  "approval.created": "requested approval",
  "approval.approved": "approved",
  "approval.rejected": "rejected",
  "project.created": "created",
  "project.updated": "updated",
  "project.deleted": "deleted",
  "milestone.created": "created",
  "milestone.updated": "updated",
  "milestone.deleted": "deleted",
  "cost.reported": "reported cost for",
  "cost.recorded": "recorded cost for",
  "project.archived": "archived",
  "project.budget_updated": "updated budget for",
  "policy_evaluation": "evaluated policy for",
};

// ── Value helpers ───────────────────────────────────────────────────────────

function renderValue(val: unknown): string {
  if (typeof val !== "string") return String(val ?? "none");
  return val.replace(/_/g, " ");
}

// ── Verb formatting with detail awareness ────────────────────────────────

function buildVerb(action: string, details: Record<string, unknown> | null | undefined): string {
  if (action !== "issue.updated" || !details) return VERB_MAP[action] ?? action.replace(/[._]/g, " ");

  const prior = (details._previous ?? {}) as Record<string, unknown>;

  if (details.status !== undefined) {
    const from = prior.status;
    return from
      ? `changed status from ${renderValue(from)} to ${renderValue(details.status)} on`
      : `changed status to ${renderValue(details.status)} on`;
  }
  if (details.priority !== undefined) {
    const from = prior.priority;
    return from
      ? `changed priority from ${renderValue(from)} to ${renderValue(details.priority)} on`
      : `changed priority to ${renderValue(details.priority)} on`;
  }
  return VERB_MAP[action];
}

// ── Link builder ─────────────────────────────────────────────────────────

function buildLink(entityType: string, entityId: string, name?: string | null): string | null {
  switch (entityType) {
    case "issue": return `/issues/${name ?? entityId}`;
    case "agent": return `/agents/${entityId}`;
    case "project": return `/projects/${deriveProjectUrlKey(name, entityId)}`;
    case "goal": return `/milestones/${entityId}`;
    case "approval": return `/approvals/${entityId}`;
    default: return null;
  }
}

// ── Heartbeat helper ─────────────────────────────────────────────────────

function extractHeartbeatAgentId(details: Record<string, unknown> | null | undefined): string | undefined {
  if (!details) return undefined;
  return details.agentId as string | undefined;
}

// ── Main component ────────────────────────────────────────────────────────

interface Props {
  event: ActivityEvent;
  agentMap: Map<string, Agent>;
  entityNameMap: Map<string, string>;
  entityTitleMap?: Map<string, string>;
  attestationStatus?: AttestationStatusKind;
  className?: string;
}

export function ActivityRow({
  event,
  agentMap,
  entityNameMap,
  entityTitleMap,
  attestationStatus,
  className,
}: Props) {
  const verb = buildVerb(event.action, event.details);
  const { selectedProjectId } = useProject();

  const isHeartbeatRun = event.entityType === "heartbeat_run";
  const heartbeatAgentId = isHeartbeatRun ? extractHeartbeatAgentId(event.details as Record<string, unknown> | null) : undefined;

  const nameKey = isHeartbeatRun && heartbeatAgentId
    ? `agent:${heartbeatAgentId}`
    : `${event.entityType}:${event.entityId}`;
  const name = isHeartbeatRun
    ? (heartbeatAgentId ? entityNameMap.get(nameKey) : null)
    : entityNameMap.get(nameKey);

  const titleKey = `${event.entityType}:${event.entityId}`;
  const title = entityTitleMap?.get(titleKey);

  const agentLink = isHeartbeatRun && heartbeatAgentId
    ? buildLink("agent", heartbeatAgentId)
    : null;

  return (
    <div className={cn("flex items-start gap-2 py-2", className)}>
      {event.agentId && (
        <Identity
          name={agentMap.get(event.agentId)?.name ?? event.agentId.slice(0, 8)}
          size="sm"
        />
      )}
      <div className="flex-1 min-w-0 text-sm">
        <span className="text-muted-foreground">{verb} </span>
        {title ? (
          <span className="font-medium truncate">{title}</span>
        ) : name ? (
          <span className="font-medium truncate">{name}</span>
        ) : (
          <span className="font-mono text-muted-foreground text-xs">{event.entityId.slice(0, 8)}</span>
        )}
        <span className="text-muted-foreground"> · </span>
        <span className="text-xs text-muted-foreground">{timeAgo(event.createdAt)}</span>
        {agentLink && heartbeatAgentId && (
          <>
            <span className="text-muted-foreground"> by </span>
            <Link to={agentLink} className="text-xs hover:underline">
              {agentMap.get(heartbeatAgentId)?.name ?? heartbeatAgentId.slice(0, 8)}
            </Link>
          </>
        )}
      </div>
      {selectedProjectId && event.id && (
        <div className="flex shrink-0 items-center self-center">
          <AttestationBadge
            projectId={selectedProjectId}
            activityId={event.id}
            status={attestationStatus}
            size="xs"
          />
        </div>
      )}
    </div>
  );
}
