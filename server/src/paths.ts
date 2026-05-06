import fs from "node:fs";
import path from "node:path";
import { resolveDefaultConfigPath } from "./home-paths.js";

const GITMESH_CONFIG_BASENAME = "gitmesh-agents.json";
const LEGACY_CONFIG_BASENAME = "config.json";
const AGENT_DIR = ".gitmesh-agents";
const ENV_FILENAME = ".env";

/**
 * Searches upward from startDir for a GitMesh config file.
 * Checks primary basename first, then legacy.
 */
function findConfigFromAncestors(startDir: string): string | null {
  let dir = path.resolve(startDir);

  for (;;) {
    const primary = path.join(dir, AGENT_DIR, GITMESH_CONFIG_BASENAME);
    if (fs.existsSync(primary)) return primary;

    const legacy = path.join(dir, AGENT_DIR, LEGACY_CONFIG_BASENAME);
    if (fs.existsSync(legacy)) return legacy;

    const parent = path.resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }

  return null;
}

export function resolveGitmeshConfigPath(override?: string): string {
  if (override) return path.resolve(override);
  if (process.env.GITMESH_CONFIG) return path.resolve(process.env.GITMESH_CONFIG);
  return findConfigFromAncestors(process.cwd()) ?? resolveDefaultConfigPath();
}

export function resolveGitmeshEnvPath(overrideConfigPath?: string): string {
  const cfg = resolveGitmeshConfigPath(overrideConfigPath);
  return path.join(path.dirname(cfg), ENV_FILENAME);
}

// Backward compatibility alias
export const resolveGitmeshAgentsEnvPath = resolveGitmeshEnvPath;
