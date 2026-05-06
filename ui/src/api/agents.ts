import type {
  Agent,
  AdapterEnvironmentTestResult,
  AgentKeyCreated,
  AgentRuntimeState,
  AgentTaskSession,
  HeartbeatRun,
  Approval,
  AgentConfigRevision,
} from "@gitmesh/core";
import { isUuidLike, normalizeAgentUrlKey } from "@gitmesh/core";
import { ApiError, api } from "./client";

export interface AgentKey {
  id: string;
  name: string;
  createdAt: Date;
  revokedAt: Date | null;
}

export interface AdapterModel {
  id: string;
  label: string;
}

export interface ClaudeLoginResult {
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  loginUrl: string | null;
  stdout: string;
  stderr: string;
}

export interface OrgNode {
  id: string;
  name: string;
  role: string;
  status: string;
  reports: OrgNode[];
}

export interface AgentEnableResponse {
  agent: Agent;
  approval: Approval | null;
}

function withProjectScope(path: string, projectId?: string) {
  if (!projectId) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}projectId=${encodeURIComponent(projectId)}`;
}

function agentPath(id: string, projectId?: string, suffix = "") {
  return withProjectScope(`/agents/${encodeURIComponent(id)}${suffix}`, projectId);
}

export const agentsApi = {
  list: (projectId: string) => api.get<Agent[]>(`/projects/${projectId}/agents`),
  org: (projectId: string) => api.get<OrgNode[]>(`/projects/${projectId}/org`),
  listConfigurations: (projectId: string) =>
    api.get<Record<string, unknown>[]>(`/projects/${projectId}/agent-configurations`),
  get: async (id: string, projectId?: string) => {
    try {
      return await api.get<Agent>(agentPath(id, projectId));
    } catch (error) {
      // Backward-compat fallback: if backend shortname lookup reports ambiguity,
      // resolve using project agent list while ignoring terminated agents.
      if (
        !(error instanceof ApiError) ||
        error.status !== 409 ||
        !projectId ||
        isUuidLike(id)
      ) {
        throw error;
      }

      const urlKey = normalizeAgentUrlKey(id);
      if (!urlKey) throw error;

      const agents = await api.get<Agent[]>(`/projects/${projectId}/agents`);
      const matches = agents.filter(
        (agent) => agent.status !== "terminated" && normalizeAgentUrlKey(agent.urlKey) === urlKey,
      );
      if (matches.length !== 1) throw error;
      return api.get<Agent>(agentPath(matches[0]!.id, projectId));
    }
  },
  getConfiguration: (id: string, projectId?: string) =>
    api.get<Record<string, unknown>>(agentPath(id, projectId, "/configuration")),
  listConfigRevisions: (id: string, projectId?: string) =>
    api.get<AgentConfigRevision[]>(agentPath(id, projectId, "/config-revisions")),
  getConfigRevision: (id: string, revisionId: string, projectId?: string) =>
    api.get<AgentConfigRevision>(agentPath(id, projectId, `/config-revisions/${revisionId}`)),
  rollbackConfigRevision: (id: string, revisionId: string, projectId?: string) =>
    api.post<Agent>(agentPath(id, projectId, `/config-revisions/${revisionId}/rollback`), {}),
  create: (projectId: string, data: Record<string, unknown>) =>
    api.post<Agent>(`/projects/${projectId}/agents`, data),
  enable: (projectId: string, data: Record<string, unknown>) =>
    api.post<AgentEnableResponse>(`/projects/${projectId}/agent-enables`, data),
  update: (id: string, data: Record<string, unknown>, projectId?: string) =>
    api.patch<Agent>(agentPath(id, projectId), data),
  updatePermissions: (id: string, data: { canCreateAgents: boolean }, projectId?: string) =>
    api.patch<Agent>(agentPath(id, projectId, "/permissions"), data),
  pause: (id: string, projectId?: string) => api.post<Agent>(agentPath(id, projectId, "/pause"), {}),
  resume: (id: string, projectId?: string) => api.post<Agent>(agentPath(id, projectId, "/resume"), {}),
  terminate: (id: string, projectId?: string) => api.post<Agent>(agentPath(id, projectId, "/terminate"), {}),
  remove: (id: string, projectId?: string) => api.delete<{ ok: true }>(agentPath(id, projectId)),
  bulkDelete: (projectId: string, ids: string[]) =>
    api.post<{ ok: true; deletedIds: string[]; skippedIds: string[] }>(
      `/projects/${encodeURIComponent(projectId)}/agents/bulk-delete`,
      { ids },
    ),
  listKeys: (id: string, projectId?: string) => api.get<AgentKey[]>(agentPath(id, projectId, "/keys")),
  createKey: (id: string, name: string, projectId?: string) =>
    api.post<AgentKeyCreated>(agentPath(id, projectId, "/keys"), { name }),
  revokeKey: (agentId: string, keyId: string, projectId?: string) =>
    api.delete<{ ok: true }>(agentPath(agentId, projectId, `/keys/${encodeURIComponent(keyId)}`)),
  runtimeState: (id: string, projectId?: string) =>
    api.get<AgentRuntimeState>(agentPath(id, projectId, "/runtime-state")),
  taskSessions: (id: string, projectId?: string) =>
    api.get<AgentTaskSession[]>(agentPath(id, projectId, "/task-sessions")),
  resetSession: (id: string, taskKey?: string | null, projectId?: string) =>
    api.post<void>(agentPath(id, projectId, "/runtime-state/reset-session"), { taskKey: taskKey ?? null }),
  adapterModels: (projectId: string, type: string) =>
    api.get<AdapterModel[]>(
      `/projects/${encodeURIComponent(projectId)}/adapters/${encodeURIComponent(type)}/models`,
    ),
  testEnvironment: (
    projectId: string,
    type: string,
    data: { adapterConfig: Record<string, unknown> },
  ) =>
    api.post<AdapterEnvironmentTestResult>(
      `/projects/${projectId}/adapters/${type}/test-environment`,
      data,
    ),
  invoke: (id: string, projectId?: string) => api.post<HeartbeatRun>(agentPath(id, projectId, "/heartbeat/invoke"), {}),
  wakeup: (
    id: string,
    data: {
      source?: "timer" | "assignment" | "on_demand" | "automation";
      triggerDetail?: "manual" | "ping" | "callback" | "system";
      reason?: string | null;
      payload?: Record<string, unknown> | null;
      idempotencyKey?: string | null;
    },
    projectId?: string,
  ) => api.post<HeartbeatRun | { status: "skipped" }>(agentPath(id, projectId, "/wakeup"), data),
  loginWithClaude: (id: string, projectId?: string) =>
    api.post<ClaudeLoginResult>(agentPath(id, projectId, "/claude-login"), {}),
};
