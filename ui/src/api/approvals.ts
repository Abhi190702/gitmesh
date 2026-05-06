import type { Approval, ApprovalComment, Issue } from "@gitmesh/core";
import { api } from "./client";

export const approvalsApi = {
  list: (projectId: string, status?: string) =>
    api.get<Approval[]>(
      `/projects/${projectId}/approvals${status ? `?status=${encodeURIComponent(status)}` : ""}`,
    ),
  create: (projectId: string, data: Record<string, unknown>) =>
    api.post<Approval>(`/projects/${projectId}/approvals`, data),
  get: (id: string) => api.get<Approval>(`/approvals/${id}`),
  approve: (id: string, decisionNote?: string) =>
    api.post<Approval>(`/approvals/${id}/approve`, { decisionNote }),
  reject: (id: string, decisionNote?: string) =>
    api.post<Approval>(`/approvals/${id}/reject`, { decisionNote }),
  requestRevision: (id: string, decisionNote?: string) =>
    api.post<Approval>(`/approvals/${id}/request-revision`, { decisionNote }),
  resubmit: (id: string, payload?: Record<string, unknown>) =>
    api.post<Approval>(`/approvals/${id}/resubmit`, { payload }),
  listComments: (id: string) => api.get<ApprovalComment[]>(`/approvals/${id}/comments`),
  addComment: (id: string, body: string) =>
    api.post<ApprovalComment>(`/approvals/${id}/comments`, { body }),
  listIssues: (id: string) => api.get<Issue[]>(`/approvals/${id}/issues`),
};
