import { Command } from "commander";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  Project,
  ProjectPortabilityExportResult,
  ProjectPortabilityInclude,
  ProjectPortabilityManifest,
  ProjectPortabilityPreviewResult,
  ProjectPortabilityImportResult,
} from "@gitmesh/core";
import { ApiRequestError } from "../../client/http.js";
import {
  addCommonClientOptions,
  formatInlineRecord,
  handleCommandError,
  printOutput,
  resolveCommandContext,
  type BaseClientOptions,
} from "./common.js";

interface ProjectCommandOptions extends BaseClientOptions {}
type ProjectDeleteSelectorMode = "auto" | "id" | "prefix";
type ProjectImportTargetMode = "new" | "existing";
type ProjectCollisionMode = "rename" | "skip" | "replace";

interface ProjectDeleteOptions extends BaseClientOptions {
  by?: ProjectDeleteSelectorMode;
  yes?: boolean;
  confirm?: string;
}

interface ProjectExportOptions extends BaseClientOptions {
  out?: string;
  include?: string;
}

interface ProjectImportOptions extends BaseClientOptions {
  from?: string;
  include?: string;
  target?: ProjectImportTargetMode;
  projectId?: string;
  newProjectName?: string;
  agents?: string;
  collision?: ProjectCollisionMode;
  dryRun?: boolean;
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeSelector(input: string): string {
  return input.trim();
}

function parseInclude(input: string | undefined): ProjectPortabilityInclude {
  if (!input || !input.trim()) return { project: true, agents: true };
  const values = input.split(",").map((part) => part.trim().toLowerCase()).filter(Boolean);
  const include = {
    project: values.includes("project"),
    agents: values.includes("agents"),
  };
  if (!include.project && !include.agents) {
    throw new Error("Invalid --include value. Use one or both of: project,agents");
  }
  return include;
}

function parseAgents(input: string | undefined): "all" | string[] {
  if (!input || !input.trim()) return "all";
  const normalized = input.trim().toLowerCase();
  if (normalized === "all") return "all";
  const values = input.split(",").map((part) => part.trim()).filter(Boolean);
  if (values.length === 0) return "all";
  return Array.from(new Set(values));
}

function isHttpUrl(input: string): boolean {
  return /^https?:\/\//i.test(input.trim());
}

function isGithubUrl(input: string): boolean {
  return /^https?:\/\/github\.com\//i.test(input.trim());
}

async function resolveInlineSourceFromPath(inputPath: string): Promise<{
  manifest: ProjectPortabilityManifest;
  files: Record<string, string>;
}> {
  const resolved = path.resolve(inputPath);
  const resolvedStat = await stat(resolved);
  const manifestPath = resolvedStat.isDirectory()
    ? path.join(resolved, "gitmesh-agents.manifest.json")
    : resolved;
  const manifestBaseDir = path.dirname(manifestPath);
  const manifestRaw = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(manifestRaw) as ProjectPortabilityManifest;
  const files: Record<string, string> = {};

  if (manifest.project?.path) {
    const projectPath = manifest.project.path.replace(/\\/g, "/");
    files[projectPath] = await readFile(path.join(manifestBaseDir, projectPath), "utf8");
  }
  for (const agent of manifest.agents ?? []) {
    const agentPath = agent.path.replace(/\\/g, "/");
    files[agentPath] = await readFile(path.join(manifestBaseDir, agentPath), "utf8");
  }

  return { manifest, files };
}

async function writeExportToFolder(outDir: string, exported: ProjectPortabilityExportResult): Promise<void> {
  const root = path.resolve(outDir);
  await mkdir(root, { recursive: true });
  const manifestPath = path.join(root, "gitmesh-agents.manifest.json");
  await writeFile(manifestPath, JSON.stringify(exported.manifest, null, 2), "utf8");
  for (const [relativePath, content] of Object.entries(exported.files)) {
    const normalized = relativePath.replace(/\\/g, "/");
    const filePath = path.join(root, normalized);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content, "utf8");
  }
}

function matchesPrefix(project: Project, selector: string): boolean {
  return project.issuePrefix.toUpperCase() === selector.toUpperCase();
}

export function resolveProjectForDeletion(
  projects: Project[],
  selectorRaw: string,
  by: ProjectDeleteSelectorMode = "auto",
): Project {
  const selector = normalizeSelector(selectorRaw);
  if (!selector) {
    throw new Error("Project selector is required.");
  }

  const idMatch = projects.find((project) => project.id === selector);
  const prefixMatch = projects.find((project) => matchesPrefix(project, selector));

  if (by === "id") {
    if (!idMatch) {
      throw new Error(`No project found by ID '${selector}'.`);
    }
    return idMatch;
  }

  if (by === "prefix") {
    if (!prefixMatch) {
      throw new Error(`No project found by shortname/prefix '${selector}'.`);
    }
    return prefixMatch;
  }

  if (idMatch && prefixMatch && idMatch.id !== prefixMatch.id) {
    throw new Error(
      `Selector '${selector}' is ambiguous (matches both an ID and a shortname). Re-run with --by id or --by prefix.`,
    );
  }

  if (idMatch) return idMatch;
  if (prefixMatch) return prefixMatch;

  throw new Error(
    `No project found for selector '${selector}'. Use project ID or issue prefix (for example PAP).`,
  );
}

export function assertDeleteConfirmation(project: Project, opts: ProjectDeleteOptions): void {
  if (!opts.yes) {
    throw new Error("Deletion requires --yes.");
  }

  const confirm = opts.confirm?.trim();
  if (!confirm) {
    throw new Error(
      "Deletion requires --confirm <value> where value matches the project ID or issue prefix.",
    );
  }

  const confirmsById = confirm === project.id;
  const confirmsByPrefix = confirm.toUpperCase() === project.issuePrefix.toUpperCase();
  if (!confirmsById && !confirmsByPrefix) {
    throw new Error(
      `Confirmation '${confirm}' does not match target project. Expected ID '${project.id}' or prefix '${project.issuePrefix}'.`,
    );
  }
}

function assertDeleteFlags(opts: ProjectDeleteOptions): void {
  if (!opts.yes) {
    throw new Error("Deletion requires --yes.");
  }
  if (!opts.confirm?.trim()) {
    throw new Error(
      "Deletion requires --confirm <value> where value matches the project ID or issue prefix.",
    );
  }
}

export function registerProjectCommands(program: Command): void {
  const projectCmd = program.command("project").description("Project operations");

  addCommonClientOptions(
    projectCmd
      .command("list")
      .description("List projects")
      .action(async (opts: ProjectCommandOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const rows = (await ctx.api.get<Project[]>("/api/projects")) ?? [];
          if (ctx.json) {
            printOutput(rows, { json: true });
            return;
          }

          if (rows.length === 0) {
            printOutput([], { json: false });
            return;
          }

          const formatted = rows.map((row) => ({
            id: row.id,
            name: row.name,
            status: row.status,
            budgetMonthlyCents: row.budgetMonthlyCents,
            spentMonthlyCents: row.spentMonthlyCents,
            requireOperatorApprovalForNewAgents: row.requireOperatorApprovalForNewAgents,
          }));
          for (const row of formatted) {
            console.log(formatInlineRecord(row));
          }
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );

  addCommonClientOptions(
    projectCmd
      .command("get")
      .description("Get one project")
      .argument("<projectId>", "Project ID")
      .action(async (projectId: string, opts: ProjectCommandOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const row = await ctx.api.get<Project>(`/api/projects/${projectId}`);
          printOutput(row, { json: ctx.json });
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );

  addCommonClientOptions(
    projectCmd
      .command("export")
      .description("Export a project into portable manifest + markdown files")
      .argument("<projectId>", "Project ID")
      .requiredOption("--out <path>", "Output directory")
      .option("--include <values>", "Comma-separated include set: project,agents", "project,agents")
      .action(async (projectId: string, opts: ProjectExportOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const include = parseInclude(opts.include);
          const exported = await ctx.api.post<ProjectPortabilityExportResult>(
            `/api/projects/${projectId}/export`,
            { include },
          );
          if (!exported) {
            throw new Error("Export request returned no data");
          }
          await writeExportToFolder(opts.out!, exported);
          printOutput(
            {
              ok: true,
              out: path.resolve(opts.out!),
              filesWritten: Object.keys(exported.files).length + 1,
              warningCount: exported.warnings.length,
            },
            { json: ctx.json },
          );
          if (!ctx.json && exported.warnings.length > 0) {
            for (const warning of exported.warnings) {
              console.log(`warning=${warning}`);
            }
          }
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );

  addCommonClientOptions(
    projectCmd
      .command("import")
      .description("Import a portable project package from local path, URL, or GitHub")
      .requiredOption("--from <pathOrUrl>", "Source path or URL")
      .option("--include <values>", "Comma-separated include set: project,agents", "project,agents")
      .option("--target <mode>", "Target mode: new | existing")
      .option("-P, --project-id <id>", "Existing target project ID")
      .option("--new-project-name <name>", "Name override for --target new")
      .option("--agents <list>", "Comma-separated agent slugs to import, or all", "all")
      .option("--collision <mode>", "Collision strategy: rename | skip | replace", "rename")
      .option("--dry-run", "Run preview only without applying", false)
      .action(async (opts: ProjectImportOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const from = (opts.from ?? "").trim();
          if (!from) {
            throw new Error("--from is required");
          }

          const include = parseInclude(opts.include);
          const agents = parseAgents(opts.agents);
          const collision = (opts.collision ?? "rename").toLowerCase() as ProjectCollisionMode;
          if (!["rename", "skip", "replace"].includes(collision)) {
            throw new Error("Invalid --collision value. Use: rename, skip, replace");
          }

          const inferredTarget = opts.target ?? (opts.projectId || ctx.projectId ? "existing" : "new");
          const target = inferredTarget.toLowerCase() as ProjectImportTargetMode;
          if (!["new", "existing"].includes(target)) {
            throw new Error("Invalid --target value. Use: new | existing");
          }

          const existingTargetProjectId = opts.projectId?.trim() || ctx.projectId;
          const targetPayload =
            target === "existing"
              ? {
                  mode: "existing_project" as const,
                  projectId: existingTargetProjectId,
                }
              : {
                  mode: "new_project" as const,
                  newProjectName: opts.newProjectName?.trim() || null,
                };

          if (targetPayload.mode === "existing_project" && !targetPayload.projectId) {
            throw new Error("Target existing project requires --project-id (or context default projectId).");
          }

          let sourcePayload:
            | { type: "inline"; manifest: ProjectPortabilityManifest; files: Record<string, string> }
            | { type: "url"; url: string }
            | { type: "github"; url: string };

          if (isHttpUrl(from)) {
            sourcePayload = isGithubUrl(from)
              ? { type: "github", url: from }
              : { type: "url", url: from };
          } else {
            const inline = await resolveInlineSourceFromPath(from);
            sourcePayload = {
              type: "inline",
              manifest: inline.manifest,
              files: inline.files,
            };
          }

          const payload = {
            source: sourcePayload,
            include,
            target: targetPayload,
            agents,
            collisionStrategy: collision,
          };

          if (opts.dryRun) {
            const preview = await ctx.api.post<ProjectPortabilityPreviewResult>(
              "/api/projects/import/preview",
              payload,
            );
            printOutput(preview, { json: ctx.json });
            return;
          }

          const imported = await ctx.api.post<ProjectPortabilityImportResult>("/api/projects/import", payload);
          printOutput(imported, { json: ctx.json });
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );

  addCommonClientOptions(
    projectCmd
      .command("delete")
      .description("Delete a project by ID or shortname/prefix (destructive)")
      .argument("<selector>", "Project ID or issue prefix (for example PAP)")
      .option(
        "--by <mode>",
        "Selector mode: auto | id | prefix",
        "auto",
      )
      .option("--yes", "Required safety flag to confirm destructive action", false)
      .option(
        "--confirm <value>",
        "Required safety value: target project ID or shortname/prefix",
      )
      .action(async (selector: string, opts: ProjectDeleteOptions) => {
        try {
          const by = (opts.by ?? "auto").trim().toLowerCase() as ProjectDeleteSelectorMode;
          if (!["auto", "id", "prefix"].includes(by)) {
            throw new Error(`Invalid --by mode '${opts.by}'. Expected one of: auto, id, prefix.`);
          }

          const ctx = resolveCommandContext(opts);
          const normalizedSelector = normalizeSelector(selector);
          assertDeleteFlags(opts);

          let target: Project | null = null;
          const shouldTryIdLookup = by === "id" || (by === "auto" && isUuidLike(normalizedSelector));
          if (shouldTryIdLookup) {
            const byId = await ctx.api.get<Project>(`/api/projects/${normalizedSelector}`, { ignoreNotFound: true });
            if (byId) {
              target = byId;
            } else if (by === "id") {
              throw new Error(`No project found by ID '${normalizedSelector}'.`);
            }
          }

          if (!target && ctx.projectId) {
            const scoped = await ctx.api.get<Project>(`/api/projects/${ctx.projectId}`, { ignoreNotFound: true });
            if (scoped) {
              try {
                target = resolveProjectForDeletion([scoped], normalizedSelector, by);
              } catch {
                // Fallback to operator-wide lookup below.
              }
            }
          }

          if (!target) {
            try {
              const projects = (await ctx.api.get<Project[]>("/api/projects")) ?? [];
              target = resolveProjectForDeletion(projects, normalizedSelector, by);
            } catch (error) {
              if (error instanceof ApiRequestError && error.status === 403 && error.message.includes("Operator access required")) {
                throw new Error(
                  "Operator access is required to resolve projects across the instance. Use a project ID/prefix for your current project, or run with operator authentication.",
                );
              }
              throw error;
            }
          }

          if (!target) {
            throw new Error(`No project found for selector '${normalizedSelector}'.`);
          }

          assertDeleteConfirmation(target, opts);

          await ctx.api.delete<{ ok: true }>(`/api/projects/${target.id}`);

          printOutput(
            {
              ok: true,
              deletedProjectId: target.id,
              deletedProjectName: target.name,
              deletedProjectPrefix: target.issuePrefix,
            },
            { json: ctx.json },
          );
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );
}
