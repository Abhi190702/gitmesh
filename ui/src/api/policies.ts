import { api } from "./client";

export type AgentPolicy = {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  version: number;
  enabled: boolean;
  priority: number;
  actionPattern: string;
  conditions: Record<string, unknown> | null;
  effect: "allow" | "block" | "require_approval";
  effectConfig: Record<string, unknown> | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export const policiesApi = {
  list: (projectId: string) => api.get<AgentPolicy[]>(`/projects/${projectId}/policies`),
  get: (projectId: string, policyId: string) =>
    api.get<AgentPolicy>(`/projects/${projectId}/policies/${policyId}`),
  create: (
    projectId: string,
    data: {
      name: string;
      description?: string;
      actionPattern: string;
      effect: "allow" | "block" | "require_approval";
      priority?: number;
      conditions?: Record<string, unknown>;
      effectConfig?: Record<string, unknown>;
    },
  ) => api.post<AgentPolicy>(`/projects/${projectId}/policies`, data),
  update: (
    projectId: string,
    policyId: string,
    data: {
      name?: string;
      description?: string;
      actionPattern?: string;
      effect?: "allow" | "block" | "require_approval";
      priority?: number;
      enabled?: boolean;
      conditions?: Record<string, unknown>;
      effectConfig?: Record<string, unknown>;
    },
  ) => api.patch<AgentPolicy>(`/projects/${projectId}/policies/${policyId}`, data),
  delete: (projectId: string, policyId: string) =>
    api.delete<{ ok: true }>(`/projects/${projectId}/policies/${policyId}`),
};
