/**
 * Secret provider module contracts.
 * Each provider implements version creation and resolution for stored secrets.
 */

/** SHA-256 hex digest of the secret value */
export type SecretDigest = string;

/** Arbitrary key-value metadata attached to a stored secret version */
export type SecretMetadata = Record<string, unknown>;

/** Base marker interface for stored secret version material */
export interface StoredSecretVersionMaterial {
  [key: string]: unknown;
}

/** Opaque material returned by a provider on version creation */
export interface SecretMaterial {
  /** Provider-specific secret material blob */
  payload: SecretMetadata;
}

export interface SecretProviderDescriptor {
  id: SecretProvider;
  label: string;
  requiresExternalRef: boolean;
}

export type SecretProvider = "local_encrypted" | "aws_secrets_manager" | "gcp_secret_manager" | "vault";

export interface SecretVersion {
  material: SecretMaterial;
  digest: SecretDigest;
  externalRef: string | null;
}

export interface SecretProviderModule {
  readonly id: SecretProvider;
  readonly descriptor: SecretProviderDescriptor;
  createVersion(input: { value: string; externalRef: string | null }): Promise<SecretVersion>;
  resolveVersion(input: { material: SecretMaterial; externalRef: string | null }): Promise<string>;
}
