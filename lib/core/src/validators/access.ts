import { z } from "zod";
import {
  AGENT_ADAPTER_TYPES,
  INVITE_JOIN_TYPES,
  JOIN_REQUEST_STATUSES,
  JOIN_REQUEST_TYPES,
  PERMISSION_KEYS,
} from "../constants.js";

export const createProjectInviteSchema = z.object({
  allowedJoinTypes: z.enum(INVITE_JOIN_TYPES).default("both"),
  defaultsPayload: z.record(z.string(), z.unknown()).optional().nullable(),
  agentMessage: z.string().max(4000).optional().nullable(),
});

export type CreateProjectInvite = z.infer<typeof createProjectInviteSchema>;

export const createGatewayInvitePromptSchema = z.object({
  agentMessage: z.string().max(4000).optional().nullable(),
});

export type CreateGatewayInvitePrompt = z.infer<
  typeof createGatewayInvitePromptSchema
>;

export const acceptInviteSchema = z.object({
  requestType: z.enum(JOIN_REQUEST_TYPES),
  agentName: z.string().min(1).max(120).optional(),
  adapterType: z.enum(AGENT_ADAPTER_TYPES).optional(),
  capabilities: z.string().max(4000).optional().nullable(),
  agentDefaultsPayload: z.record(z.string(), z.unknown()).optional().nullable(),
  // Gateway join compatibility fields accepted at top level.
  responsesWebhookUrl: z.string().max(4000).optional().nullable(),
  responsesWebhookMethod: z.string().max(32).optional().nullable(),
  responsesWebhookHeaders: z.record(z.string(), z.unknown()).optional().nullable(),
  gitmeshAentsApiUrl: z.string().max(4000).optional().nullable(),
  webhookAuthHeader: z.string().max(4000).optional().nullable(),
});

export type AcceptInvite = z.infer<typeof acceptInviteSchema>;

export const listJoinRequestsQuerySchema = z.object({
  status: z.enum(JOIN_REQUEST_STATUSES).optional(),
  requestType: z.enum(JOIN_REQUEST_TYPES).optional(),
});

export type ListJoinRequestsQuery = z.infer<typeof listJoinRequestsQuerySchema>;

export const claimJoinRequestApiKeySchema = z.object({
  claimSecret: z.string().min(16).max(256),
});

export type ClaimJoinRequestApiKey = z.infer<typeof claimJoinRequestApiKeySchema>;

export const updateMemberPermissionsSchema = z.object({
  grants: z.array(
    z.object({
      permissionKey: z.enum(PERMISSION_KEYS),
      scope: z.record(z.string(), z.unknown()).optional().nullable(),
    }),
  ),
});

export type UpdateMemberPermissions = z.infer<typeof updateMemberPermissionsSchema>;

export const updateUserProjectAccessSchema = z.object({
  projectIds: z.array(z.string().uuid()).default([]),
});

export type UpdateUserProjectAccess = z.infer<typeof updateUserProjectAccessSchema>;
