/**
 * Stub secret providers for external secret stores.
 *
 * These providers are compiled into the binary but are not functional in a
 * self-hosted GitMesh Agents deployment. They exist so that configuration
 * schema validation passes; runtime calls will throw an error pointing
 * operators toward proper configuration of their chosen provider.
 *
 * To enable a provider, set the `secrets.provider` field in your
 * gitmesh-agents.json config to the desired value and ensure the
 * corresponding environment variables or credentials are available.
 */

import { unprocessable } from "../../errors.js";
import type { SecretProviderModule } from "./types.js";

type ExternalProviderId = "aws_secrets_manager" | "gcp_secret_manager" | "vault";

function stubProvider(id: ExternalProviderId, displayName: string): SecretProviderModule {
  return {
    id,
    descriptor: { id, label: displayName, requiresExternalRef: true },
    async createVersion() {
      throw unprocessable(`${id} provider is not available in self-hosted deployments`);
    },
    async resolveVersion() {
      throw unprocessable(`${id} provider is not available in self-hosted deployments`);
    },
  };
}

export const awsSecretsManagerProvider = stubProvider("aws_secrets_manager", "AWS Secrets Manager");
export const gcpSecretManagerProvider = stubProvider("gcp_secret_manager", "GCP Secret Manager");
export const vaultProvider = stubProvider("vault", "HashiCorp Vault");
