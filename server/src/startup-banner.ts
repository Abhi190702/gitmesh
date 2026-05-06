import { existsSync, readFileSync } from "node:fs";
import { resolveGitmeshConfigPath, resolveGitmeshAgentsEnvPath } from "./paths.js";
import type { DeploymentExposure, DeploymentMode } from "@gitmesh/core";
import { parse as parseDotEnv } from "dotenv";

export type UiMode = "none" | "static" | "vite-dev";

export interface PostgresExternalConfig {
  mode: "external-postgres";
  connectionString: string;
}

export interface PostgresEmbeddedConfig {
  mode: "embedded-postgres";
  dataDir: string;
  port: number;
}

export interface StartupBannerOptions {
  host: string;
  listenPort: number;
  requestedPort: number;
  uiMode: UiMode;
  deploymentMode: DeploymentMode;
  deploymentExposure: DeploymentExposure;
  authReady: boolean;
  db: PostgresExternalConfig | PostgresEmbeddedConfig;
  migrationSummary: string;
  heartbeatSchedulerEnabled: boolean;
  heartbeatSchedulerIntervalMs: number;
  databaseBackupEnabled: boolean;
  databaseBackupIntervalMinutes: number;
  databaseBackupRetentionDays: number;
  databaseBackupDir: string;
}

// Simple color formatting for terminal
const formatters = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
};

const formatText = (text: string, color: keyof typeof formatters) => `${formatters[color]}${text}${formatters.reset}`;
const formatField = (label: string, value: string) => `${formatText(label.padEnd(18), "dim")} ${value}`;

const hideDbCredentials = (connStr: string): string => {
  try {
    const parsedUrl = new URL(connStr);
    const username = parsedUrl.username || "user";
    return `${parsedUrl.protocol}//${username}:***@${parsedUrl.host}${parsedUrl.pathname}`;
  } catch {
    return "<invalid DATABASE_URL>";
  }
};

const checkAgentJwtConfiguration = (envFile: string): { ok: boolean; msg: string } => {
  if (process.env.GITMESH_AGENT_JWT_SECRET?.trim()) {
    return { ok: true, msg: "set" };
  }

  if (existsSync(envFile)) {
    const envVars = parseDotEnv(readFileSync(envFile, "utf-8"));
    const secret = envVars.GITMESH_AGENT_JWT_SECRET;
    if (typeof secret === "string" && secret.trim()) {
      return { ok: false, msg: `found in ${envFile} but not loaded` };
    }
  }

  return { ok: false, msg: "missing (run `pnpm gitmesh-agents setup`)" };
};

export const printStartupBanner = (opts: StartupBannerOptions): void => {
  const hostAddr = opts.host === "0.0.0.0" ? "localhost" : opts.host;
  const serverUrl = `http://${hostAddr}:${opts.listenPort}`;
  const apiEndpoint = `${serverUrl}/api`;
  
  const uiEndpoint = opts.uiMode === "none" ? "disabled" : serverUrl;
  const cfgPath = resolveGitmeshConfigPath();
  const envPath = resolveGitmeshAgentsEnvPath();
  const jwtConfig = checkAgentJwtConfiguration(envPath);

  const formatDbMode = () => opts.db.mode === "embedded-postgres" ? formatText("embedded-postgres", "green") : formatText("external-postgres", "yellow");
  
  const formatUiMode = () => {
    switch (opts.uiMode) {
      case "vite-dev": return formatText("vite-dev-middleware", "cyan");
      case "static": return formatText("static-ui", "magenta");
      default: return formatText("headless-api", "yellow");
    }
  };

  const actualPortInfo = opts.requestedPort === opts.listenPort
    ? `${opts.listenPort}`
    : `${opts.listenPort} ${formatText(`(requested ${opts.requestedPort})`, "dim")}`;

  const databaseConnectionInfo = opts.db.mode === "embedded-postgres"
    ? `${opts.db.dataDir} ${formatText(`(pg:${opts.db.port})`, "dim")}`
    : hideDbCredentials(opts.db.connectionString);

  const heartbeatStatus = opts.heartbeatSchedulerEnabled
    ? `enabled ${formatText(`(${opts.heartbeatSchedulerIntervalMs}ms)`, "dim")}`
    : formatText("disabled", "yellow");
    
  const backupStatus = opts.databaseBackupEnabled
    ? `enabled ${formatText(`(every ${opts.databaseBackupIntervalMinutes}m, keep ${opts.databaseBackupRetentionDays}d)`, "dim")}`
    : formatText("disabled", "yellow");

  const brandLogo = [
    formatText(" ██████╗ ██╗████████╗███╗   ███╗███████╗███████╗██╗  ██╗", "cyan"),
    formatText("██╔════╝ ██║╚══██╔══╝████╗ ████║██╔════╝██╔════╝██║  ██║", "cyan"),
    formatText("██║  ███╗██║   ██║   ██╔████╔██║█████╗  ███████╗███████║", "cyan"),
    formatText("██║   ██║██║   ██║   ██║╚██╔╝██║██╔══╝  ╚════██║██╔══██║", "cyan"),
    formatText("╚██████╔╝██║   ██║   ██║ ╚═╝ ██║███████╗███████║██║  ██║", "cyan"),
    formatText(" ╚═════╝ ╚═╝   ╚═╝   ╚═╝     ╚═╝╚══════╝╚══════╝╚═╝  ╚═╝", "cyan"),
  ];

  const outputLines = [
    "",
    ...brandLogo,
    formatText("  ────────────────────────────────────────────────────────", "blue"),
    formatField("Mode", `${formatDbMode()}  |  ${formatUiMode()}`),
    formatField("Deploy", `${opts.deploymentMode} (${opts.deploymentExposure})`),
    formatField("Auth", opts.authReady ? formatText("ready", "green") : formatText("not-ready", "yellow")),
    formatField("Server", actualPortInfo),
    formatField("API", `${apiEndpoint} ${formatText(`(health: ${apiEndpoint}/health)`, "dim")}`),
    formatField("UI", uiEndpoint),
    formatField("Database", databaseConnectionInfo),
    formatField("Migrations", opts.migrationSummary),
    formatField("Agent JWT", jwtConfig.ok ? formatText(jwtConfig.msg, "green") : formatText(jwtConfig.msg, "yellow")),
    formatField("Heartbeat", heartbeatStatus),
    formatField("DB Backup", backupStatus),
    formatField("Backup Dir", opts.databaseBackupDir),
    formatField("Config", cfgPath),
    jwtConfig.ok ? null : formatText("  ────────────────────────────────────────────────────────", "yellow"),
    formatText("  ────────────────────────────────────────────────────────", "blue"),
    "",
  ];

  console.log(outputLines.filter((l): l is string => l !== null).join("\n"));
};
