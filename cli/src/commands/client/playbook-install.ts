import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import pc from "picocolors";
import type { GitmeshApiClient } from "../../client/http.js";

export type PlaybookInstallTarget = "claude" | "codex";

export interface PlaybookInstallOptions {
  api: GitmeshApiClient;
  apiBase: string;
  roles: string[];
  targets: PlaybookInstallTarget[];
  /** Bumps when the install layout or marker format changes. */
  installVersion?: string;
  silent?: boolean;
}

export interface PlaybookInstallResult {
  installed: { role: string; target: PlaybookInstallTarget; path: string }[];
  skipped: { role: string; target: PlaybookInstallTarget; path: string; reason: string }[];
}

const DEFAULT_VERSION = "1";
const TARGET_DIRS: Record<PlaybookInstallTarget, string> = {
  claude: ".claude/skills",
  codex: ".codex/skills",
};

/**
 * Fetch playbook markdown from the GitMesh API and install it into the
 * agent runtime's local skills directory. Idempotent: existing installs
 * with a matching `gitmesh.installVersion` marker are skipped.
 */
export async function installPlaybooks(
  opts: PlaybookInstallOptions,
): Promise<PlaybookInstallResult> {
  const installed: PlaybookInstallResult["installed"] = [];
  const skipped: PlaybookInstallResult["skipped"] = [];
  const installVersion = opts.installVersion ?? DEFAULT_VERSION;
  const home = os.homedir();

  for (const role of opts.roles) {
    const safeRole = role.replace(/[^a-z0-9_-]/gi, "").toLowerCase();
    if (!safeRole) {
      throw new Error(`Invalid role name: "${role}"`);
    }

    const markdown = await fetchPlaybook(opts.api, safeRole);
    if (!markdown) {
      throw new Error(
        `Playbook "${safeRole}" not found at ${opts.apiBase}/api/playbooks/${safeRole}.`,
      );
    }

    for (const target of opts.targets) {
      const dirName = `gitmesh-${safeRole}`;
      const installDir = path.join(home, TARGET_DIRS[target], dirName);
      const skillFile = path.join(installDir, "SKILL.md");
      const markerFile = path.join(installDir, ".gitmesh-version");

      const existing = await readFileSafely(markerFile);
      if (existing && existing.trim() === installVersion) {
        skipped.push({
          role: safeRole,
          target,
          path: skillFile,
          reason: `already installed (version ${installVersion})`,
        });
        if (!opts.silent) {
          console.log(pc.dim(`  ↷  ${target}/${dirName} already at v${installVersion}`));
        }
        continue;
      }

      await fs.mkdir(installDir, { recursive: true });
      await fs.writeFile(skillFile, withGitmeshHeader(markdown, safeRole), "utf8");
      await fs.writeFile(markerFile, `${installVersion}\n`, "utf8");

      installed.push({ role: safeRole, target, path: skillFile });
      if (!opts.silent) {
        console.log(pc.green(`  ✓  installed ${target}/${dirName}`));
      }
    }
  }

  return { installed, skipped };
}

async function fetchPlaybook(api: GitmeshApiClient, name: string): Promise<string | null> {
  // The API serves text/markdown directly; the http client falls back to
  // returning the raw text when JSON parsing fails.
  try {
    const result = await api.get<unknown>(`/api/playbooks/${encodeURIComponent(name)}`);
    if (typeof result === "string") return result;
    if (result === null || result === undefined) return null;
    return String(result);
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 404) return null;
    throw err;
  }
}

async function readFileSafely(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

function withGitmeshHeader(markdown: string, role: string): string {
  const banner = [
    "<!--",
    `  Installed by gitmesh-agents CLI on ${new Date().toISOString()}`,
    `  Role: ${role}`,
    "  Re-run `gitmesh-agents project connect <repo-url>` to refresh.",
    "-->",
    "",
  ].join("\n");
  return `${banner}${markdown}`;
}
