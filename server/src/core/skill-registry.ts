/**
 * Skill Registry
 *
 * Registers and executes agent skills per role.
 * Skills are triggered based on agent role and forge events.
 *
 * Roles: triage, pr_review, docs, security, community, onboarding, release
 */

import type { Db } from "@gitmesh/data";
import type { ForgeEvent } from "./forge-sync.js";
import { executeTriage } from "./skills/triage-skill.js";
import { executePRReview } from "./skills/pr-review-skill.js";
import { executeDocsCheck } from "./skills/docs-skill.js";
import { executeOnboarding } from "./skills/onboarding-skill.js";
import { executeRelease } from "./skills/release-skill.js";
import { executeSecurity } from "./skills/security-skill.js";
import { executeCommunity } from "./skills/community-skill.js";

export interface SkillDefinition {
  name: string;
  description: string;
  execute: (context: any) => Promise<any>;
}

export interface SkillContext {
  db: Db;
  event: ForgeEvent;
  projectId: string;
}

/**
 * Registry of available skills mapped by role
 */
const SKILLS_BY_ROLE: Record<string, SkillDefinition[]> = {
  triage: [
    {
      name: "triage",
      description: "Automatically triage issues by priority and type",
      execute: executeTriage,
    },
  ],
  pr_review: [
    {
      name: "pr_review",
      description: "Automatically review pull requests",
      execute: executePRReview,
    },
  ],
  docs: [
    {
      name: "docs",
      description: "Check pull requests for documentation",
      execute: executeDocsCheck,
    },
  ],
  security: [
    {
      name: "security",
      description: "Scan PRs for security vulnerabilities and secrets",
      execute: executeSecurity,
    },
  ],
  community: [
    {
      name: "community",
      description: "Monitor community engagement and suggest responses",
      execute: executeCommunity,
    },
  ],
  onboarding: [
    {
      name: "onboarding",
      description: "Welcome first-time contributors with contextual guidance",
      execute: executeOnboarding,
    },
  ],
  release: [
    {
      name: "release",
      description: "Generate changelogs, bump versions, draft release notes",
      execute: executeRelease,
    },
  ],
  general: [
    {
      name: "triage",
      description: "Automatically triage issues",
      execute: executeTriage,
    },
  ],
};

/**
 * Get skills for a given agent role
 */
export function getSkillsForRole(role: string): SkillDefinition[] {
  return SKILLS_BY_ROLE[role] || [];
}

/**
 * Execute all applicable skills for an agent role and forge event
 */
export async function executeSkillsForRole(
  role: string,
  context: SkillContext,
): Promise<Array<{ skillName: string; result: any; error?: string }>> {
  const skills = getSkillsForRole(role);
  const results: Array<{ skillName: string; result: any; error?: string }> = [];

  for (const skill of skills) {
    try {
      const result = await skill.execute(context);
      results.push({
        skillName: skill.name,
        result,
      });
    } catch (error) {
      console.error(`Error executing skill ${skill.name}:`, error);
      results.push({
        skillName: skill.name,
        result: null,
        error: String(error),
      });
    }
  }

  return results;
}

/**
 * Get all available skills
 */
export function getAllSkills(): SkillDefinition[] {
  const allSkills = new Map<string, SkillDefinition>();

  for (const skills of Object.values(SKILLS_BY_ROLE)) {
    for (const skill of skills) {
      allSkills.set(skill.name, skill);
    }
  }

  return Array.from(allSkills.values());
}
