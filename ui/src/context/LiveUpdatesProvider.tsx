import { useEffect, useRef, type ReactNode } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { Agent, Issue, LiveEvent } from "@gitmesh/core";
import { authApi } from "../api/auth";
import { useProject } from "./ProjectContext";
import type { ToastInput } from "./ToastContext";
import { useToast } from "./ToastContext";
import { queryKeys } from "../lib/queryKeys";

// ── Constants ─────────────────────────────────────────────────────────────

const TOAST_COOLDOWN_WINDOW_MS = 10_000;
const TOAST_COOLDOWN_MAX = 3;
const RECONNECT_SUPPRESS_MS = 2000;

const ISSUE_ACTIONS = new Set(["issue.created", "issue.updated", "issue.comment_added"]);
const AGENT_STATUSES = new Set(["running", "error"]);
const TERMINAL_RUN_STATUSES = new Set(["succeeded", "failed", "timed_out", "cancelled"]);

// ── Type helpers ─────────────────────────────────────────────────────────

function toString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "\u2026";
}

// ── Agent name resolution ────────────────────────────────────────────────

function resolveAgentName(queryClient: QueryClient, projectId: string, agentId: string): string | null {
  const agents = queryClient.getQueryData<Agent[]>(queryKeys.agents.list(projectId));
  return agents?.find((a) => a.id === agentId)?.name ?? null;
}

// ── Actor resolution ─────────────────────────────────────────────────────

function resolveActor(
  queryClient: QueryClient,
  projectId: string,
  actorType: string | null,
  actorId: string | null,
): string {
  if (actorType === "agent" && actorId) {
    return resolveAgentName(queryClient, projectId, actorId) ?? `Agent ${agentId}`;
  }
  if (actorType === "system") return "System";
  if (actorType === "user" && actorId) return "Maintainer";
  return "Someone";
}

const agentId = (id: string) => id.slice(0, 8);

// ── Issue refs ──────────────────────────────────────────────────────────

function resolveIssueRefs(
  queryClient: QueryClient,
  projectId: string,
  issueId: string,
  details: Record<string, unknown> | null,
): string[] {
  const refs = new Set<string>([issueId]);
  const detailIssue = queryClient.getQueryData<Issue>(queryKeys.issues.detail(issueId));
  const listIssues = queryClient.getQueryData<Issue[]>(queryKeys.issues.list(projectId));
  const identifier =
    toString(details?.identifier) ?? toString(details?.issueIdentifier);

  if (identifier) refs.add(identifier);
  if (detailIssue?.id) refs.add(detailIssue.id);
  if (detailIssue?.identifier) refs.add(detailIssue.identifier);

  const listIssue = listIssues?.find((issue) => {
    if (issue.id === issueId) return true;
    if (issue.identifier && issue.identifier === issueId) return true;
    if (identifier && issue.identifier === identifier) return true;
    return false;
  });
  if (listIssue?.id) refs.add(listIssue.id);
  if (listIssue?.identifier) refs.add(listIssue.identifier);

  return Array.from(refs);
}

function resolveIssue(
  queryClient: QueryClient,
  projectId: string,
  issueId: string,
  details: Record<string, unknown> | null,
) {
  const refs = resolveIssueRefs(queryClient, projectId, issueId, details);
  const detailIssue = refs
    .map((ref) => queryClient.getQueryData<Issue>(queryKeys.issues.detail(ref)))
    .find((issue): issue is Issue => !!issue);
  const listIssue = queryClient
    .getQueryData<Issue[]>(queryKeys.issues.list(projectId))
    ?.find((issue) => refs.some((ref) => issue.id === ref || issue.identifier === ref));
  const cached = detailIssue ?? listIssue ?? null;
  const ref =
    toString(details?.identifier) ??
    toString(details?.issueIdentifier) ??
    cached?.identifier ??
    `Issue ${agentId(issueId)}`;
  const title =
    toString(details?.title) ??
    toString(details?.issueTitle) ??
    cached?.title ??
    null;
  return {
    ref,
    title,
    label: title ? `${ref} - ${truncate(title, 72)}` : ref,
    href: `/issues/${cached?.identifier ?? issueId}`,
  };
}

// ── Toast builders ───────────────────────────────────────────────────────

function describeChanges(details: Record<string, unknown> | null): string | null {
  if (!details) return null;
  const changes: string[] = [];
  if (typeof details.status === "string") changes.push(`status -> ${details.status.replace(/_/g, " ")}`);
  if (typeof details.priority === "string") changes.push(`priority -> ${details.priority}`);
  if (typeof details.assigneeAgentId === "string" || typeof details.assigneeUserId === "string") {
    changes.push("reassigned");
  } else if (details.assigneeAgentId === null || details.assigneeUserId === null) {
    changes.push("unassigned");
  }
  if (details.reopened === true) {
    const from = toString(details.reopenedFrom);
    changes.push(from ? `reopened from ${from.replace(/_/g, " ")}` : "reopened");
  }
  if (typeof details.title === "string") changes.push("title changed");
  if (typeof details.description === "string") changes.push("description changed");
  return changes.length > 0 ? changes.join(", ") : null;
}

function buildActivityToast(
  queryClient: QueryClient,
  projectId: string,
  payload: Record<string, unknown>,
  currentActor: { userId: string | null; agentId: string | null },
): ToastInput | null {
  const entityType = toString(payload.entityType);
  const entityId = toString(payload.entityId);
  const action = toString(payload.action);
  const details = toRecord(payload.details);
  const actorId = toString(payload.actorId);
  const actorType = toString(payload.actorType);

  if (entityType !== "issue" || !entityId || !action || !ISSUE_ACTIONS.has(action)) {
    return null;
  }

  const issue = resolveIssue(queryClient, projectId, entityId, details);
  const actor = resolveActor(queryClient, projectId, actorType, actorId);
  const isSelf =
    (actorType === "user" && !!currentActor.userId && actorId === currentActor.userId) ||
    (actorType === "agent" && !!currentActor.agentId && actorId === currentActor.agentId);
  if (isSelf) return null;

  if (action === "issue.created") {
    return {
      title: `${actor} created ${issue.ref}`,
      body: issue.title ? truncate(issue.title, 96) : undefined,
      tone: "success",
      action: { label: `View ${issue.ref}`, href: issue.href },
      dedupeKey: `activity:${action}:${entityId}`,
    };
  }

  if (action === "issue.updated") {
    if (toString(details?.source) === "comment") return null;
    const changeDesc = describeChanges(details);
    const body = changeDesc
      ? issue.title
        ? `${truncate(issue.title, 64)} - ${changeDesc}`
        : changeDesc
      : issue.title
        ? truncate(issue.title, 96)
        : issue.label;
    return {
      title: `${actor} updated ${issue.ref}`,
      body: truncate(body, 100),
      tone: "info",
      action: { label: `View ${issue.ref}`, href: issue.href },
      dedupeKey: `activity:${action}:${entityId}`,
    };
  }

  const commentId = toString(details?.commentId);
  const bodySnippet = toString(details?.bodySnippet);
  const reopened = details?.reopened === true;
  const updated = details?.updated === true;
  const reopenedFrom = toString(details?.reopenedFrom);
  const reopenedLabel = reopened
    ? reopenedFrom
      ? `reopened from ${reopenedFrom.replace(/_/g, " ")}`
      : "reopened"
    : null;
  const title = reopened
    ? `${actor} reopened and commented on ${issue.ref}`
    : updated
      ? `${actor} commented and updated ${issue.ref}`
      : `${actor} commented on ${issue.ref}`;
  const body = bodySnippet
    ? reopenedLabel
      ? `${reopenedLabel} - ${bodySnippet.replace(/^#+\s*/m, "").replace(/\n/g, " ")}`
      : bodySnippet.replace(/^#+\s*/m, "").replace(/\n/g, " ")
    : reopenedLabel
      ? issue.title
        ? `${reopenedLabel} - ${issue.title}`
        : reopenedLabel
      : issue.title ?? undefined;
  return {
    title,
    body: body ? truncate(body, 96) : undefined,
    tone: "info",
    action: { label: `View ${issue.ref}`, href: issue.href },
    dedupeKey: `activity:${action}:${entityId}:${commentId ?? "na"}`,
  };
}

function buildJoinRequestToast(payload: Record<string, unknown>): ToastInput | null {
  const entityType = toString(payload.entityType);
  const action = toString(payload.action);
  const entityId = toString(payload.entityId);
  const details = toRecord(payload.details);

  if (entityType !== "join_request" || !action || !entityId) return null;
  if (action !== "join.requested" && action !== "join.request_replayed") return null;

  const requestType = toString(details?.requestType);
  const label = requestType === "agent" ? "Agent" : "Someone";

  return {
    title: `${label} wants to join`,
    body: "A new join request is waiting for approval.",
    tone: "info",
    action: { label: "View inbox", href: "/inbox/new" },
    dedupeKey: `join-request:${entityId}`,
  };
}

function buildAgentToast(
  payload: Record<string, unknown>,
  nameOf: (id: string) => string | null,
): ToastInput | null {
  const agentId = toString(payload.agentId);
  const status = toString(payload.status);
  if (!agentId || !status || !AGENT_STATUSES.has(status)) return null;

  const tone = status === "error" ? "error" : "info";
  const name = nameOf(agentId) ?? `Agent ${agentId}`;
  const title = status === "running" ? `${name} started` : `${name} errored`;

  return {
    title,
    body: undefined,
    tone,
    action: { label: "View agent", href: `/agents/${agentId}` },
    dedupeKey: `agent-status:${agentId}:${status}`,
  };
}

function buildRunToast(
  payload: Record<string, unknown>,
  nameOf: (id: string) => string | null,
): ToastInput | null {
  const runId = toString(payload.runId);
  const agentId = toString(payload.agentId);
  const status = toString(payload.status);
  if (!runId || !agentId || !status || !TERMINAL_RUN_STATUSES.has(status)) return null;

  const error = toString(payload.error);
  const trigger = toString(payload.triggerDetail);
  const name = nameOf(agentId) ?? `Agent ${agentId}`;
  const tone = status === "succeeded" ? "success" : status === "cancelled" ? "warn" : "error";
  const label = status === "succeeded" ? "succeeded" : status === "failed" ? "failed" : status === "timed_out" ? "timed out" : "cancelled";
  const title = `${name} run ${label}`;

  let body: string | undefined;
  if (error) {
    body = truncate(error, 100);
  } else if (trigger) {
    body = `Trigger: ${trigger}`;
  }

  return {
    title,
    body,
    tone,
    ttlMs: status === "succeeded" ? 5000 : 7000,
    action: { label: "View run", href: `/agents/${agentId}/runs/${runId}` },
    dedupeKey: `run-status:${runId}:${status}`,
  };
}

// ── Query invalidation ───────────────────────────────────────────────────

function invalidateHeartbeats(
  qc: ReturnType<typeof useQueryClient>,
  projectId: string,
  payload: Record<string, unknown>,
) {
  qc.invalidateQueries({ queryKey: queryKeys.liveRuns(projectId) });
  qc.invalidateQueries({ queryKey: queryKeys.heartbeats(projectId) });
  qc.invalidateQueries({ queryKey: queryKeys.agents.list(projectId) });
  qc.invalidateQueries({ queryKey: queryKeys.dashboard(projectId) });
  qc.invalidateQueries({ queryKey: queryKeys.costs(projectId) });
  qc.invalidateQueries({ queryKey: queryKeys.sidebarBadges(projectId) });

  const agentId = toString(payload.agentId);
  if (agentId) {
    qc.invalidateQueries({ queryKey: queryKeys.agents.detail(agentId) });
    qc.invalidateQueries({ queryKey: queryKeys.heartbeats(projectId, agentId) });
  }
}

function invalidateActivity(
  qc: ReturnType<typeof useQueryClient>,
  projectId: string,
  payload: Record<string, unknown>,
) {
  qc.invalidateQueries({ queryKey: queryKeys.auditLog(projectId) });
  qc.invalidateQueries({ queryKey: queryKeys.dashboard(projectId) });
  qc.invalidateQueries({ queryKey: queryKeys.sidebarBadges(projectId) });

  const entityType = toString(payload.entityType);
  const entityId = toString(payload.entityId);

  if (entityType === "issue") {
    qc.invalidateQueries({ queryKey: queryKeys.issues.list(projectId) });
    if (entityId) {
      const details = toRecord(payload.details);
      const refs = resolveIssueRefs(qc, projectId, entityId, details);
      for (const ref of refs) {
        qc.invalidateQueries({ queryKey: queryKeys.issues.detail(ref) });
        qc.invalidateQueries({ queryKey: queryKeys.issues.comments(ref) });
        qc.invalidateQueries({ queryKey: queryKeys.issues.activity(ref) });
        qc.invalidateQueries({ queryKey: queryKeys.issues.runs(ref) });
        qc.invalidateQueries({ queryKey: queryKeys.issues.liveRuns(ref) });
        qc.invalidateQueries({ queryKey: queryKeys.issues.activeRun(ref) });
      }
    }
    return;
  }

  if (entityType === "agent") {
    qc.invalidateQueries({ queryKey: queryKeys.agents.list(projectId) });
    qc.invalidateQueries({ queryKey: queryKeys.org(projectId) });
    if (entityId) {
      qc.invalidateQueries({ queryKey: queryKeys.agents.detail(entityId) });
      qc.invalidateQueries({ queryKey: queryKeys.heartbeats(projectId, entityId) });
    }
    return;
  }

  if (entityType === "project") {
    qc.invalidateQueries({ queryKey: queryKeys.subprojects.list(projectId) });
    if (entityId) qc.invalidateQueries({ queryKey: queryKeys.subprojects.detail(entityId) });
    return;
  }

  if (entityType === "goal") {
    qc.invalidateQueries({ queryKey: queryKeys.milestones.list(projectId) });
    if (entityId) qc.invalidateQueries({ queryKey: queryKeys.milestones.detail(entityId) });
    return;
  }

  if (entityType === "approval") {
    qc.invalidateQueries({ queryKey: queryKeys.approvals.list(projectId) });
    return;
  }

  if (entityType === "join_request") {
    qc.invalidateQueries({ queryKey: queryKeys.access.joinRequests(projectId) });
    return;
  }

  if (entityType === "cost_event") {
    qc.invalidateQueries({ queryKey: queryKeys.costs(projectId) });
    return;
  }

  if (entityType === "project") {
    qc.invalidateQueries({ queryKey: queryKeys.projects.all });
  }
}

// ── Toast gating ─────────────────────────────────────────────────────────

interface ToastGate {
  cooldownHits: Map<string, number[]>;
  suppressUntil: number;
}

function shouldSuppress(gate: ToastGate, category: string): boolean {
  const now = Date.now();
  if (now < gate.suppressUntil) return true;
  const hits = gate.cooldownHits.get(category);
  if (!hits) return false;
  const recent = hits.filter((t) => now - t < TOAST_COOLDOWN_WINDOW_MS);
  gate.cooldownHits.set(category, recent);
  return recent.length >= TOAST_COOLDOWN_MAX;
}

function recordHit(gate: ToastGate, category: string) {
  const now = Date.now();
  const hits = gate.cooldownHits.get(category) ?? [];
  hits.push(now);
  gate.cooldownHits.set(category, hits);
}

function pushGated(
  gate: ToastGate,
  push: (t: ToastInput) => string | null,
  category: string,
  toast: ToastInput,
) {
  if (shouldSuppress(gate, category)) return;
  const id = push(toast);
  if (id !== null) recordHit(gate, category);
}

// ── Event handler ────────────────────────────────────────────────────────

function processEvent(
  queryClient: QueryClient,
  projectId: string,
  event: LiveEvent,
  pushToast: (t: ToastInput) => string | null,
  gate: ToastGate,
  currentActor: { userId: string | null; agentId: string | null },
) {
  if (event.projectId !== projectId) return;

  const nameOf = (id: string) => resolveAgentName(queryClient, projectId, id);
  const payload = event.payload ?? {};

  if (event.type === "heartbeat.run.queued" || event.type === "heartbeat.run.status") {
    invalidateHeartbeats(queryClient, projectId, payload);
    if (event.type === "heartbeat.run.status") {
      const toast = buildRunToast(payload, nameOf);
      if (toast) pushGated(gate, pushToast, "run-status", toast);
    }
    return;
  }

  if (event.type === "agent.status") {
    queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(projectId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(projectId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.org(projectId) });
    const agentId = toString(payload.agentId);
    if (agentId) queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(agentId) });
    const toast = buildAgentToast(payload, nameOf);
    if (toast) pushGated(gate, pushToast, "agent-status", toast);
    return;
  }

  if (event.type === "activity.logged") {
    invalidateActivity(queryClient, projectId, payload);
    const action = toString(payload.action);
    const toast =
      buildActivityToast(queryClient, projectId, payload, currentActor) ??
      buildJoinRequestToast(payload);
    if (toast) pushGated(gate, pushToast, `activity:${action ?? "unknown"}`, toast);
  }
}

// ── Provider ────────────────────────────────────────────────────────────

export function LiveUpdatesProvider({ children }: { children: ReactNode }) {
  const { selectedProjectId } = useProject();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const gateRef = useRef<ToastGate>({ cooldownHits: new Map(), suppressUntil: 0 });
  const { data: session } = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    retry: false,
  });
  const currentUserId = session?.user?.id ?? session?.session?.userId ?? null;

  useEffect(() => {
    if (!selectedProjectId) return;

    let closed = false;
    let attempts = 0;
    let reconnectTimer: number | null = null;
    let socket: WebSocket | null = null;

    const clearReconnect = () => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const scheduleReconnect = () => {
      if (closed) return;
      attempts += 1;
      const delay = Math.min(15000, 1000 * 2 ** Math.min(attempts - 1, 4));
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
    };

    const connect = () => {
      if (closed) return;
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const url = `${protocol}://${window.location.host}/api/projects/${encodeURIComponent(selectedProjectId)}/events/ws`;
      socket = new WebSocket(url);

      socket.onopen = () => {
        if (attempts > 0) {
          gateRef.current.suppressUntil = Date.now() + RECONNECT_SUPPRESS_MS;
        }
        attempts = 0;
      };

      socket.onmessage = (message) => {
        const raw = typeof message.data === "string" ? message.data : "";
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw) as LiveEvent;
          processEvent(queryClient, selectedProjectId, parsed, pushToast, gateRef.current, {
            userId: currentUserId,
            agentId: null,
          });
        } catch { /* ignore */ }
      };

      socket.onerror = () => socket?.close();

      socket.onclose = () => {
        if (closed) return;
        scheduleReconnect();
      };
    };

    connect();

    return () => {
      closed = true;
      clearReconnect();
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        socket.close(1000, "provider_unmount");
      }
    };
  }, [queryClient, selectedProjectId, pushToast, currentUserId]);

  return <>{children}</>;
}
