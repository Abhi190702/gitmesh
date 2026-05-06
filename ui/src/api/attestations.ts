import { api } from "./client";

export interface AttestationFetchResponse {
  activityId: string;
  projectId: string;
  algorithm: string;
  signedPayload: string;
  payloadHash: string;
  signature: string;
  signingKeyVersion: number;
  createdAt: string;
  publicKey: string;
  verifyInstructions: string[];
}

export interface AttestationPublicKeyResponse {
  projectId: string;
  algorithm: string;
  publicKey: string;
  keyVersion: number;
}

export type AttestationStatusKind = "attested" | "pending" | "missing";

export interface AttestationStatusBulkResponse {
  statuses: Record<string, AttestationStatusKind>;
}

export const attestationsApi = {
  publicKey: (projectId: string) =>
    api.get<AttestationPublicKeyResponse>(`/projects/${projectId}/attestations/public-key`),

  /**
   * Bulk status lookup so the timeline can render badges for a batch
   * of activity rows in one request instead of N per-row 404s.
   */
  bulkStatus: (
    projectId: string,
    activityIds: string[],
  ): Promise<AttestationStatusBulkResponse> =>
    api.post<AttestationStatusBulkResponse>(
      `/projects/${projectId}/attestations/status`,
      { activityIds },
    ),
};
