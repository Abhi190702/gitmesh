/**
 * getPlaybooksForRole — Maps an agent role to the set of playbook directories
 * that should be injected into its runtime.
 *
 * Every agent gets the base `core` playbook (heartbeat, API, rules).
 * Role-specific playbooks are added on top based on the agent's role field.
 */

/** All known OSS agent roles */
export type AgentRole =
  | "triage"
  | "pr_review"
  | "docs"
  | "security"
  | "community"
  | "onboarding"
  | "release"
  | "admin"
  | "general";

/** Mapping from role to additional playbook directory names (beyond core) */
const ROLE_PLAYBOOK_MAP: Record<AgentRole, string[]> = {
  triage: ["triage"],
  pr_review: ["pr-review"],
  docs: ["docs"],
  security: ["security"],
  community: ["community"],
  onboarding: ["onboarding"],
  release: ["release-agent"],
  admin: ["agent-setup", "policy-guide"],
  general: [],
};

/**
 * Returns the list of playbook directory names that should be injected for the given role.
 * Always includes `core` (the base playbook) and `policy-guide` as the base set.
 *
 * @param role - The agent's role (e.g., "triage", "pr_review", "docs")
 * @returns Array of playbook directory names to inject (e.g., ["core", "policy-guide", "triage"])
 */
export function getPlaybooksForRole(role: string): string[] {
  const base = ["core", "policy-guide"];
  const rolePlaybooks = ROLE_PLAYBOOK_MAP[role as AgentRole] ?? [];

  // Deduplicate (policy-guide is already in base, and also in admin role)
  const all = [...base, ...rolePlaybooks];
  return [...new Set(all)];
}

/** @deprecated Use getPlaybooksForRole instead */
export const getSkillsForRole = getPlaybooksForRole;

/**
 * Skill metadata interface for OSS skills published in skills/ directory
 */
export interface SkillMetadata {
  id: string;
  name: string;
  description: string;
  roles: AgentRole[];
  version: string;
}

/**
 * Get skills directory path relative to workspace root
 */
export function getSkillsDirectory(): string {
  return "skills";
}

/**
 * List all available OSS skills from skills/ directory
 */
export function listAvailableSkills(): SkillMetadata[] {
  return [
    {
      id: "triage-skill",
      name: "Triage Skill",
      description: "Automated issue triage and labeling",
      roles: ["triage"],
      version: "0.2.7",
    },
    {
      id: "pr-review-skill",
      name: "PR Review Skill",
      description: "Code review analysis and feedback",
      roles: ["pr_review"],
      version: "0.2.7",
    },
    {
      id: "docs-skill",
      name: "Docs Skill",
      description: "Documentation detection and generation",
      roles: ["docs"],
      version: "0.2.7",
    },
    {
      id: "security-skill",
      name: "Security Skill",
      description: "Security scanning and vulnerability detection",
      roles: ["security"],
      version: "0.2.7",
    },
    {
      id: "community-skill",
      name: "Community Skill",
      description: "Community engagement and discussion monitoring",
      roles: ["community"],
      version: "0.2.7",
    },
    {
      id: "onboarding-skill",
      name: "Onboarding Skill",
      description: "Contributor onboarding automation",
      roles: ["onboarding"],
      version: "0.2.7",
    },
    {
      id: "release-skill",
      name: "Release Skill",
      description: "Release management and automation",
      roles: ["release"],
      version: "0.2.7",
    },
  ];
}
