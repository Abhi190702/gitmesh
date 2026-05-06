import type { Subproject, SubprojectWorkspace } from "@gitmesh/core";
import { api } from "./client";

function withProjectScope(path: string, projectId?: string) {
  if (!projectId) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}projectId=${encodeURIComponent(projectId)}`;
}

function subprojectPath(id: string, projectId?: string, suffix = "") {
  return withProjectScope(`/subprojects/${encodeURIComponent(id)}${suffix}`, projectId);
}

export const subprojectsApi = {
  list: (projectId: string) => api.get<Subproject[]>(`/projects/${projectId}/subprojects`),
  get: (id: string, projectId?: string) => api.get<Subproject>(subprojectPath(id, projectId)),
  create: (projectId: string, data: Record<string, unknown>) =>
    api.post<Subproject>(`/projects/${projectId}/subprojects`, data),
  update: (id: string, data: Record<string, unknown>, projectId?: string) =>
    api.patch<Subproject>(subprojectPath(id, projectId), data),
  listWorkspaces: (subprojectId: string, projectId?: string) =>
    api.get<SubprojectWorkspace[]>(subprojectPath(subprojectId, projectId, "/workspaces")),
  createWorkspace: (subprojectId: string, data: Record<string, unknown>, projectId?: string) =>
    api.post<SubprojectWorkspace>(subprojectPath(subprojectId, projectId, "/workspaces"), data),
  updateWorkspace: (subprojectId: string, workspaceId: string, data: Record<string, unknown>, projectId?: string) =>
    api.patch<SubprojectWorkspace>(
      subprojectPath(subprojectId, projectId, `/workspaces/${encodeURIComponent(workspaceId)}`),
      data,
    ),
  removeWorkspace: (subprojectId: string, workspaceId: string, projectId?: string) =>
    api.delete<SubprojectWorkspace>(subprojectPath(subprojectId, projectId, `/workspaces/${encodeURIComponent(workspaceId)}`)),
  remove: (id: string, projectId?: string) => api.delete<Subproject>(subprojectPath(id, projectId)),
};
