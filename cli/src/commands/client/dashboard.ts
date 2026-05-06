import { Command } from "commander";
import type { DashboardSummary } from "@gitmesh/core";
import {
  addCommonClientOptions,
  handleCommandError,
  printOutput,
  resolveCommandContext,
  type BaseClientOptions,
} from "./common.js";

interface DashboardGetOptions extends BaseClientOptions {
  projectId?: string;
}

export function registerDashboardCommands(program: Command): void {
  const dashboard = program.command("dashboard").description("Dashboard summary operations");

  addCommonClientOptions(
    dashboard
      .command("get")
      .description("Get dashboard summary for a project")
      .requiredOption("-P, --project-id <id>", "Project ID")
      .action(async (opts: DashboardGetOptions) => {
        try {
          const ctx = resolveCommandContext(opts, { requireProject: true });
          const row = await ctx.api.get<DashboardSummary>(`/api/projects/${ctx.projectId}/dashboard`);
          printOutput(row, { json: ctx.json });
        } catch (err) {
          handleCommandError(err);
        }
      }),
    { includeProject: false },
  );
}
