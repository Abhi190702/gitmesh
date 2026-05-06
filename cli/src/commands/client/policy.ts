import fs from "node:fs/promises";
import path from "node:path";
import pc from "picocolors";
import type { Command } from "commander";
import {
  addCommonClientOptions,
  resolveCommandContext,
  printOutput,
  type BaseClientOptions,
} from "./common.js";

// ---------------------------------------------------------------------------
// YAML validation helpers (lightweight, no external YAML parser dependency)
// ---------------------------------------------------------------------------

interface PolicyRule {
  name: string;
  match?: Record<string, unknown>;
  decision?: string;
}

interface PolicyFile {
  version?: number;
  rules?: PolicyRule[];
  defaults?: Record<string, unknown>;
}

function parsePolicyYaml(content: string): PolicyFile {
  // Lightweight parse: extract version, rules array, defaults from YAML
  // For production use this would use a proper YAML parser; here we do
  // minimal validation of the structure rather than full parsing.
  const lines = content.split(/\r?\n/);
  let version: number | undefined;
  const rules: PolicyRule[] = [];

  for (const line of lines) {
    const vMatch = line.match(/^version:\s*(\d+)/);
    if (vMatch) version = Number(vMatch[1]);
  }

  return { version, rules };
}

function validatePolicyContent(content: string): string[] {
  const errors: string[] = [];
  if (!content.trim()) {
    errors.push("Policy file is empty");
    return errors;
  }
  const parsed = parsePolicyYaml(content);
  if (parsed.version === undefined) {
    errors.push("Missing required field: version");
  } else if (parsed.version !== 1) {
    errors.push(`Unsupported policy version: ${parsed.version} (expected 1)`);
  }
  // Check for basic YAML validity by looking for common issues
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("\t")) {
      errors.push(`Line ${i + 1}: tabs are not allowed in YAML, use spaces`);
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Policy subcommands
// ---------------------------------------------------------------------------

async function policyList(options: BaseClientOptions) {
  const { api, projectId, json } = resolveCommandContext(options, { requireProject: true });
  try {
    const data = await api.get(`/api/projects/${projectId}/policies`);
    printOutput(data, { json, label: "Policy versions" });
  } catch (err) {
    if (json) {
      console.log(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    } else {
      console.error(pc.red(`Failed to list policies: ${err instanceof Error ? err.message : String(err)}`));
    }
    process.exit(1);
  }
}

async function policyShow(options: BaseClientOptions) {
  const { api, projectId, json } = resolveCommandContext(options, { requireProject: true });
  try {
    const data = await api.get(`/api/projects/${projectId}/policies/active`);
    printOutput(data, { json, label: "Active policy" });
  } catch (err) {
    if (json) {
      console.log(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    } else {
      console.error(pc.red(`Failed to show active policy: ${err instanceof Error ? err.message : String(err)}`));
    }
    process.exit(1);
  }
}

async function policyCreate(file: string, options: BaseClientOptions) {
  const { api, projectId, json } = resolveCommandContext(options, { requireProject: true });
  const filePath = path.resolve(file);
  let content: string;
  try {
    content = await fs.readFile(filePath, "utf-8");
  } catch (err) {
    console.error(pc.red(`Cannot read file: ${filePath}`));
    process.exit(1);
    return; // unreachable, but helps TS
  }

  const errors = validatePolicyContent(content);
  if (errors.length > 0) {
    console.error(pc.red("Policy validation failed:"));
    for (const e of errors) console.error(pc.dim(`  • ${e}`));
    process.exit(1);
  }

  try {
    const data = await api.post(`/api/projects/${projectId}/policies`, { content, source: "cli" });
    printOutput(data, { json, label: "Policy created" });
  } catch (err) {
    if (json) {
      console.log(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    } else {
      console.error(pc.red(`Failed to create policy: ${err instanceof Error ? err.message : String(err)}`));
    }
    process.exit(1);
  }
}

async function policyActivate(version: string, options: BaseClientOptions) {
  const { api, projectId, json } = resolveCommandContext(options, { requireProject: true });
  try {
    const data = await api.post(`/api/projects/${projectId}/policies/${version}/activate`);
    printOutput(data, { json, label: `Policy version ${version} activated` });
  } catch (err) {
    if (json) {
      console.log(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    } else {
      console.error(pc.red(`Failed to activate policy: ${err instanceof Error ? err.message : String(err)}`));
    }
    process.exit(1);
  }
}

async function policyValidate(file: string, _options: BaseClientOptions) {
  const filePath = path.resolve(file);
  let content: string;
  try {
    content = await fs.readFile(filePath, "utf-8");
  } catch (err) {
    console.error(pc.red(`Cannot read file: ${filePath}`));
    process.exit(1);
    return;
  }

  const errors = validatePolicyContent(content);
  if (errors.length > 0) {
    console.error(pc.red("Validation failed:"));
    for (const e of errors) console.error(pc.dim(`  • ${e}`));
    process.exit(1);
  } else {
    console.log(pc.green("✓ Policy file is valid"));
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerPolicyCommands(program: Command): void {
  const policy = program
    .command("policy")
    .description("Manage project policies (governance rules for agent behaviour)");

  const listCmd = policy
    .command("list")
    .description("List all policy versions for the project")
    .action(policyList);
  addCommonClientOptions(listCmd, { includeProject: true });

  const showCmd = policy
    .command("show")
    .description("Show the currently active policy")
    .action(policyShow);
  addCommonClientOptions(showCmd, { includeProject: true });

  const createCmd = policy
    .command("create <file>")
    .description("Upload a new policy version from a YAML file")
    .action(policyCreate);
  addCommonClientOptions(createCmd, { includeProject: true });

  const activateCmd = policy
    .command("activate <version>")
    .description("Activate a specific policy version")
    .action(policyActivate);
  addCommonClientOptions(activateCmd, { includeProject: true });

  const validateCmd = policy
    .command("validate <file>")
    .description("Validate a policy YAML file without uploading")
    .action(policyValidate);
  addCommonClientOptions(validateCmd);
}
