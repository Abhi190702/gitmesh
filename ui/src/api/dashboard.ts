import type { DashboardSummary } from "@gitmesh/core";
import { api } from "./client";

export const dashboardApi = {
  summary: (projectId: string) => api.get<DashboardSummary>(`/projects/${projectId}/dashboard`),
};
