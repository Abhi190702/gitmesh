import type { Issue, IssueComment, IssueLabel } from "@gitmesh/core";
import { api } from "./client";

/** PR status derived from forgeState */
export type PullRequestStatus = "open" | "merged" | "closed";

export interface PullRequest {
  id: string;
  title: string;
  description: string | null;
  status: PullRequestStatus;
  forgeState: string | null;
  forgePrNumber: number | null;
  forgeUrl: string | null;
  identifier: string | null;
  projectId: string;
  subprojectId: string | null;
  goalId?: string | null;
  authorUserId: string | null;
  authorAgentId: string | null;
  assigneeAgentId: string | null;
  assigneeUserId: string | null;
  labelIds: string[];
  labels: IssueLabel[];
  linkedIssues?: Array<{
    id: string;
    identifier: string | null;
    title: string;
    status: string;
    priority: string;
    forgeIssueNumber: number | null;
  }>;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface PullRequestListFilters {
  status?: "open" | "merged" | "closed" | "all";
}

export const pullRequestsApi = {
  list: (projectId: string, filters?: PullRequestListFilters) => {
    const params = new URLSearchParams();
    if (filters?.status && filters.status !== "all") params.set("status", filters.status);
    const qs = params.toString();
    return api.get<PullRequest[]>(`/projects/${projectId}/pull-requests${qs ? `?${qs}` : ""}`);
  },

  get: (id: string) => api.get<PullRequest>(`/pull-requests/${id}`),

  update: (id: string, data: { action: string }) =>
    api.patch<{ ok: boolean; status: string }>(`/pull-requests/${id}`, data),
};
