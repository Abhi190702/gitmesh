/**
 * Shared fixtures for the GitMesh Agents CLI test suite.
 *
 * The helpers below centralise three repeated patterns:
 *   1. Creating an isolated temp directory for context/config files.
 *   2. Snapshotting and restoring `process.env` between tests.
 *   3. Building canonical context-store payloads with sensible defaults.
 *
 * Tests use the fixtures so a single `setupCliEnv()` call produces a clean
 * environment per case, instead of each test repeating the same boilerplate.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach } from "vitest";
import {
  defaultClientContext,
  writeContext,
  type ClientContext,
  type ClientContextProfile,
} from "../../client/context.js";

const ENV_KEYS_TO_RESET = [
  "GITMESH_API_URL",
  "GITMESH_API_KEY",
  "GITMESH_PROJECT_ID",
  "GITMESH_HOME",
  "GITMESH_CONFIG",
  "GITMESH_CONTEXT",
  "GITMESH_INSTANCE_ID",
] as const;

/** Make an isolated temp file path beneath the system temp dir. */
export function makeTempFilePath(filename: string, prefix = "gitmesh-agents-cli-"): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return path.join(dir, filename);
}

/** Make an isolated temp directory and return its absolute path. */
export function makeTempDir(prefix = "gitmesh-agents-cli-"): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/**
 * Reset env for each test in the current `describe` block. Pass `extraKeys`
 * to scrub additional vars beyond the default set.
 */
export function setupCliEnv(extraKeys: readonly string[] = []): void {
  let snapshot: NodeJS.ProcessEnv = {};

  beforeEach(() => {
    snapshot = { ...process.env };
    for (const key of [...ENV_KEYS_TO_RESET, ...extraKeys]) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    process.env = { ...snapshot };
  });
}

// ---------------------------------------------------------------------------
// Canonical context payloads
// ---------------------------------------------------------------------------

/** Build a context store with a single named profile preconfigured. */
export function buildSingleProfileContext(
  profileName: string,
  profile: ClientContextProfile,
): ClientContext {
  return {
    version: 1,
    currentProfile: profileName,
    profiles: { [profileName]: profile },
  };
}

/** Persist the supplied context payload to a fresh temp file and return the path. */
export function seedContextFile(context: ClientContext, filename = "context.json"): string {
  const filePath = makeTempFilePath(filename);
  writeContext(context, filePath);
  return filePath;
}

/** Empty default context written to a temp file (used as a "no profile" baseline). */
export function seedEmptyContextFile(): string {
  return seedContextFile(defaultClientContext());
}
