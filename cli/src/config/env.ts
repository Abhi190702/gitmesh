import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { config as loadDotenv, parse as parseEnvFileContents } from "dotenv";
import { resolveConfigPath } from "./store.js";

const JWT_SECRET_KEY = "GITMESH_AGENT_JWT_SECRET";

function resolveJwtEnvPath(configPath?: string): string {
  return path.resolve(path.dirname(resolveConfigPath(configPath)), ".env");
}

function parseEnv(content: string): Record<string, string> {
  try {
    return parseEnvFileContents(content);
  } catch {
    return {};
  }
}

function renderEnv(entries: Record<string, string>): string {
  const header = "# GitMesh environment variables\n# Written by gitmesh-agents setup\n";
  const lines = Object.entries(entries).map(([k, v]) => `${k}=${v}`);
  return header + lines.join("\n") + "\n";
}

const loadedPaths = new Set<string>();

export function resolveAgentJwtEnvFile(configPath?: string): string {
  return resolveJwtEnvPath(configPath);
}

export function loadAgentJwtEnvFile(filePath = resolveJwtEnvPath()): void {
  if (loadedPaths.has(filePath)) return;
  if (!fs.existsSync(filePath)) return;
  loadedPaths.add(filePath);
  loadDotenv({ path: filePath, override: false, quiet: true });
}

export function readAgentJwtSecretFromEnv(configPath?: string): string | null {
  loadAgentJwtEnvFile(resolveJwtEnvPath(configPath));
  const val = process.env[JWT_SECRET_KEY];
  return typeof val === "string" && val.trim().length > 0 ? val.trim() : null;
}

export function readAgentJwtSecretFromEnvFile(filePath = resolveJwtEnvPath()): string | null {
  if (!fs.existsSync(filePath)) return null;
  const entries = parseEnv(fs.readFileSync(filePath, "utf-8"));
  const val = entries[JWT_SECRET_KEY];
  return typeof val === "string" && val.trim().length > 0 ? val.trim() : null;
}

export function ensureAgentJwtSecret(configPath?: string): { secret: string; created: boolean } {
  const fromEnv = readAgentJwtSecretFromEnv(configPath);
  if (fromEnv) return { secret: fromEnv, created: false };

  const filePath = resolveJwtEnvPath(configPath);
  const fromFile = readAgentJwtSecretFromEnvFile(filePath);
  const secret = fromFile ?? randomBytes(32).toString("hex");
  const created = !fromFile;

  if (!fromFile) {
    writeAgentJwtEnv(secret, filePath);
  }

  return { secret, created };
}

export function writeAgentJwtEnv(secret: string, filePath = resolveJwtEnvPath()): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });

  const existing = fs.existsSync(filePath) ? parseEnv(fs.readFileSync(filePath, "utf-8")) : {};
  existing[JWT_SECRET_KEY] = secret;

  fs.writeFileSync(filePath, renderEnv(existing), { mode: 0o600 });
}
