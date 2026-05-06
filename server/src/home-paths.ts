import os from "node:os";
import path from "node:path";

const DEFAULT_INSTANCE_ID = "default";
const INSTANCE_ID_RE = /^[a-zA-Z0-9_-]+$/;
const PATH_SEGMENT_RE = /^[a-zA-Z0-9_-]+$/;

function expandHomePrefix(value: string): string {
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.resolve(os.homedir(), value.slice(2));
  return value;
}

export function resolveGitmeshAgentsHomeDir(): string {
  const envHome = process.env.GITMESH_HOME?.trim();
  if (envHome) return path.resolve(expandHomePrefix(envHome));
  return path.resolve(os.homedir(), ".gitmesh-agents");
}

export function resolveGitmeshAgentsInstanceId(): string {
  const raw = process.env.GITMESH_INSTANCE_ID?.trim() || DEFAULT_INSTANCE_ID;
  if (!INSTANCE_ID_RE.test(raw)) {
    throw new Error(`Invalid GITMESH_INSTANCE_ID '${raw}'.`);
  }
  return raw;
}

export function resolveGitmeshAgentsInstanceRoot(): string {
  return path.resolve(resolveGitmeshAgentsHomeDir(), "instances", resolveGitmeshAgentsInstanceId());
}

export function resolveDefaultConfigPath(): string {
  return path.resolve(resolveGitmeshAgentsInstanceRoot(), "gitmesh-agents.json");
}

export function resolveDefaultEmbeddedPostgresDir(): string {
  return path.resolve(resolveGitmeshAgentsInstanceRoot(), "db");
}

export function resolveDefaultLogsDir(): string {
  return path.resolve(resolveGitmeshAgentsInstanceRoot(), "logs");
}

export function resolveDefaultSecretsKeyFilePath(): string {
  return path.resolve(resolveGitmeshAgentsInstanceRoot(), "secrets", "master.key");
}

export function resolveDefaultStorageDir(): string {
  return path.resolve(resolveGitmeshAgentsInstanceRoot(), "data", "storage");
}

export function resolveDefaultBackupDir(): string {
  return path.resolve(resolveGitmeshAgentsInstanceRoot(), "data", "backups");
}

export function resolveDefaultAgentWorkspaceDir(agentId: string): string {
  const trimmed = agentId.trim();
  if (!PATH_SEGMENT_RE.test(trimmed)) {
    throw new Error(`Invalid agent id for workspace path '${agentId}'.`);
  }
  return path.resolve(resolveGitmeshAgentsInstanceRoot(), "workspaces", trimmed);
}

export function resolveHomeAwarePath(value: string): string {
  return path.resolve(expandHomePrefix(value));
}
