import { loadConfig, type Config } from "../../config.js";
import { createStorageProviderFromConfig } from "./provider-registry.js";
import { createStorageService } from "./service.js";
import type { StorageService } from "./types.js";

let cachedService: StorageService | null = null;
let cachedConfigSig: string | null = null;

function configFingerprint(cfg: Config): string {
  return JSON.stringify({
    storageProvider: cfg.storageProvider,
    localDiskBaseDir: cfg.storageLocalDiskBaseDir,
    s3: {
      bucket: cfg.storageS3Bucket,
      region: cfg.storageS3Region,
      endpoint: cfg.storageS3Endpoint,
      prefix: cfg.storageS3Prefix,
      forcePathStyle: cfg.storageS3ForcePathStyle,
    },
  });
}

export function createStorageServiceFromConfig(cfg: Config): StorageService {
  return createStorageService(createStorageProviderFromConfig(cfg));
}

export function getStorageService(): StorageService {
  const cfg = loadConfig();
  const sig = configFingerprint(cfg);
  if (cachedConfigSig !== sig || !cachedService) {
    cachedService = createStorageServiceFromConfig(cfg);
    cachedConfigSig = sig;
  }
  return cachedService;
}

export type { StorageService, PutFileResult } from "./types.js";
