import type { CostSummary, CostByAgent } from "@gitmesh/core";
import { api } from "./client";

export interface CostByProject {
  projectId: string | null;
  projectName: string | null;
  costCents: number;
  inputTokens: number;
  outputTokens: number;
}

function dateParams(from?: string, to?: string): string {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const costsApi = {
  summary: (projectId: string, from?: string, to?: string) =>
    api.get<CostSummary>(`/projects/${projectId}/costs/summary${dateParams(from, to)}`),
  byAgent: (projectId: string, from?: string, to?: string) =>
    api.get<CostByAgent[]>(`/projects/${projectId}/costs/by-agent${dateParams(from, to)}`),
  byProject: (projectId: string, from?: string, to?: string) =>
    api.get<CostByProject[]>(`/projects/${projectId}/costs/by-project${dateParams(from, to)}`),
};
