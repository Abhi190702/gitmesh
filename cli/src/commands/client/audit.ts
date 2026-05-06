import pc from "picocolors";
import type { Command } from "commander";
import {
  addCommonClientOptions,
  resolveCommandContext,
  printOutput,
  type BaseClientOptions,
} from "./common.js";

// ---------------------------------------------------------------------------
// Audit subcommands
// ---------------------------------------------------------------------------

interface AuditListOptions extends BaseClientOptions {
  limit?: string;
  from?: string;
  to?: string;
}

async function auditList(options: AuditListOptions) {
  const { api, projectId, json } = resolveCommandContext(options, { requireProject: true });
  const params = new URLSearchParams();
  if (options.limit) params.set("limit", options.limit);
  if (options.from) params.set("from", options.from);
  if (options.to) params.set("to", options.to);
  const qs = params.toString() ? `?${params.toString()}` : "";
  try {
    const data = await api.get(`/api/projects/${projectId}/audit${qs}`);
    printOutput(data, { json, label: "Audit entries" });
  } catch (err) {
    if (json) {
      console.log(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    } else {
      console.error(pc.red(`Failed to list audit entries: ${err instanceof Error ? err.message : String(err)}`));
    }
    process.exit(1);
  }
}

async function auditShow(id: string, options: BaseClientOptions) {
  const { api, projectId, json } = resolveCommandContext(options, { requireProject: true });
  try {
    const data = await api.get(`/api/projects/${projectId}/audit/${id}`);
    printOutput(data, { json, label: `Audit entry ${id}` });
  } catch (err) {
    if (json) {
      console.log(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    } else {
      console.error(pc.red(`Failed to show audit entry: ${err instanceof Error ? err.message : String(err)}`));
    }
    process.exit(1);
  }
}

interface AuditExportOptions extends BaseClientOptions {
  format?: string;
  from?: string;
  to?: string;
}

async function auditExport(options: AuditExportOptions) {
  const { api, projectId, json } = resolveCommandContext(options, { requireProject: true });
  const format = options.format || "json";
  const params = new URLSearchParams({ format });
  if (options.from) params.set("from", options.from);
  if (options.to) params.set("to", options.to);
  try {
    const data = await api.get(`/api/projects/${projectId}/audit/export?${params.toString()}`);
    if (format === "json") {
      console.log(JSON.stringify(data, null, 2));
    } else {
      // CSV or other formats - print raw
      console.log(typeof data === "string" ? data : JSON.stringify(data));
    }
  } catch (err) {
    if (json) {
      console.log(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    } else {
      console.error(pc.red(`Failed to export audit: ${err instanceof Error ? err.message : String(err)}`));
    }
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerAuditCommands(program: Command): void {
  const audit = program
    .command("audit")
    .description("Query and export the agent audit log");

  const listCmd = audit
    .command("list")
    .description("List recent audit entries")
    .option("-n, --limit <count>", "Maximum number of entries to return", "50")
    .option("--from <date>", "Start date filter (ISO 8601)")
    .option("--to <date>", "End date filter (ISO 8601)")
    .action(auditList);
  addCommonClientOptions(listCmd, { includeProject: true });

  const showCmd = audit
    .command("show <id>")
    .description("Show a single audit entry in detail")
    .action(auditShow);
  addCommonClientOptions(showCmd, { includeProject: true });

  const exportCmd = audit
    .command("export")
    .description("Export audit entries in bulk")
    .option("--format <format>", "Output format: json or csv", "json")
    .option("--from <date>", "Start date filter (ISO 8601)")
    .option("--to <date>", "End date filter (ISO 8601)")
    .action(auditExport);
  addCommonClientOptions(exportCmd, { includeProject: true });
}
