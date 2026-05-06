import type {
  Project,
  ProjectPortabilityExportResult,
  ProjectPortabilityImportRequest,
  ProjectPortabilityImportResult,
  ProjectPortabilityPreviewRequest,
  ProjectPortabilityPreviewResult,
} from "@gitmesh/core";
import { api } from "./client";

export type ProjectStats = Record<string, { agentCount: number; issueCount: number }>;

export const projectsApi = {
  list: () => api.get<Project[]>("/projects"),
  get: (projectId: string) => api.get<Project>(`/projects/${projectId}`),
  stats: () => api.get<ProjectStats>("/projects/stats"),
  create: (data: { name: string; description?: string | null; budgetMonthlyCents?: number }) =>
    api.post<Project>("/projects", data),
  update: (
    projectId: string,
    data: Partial<
      Pick<
        Project,
        "name" | "description" | "status" | "budgetMonthlyCents" | "requireOperatorApprovalForNewAgents" | "brandColor" | "forgeOwner" | "forgeRepo" | "forgeProvider"
      >
    >,
  ) => api.patch<Project>(`/projects/${projectId}`, data),
  archive: (projectId: string) => api.post<Project>(`/projects/${projectId}/archive`, {}),
  remove: (projectId: string) => api.delete<{ ok: true }>(`/projects/${projectId}`),
  exportBundle: (projectId: string, data: { include?: { project?: boolean; agents?: boolean } }) =>
    api.post<ProjectPortabilityExportResult>(`/projects/${projectId}/export`, data),
  importPreview: (data: ProjectPortabilityPreviewRequest) =>
    api.post<ProjectPortabilityPreviewResult>("/projects/import/preview", data),
  importBundle: (data: ProjectPortabilityImportRequest) =>
    api.post<ProjectPortabilityImportResult>("/projects/import", data),
};
