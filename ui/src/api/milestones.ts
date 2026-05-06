import type { Goal } from "@gitmesh/core";
import { api } from "./client";

export const milestonesApi = {
  list: (projectId: string) => api.get<Goal[]>(`/projects/${projectId}/milestones`),
  get: (id: string) => api.get<Goal>(`/milestones/${id}`),
  create: (projectId: string, data: Record<string, unknown>) =>
    api.post<Goal>(`/projects/${projectId}/milestones`, data),
  update: (id: string, data: Record<string, unknown>) => api.patch<Goal>(`/milestones/${id}`, data),
  remove: (id: string) => api.delete<Goal>(`/milestones/${id}`),
};
