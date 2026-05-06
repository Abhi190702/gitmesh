/**
 * Agents YAML Config Validator
 *
 * Zod schema for validating .gitmesh/agents.yaml configuration files.
 * Ensures agent configs match expected structure and defaults.
 */

import { z } from "zod";

/**
 * Single agent configuration from agents.yaml
 */
export const AgentConfigSchema = z.object({
  enabled: z.boolean().optional().default(true),
  schedule: z.string().describe('Cron schedule or event trigger (e.g., "on:pr_opened", "0 * * * *")'),
  budget_monthly_cents: z.number().int().positive().describe("Monthly budget in cents"),
  adapter: z.string().describe('Adapter name (e.g., "claude_local", "opencode_local")'),
  auto_approve: z.boolean().optional().default(false),
  tools: z.record(z.boolean()).optional().describe("Map of tool names to enabled/disabled"),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

/**
 * Full agents.yaml schema with agents record
 */
export const AgentsYamlConfigSchema = z.object({
  agents: z.record(z.string(), AgentConfigSchema),
});

export type AgentsYamlConfig = z.infer<typeof AgentsYamlConfigSchema>;

/**
 * Policy YAML schema (basic version for Phase 1)
 * Full OPA-based policies are Phase 2
 */
export const PolicyYamlConfigSchema = z.object({
  policies: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
        enabled: z.boolean().default(true),
        rules: z.record(z.string(), z.any()).optional(),
      }),
    )
    .optional()
    .default([]),
  defaults: z
    .object({
      approval_required: z.boolean().default(false),
      approval_timeout_hours: z.number().int().positive().default(24),
    })
    .optional(),
});

export type PolicyYamlConfig = z.infer<typeof PolicyYamlConfigSchema>;

/**
 * Validate and parse agents.yaml content
 */
export function validateAgentsYaml(parsed: unknown): AgentsYamlConfig {
  return AgentsYamlConfigSchema.parse(parsed);
}

/**
 * Validate and parse policy.yaml content
 */
export function validatePolicyYaml(parsed: unknown): PolicyYamlConfig {
  return PolicyYamlConfigSchema.parse(parsed);
}

/**
 * Get default agent config for a role
 */
export function getDefaultAgentConfig(role: string): AgentConfig {
  const defaults: Record<string, AgentConfig> = {
    triage: {
      enabled: true,
      schedule: "0 * * * *",
      budget_monthly_cents: 5000,
      adapter: "claude_local",
      auto_approve: false,
    },
    pr_review: {
      enabled: true,
      schedule: "on:pr_opened",
      budget_monthly_cents: 10000,
      adapter: "claude_local",
      auto_approve: false,
    },
    docs: {
      enabled: true,
      schedule: "0 2 * * *",
      budget_monthly_cents: 3000,
      adapter: "claude_local",
      auto_approve: false,
    },
    security: {
      enabled: true,
      schedule: "0 9 * * 1",
      budget_monthly_cents: 5000,
      adapter: "claude_local",
      auto_approve: false,
    },
    community: {
      enabled: true,
      schedule: "0 */6 * * *",
      budget_monthly_cents: 3000,
      adapter: "claude_local",
      auto_approve: false,
    },
    onboarding: {
      enabled: true,
      schedule: "on:first_pr",
      budget_monthly_cents: 2000,
      adapter: "claude_local",
      auto_approve: false,
    },
    release: {
      enabled: true,
      schedule: "manual",
      budget_monthly_cents: 2000,
      adapter: "claude_local",
      auto_approve: false,
    },
  };

  return defaults[role] || defaults.triage;
}
