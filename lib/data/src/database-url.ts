import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FALLBACK_LOCAL_DATABASE_URL = "postgres://gitmesh:gitmesh@localhost:5433/gitmesh";

function getRepoRootEnvPath(): string {
  return path.resolve(fileURLToPath(new URL("../../../.env", import.meta.url)));
}

function readDatabaseUrlFromEnvFile(filePath: string): string | null {
  if (!existsSync(filePath)) return null;

  const contents = readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    if (key !== "DATABASE_URL") continue;

    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    return value.trim() || null;
  }

  return null;
}

export function resolveDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL?.trim();
  if (envUrl) return envUrl;

  const fileUrl = readDatabaseUrlFromEnvFile(getRepoRootEnvPath());
  if (fileUrl) return fileUrl;

  return FALLBACK_LOCAL_DATABASE_URL;
}
