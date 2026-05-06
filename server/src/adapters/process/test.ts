import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "../types.js";
import {
  asString,
  parseObject,
  ensureAbsoluteDirectory,
  ensureCommandResolvable,
  ensurePathInEnv,
} from "../utils.js";

type CheckLevel = "error" | "warn" | "info";

function addCheck(
  checks: AdapterEnvironmentCheck[],
  code: string,
  level: CheckLevel,
  message: string,
  hintOrDetail?: string,
): void {
  const check: AdapterEnvironmentCheck = { code, level, message };
  if (hintOrDetail !== undefined) {
    if (level === "error" && !hintOrDetail.includes(" ")) {
      check.detail = hintOrDetail;
    } else if (level === "error") {
      check.hint = hintOrDetail;
    } else {
      check.detail = hintOrDetail;
    }
  }
  checks.push(check);
}

function deriveStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  for (const check of checks) {
    if (check.level === "error") return "fail";
  }
  for (const check of checks) {
    if (check.level === "warn") return "warn";
  }
  return "pass";
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);
  const command = asString(config.command, "");
  const cwd = asString(config.cwd, process.cwd());

  if (!command) {
    addCheck(checks, "process_command_missing", "error", "Process adapter requires a command.", "Set adapterConfig.command to an executable command.");
  } else {
    addCheck(checks, "process_command_present", "info", `Configured command: ${command}`);
  }

  try {
    await ensureAbsoluteDirectory(cwd);
    addCheck(checks, "process_cwd_valid", "info", `Working directory is valid: ${cwd}`);
  } catch (err) {
    addCheck(checks, "process_cwd_invalid", "error", err instanceof Error ? err.message : "Invalid working directory", cwd);
  }

  if (command) {
    const envConfig = parseObject(config.env);
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(envConfig)) {
      if (typeof v === "string") env[k] = v;
    }
    const runtimeEnv = ensurePathInEnv({ ...process.env, ...env });
    try {
      await ensureCommandResolvable(command, cwd, runtimeEnv);
      addCheck(checks, "process_command_resolvable", "info", `Command is executable: ${command}`);
    } catch (err) {
      addCheck(checks, "process_command_unresolvable", "error", err instanceof Error ? err.message : "Command is not executable", command);
    }
  }

  return {
    adapterType: ctx.adapterType,
    status: deriveStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
