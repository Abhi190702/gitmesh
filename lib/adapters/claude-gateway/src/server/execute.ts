import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AdapterExecutionContext, AdapterExecutionResult } from "@gitmesh/adapter-sdk";
import { getPlaybooksForRole } from "@gitmesh/adapter-sdk";
import type { RunProcessResult } from "@gitmesh/adapter-sdk/server-utils";
import {
  asString,
  asNumber,
  asBoolean,
  asStringArray,
  parseObject,
  parseJson,
  buildGitmeshEnv,
  redactEnvForLogs,
  ensureAbsoluteDirectory,
  ensureCommandResolvable,
  ensurePathInEnv,
  renderTemplate,
  runChildProcess,
} from "@gitmesh/adapter-sdk/server-utils";
import {
  parseClaudeStreamJson,
  describeClaudeFailure,
  detectClaudeLoginRequired,
  isClaudeMaxTurnsResult,
  isClaudeUnknownSessionError,
} from "./parse.js";

const __moduleDir = path.dirname(fileURLToPath(import.meta.url));
const GITMESH_PLAYBOOK_CANDIDATES = [
  path.resolve(__moduleDir, "../../playbooks"),
  path.resolve(__moduleDir, "../../../../../playbooks"),
];

interface ProviderConfig {
  name: string;
  baseUrl: string;
  scheme: "bearer" | "key"; // "bearer" for Authorization: Bearer, "key" for x-api-key
}

const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  anthropic: {
    name: "anthropic",
    baseUrl: "https://api.anthropic.com",
    scheme: "bearer",
  },
  minimax: {
    name: "minimax",
    baseUrl: "https://api.minimax.io/anthropic",
    scheme: "key",
  },
};

async function resolveGitmeshPlaybooksDir(): Promise<string | null> {
  for (const candidate of GITMESH_PLAYBOOK_CANDIDATES) {
    const isDir = await fs.stat(candidate).then((s) => s.isDirectory()).catch(() => false);
    if (isDir) return candidate;
  }
  return null;
}

async function buildPlaybooksDir(role?: string): Promise<string> {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "gitmesh-agents-playbooks-"));
  const target = path.join(tmp, ".claude", "playbooks");
  await fs.mkdir(target, { recursive: true });
  const playbooksDir = await resolveGitmeshPlaybooksDir();
  if (!playbooksDir) return tmp;
  const entries = await fs.readdir(playbooksDir, { withFileTypes: true });
  const allowedPlaybooks = role ? new Set(getPlaybooksForRole(role)) : null;
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (allowedPlaybooks && !allowedPlaybooks.has(entry.name)) continue;
    await fs.symlink(
      path.join(playbooksDir, entry.name),
      path.join(target, entry.name),
    );
  }
  return tmp;
}

interface ClaudeGatewayExecutionInput {
  runId: string;
  agent: AdapterExecutionContext["agent"];
  config: Record<string, unknown>;
  context: Record<string, unknown>;
  authToken?: string;
}

interface ClaudeGatewayRuntimeConfig {
  command: string;
  cwd: string;
  workspaceId: string | null;
  workspaceRepoUrl: string | null;
  workspaceRepoRef: string | null;
  env: Record<string, string>;
  timeoutSec: number;
  graceSec: number;
  extraArgs: string[];
}

function buildLoginResult(input: {
  proc: RunProcessResult;
  loginUrl: string | null;
}): AdapterExecutionResult {
  return {
    exitCode: input.proc.exitCode,
    signal: input.proc.signal,
    timedOut: input.proc.timedOut,
    errorMessage: input.loginUrl ? "Login required" : null,
    errorCode: input.loginUrl ? "LOGIN_REQUIRED" : null,
    errorMeta: input.loginUrl ? { loginUrl: input.loginUrl } : undefined,
  };
}

function hasNonEmptyEnvValue(env: Record<string, string>, key: string): boolean {
  const raw = env[key];
  return typeof raw === "string" && raw.trim().length > 0;
}

/**
 * Resolve provider configuration with support for custom providers
 */
function resolveProviderConfig(providerName: string, customBaseUrl?: string): ProviderConfig {
  const providerLower = providerName.toLowerCase();
  
  if (PROVIDER_CONFIGS[providerLower]) {
    const preset = PROVIDER_CONFIGS[providerLower];
    if (customBaseUrl) {
      return { ...preset, baseUrl: customBaseUrl };
    }
    return preset;
  }
  
  // Custom/unknown provider - assume Anthropic-compatible with key auth
  return {
    name: providerLower,
    baseUrl: customBaseUrl || "https://api.example.com",
    scheme: "key",
  };
}

async function buildClaudeGatewayRuntimeConfig(input: ClaudeGatewayExecutionInput): Promise<ClaudeGatewayRuntimeConfig> {
  const { runId, agent, config, context, authToken } = input;

  const command = asString(config.command, "claude");
  const workspaceContext = parseObject(context.gitmeshWorkspace);
  const workspaceCwd = asString(workspaceContext.cwd, "");
  const workspaceSource = asString(workspaceContext.source, "");
  const workspaceId = asString(workspaceContext.workspaceId, "") || null;
  const workspaceRepoUrl = asString(workspaceContext.repoUrl, "") || null;
  const workspaceRepoRef = asString(workspaceContext.repoRef, "") || null;
  const workspaceHints = Array.isArray(context.gitmeshWorkspaces)
    ? context.gitmeshWorkspaces.filter(
        (value): value is Record<string, unknown> => typeof value === "object" && value !== null,
      )
    : [];
  const configuredCwd = asString(config.cwd, "");
  const useConfiguredInsteadOfAgentHome = workspaceSource === "agent_home" && configuredCwd.length > 0;
  const effectiveWorkspaceCwd = useConfiguredInsteadOfAgentHome ? "" : workspaceCwd;
  const cwd = effectiveWorkspaceCwd || configuredCwd || process.cwd();
  await ensureAbsoluteDirectory(cwd, { createIfMissing: true });

  const envConfig = parseObject(config.env);
  const hasExplicitApiKey =
    typeof envConfig.GITMESH_API_KEY === "string" && envConfig.GITMESH_API_KEY.trim().length > 0;
  const env: Record<string, string> = { ...buildGitmeshEnv(agent) };
  env.GITMESH_RUN_ID = runId;

  // **Provider routing logic**
  const providerName = asString(config.provider, "anthropic");
  const apiKey = asString(config.apiKey, "");
  const customBaseUrl = asString(config.baseUrl, "");
  const providerConfig = resolveProviderConfig(providerName, customBaseUrl);

  if (!apiKey) {
    throw new Error(
      `[claude_gateway] Missing required configuration: apiKey. Provider: ${providerName}`
    );
  }

  // Set Anthropic-compatible auth
  env.ANTHROPIC_API_KEY = apiKey;
  env.ANTHROPIC_BASE_URL = providerConfig.baseUrl;

  // Handle model name mapping
  const modelMap = parseObject(config.modelMap);
  if (typeof modelMap === "object" && modelMap !== null) {
    env.GITMESH_CLAUDE_GATEWAY_MODEL_MAP = JSON.stringify(modelMap);
  }

  const wakeTaskId =
    (typeof context.taskId === "string" && context.taskId.trim().length > 0 && context.taskId.trim()) ||
    (typeof context.issueId === "string" && context.issueId.trim().length > 0 && context.issueId.trim()) ||
    null;
  const wakeReason =
    typeof context.wakeReason === "string" && context.wakeReason.trim().length > 0
      ? context.wakeReason.trim()
      : null;
  const wakeCommentId =
    (typeof context.wakeCommentId === "string" && context.wakeCommentId.trim().length > 0 && context.wakeCommentId.trim()) ||
    (typeof context.commentId === "string" && context.commentId.trim().length > 0 && context.commentId.trim()) ||
    null;
  const approvalId =
    typeof context.approvalId === "string" && context.approvalId.trim().length > 0
      ? context.approvalId.trim()
      : null;
  const approvalStatus =
    typeof context.approvalStatus === "string" && context.approvalStatus.trim().length > 0
      ? context.approvalStatus.trim()
      : null;
  const linkedIssueIds = Array.isArray(context.issueIds)
    ? context.issueIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];

  if (wakeTaskId) {
    env.GITMESH_TASK_ID = wakeTaskId;
  }
  if (wakeReason) {
    env.GITMESH_WAKE_REASON = wakeReason;
  }
  if (wakeCommentId) {
    env.GITMESH_WAKE_COMMENT_ID = wakeCommentId;
  }
  if (approvalId) {
    env.GITMESH_APPROVAL_ID = approvalId;
  }
  if (approvalStatus) {
    env.GITMESH_APPROVAL_STATUS = approvalStatus;
  }
  if (linkedIssueIds.length > 0) {
    env.GITMESH_LINKED_ISSUE_IDS = linkedIssueIds.join(",");
  }
  if (effectiveWorkspaceCwd) {
    env.GITMESH_WORKSPACE_CWD = effectiveWorkspaceCwd;
  }
  if (workspaceSource) {
    env.GITMESH_WORKSPACE_SOURCE = workspaceSource;
  }
  if (workspaceId) {
    env.GITMESH_WORKSPACE_ID = workspaceId;
  }
  if (workspaceRepoUrl) {
    env.GITMESH_WORKSPACE_REPO_URL = workspaceRepoUrl;
  }
  if (workspaceRepoRef) {
    env.GITMESH_WORKSPACE_REPO_REF = workspaceRepoRef;
  }
  if (workspaceHints.length > 0) {
    env.GITMESH_WORKSPACES_JSON = JSON.stringify(workspaceHints);
  }

  // Merge extra env vars but prevent override of provider config
  for (const [key, value] of Object.entries(envConfig)) {
    if (typeof value === "string" && !["ANTHROPIC_API_KEY", "ANTHROPIC_BASE_URL"].includes(key)) {
      env[key] = value;
    }
  }

  if (!hasExplicitApiKey && authToken) {
    env.GITMESH_API_KEY = authToken;
  }

  const runtimeEnv = ensurePathInEnv({ ...process.env, ...env });
  await ensureCommandResolvable(command, cwd, runtimeEnv);

  const timeoutSec = asNumber(config.timeoutSec, 0);
  const graceSec = asNumber(config.graceSec, 20);
  const extraArgs = (() => {
    const fromExtraArgs = asStringArray(config.extraArgs);
    if (fromExtraArgs.length > 0) return fromExtraArgs;
    return asStringArray(config.args);
  })();

  return {
    command,
    cwd,
    workspaceId,
    workspaceRepoUrl,
    workspaceRepoRef,
    env,
    timeoutSec,
    graceSec,
    extraArgs,
  };
}

export async function runClaudeGatewayLogin(input: {
  runId: string;
  agent: AdapterExecutionContext["agent"];
  config: Record<string, unknown>;
  context?: Record<string, unknown>;
  authToken?: string;
  onLog?: (stream: "stdout" | "stderr", chunk: string) => Promise<void>;
}) {
  const onLog = input.onLog ?? (async () => {});
  const runtime = await buildClaudeGatewayRuntimeConfig({
    runId: input.runId,
    agent: input.agent,
    config: input.config,
    context: input.context ?? {},
    authToken: input.authToken,
  });

  const proc = await runChildProcess(
    input.runId,
    runtime.command,
    ["login", ...runtime.extraArgs],
    {
      cwd: runtime.cwd,
      env: runtime.env,
      timeoutSec: runtime.timeoutSec,
      graceSec: runtime.graceSec,
      onLog,
    }
  );

  const loginErrorMatch = proc.stderr.match(/Login URL:\s+(.+?)(?:\n|$)/);
  const loginUrl = loginErrorMatch ? loginErrorMatch[1].trim() : null;

  return buildLoginResult({ proc, loginUrl });
}

export async function execute(input: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { runId, agent, config, context, onLog } = input;
  const onLog_ = onLog ?? (async () => {});

  const playbooksDir = await buildPlaybooksDir(agent.role ?? undefined);
  let runtimeConfig: ClaudeGatewayRuntimeConfig;
  try {
    runtimeConfig = await buildClaudeGatewayRuntimeConfig({
      runId,
      agent,
      config,
      context,
      authToken: input.authToken,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      exitCode: null,
      signal: null,
      timedOut: false,
      errorMessage: `Configuration error: ${message}`,
      errorCode: "CONFIG_ERROR",
      errorMeta: { cause: message },
    };
  }

  const redactedEnv = redactEnvForLogs(runtimeConfig.env);
  await onLog_("stdout", `[claude_gateway] Running command: ${runtimeConfig.command}\n`);
  await onLog_("stdout", `[claude_gateway] Provider: ${asString(config.provider, "anthropic")}\n`);
  await onLog_("stdout", `[claude_gateway] Working directory: ${runtimeConfig.cwd}\n`);
  await onLog_(
    "stdout",
    `[claude_gateway] Environment: ${Object.keys(redactedEnv)
      .filter((k) => k.startsWith("GITMESH_") || k.startsWith("ANTHROPIC_"))
      .join(", ")}\n`
  );

  const proc = await runChildProcess(
    runId,
    runtimeConfig.command,
    runtimeConfig.extraArgs,
    {
      cwd: runtimeConfig.cwd,
      env: runtimeConfig.env,
      timeoutSec: runtimeConfig.timeoutSec,
      graceSec: runtimeConfig.graceSec,
      onLog: onLog_,
    }
  );

  // Parse Claude output
  const streamLines = proc.stdout.split("\n").filter((line) => line.trim().length > 0);
  const streamObjects = streamLines.map((line) => {
    try {
      return parseClaudeStreamJson(line);
    } catch {
      return null;
    }
  });

  const exitCode = proc.exitCode ?? -1;
  const signal = proc.signal;

  if (proc.timedOut) {
    return {
      exitCode,
      signal,
      timedOut: true,
      errorMessage: "Command exceeded timeout",
    };
  }

  if (detectClaudeLoginRequired({ parsed: streamObjects[0] ?? null, stdout: proc.stdout, stderr: proc.stderr }).requiresLogin) {
    const loginResult = await runClaudeGatewayLogin({
      runId,
      agent,
      config,
      context,
      authToken: input.authToken,
    });
    return {
      exitCode: loginResult.exitCode,
      signal: loginResult.signal,
      timedOut: false,
      errorMessage: "Login required",
      errorCode: "LOGIN_REQUIRED",
      errorMeta: { loginUrl: loginResult.errorMeta?.loginUrl },
    };
  }

  const failureDescription = describeClaudeFailure(streamObjects[0] ?? {} as Record<string, unknown>);
  if (failureDescription) {
    return {
      exitCode,
      signal,
      timedOut: false,
      errorMessage: failureDescription,
      errorMeta: { streamObjects },
    };
  }

  const lastStreamObject = streamObjects.reverse().find((obj) => obj !== null && typeof obj === "object");

  if (exitCode === 0 && lastStreamObject) {
    return {
      exitCode: 0,
      signal,
      timedOut: false,
      resultJson: lastStreamObject as Record<string, unknown>,
      summary: "Command completed successfully",
    };
  }

  return {
    exitCode,
    signal,
    timedOut: false,
    resultJson: lastStreamObject as Record<string, unknown>,
    summary: "Command completed",
  };
}
