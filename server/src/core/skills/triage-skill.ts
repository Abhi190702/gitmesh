/**
 * Triage Skill
 *
 * Automatically triages GitHub issues by:
 * - Classifying priority based on keywords
 * - Adding labels (priority, type)
 * - Routing to team leads if mentioned
 */

import type { Db } from "@gitmesh/data";
import type { ForgeEvent } from "../forge-sync.js";

export interface TriageContext {
  db: Db;
  event: ForgeEvent;
  projectId: string;
}

export interface TriageResult {
  labels: string[];
  assignee?: string;
  comment: string;
}

/**
 * Priority keywords for classification
 */
const PRIORITY_KEYWORDS: Record<string, string[]> = {
  critical: ["critical", "critical bug", "security", "crash", "down", "broken"],
  high: ["urgent", "important", "bug", "error", "fail", "high priority"],
  medium: ["feature", "enhancement", "improvement", "help wanted"],
  low: ["docs", "documentation", "typo", "suggestion", "discussion"],
};

/**
 * Type keywords
 */
const TYPE_KEYWORDS: Record<string, string[]> = {
  bug: ["bug", "error", "crash", "broken", "not working", "unexpected"],
  feature: ["feature", "enhancement", "request", "add", "implement"],
  docs: ["docs", "documentation", "readme", "comment", "explain"],
  question: ["question", "how", "help", "? "],
};

/**
 * Classify issue priority based on title and body
 */
function classifyPriority(title: string, body: string): string {
  const combined = `${title} ${body}`.toLowerCase();

  for (const [priority, keywords] of Object.entries(PRIORITY_KEYWORDS)) {
    if (keywords.some((kw) => combined.includes(kw))) {
      return priority;
    }
  }

  return "medium"; // default
}

/**
 * Classify issue type based on title and body
 */
function classifyType(title: string, body: string): string {
  const combined = `${title} ${body}`.toLowerCase();

  for (const [type, keywords] of Object.entries(TYPE_KEYWORDS)) {
    if (keywords.some((kw) => combined.includes(kw))) {
      return type;
    }
  }

  return "question"; // default
}

/**
 * Extract team mentions from issue body (e.g., @docs-team, @security-team)
 */
function extractTeamMentions(body: string | undefined): string[] {
  if (!body) return [];

  // Match @team-name patterns
  const matches = body.match(/@([\w-]+)/g) || [];
  return matches.map((m) => m.substring(1)); // Remove @
}

/**
 * Execute triage skill on an issue
 */
export async function executeTriage(context: TriageContext): Promise<TriageResult> {
  const { event } = context;

  // Only triage issue_opened and issue_reopened events
  if (!["issue_opened", "issue_reopened"].includes(event.eventType)) {
    return { labels: [], comment: "Triage skill: not applicable for this event" };
  }

  const title = event.title || "";
  const body = event.body || "";

  // Classify priority and type
  const priority = classifyPriority(title, body);
  const type = classifyType(title, body);

  // Build labels
  const labels: string[] = [];
  if (priority !== "medium") {
    labels.push(`priority-${priority}`);
  }
  labels.push(`type-${type}`);

  // Check for team mentions
  const teams = extractTeamMentions(body);
  if (teams.length > 0) {
    labels.push(...teams.map((t) => `team-${t}`));
  }

  // Generate comment
  const comment = [
    `🤖 **Triage Report**`,
    `- **Priority**: ${priority}`,
    `- **Type**: ${type}`,
    ...(teams.length > 0 ? [`- **Teams**: ${teams.join(", ")}`] : []),
    `\nThis issue has been automatically triaged. Feel free to adjust the classification if needed.`,
  ].join("\n");

  return {
    labels,
    comment,
  };
}

/**
 * Skill definition for registration
 */
export const TriageSkill = {
  name: "triage",
  description: "Automatically triage issues by priority and type",
  execute: executeTriage,
};
