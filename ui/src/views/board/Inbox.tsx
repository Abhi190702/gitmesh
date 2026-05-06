import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { approvalsApi } from "../../api/approvals";
import { accessApi } from "../../api/access";
import { ApiError } from "../../api/client";
import { dashboardApi } from "../../api/dashboard";
import { issuesApi } from "../../api/issues";
import { agentsApi } from "../../api/agents";
import { heartbeatsApi } from "../../api/heartbeats";
import { useProject } from "../../context/ProjectContext";
import { useBreadcrumbs } from "../../context/BreadcrumbContext";
import { queryKeys } from "../../lib/queryKeys";
import { timeAgo } from "../../lib/timeAgo";
import type { Approval, HeartbeatRun, Issue, JoinRequest } from "@gitmesh/core";

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;
const RECENT_ISSUES_LIMIT = 100;
const FAILED_RUN_STATUSES = new Set(["failed", "timed_out"]);
const ACTIONABLE_APPROVAL_STATUSES = new Set(["pending", "revision_requested"]);
const DISMISSED_KEY = "gitmesh-agents:inbox:dismissed";

type Severity = "block" | "pending" | "allow";
type RowKind =
  | "failed_run"
  | "approval"
  | "join_request"
  | "alert"
  | "stale"
  | "mention";

type PillKey =
  | "is:unread"
  | "is:failed"
  | "is:approval"
  | "for:@me"
  | "since:24h"
  | "since:7d";

interface SignalRow {
  id: string;
  kind: RowKind;
  severity: Severity;
  verdict: string;
  ts: number;
  glyph: string;
  entity: string;
  context: string | null;
  actor: string | null;
  href: string;
  retry?: () => void;
  archive?: () => void;
  unread?: boolean;
  matches: string;
}

const KIND_LABEL: Record<RowKind, string> = {
  failed_run: "FAILED",
  approval: "AT GATE",
  join_request: "JOIN",
  alert: "ALERT",
  stale: "STALE",
  mention: "MENTION",
};

const SEVERITY_RANK: Record<Severity, number> = { block: 0, pending: 1, allow: 2 };

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
  } catch {
    /* noop */
  }
}

function useDismissedItems() {
  const [dismissed, setDismissed] = useState<Set<string>>(loadDismissed);
  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveDismissed(next);
      return next;
    });
  }, []);
  return { dismissed, dismiss };
}

function firstNonEmptyLine(value: string | null | undefined): string | null {
  if (!value) return null;
  const line = value.split("\n").map((c) => c.trim()).find(Boolean);
  return line ?? null;
}

function runFailureMessage(run: HeartbeatRun): string {
  return (
    firstNonEmptyLine(run.error) ??
    firstNonEmptyLine(run.stderrExcerpt) ??
    "exited with error"
  );
}

function getStaleIssues(issues: Issue[]): Issue[] {
  const now = Date.now();
  return issues.filter(
    (i) =>
      ["in_progress", "todo"].includes(i.status) &&
      now - new Date(i.updatedAt).getTime() > STALE_THRESHOLD_MS,
  );
}

function getLatestFailedRunsByAgent(runs: HeartbeatRun[]): HeartbeatRun[] {
  const sorted = [...runs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const latestByAgent = new Map<string, HeartbeatRun>();
  for (const run of sorted) {
    if (!latestByAgent.has(run.agentId)) latestByAgent.set(run.agentId, run);
  }
  return Array.from(latestByAgent.values()).filter((run) =>
    FAILED_RUN_STATUSES.has(run.status),
  );
}

function readIssueIdFromRun(run: HeartbeatRun): string | null {
  const ctx = run.contextSnapshot;
  if (!ctx) return null;
  const issueId = ctx["issueId"];
  if (typeof issueId === "string" && issueId.length > 0) return issueId;
  const taskId = ctx["taskId"];
  if (typeof taskId === "string" && taskId.length > 0) return taskId;
  return null;
}

function fmtTime(ts: number): string {
  if (!ts) return "--:--";
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function severityColor(sev: Severity): string {
  if (sev === "block") return "var(--verdict-block)";
  if (sev === "pending") return "var(--verdict-pending)";
  return "var(--verdict-allow)";
}

export function Inbox() {
  const { selectedProjectId } = useProject();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ tab?: string }>();
  const queryClient = useQueryClient();
  const { dismissed, dismiss } = useDismissedItems();

  const [actionError, setActionError] = useState<string | null>(null);
  const [pills, setPills] = useState<Set<PillKey>>(new Set());
  const [filterText, setFilterText] = useState("");
  const [focusedIdx, setFocusedIdx] = useState(0);
  const filterInputRef = useRef<HTMLInputElement | null>(null);
  const rowRefs = useRef<Array<HTMLDivElement | null>>([]);

  // URL tab segment seeds the corresponding pill (no 404)
  const urlTab = params.tab ?? location.pathname.split("/").pop() ?? "";
  useEffect(() => {
    if (urlTab === "unread") setPills((p) => new Set(p).add("is:unread"));
    else if (urlTab === "failed") setPills((p) => new Set(p).add("is:failed"));
    else if (urlTab === "approvals" || urlTab === "approval")
      setPills((p) => new Set(p).add("is:approval"));
    else if (urlTab === "mine") setPills((p) => new Set(p).add("for:@me"));
    // "all" or "new" or empty -> no preset
  }, [urlTab]);

  useEffect(() => {
    setBreadcrumbs([{ label: "Signal" }]);
  }, [setBreadcrumbs]);

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedProjectId!),
    queryFn: () => agentsApi.list(selectedProjectId!),
    enabled: !!selectedProjectId,
  });

  const { data: approvals, error: approvalsError } = useQuery({
    queryKey: queryKeys.approvals.list(selectedProjectId!),
    queryFn: () => approvalsApi.list(selectedProjectId!),
    enabled: !!selectedProjectId,
  });

  const { data: joinRequests = [] } = useQuery({
    queryKey: queryKeys.access.joinRequests(selectedProjectId!),
    queryFn: async () => {
      try {
        return await accessApi.listJoinRequests(selectedProjectId!, "pending_approval");
      } catch (err) {
        if (err instanceof ApiError && (err.status === 403 || err.status === 401)) {
          return [];
        }
        throw err;
      }
    },
    enabled: !!selectedProjectId,
    retry: false,
  });

  const { data: dashboard } = useQuery({
    queryKey: queryKeys.dashboard(selectedProjectId!),
    queryFn: () => dashboardApi.summary(selectedProjectId!),
    enabled: !!selectedProjectId,
  });

  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(selectedProjectId!),
    queryFn: () => issuesApi.list(selectedProjectId!),
    enabled: !!selectedProjectId,
  });

  const { data: touchedIssuesRaw = [] } = useQuery({
    queryKey: queryKeys.issues.listTouchedByMe(selectedProjectId!),
    queryFn: () =>
      issuesApi.list(selectedProjectId!, {
        touchedByUserId: "me",
        status: "backlog,todo,in_progress,in_review,blocked,done",
      }),
    enabled: !!selectedProjectId,
  });

  const { data: heartbeatRuns } = useQuery({
    queryKey: queryKeys.heartbeats(selectedProjectId!),
    queryFn: () => heartbeatsApi.list(selectedProjectId!),
    enabled: !!selectedProjectId,
  });

  const agentById = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of agents ?? []) map.set(a.id, a.name);
    return map;
  }, [agents]);

  const issueById = useMemo(() => {
    const map = new Map<string, Issue>();
    for (const i of issues ?? []) map.set(i.id, i);
    return map;
  }, [issues]);

  // ── Mutations ─────────────────────────────────────────────────────────
  const approveMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.approve(id),
    onSuccess: (_a, id) => {
      setActionError(null);
      queryClient.invalidateQueries({
        queryKey: queryKeys.approvals.list(selectedProjectId!),
      });
      navigate(`/approvals/${id}?resolved=approved`);
    },
    onError: (err) =>
      setActionError(err instanceof Error ? err.message : "Failed to approve"),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.reject(id),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({
        queryKey: queryKeys.approvals.list(selectedProjectId!),
      });
    },
    onError: (err) =>
      setActionError(err instanceof Error ? err.message : "Failed to reject"),
  });

  const approveJoinMutation = useMutation({
    mutationFn: (jr: JoinRequest) =>
      accessApi.approveJoinRequest(selectedProjectId!, jr.id),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({
        queryKey: queryKeys.access.joinRequests(selectedProjectId!),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.sidebarBadges(selectedProjectId!),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.agents.list(selectedProjectId!),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
    onError: (err) =>
      setActionError(
        err instanceof Error ? err.message : "Failed to approve join request",
      ),
  });

  const rejectJoinMutation = useMutation({
    mutationFn: (jr: JoinRequest) =>
      accessApi.rejectJoinRequest(selectedProjectId!, jr.id),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({
        queryKey: queryKeys.access.joinRequests(selectedProjectId!),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.sidebarBadges(selectedProjectId!),
      });
    },
    onError: (err) =>
      setActionError(
        err instanceof Error ? err.message : "Failed to reject join request",
      ),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => issuesApi.markRead(id),
    onSuccess: () => {
      if (selectedProjectId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.issues.listTouchedByMe(selectedProjectId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.issues.listUnreadTouchedByMe(selectedProjectId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.sidebarBadges(selectedProjectId),
        });
      }
    },
  });

  const retryRunMutation = useMutation({
    mutationFn: async (run: HeartbeatRun) => {
      const payload: Record<string, unknown> = {};
      const ctx = run.contextSnapshot as Record<string, unknown> | null;
      if (ctx) {
        if (typeof ctx.issueId === "string" && ctx.issueId) payload.issueId = ctx.issueId;
        if (typeof ctx.taskId === "string" && ctx.taskId) payload.taskId = ctx.taskId;
        if (typeof ctx.taskKey === "string" && ctx.taskKey) payload.taskKey = ctx.taskKey;
      }
      const result = await agentsApi.wakeup(run.agentId, {
        source: "on_demand",
        triggerDetail: "manual",
        reason: "retry_failed_run",
        payload,
      });
      if (!("id" in result)) {
        throw new Error("Retry skipped: agent not invokable.");
      }
      return result;
    },
    onSuccess: (newRun, run) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.heartbeats(run.projectId) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.heartbeats(run.projectId, run.agentId),
      });
      navigate(`/agents/${run.agentId}/runs/${newRun.id}`);
    },
    onError: (err) =>
      setActionError(err instanceof Error ? err.message : "Retry failed"),
  });

  // ── Compose unified rows ──────────────────────────────────────────────
  const rows = useMemo<SignalRow[]>(() => {
    const out: SignalRow[] = [];

    // failed runs
    for (const run of getLatestFailedRunsByAgent(heartbeatRuns ?? [])) {
      if (dismissed.has(`run:${run.id}`)) continue;
      const issueId = readIssueIdFromRun(run);
      const issue = issueId ? issueById.get(issueId) ?? null : null;
      const agentName = agentById.get(run.agentId) ?? `agent ${run.agentId.slice(0, 6)}`;
      const entity = issue
        ? `${issue.identifier ?? issue.id.slice(0, 8)} ${issue.title}`
        : `run ${run.id.slice(0, 8)}`;
      out.push({
        id: `run:${run.id}`,
        kind: "failed_run",
        severity: "block",
        verdict: "failed",
        ts: new Date(run.createdAt).getTime(),
        glyph: "▲",
        entity,
        context: runFailureMessage(run),
        actor: agentName,
        href: `/agents/${run.agentId}/runs/${run.id}`,
        retry: () => retryRunMutation.mutate(run),
        archive: () => dismiss(`run:${run.id}`),
        matches: `${entity} ${agentName} ${run.status} failed`.toLowerCase(),
      });
    }

    // approvals (actionable + recent decided)
    const allApprovals: Approval[] = [...(approvals ?? [])].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    for (const ap of allApprovals) {
      const actionable = ACTIONABLE_APPROVAL_STATUSES.has(ap.status);
      const requesterName = ap.requestedByAgentId
        ? agentById.get(ap.requestedByAgentId) ?? `agent ${ap.requestedByAgentId.slice(0, 6)}`
        : "user";
      out.push({
        id: `approval:${ap.id}`,
        kind: "approval",
        severity: actionable ? "pending" : "allow",
        verdict: actionable ? "pending" : ap.status,
        ts: new Date(ap.createdAt).getTime(),
        glyph: "◇",
        entity: `${ap.type} approval`,
        context: ap.decisionNote ?? null,
        actor: requesterName,
        href: `/approvals/${ap.id}`,
        archive: actionable ? () => rejectMutation.mutate(ap.id) : undefined,
        retry: actionable ? () => approveMutation.mutate(ap.id) : undefined,
        matches: `${ap.type} approval ${requesterName} ${ap.status}`.toLowerCase(),
      });
    }

    // join requests
    for (const jr of joinRequests) {
      const label =
        jr.requestType === "human"
          ? "human join"
          : `agent join${jr.agentName ? `: ${jr.agentName}` : ""}`;
      out.push({
        id: `join:${jr.id}`,
        kind: "join_request",
        severity: "pending",
        verdict: "pending",
        ts: new Date(jr.createdAt).getTime(),
        glyph: "◈",
        entity: label,
        context: jr.requestEmailSnapshot ?? jr.adapterType ?? jr.requestIp,
        actor: null,
        href: `/access`,
        retry: () => approveJoinMutation.mutate(jr),
        archive: () => rejectJoinMutation.mutate(jr),
        matches: `${label} ${jr.requestEmailSnapshot ?? ""} ${jr.adapterType ?? ""}`.toLowerCase(),
      });
    }

    // alerts
    if (
      dashboard &&
      dashboard.agents.error > 0 &&
      !dismissed.has("alert:agent-errors")
    ) {
      out.push({
        id: "alert:agent-errors",
        kind: "alert",
        severity: "block",
        verdict: "alert",
        ts: Date.now(),
        glyph: "!",
        entity: `${dashboard.agents.error} ${dashboard.agents.error === 1 ? "agent has" : "agents have"} errors`,
        context: "agent fleet",
        actor: null,
        href: `/agents`,
        archive: () => dismiss("alert:agent-errors"),
        matches: "alert agent errors".toLowerCase(),
      });
    }
    if (
      dashboard &&
      dashboard.costs.monthBudgetCents > 0 &&
      dashboard.costs.monthUtilizationPercent >= 80 &&
      !dismissed.has("alert:budget")
    ) {
      out.push({
        id: "alert:budget",
        kind: "alert",
        severity: "pending",
        verdict: "budget",
        ts: Date.now(),
        glyph: "!",
        entity: `budget ${dashboard.costs.monthUtilizationPercent}% utilization`,
        context: "monthly cap",
        actor: null,
        href: `/costs`,
        archive: () => dismiss("alert:budget"),
        matches: "alert budget cost".toLowerCase(),
      });
    }

    // stale work
    for (const issue of getStaleIssues(issues ?? [])) {
      if (dismissed.has(`stale:${issue.id}`)) continue;
      const assignee = issue.assigneeAgentId
        ? agentById.get(issue.assigneeAgentId) ??
          `agent ${issue.assigneeAgentId.slice(0, 6)}`
        : null;
      out.push({
        id: `stale:${issue.id}`,
        kind: "stale",
        severity: "pending",
        verdict: "stale",
        ts: new Date(issue.updatedAt).getTime(),
        glyph: "◷",
        entity: `${issue.identifier ?? issue.id.slice(0, 8)} ${issue.title}`,
        context: issue.status,
        actor: assignee,
        href: `/issues/${issue.identifier ?? issue.id}`,
        archive: () => dismiss(`stale:${issue.id}`),
        matches: `${issue.identifier ?? ""} ${issue.title} ${issue.status} ${assignee ?? ""}`.toLowerCase(),
      });
    }

    // mentions / my recent issues with unread activity
    const sortedTouched = [...touchedIssuesRaw]
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )
      .slice(0, RECENT_ISSUES_LIMIT);
    for (const issue of sortedTouched) {
      const ts = issue.lastExternalCommentAt
        ? new Date(issue.lastExternalCommentAt).getTime()
        : new Date(issue.updatedAt).getTime();
      out.push({
        id: `mention:${issue.id}`,
        kind: "mention",
        severity: issue.isUnreadForMe ? "pending" : "allow",
        verdict: issue.isUnreadForMe ? "unread" : "read",
        ts,
        glyph: issue.isUnreadForMe ? "●" : "·",
        entity: `${issue.identifier ?? issue.id.slice(0, 8)} ${issue.title}`,
        context: issue.lastExternalCommentAt ? "new activity" : "updated",
        actor: null,
        href: `/issues/${issue.identifier ?? issue.id}`,
        archive: issue.isUnreadForMe
          ? () => markReadMutation.mutate(issue.id)
          : undefined,
        unread: issue.isUnreadForMe ?? false,
        matches: `${issue.identifier ?? ""} ${issue.title}`.toLowerCase(),
      });
    }

    return out;
  }, [
    heartbeatRuns,
    approvals,
    joinRequests,
    dashboard,
    issues,
    touchedIssuesRaw,
    issueById,
    agentById,
    dismissed,
    retryRunMutation,
    approveMutation,
    rejectMutation,
    approveJoinMutation,
    rejectJoinMutation,
    markReadMutation,
    dismiss,
  ]);

  // ── Filters ───────────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    const now = Date.now();
    const text = filterText.trim().toLowerCase();
    return rows.filter((r) => {
      if (pills.has("is:unread") && !r.unread && r.kind !== "approval") {
        // unread = approvals at gate OR mention rows flagged unread OR failed runs
        if (r.kind !== "failed_run") return false;
      }
      if (pills.has("is:failed") && r.kind !== "failed_run") return false;
      if (pills.has("is:approval") && r.kind !== "approval") return false;
      if (pills.has("for:@me")) {
        if (r.kind !== "mention" && r.kind !== "stale" && r.kind !== "approval")
          return false;
      }
      if (pills.has("since:24h") && now - r.ts > 24 * 60 * 60 * 1000)
        return false;
      if (pills.has("since:7d") && now - r.ts > 7 * 24 * 60 * 60 * 1000)
        return false;
      if (text && !r.matches.includes(text)) return false;
      return true;
    });
  }, [rows, pills, filterText]);

  // ── Sort: severity desc → recency desc ────────────────────────────────
  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const sev = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      if (sev !== 0) return sev;
      return b.ts - a.ts;
    });
  }, [filteredRows]);

  // ── Group consecutive by kind ─────────────────────────────────────────
  type Group = { kind: RowKind; rows: SignalRow[] };
  const groups = useMemo<Group[]>(() => {
    const out: Group[] = [];
    for (const r of sortedRows) {
      const last = out[out.length - 1];
      if (last && last.kind === r.kind) last.rows.push(r);
      else out.push({ kind: r.kind, rows: [r] });
    }
    return out;
  }, [sortedRows]);

  // flat index mapping for keyboard nav
  const flatRows = sortedRows;
  const totalEvents = rows.length;
  const unreadCount = rows.filter(
    (r) => r.kind === "approval" || r.unread || r.kind === "failed_run",
  ).length;
  const failedCount = rows.filter((r) => r.kind === "failed_run").length;

  // ── Keyboard ──────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (e.key === "/" && !inField) {
        e.preventDefault();
        filterInputRef.current?.focus();
        return;
      }
      if (inField) {
        if (e.key === "Escape") {
          (target as HTMLInputElement).blur();
        }
        return;
      }
      if (flatRows.length === 0) return;

      if (e.key === "j") {
        e.preventDefault();
        setFocusedIdx((i) => Math.min(flatRows.length - 1, i + 1));
      } else if (e.key === "k") {
        e.preventDefault();
        setFocusedIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const row = flatRows[focusedIdx];
        if (row) navigate(row.href);
      } else if (e.key === "r") {
        e.preventDefault();
        const row = flatRows[focusedIdx];
        if (row?.retry) row.retry();
      } else if (e.key === "e") {
        e.preventDefault();
        const row = flatRows[focusedIdx];
        if (row?.archive) row.archive();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [flatRows, focusedIdx, navigate]);

  useEffect(() => {
    if (focusedIdx >= flatRows.length) setFocusedIdx(Math.max(0, flatRows.length - 1));
  }, [flatRows.length, focusedIdx]);

  useEffect(() => {
    rowRefs.current[focusedIdx]?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [focusedIdx]);

  // ── Render ────────────────────────────────────────────────────────────
  if (!selectedProjectId) {
    return (
      <div
        className="flex min-h-[40vh] items-center justify-center text-sm"
        style={{ fontFamily: "var(--font-mono)", color: "var(--text-tertiary)" }}
      >
        select a project to see signal.
      </div>
    );
  }

  const togglePill = (k: PillKey) => {
    setPills((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  let runningIdx = -1;

  return (
    <div
      className="flex flex-col gap-4 pb-12"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {/* Header strip */}
      <div className="flex items-center justify-between border-b border-border pb-2">
        <span className="text-sm tracking-tight text-foreground">signal</span>
        <span className="text-xs tabular-nums text-text-tertiary">
          {totalEvents} events · {unreadCount} unread · {failedCount} failed
        </span>
      </div>

      {/* Pill bar */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            "is:unread",
            "is:failed",
            "is:approval",
            "for:@me",
            "since:24h",
            "since:7d",
          ] as PillKey[]
        ).map((k) => {
          const active = pills.has(k);
          return (
            <button
              key={k}
              type="button"
              onClick={() => togglePill(k)}
              className="rounded-sm px-2 py-0.5 text-[11px] tracking-tight transition-colors"
              style={{
                border: active
                  ? "1px solid var(--verdict-attested)"
                  : "1px solid transparent",
                color: active
                  ? "var(--verdict-attested)"
                  : "var(--text-tertiary)",
                background: active ? "transparent" : "transparent",
              }}
            >
              {k}
            </button>
          );
        })}

        <div className="ml-auto flex min-w-[220px] flex-1 items-center gap-1.5 border-b border-border px-1 py-0.5 sm:max-w-sm sm:flex-none">
          <span className="text-text-tertiary">{">"}</span>
          <input
            ref={filterInputRef}
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="filter ..."
            className="w-full bg-transparent text-[12px] outline-none placeholder:text-text-tertiary"
            style={{ fontFamily: "var(--font-mono)" }}
          />
          {filterText && (
            <button
              type="button"
              onClick={() => setFilterText("")}
              className="text-[10px] text-text-tertiary hover:text-foreground"
              aria-label="clear filter"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {approvalsError && (
        <div
          className="text-xs"
          style={{ color: "var(--verdict-block)" }}
        >
          {approvalsError.message}
        </div>
      )}
      {actionError && (
        <div
          className="text-xs"
          style={{ color: "var(--verdict-block)" }}
        >
          {actionError}
        </div>
      )}

      {/* Body */}
      {sortedRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-xs text-text-tertiary">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: "var(--verdict-attested)" }}
          />
          <span>signal is quiet. mesh ok.</span>
        </div>
      ) : (
        <div className="flex flex-col">
          {groups.map((g, gi) => (
            <div key={`g-${gi}-${g.kind}`} className="flex flex-col">
              <div
                className="flex h-5 items-center gap-2 border-b border-border text-[10px] tracking-[0.18em] text-text-tertiary"
                style={{ textTransform: "uppercase" }}
              >
                <span>{KIND_LABEL[g.kind]}</span>
                <span>·</span>
                <span className="tabular-nums">{g.rows.length}</span>
              </div>
              {g.rows.map((row) => {
                runningIdx += 1;
                const idx = runningIdx;
                const isFocused = idx === focusedIdx;
                return (
                  <div
                    key={row.id}
                    ref={(el) => {
                      rowRefs.current[idx] = el;
                    }}
                    onClick={() => {
                      setFocusedIdx(idx);
                      navigate(row.href);
                    }}
                    onMouseEnter={() => setFocusedIdx(idx)}
                    className="group flex h-7 cursor-pointer items-center gap-2 border-b border-border pl-2 pr-2 text-[12px] transition-colors"
                    style={{
                      borderLeft: `2px solid ${severityColor(row.severity)}`,
                      background: isFocused ? "var(--surface-2)" : "transparent",
                    }}
                  >
                    <span className="w-10 shrink-0 tabular-nums text-text-tertiary">
                      {fmtTime(row.ts)}
                    </span>
                    <span
                      className="verdict-chip shrink-0"
                      data-verdict={
                        row.severity === "block"
                          ? "block"
                          : row.severity === "pending"
                            ? "pending"
                            : "allow"
                      }
                    >
                      {row.verdict}
                    </span>
                    <span
                      className="w-3 shrink-0 text-center"
                      style={{ color: severityColor(row.severity) }}
                    >
                      {row.glyph}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-foreground">
                      {row.entity}
                    </span>
                    {row.context && (
                      <span className="hidden min-w-0 max-w-[28%] shrink truncate text-text-tertiary md:inline">
                        · {row.context}
                      </span>
                    )}
                    {row.actor && (
                      <span className="hidden shrink-0 truncate text-text-tertiary lg:inline">
                        · {row.actor}
                      </span>
                    )}
                    <span className="shrink-0 tabular-nums text-text-tertiary">
                      · {timeAgo(new Date(row.ts).toISOString())}
                    </span>
                    <span className="ml-1 hidden shrink-0 items-center gap-1 group-hover:flex">
                      {row.retry && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            row.retry?.();
                          }}
                          className="rounded-sm px-1.5 py-0.5 text-[10px] text-text-tertiary hover:text-foreground"
                          style={{ border: "1px solid var(--border)" }}
                        >
                          retry
                        </button>
                      )}
                      {row.archive && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            row.archive?.();
                          }}
                          className="rounded-sm px-1.5 py-0.5 text-[10px] text-text-tertiary hover:text-foreground"
                          style={{ border: "1px solid var(--border)" }}
                        >
                          archive
                        </button>
                      )}
                      <span
                        className="rounded-sm px-1.5 py-0.5 text-[10px]"
                        style={{
                          border: "1px solid var(--border)",
                          color: "var(--verdict-attested)",
                        }}
                      >
                        open
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Footer keyboard hint */}
      <div className="pointer-events-none fixed bottom-3 right-4 text-[10px] text-text-tertiary">
        j/k · ↵ open · r retry · e archive · / filter
      </div>
    </div>
  );
}

export default Inbox;
