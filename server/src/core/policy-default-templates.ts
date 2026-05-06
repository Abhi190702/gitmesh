export type PolicyEffect = "allow" | "block" | "require_approval";

export interface PolicyTemplate {
  name: string;
  description: string;
  actionPattern: string;
  conditions: Record<string, unknown> | null;
  effect: PolicyEffect;
  effectConfig: Record<string, unknown> | null;
  priority: number;
}

/**
 * Default policy templates for new projects.
 * These provide sensible defaults for OSS governance.
 */
export const DEFAULT_POLICY_TEMPLATES: PolicyTemplate[] = [
  {
    name: "Require approval for merge",
    description: "All PR merges by agents require human approval",
    actionPattern: "merge_pr",
    conditions: null,
    effect: "require_approval",
    effectConfig: { approverRoles: ["maintainer", "admin"], timeout: "24h" },
    priority: 10,
  },
  {
    name: "Require approval for security advisories",
    description: "Publishing security advisories requires human approval",
    actionPattern: "publish_advisory",
    conditions: null,
    effect: "require_approval",
    effectConfig: { approverRoles: ["security", "admin"], timeout: "48h" },
    priority: 20,
  },
  {
    name: "Block direct push to main",
    description: "Agents cannot push directly to the main branch",
    actionPattern: "push",
    conditions: { targetBranch: ["main", "master"] },
    effect: "block",
    effectConfig: { message: "Direct pushes to main/master are not allowed. Please open a PR." },
    priority: 30,
  },
  {
    name: "Allow triage actions",
    description: "Triage agents can label, assign, and close issues freely",
    actionPattern: "close_issue",
    conditions: { agentRole: ["triage"] },
    effect: "allow",
    effectConfig: null,
    priority: 50,
  },
  {
    name: "Default allow",
    description: "Allow all other actions by default",
    actionPattern: "*",
    conditions: null,
    effect: "allow",
    effectConfig: null,
    priority: 1000,
  },
];
