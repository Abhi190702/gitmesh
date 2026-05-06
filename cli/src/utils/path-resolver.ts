import fs from "node:fs";
import path from "node:path";
import { expandHomePrefix } from "../config/home.js";

/**
 * Deduplicates an array while preserving order.
 */
function uniqueOrdered<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

/**
 * Resolves a user-provided path by checking multiple candidate locations.
 * Expands ~, resolves relative paths against config dir or workspace root or cwd.
 * Returns the first existing path found, or the first candidate if none exist.
 */
export function resolveRuntimeLikePath(value: string, configPath?: string): string {
  const expanded = expandHomePrefix(value);
  if (path.isAbsolute(expanded)) return path.resolve(expanded);

  const cwd = process.cwd();
  const configDir = configPath ? path.dirname(configPath) : null;
  const workspaceRoot = configDir ? path.resolve(configDir, "..") : cwd;

  const candidates = uniqueOrdered([
    ...(configDir ? [path.resolve(configDir, expanded)] : []),
    path.resolve(workspaceRoot, "server", expanded),
    path.resolve(workspaceRoot, expanded),
    path.resolve(cwd, expanded),
  ]);

  return candidates.find((c) => fs.existsSync(c)) ?? candidates[0];
}
