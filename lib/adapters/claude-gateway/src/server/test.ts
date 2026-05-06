import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@gitmesh/adapter-sdk";
import {
  asString,
  asBoolean,
  asNumber,
  asStringArray,
  parseObject,
  ensureAbsoluteDirectory,
  ensureCommandResolvable,
  ensurePathInEnv,
  runChildProcess,
} from "@gitmesh/adapter-sdk/server-utils";
import path from "node:path";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function firstNonEmptyLine(text: string): string {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}

function commandLooksLike(command: string, expected: string): boolean {
  const base = path.basename(command).toLowerCase();
  return base === expected || base === `${expected}.cmd` || base === `${expected}.exe`;
}

function summarizeProbeDetail(stdout: string, stderr: string): string | null {
  const raw = firstNonEmptyLine(stderr) || firstNonEmptyLine(stdout);
  if (!raw) return null;
  const clean = raw.replace(/\s+/g, " ").trim();
  const max = 240;
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);
  const command = asString(config.command, "claude");
  const cwd = asString(config.cwd, process.cwd());

  // **Provider-specific validation**
  const provider = asString(config.provider, "").trim();
  const apiKey = asString(config.apiKey, "").trim();

  if (!provider) {
    checks.push({
      code: "claude_gateway_provider_missing",
      level: "error",
      message: "Provider is required. Set provider to: anthropic, minimax, or custom",
      hint: "Example: provider: minimax",
    });
  } else {
    checks.push({
      code: "claude_gateway_provider_configured",
      level: "info",
      message: `Provider is configured: ${provider}`,
    });
  }

  if (!apiKey) {
    checks.push({
      code: "claude_gateway_api_key_missing",
      level: "error",
      message: "API key is required for the provider",
      hint: "Example: apiKey: ${MINIMAX_API_KEY}",
    });
  } else {
    checks.push({
      code: "claude_gateway_api_key_configured",
      level: "info",
      message: "API key is configured",
    });
  }

  const customBaseUrl = asString(config.baseUrl, "").trim();
  if (customBaseUrl) {
    checks.push({
      code: "claude_gateway_custom_base_url",
      level: "info",
      message: `Custom base URL configured: ${customBaseUrl}`,
    });
  }

  // **Standard checks**
  try {
    await ensureAbsoluteDirectory(cwd, { createIfMissing: true });
    checks.push({
      code: "claude_cwd_valid",
      level: "info",
      message: `Working directory is valid: ${cwd}`,
    });
  } catch (err) {
    checks.push({
      code: "claude_cwd_invalid",
      level: "error",
      message: err instanceof Error ? err.message : "Invalid working directory",
      detail: cwd,
    });
  }

  const envConfig = parseObject(config.env);
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(envConfig)) {
    if (typeof value === "string" && !["ANTHROPIC_API_KEY", "ANTHROPIC_BASE_URL"].includes(key)) {
      env[key] = value;
    }
  }

  // Provider auth setup
  if (apiKey) {
    env.ANTHROPIC_API_KEY = apiKey;
  }
  if (customBaseUrl) {
    env.ANTHROPIC_BASE_URL = customBaseUrl;
  }

  const runtimeEnv = ensurePathInEnv({ ...process.env, ...env });
  try {
    await ensureCommandResolvable(command, cwd, runtimeEnv);
    checks.push({
      code: "claude_command_resolvable",
      level: "info",
      message: `Command is executable: ${command}`,
    });
  } catch (err) {
    checks.push({
      code: "claude_command_unresolvable",
      level: "error",
      message: err instanceof Error ? err.message : "Command is not executable",
      detail: command,
    });
  }

  const canRunProbe =
    checks.every((check) => check.code !== "claude_cwd_invalid" && check.code !== "claude_command_unresolvable")
    && provider && apiKey;

  if (canRunProbe) {
    if (!commandLooksLike(command, "claude")) {
      checks.push({
        code: "claude_hello_probe_skipped_custom_command",
        level: "info",
        message: "Skipped hello probe because command is not `claude`.",
        detail: command,
        hint: "Use the `claude` CLI command to run the automatic login and installation probe.",
      });
    } else {
      const model = asString(config.model, "").trim();
      const effort = asString(config.effort, "").trim();
      const chrome = asBoolean(config.chrome, false);
      const maxTurns = asNumber(config.maxTurnsPerRun, 0);
      const dangerouslySkipPermissions = asBoolean(config.dangerouslySkipPermissions, false);
      const extraArgs = (() => {
        const fromExtraArgs = asStringArray(config.extraArgs);
        if (fromExtraArgs.length > 0) return fromExtraArgs;
        return asStringArray(config.args);
      })();

      const args = ["--print", "-", "--output-format", "stream-json", "--verbose"];
      if (dangerouslySkipPermissions) args.push("--dangerously-skip-permissions");
      if (chrome) args.push("--chrome");
      if (model) args.push("--model", model);
      if (effort) args.push("--effort", effort);
      if (maxTurns > 0) args.push("--max-turns", String(maxTurns));
      if (extraArgs.length > 0) args.push(...extraArgs);

      checks.push({
        code: "claude_gateway_hello_probe_info",
        level: "info",
        message: `Will probe provider "${provider}" with model "${model || "(default)"}"`,
      });

      const probe = await runChildProcess(
        `claude-gateway-envtest-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        command,
        args,
        {
          cwd,
          env: runtimeEnv as Record<string, string>,
          timeoutSec: 60,
          graceSec: 5,
          stdin: "Respond with hello.",
          onLog: async () => {},
        },
      );

      const detail = summarizeProbeDetail(probe.stdout, probe.stderr);

      if (probe.timedOut) {
        checks.push({
          code: "claude_gateway_hello_probe_timed_out",
          level: "warn",
          message: `Claude probe timed out connecting to provider "${provider}".`,
          ...(detail ? { detail } : {}),
          hint: "Verify network access to the provider endpoint and API key validity. Then retry.",
        });
      } else if ((probe.exitCode ?? 1) === 0 && probe.stdout.toLowerCase().includes("hello")) {
        checks.push({
          code: "claude_gateway_hello_probe_passed",
          level: "info",
          message: `Claude probe succeeded with provider "${provider}".`,
        });
      } else if (probe.exitCode === 0) {
        checks.push({
          code: "claude_gateway_hello_probe_unexpected_output",
          level: "warn",
          message: `Claude probe ran with provider "${provider}" but returned unexpected output.`,
          ...(detail ? { detail } : {}),
        });
      } else {
        checks.push({
          code: "claude_gateway_hello_probe_failed",
          level: "error",
          message: `Claude probe failed with provider "${provider}" (exit code ${probe.exitCode}).`,
          ...(detail ? { detail } : {}),
          hint: `Verify apiKey is valid for provider "${provider}" and check network/firewall access.`,
        });
      }
    }
  }

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
