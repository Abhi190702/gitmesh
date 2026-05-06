import { api } from "./client";

export interface ForgeWebhook {
  id: string;
  projectId: string;
  forgeProvider: string;
  forgeOwner: string;
  forgeRepo: string;
  forgeWebhookId: string | null;
  webhookSecret?: string;
  events: string[];
  active: boolean;
  lastError: string | null;
  lastDeliveredAt: string | null;
  deliveryStatus: string;
  createdAt: string;
}

export interface ConnectGitHubPayload {
  repoUrl: string;
  token: string;
}

export interface ConnectGitHubResult {
  forgeOwner: string;
  forgeRepo: string;
  secretId: string;
}

/**
 * Connect a GitHub repository to a project by URL + PAT.
 * Stores the PAT as an encrypted secret and updates project forge fields.
 */
export const forgeApi = {
  /**
   * PATCH /api/projects/:projectId/forge
   * Connect or update GitHub connection for a project.
   */
  connectGitHub: (projectId: string, payload: ConnectGitHubPayload) =>
    api.patch<ConnectGitHubResult>(`/projects/${projectId}/forge`, payload),

  /**
   * GET /api/projects/:projectId/forge/webhooks
   * List registered webhooks for a project.
   */
  getWebhookStatus: (projectId: string) =>
    api.get<ForgeWebhook[]>(`/projects/${projectId}/forge/webhooks`),

  /**
   * POST /api/projects/:projectId/forge/webhooks
   * Register a new webhook with the forge.
   */
  registerWebhook: (
    projectId: string,
    data: {
      forgeProvider: string;
      forgeOwner: string;
      forgeRepo: string;
      events?: string[];
    },
  ) =>
    api.post<ForgeWebhook>(`/projects/${projectId}/forge/webhooks`, data),

  /**
   * DELETE /api/projects/:projectId/forge/webhooks/:webhookId
   * Deactivate/delete a webhook.
   */
  deleteWebhook: (projectId: string, webhookId: string) =>
    api.delete<{ ok: boolean }>(
      `/projects/${projectId}/forge/webhooks/${webhookId}`,
    ),

  /**
   * POST /api/projects/:projectId/forge/webhooks/:webhookId/test
   * Simulate a test event to the registered webhook.
   */
  testWebhook: (projectId: string, webhookId: string) =>
    api.post<{ ok: boolean }>(
      `/projects/${projectId}/forge/webhooks/${webhookId}/test`,
      {},
    ),

  /**
   * POST /api/projects/:projectId/forge/webhooks/:webhookId/rotate
   * Rotate the webhook secret and return the updated webhook.
   */
  rotateWebhook: (projectId: string, webhookId: string) =>
    api.post<ForgeWebhook>(
      `/projects/${projectId}/forge/webhooks/${webhookId}/rotate`,
      {},
    ),
};
