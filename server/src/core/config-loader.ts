/**
 * Config Loader Service
 *
 * Loads and validates .gitmesh/agents.yaml configuration from project repos.
 * Handles parsing, caching, and file watching for updates.
 */

import * as fs from "fs/promises";
import * as path from "path";
import * as yaml from "js-yaml";
import { z } from "zod";

/**
 * Zod schema for agent configuration in agents.yaml
 */
const AgentConfigSchema = z.object({
  enabled: z.boolean().default(true),
  schedule: z.string().describe("Cron schedule or event trigger (e.g., 'on:pr_opened', '0 * * * *')"),
  budget_monthly_cents: z.number().int().positive(),
  adapter: z.string().describe("Adapter name (e.g., 'claude_local', 'opencode_local')"),
  auto_approve: z.boolean().default(false),
  tools: z.record(z.boolean()).optional().describe("Map of tool names to enabled/disabled"),
});

const AgentsYamlSchema = z.object({
  agents: z.record(z.string(), AgentConfigSchema),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type AgentsYamlConfig = z.infer<typeof AgentsYamlSchema>;

/**
 * Cache for loaded configs: key is absolute file path
 */
const configCache = new Map<string, { config: AgentsYamlConfig; mtime: number }>();

/**
 * Load and validate agents.yaml from a project directory.
 *
 * @param projectRoot - Absolute path to project root (where .gitmesh/ lives)
 * @returns Parsed and validated config, or null if file not found or invalid
 */
export async function loadAgentsYaml(projectRoot: string): Promise<AgentsYamlConfig | null> {
  const configPath = path.join(projectRoot, ".gitmesh", "agents.yaml");

  try {
    // Check if file exists
    const stat = await fs.stat(configPath);

    // Check cache
    const cached = configCache.get(configPath);
    if (cached && cached.mtime === stat.mtime.getTime()) {
      return cached.config;
    }

    // Load and parse the YAML
    const content = await fs.readFile(configPath, "utf-8");
    const parsed = yaml.load(content) as unknown;

    // Validate against schema
    const validated = AgentsYamlSchema.parse(parsed);

    // Cache the result
    configCache.set(configPath, {
      config: validated,
      mtime: stat.mtime.getTime(),
    });

    return validated;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(`Invalid agents.yaml at ${configPath}:`, error.errors);
      return null;
    }

    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      // File not found - this is OK, not all projects have agents.yaml
      return null;
    }

    console.error(`Error loading agents.yaml from ${projectRoot}:`, error);
    return null;
  }
}

/**
 * Invalidate cache for a specific project or globally.
 * Useful after config file updates.
 */
export function invalidateAgentsConfigCache(projectRoot?: string): void {
  if (projectRoot) {
    const configPath = path.join(projectRoot, ".gitmesh", "agents.yaml");
    configCache.delete(configPath);
  } else {
    configCache.clear();
  }
}

/**
 * Get agent config for a specific role.
 * Returns the stored config or a sensible default if not configured.
 */
export function getAgentConfig(config: AgentsYamlConfig | null, roleName: string): AgentConfig {
  if (config?.agents?.[roleName]) {
    return config.agents[roleName];
  }

  // Return minimal default if not found
  return {
    enabled: false,
    schedule: "manual",
    budget_monthly_cents: 5000,
    adapter: "claude_local",
    auto_approve: false,
  };
}
