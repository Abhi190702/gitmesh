import type { ProjectSecret, SecretProviderDescriptor, SecretProvider } from "@gitmesh/core";
import { api } from "./client";

export const secretsApi = {
  list: (projectId: string) => api.get<ProjectSecret[]>(`/projects/${projectId}/secrets`),
  providers: (projectId: string) =>
    api.get<SecretProviderDescriptor[]>(`/projects/${projectId}/secret-providers`),
  create: (
    projectId: string,
    data: {
      name: string;
      value: string;
      provider?: SecretProvider;
      description?: string | null;
      externalRef?: string | null;
    },
  ) => api.post<ProjectSecret>(`/projects/${projectId}/secrets`, data),
  rotate: (id: string, data: { value: string; externalRef?: string | null }) =>
    api.post<ProjectSecret>(`/secrets/${id}/rotate`, data),
  update: (
    id: string,
    data: { name?: string; description?: string | null; externalRef?: string | null },
  ) => api.patch<ProjectSecret>(`/secrets/${id}`, data),
  remove: (id: string) => api.delete<{ ok: true }>(`/secrets/${id}`),
};
