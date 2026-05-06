/**
 * Docs Skill
 *
 * Checks pull requests for documentation:
 * - Detects undocumented code changes
 * - Suggests doc updates
 * - Flags breaking changes without migration docs
 */

import type { Db } from "@gitmesh/data";
import type { ForgeEvent } from "../forge-sync.js";

export interface DocsCheckContext {
  db: Db;
  event: ForgeEvent;
  projectId: string;
}

export interface DocIssue {
  file: string;
  type: "undocumented" | "breaking-change" | "api-change";
  severity: "error" | "warning" | "info";
  message: string;
}

export interface DocsCheckResult {
  labels: string[];
  comment: string;
  issues: DocIssue[];
  suggestDocPR: boolean;
}

/**
 * Files that typically contain documentation
 */
const DOC_FILES = [
  "README.md",
  "CONTRIBUTING.md",
  "docs",
  "doc",
  "documentation",
  ".github/WIKI",
];

/**
 * Detect if a PR includes documentation changes
 */
function hasDocs(title: string, body: string): boolean {
  const combined = `${title} ${body}`.toLowerCase();

  return (
    DOC_FILES.some((f) => combined.includes(f.toLowerCase())) ||
    ["doc", "docs", "documentation", "readme", "guide"].some((kw) => combined.includes(kw))
  );
}

/**
 * Check for breaking changes
 */
function checkBreakingChanges(title: string, body: string): DocIssue[] {
  const combined = `${title} ${body}`.toLowerCase();
  const issues: DocIssue[] = [];

  const breakingKeywords = [
    "breaking change",
    "breaking",
    "api removal",
    "remove support for",
    "deprecate",
  ];

  if (breakingKeywords.some((kw) => combined.includes(kw))) {
    issues.push({
      file: "general",
      type: "breaking-change",
      severity: "error",
      message:
        "Breaking change detected. Please ensure migration guide is included in docs.",
    });
  }

  return issues;
}

/**
 * Check for API/function documentation
 */
function checkAPIDocumentation(body: string | undefined): DocIssue[] {
  if (!body) return [];

  const issues: DocIssue[] = [];

  // Check for function/class additions without JSDoc markers
  if ((/export (function|class|const|interface)/.test(body) || /^\+\s*export/m.test(body)) &&
    !body.includes("/**") &&
    !body.includes("@param")) {
    issues.push({
      file: "code",
      type: "undocumented",
      severity: "warning",
      message: "New exported functions/classes should have JSDoc comments (@param, @returns)",
    });
  }

  // Check for parameter changes
  if (body.includes("params") || body.includes("arguments")) {
    issues.push({
      file: "code",
      type: "api-change",
      severity: "info",
      message: "Parameter changes detected. Ensure JSDoc/TypeScript definitions are updated.",
    });
  }

  return issues;
}

/**
 * Estimate if documentation is missing based on file changes
 */
function estimateDocBacklog(title: string): number {
  const fileCount = (title.match(/\.[a-z]+/gi) || []).length;
  // Rough heuristic: more files changed = more likely docs are needed
  return Math.ceil(fileCount / 5);
}

/**
 * Execute docs check skill
 */
export async function executeDocsCheck(context: DocsCheckContext): Promise<DocsCheckResult> {
  const { event } = context;

  // Only check PR events
  if (!["pr_opened", "pr_comment"].includes(event.eventType)) {
    return {
      labels: [],
      comment: "Docs skill: not applicable for this event",
      issues: [],
      suggestDocPR: false,
    };
  }

  const title = event.title || "";
  const body = event.body || "";
  const issues: DocIssue[] = [];
  const labels: string[] = [];

  // Check for breaking changes
  issues.push(...checkBreakingChanges(title, body));

  // Check API documentation
  issues.push(...checkAPIDocumentation(body));

  // Check if docs were updated
  const docsIncluded = hasDocs(title, body);

  if (!docsIncluded && issues.length > 0) {
    labels.push("needs-docs");
  }

  // Build comment
  let commentBody = "📚 **Documentation Check**\n\n";

  if (issues.length === 0 && docsIncluded) {
    commentBody += "✅ Documentation looks complete!\n";
  } else if (issues.length === 0) {
    commentBody += "ℹ️ No documentation changes detected, but code looks well-documented.\n";
  } else {
    commentBody += "Documentation items to review:\n\n";
    for (const issue of issues) {
      const icon = issue.severity === "error" ? "❌" : issue.severity === "warning" ? "⚠️" : "ℹ️";
      commentBody += `${icon} **${issue.type}**: ${issue.message}\n`;
    }
  }

  const docBacklog = !docsIncluded ? estimateDocBacklog(title) : 0;
  if (docBacklog > 0) {
    commentBody += `\n💡 Consider opening a documentation PR to cover these ${docBacklog} changes.`;
  }

  commentBody += "\n\n_This is an automated check. Please review and adjust as needed._";

  return {
    labels,
    comment: commentBody,
    issues,
    suggestDocPR: docBacklog > 0,
  };
}

/**
 * Skill definition for registration
 */
export const DocsSkill = {
  name: "docs",
  description: "Check pull requests for documentation coverage",
  execute: executeDocsCheck,
};
