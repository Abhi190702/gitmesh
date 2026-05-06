export const queryKeys = {
  projects: {
    all: ["projects"] as const,
    detail: (id: string) => ["projects", id] as const,
    stats: ["projects", "stats"] as const,
  },
  agents: {
    list: (projectId: string) => ["agents", projectId] as const,
    detail: (id: string) => ["agents", "detail", id] as const,
    runtimeState: (id: string) => ["agents", "runtime-state", id] as const,
    taskSessions: (id: string) => ["agents", "task-sessions", id] as const,
    keys: (agentId: string) => ["agents", "keys", agentId] as const,
    configRevisions: (agentId: string) => ["agents", "config-revisions", agentId] as const,
    adapterModels: (projectId: string, adapterType: string) =>
      ["agents", projectId, "adapter-models", adapterType] as const,
  },
  issues: {
    list: (projectId: string) => ["issues", projectId] as const,
    search: (projectId: string, q: string, subprojectId?: string) =>
      ["issues", projectId, "search", q, subprojectId ?? "__all-subprojects__"] as const,
    listAssignedToMe: (projectId: string) => ["issues", projectId, "assigned-to-me"] as const,
    listTouchedByMe: (projectId: string) => ["issues", projectId, "touched-by-me"] as const,
    listUnreadTouchedByMe: (projectId: string) => ["issues", projectId, "unread-touched-by-me"] as const,
    labels: (projectId: string) => ["issues", projectId, "labels"] as const,
    listByProject: (projectId: string, subprojectId: string) =>
      ["issues", projectId, "subproject", subprojectId] as const,
    detail: (id: string) => ["issues", "detail", id] as const,
    comments: (issueId: string) => ["issues", "comments", issueId] as const,
    attachments: (issueId: string) => ["issues", "attachments", issueId] as const,
    activity: (issueId: string) => ["issues", "activity", issueId] as const,
    runs: (issueId: string) => ["issues", "runs", issueId] as const,
    approvals: (issueId: string) => ["issues", "approvals", issueId] as const,
    liveRuns: (issueId: string) => ["issues", "live-runs", issueId] as const,
    activeRun: (issueId: string) => ["issues", "active-run", issueId] as const,
  },
  subprojects: {
    list: (projectId: string) => ["subprojects", projectId] as const,
    detail: (id: string) => ["subprojects", "detail", id] as const,
  },
  milestones: {
    list: (projectId: string) => ["milestones", projectId] as const,
    detail: (id: string) => ["milestones", "detail", id] as const,
  },
  approvals: {
    list: (projectId: string, status?: string) =>
      ["approvals", projectId, status] as const,
    detail: (approvalId: string) => ["approvals", "detail", approvalId] as const,
    comments: (approvalId: string) => ["approvals", "comments", approvalId] as const,
    issues: (approvalId: string) => ["approvals", "issues", approvalId] as const,
  },
  pullRequests: {
    list: (projectId: string, status?: string) =>
      ["pull-requests", projectId, status ?? "all"] as const,
    detail: (id: string) => ["pull-requests", "detail", id] as const,
  },
  access: {
    joinRequests: (projectId: string, status: string = "pending_approval") =>
      ["access", "join-requests", projectId, status] as const,
    invite: (token: string) => ["access", "invite", token] as const,
  },
  auth: {
    session: ["auth", "session"] as const,
  },
  health: ["health"] as const,
  secrets: {
    list: (projectId: string) => ["secrets", projectId] as const,
    providers: (projectId: string) => ["secret-providers", projectId] as const,
  },
  policies: (projectId: string) => ["policies", projectId] as const,
  assets: (projectId: string) => ["assets", projectId] as const,
  dashboard: (projectId: string) => ["dashboard", projectId] as const,
  sidebarBadges: (projectId: string) => ["sidebar-badges", projectId] as const,
  auditLog: (projectId: string) => ["audit-log", projectId] as const,
  costs: (projectId: string, from?: string, to?: string) =>
    ["costs", projectId, from, to] as const,
  heartbeats: (projectId: string, agentId?: string) =>
    ["heartbeats", projectId, agentId] as const,
  liveRuns: (projectId: string) => ["live-runs", projectId] as const,
  runIssues: (runId: string) => ["run-issues", runId] as const,
  org: (projectId: string) => ["org", projectId] as const,
  github: {
    repos: ["github", "repos"] as const,
    user: ["github", "user"] as const,
  },
};
