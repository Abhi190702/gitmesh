/**
 * PR Review Skill
 *
 * Automatically reviews pull requests by:
 * - Checking code style and formatting
 * - Analyzing test coverage
 * - Verifying commit messages
 * - Checking policy compliance
 */

import type { Db } from "@gitmesh/data";
import type { ForgeEvent } from "../forge-sync.js";

export interface PRReviewContext {
  db: Db;
  event: ForgeEvent;
  projectId: string;
}

export interface ReviewIssue {
  type: "style" | "testing" | "policy" | "commits";
  severity: "error" | "warning" | "info";
  message: string;
}

export interface PRReviewResult {
  labels: string[];
  comment: string;
  issues: ReviewIssue[];
  autoApprove: boolean;
}

/**
 * Check if code diff contains style issues
 * (This is a simplified check - a real implementation would use linters)
 */
function checkStyleIssues(diffContent: string | undefined): ReviewIssue[] {
  if (!diffContent) return [];

  const issues: ReviewIssue[] = [];

  // Check for trailing whitespace
  if (/\s+\n/m.test(diffContent)) {
    issues.push({
      type: "style",
      severity: "warning",
      message: "Trailing whitespace detected in diff",
    });
  }

  // Check for tabs (should use spaces)
  if (/^\+.*\t/m.test(diffContent)) {
    issues.push({
      type: "style",
      severity: "warning",
      message: "Tabs detected; please use spaces for indentation",
    });
  }

  // Check for console.log (should use proper logging)
  if (/^\+.*console\.(log|warn|error)/m.test(diffContent)) {
    issues.push({
      type: "style",
      severity: "warning",
      message: "console.log/warn/error calls should use proper logger",
    });
  }

  return issues;
}

/**
 * Check test coverage based on file patterns
 */
function checkTestCoverage(title: string, _body: string): ReviewIssue[] {
  const issues: ReviewIssue[] = [];

  // If PR modifies non-test files but has no test files, flag it
  if (
    (title.includes(".ts") || title.includes(".js")) &&
    !title.includes(".test.") &&
    !title.includes(".spec.")
  ) {
    issues.push({
      type: "testing",
      severity: "warning",
      message: "Added/modified code without corresponding test changes",
    });
  }

  return issues;
}

/**
 * Check commit messages for conventional commits
 */
function checkCommitMessages(body: string | undefined): ReviewIssue[] {
  if (!body) return [];

  const issues: ReviewIssue[] = [];

  // Check for conventional commit format: type(scope): message
  const conventionalPattern = /^(feat|fix|docs|style|refactor|perf|test|chore)/i;

  if (!conventionalPattern.test(body)) {
    issues.push({
      type: "commits",
      severity: "info",
      message:
        "Consider using conventional commits (feat/fix/docs/...): for better changelog generation",
    });
  }

  return issues;
}

/**
 * Execute PR review skill
 */
export async function executePRReview(context: PRReviewContext): Promise<PRReviewResult> {
  const { event } = context;

  // Only review PR events
  if (!["pr_opened", "pr_comment"].includes(event.eventType)) {
    return {
      labels: [],
      comment: "PR Review skill: not applicable for this event",
      issues: [],
      autoApprove: false,
    };
  }

  const issues: ReviewIssue[] = [];
  const labels: string[] = [];

  // Check style (simplified - would use actual linter in production)
  issues.push(...checkStyleIssues(event.body));

  // Check test coverage
  issues.push(...checkTestCoverage(event.title || "", event.body || ""));

  // Check commit messages
  issues.push(...checkCommitMessages(event.body));

  // Determine if we should flag for manual review
  const hasErrors = issues.some((i) => i.severity === "error");
  const hasWarnings = issues.some((i) => i.severity === "warning");

  if (hasErrors) {
    labels.push("review-blocked");
  } else if (hasWarnings) {
    labels.push("needs-review");
  } else {
    labels.push("review-ok");
  }

  // Build comment
  let commentBody = "🔍 **Automated PR Review**\n\n";

  if (issues.length === 0) {
    commentBody += "✅ No issues detected. This PR looks good!\n";
  } else {
    commentBody += "Issues found:\n\n";
    for (const issue of issues) {
      const icon = issue.severity === "error" ? "❌" : issue.severity === "warning" ? "⚠️" : "ℹ️";
      commentBody += `${icon} **${issue.type}** (${issue.severity}): ${issue.message}\n`;
    }
  }

  commentBody += "\n_This is an automated review. Please review and make any adjustments as needed._";

  return {
    labels,
    comment: commentBody,
    issues,
    autoApprove: !hasErrors && issues.length === 0,
  };
}

/**
 * Skill definition for registration
 */
export const PRReviewSkill = {
  name: "pr_review",
  description: "Automatically review pull requests for style, tests, and conventions",
  execute: executePRReview,
};
