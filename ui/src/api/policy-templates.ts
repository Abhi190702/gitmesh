import { api } from "./client";
import type { AgentPolicy } from "./policies";

export interface PolicyTemplateMetadata {
  slug: string;
  title: string;
  whatItDoes: string;
  whatItProtects: string;
  whenToUse: string;
  auditExample: string;
  videoUrl: string | null;
  defaultEnabled: boolean;
}

export interface PolicyTemplatePolicy {
  name: string;
  description: string | null;
  actionPattern: string;
  conditions: Record<string, unknown> | null;
  effect: "allow" | "block" | "require_approval";
  effectConfig: Record<string, unknown> | null;
  priority: number;
  enabled: boolean;
}

export interface PolicyTemplate {
  metadata: PolicyTemplateMetadata;
  policies: PolicyTemplatePolicy[];
  sourcePath: string;
}

export interface PolicyTemplateListResponse {
  templates: PolicyTemplate[];
  errors: { slug: string | null; sourcePath: string; error: string }[];
}

export interface PolicyTemplateInstallResponse {
  template: PolicyTemplate;
  created: AgentPolicy[];
}

export const policyTemplatesApi = {
  list: () => api.get<PolicyTemplateListResponse>("/policy-templates"),
  get: (slug: string) => api.get<PolicyTemplate>(`/policy-templates/${encodeURIComponent(slug)}`),
  install: (
    projectId: string,
    body: { slug: string; overrides?: { name?: string; priority?: number } },
  ) => api.post<PolicyTemplateInstallResponse>(`/projects/${projectId}/policies/install-template`, body),
};
