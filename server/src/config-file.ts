import fs from "node:fs";
import path from "node:path";
import { gitmeshConfigSchema, type GitmeshConfig } from "@gitmesh/core";
import { resolveGitmeshConfigPath } from "./paths.js";

export const readConfigFile = loadGitmeshConfig;

/**
 * Reads and validates the GitMesh config file.
 * Returns null if no config exists or if parsing/validation fails.
 */
export function loadGitmeshConfig(): GitmeshConfig | null {
  const configPath = resolveGitmeshConfigPath();

  let rawContent: string;
  try {
    rawContent = fs.readFileSync(configPath, "utf-8");
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(rawContent);
    return gitmeshConfigSchema.parse(parsed);
  } catch {
    return null;
  }
}
