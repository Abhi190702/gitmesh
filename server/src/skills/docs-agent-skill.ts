/**
 * Docs Agent Skill
 * 
 * Autonomous documentation agent
 * - Detects undocumented code changes
 * - Generates documentation stubs
 * - Enforces documentation standards
 * - Monitors doc staleness
 */

import { Db } from "@gitmesh/data";

export interface CodeChange {
  file: string;
  type: "added" | "modified" | "deleted";
  additions: number;
  deletions: number;
  diff?: string;
}

export interface DocumentationRequirement {
  file: string;
  changeType: "added" | "modified" | "deleted";
  suggestedDocPath: string;
  priority: "critical" | "high" | "medium";
  reason: string;
  suggestedContent?: string;
}

export function docsAgentSkill(db: Db) {
  return {
    /**
     * Analyze code changes and identify undocumented changes
     */
    async analyzeCodeChanges(
      projectId: string,
      changes: CodeChange[]
    ): Promise<DocumentationRequirement[]> {
      const requirements: DocumentationRequirement[] = [];

      for (const change of changes) {
        // Pattern: new files in src/ directories typically need documentation
        if (change.type === "added" && change.file.includes("/src/")) {
          // Check if it's a public API file (not test, not internal)
          if (
            !change.file.includes(".test.") &&
            !change.file.includes(".spec.") &&
            !change.file.startsWith("__")
          ) {
            requirements.push({
              file: change.file,
              changeType: "added",
              suggestedDocPath: `docs/${change.file.replace(/\.ts$/, ".md")}`,
              priority: "high",
              reason: `New file added with ${change.additions} lines - documentation required`,
              suggestedContent: generateDocStub(change.file),
            });
          }
        }

        // Pattern: large modifications to public files
        if (change.type === "modified" && change.additions > 50) {
          if (
            !change.file.includes(".test.") &&
            !change.file.startsWith("__")
          ) {
            requirements.push({
              file: change.file,
              changeType: "modified",
              suggestedDocPath: `docs/${change.file.replace(/\.ts$/, ".md")}`,
              priority: "medium",
              reason: `Significant modification with ${change.additions} lines added - documentation update recommended`,
            });
          }
        }

        // Pattern: API route files absolutely must be documented
        if (
          change.file.includes("/routes/") ||
          change.file.includes("/api/")
        ) {
          requirements.push({
            file: change.file,
            changeType: change.type,
            suggestedDocPath: `docs/${change.file.replace(/\.ts$/, ".md")}`,
            priority: "critical",
            reason: "API route files must have endpoint documentation",
          });
        }
      }

      return requirements;
    },

    /**
     * Check for stale documentation (docs older than code)
     */
    async checkDocStaleness(
      projectId: string,
      codeFiles: Array<{ path: string; lastModified: Date }>,
      docFiles: Array<{ path: string; lastModified: Date }>
    ): Promise<
      Array<{
        docFile: string;
        lastModified: Date;
        lastCodeUpdateDaysAgo: number;
        staleness: "fresh" | "outdated" | "critical";
      }>
    > {
      const results = [];

      for (const doc of docFiles) {
        // Extract corresponding code file from doc path
        // e.g., docs/src-services-auth.md -> src/services/auth.ts
        const possibleCodeFiles = codeFiles.filter((cf) => {
          const docBase = doc.path
            .replace(/^docs\//, "")
            .replace(/\.md$/, "")
            .replace(/-/g, "/");
          return cf.path.includes(docBase);
        });

        if (possibleCodeFiles.length > 0) {
          const latestCodeUpdate = possibleCodeFiles.sort(
            (a, b) => b.lastModified.getTime() - a.lastModified.getTime()
          )[0];

          const daysSinceCodeChange = Math.floor(
            (Date.now() - latestCodeUpdate.lastModified.getTime()) /
              (1000 * 60 * 60 * 24)
          );

          let staleness: "fresh" | "outdated" | "critical" = "fresh";
          if (daysSinceCodeChange > 90) staleness = "critical";
          else if (daysSinceCodeChange > 30) staleness = "outdated";

          results.push({
            docFile: doc.path,
            lastModified: doc.lastModified,
            lastCodeUpdateDaysAgo: daysSinceCodeChange,
            staleness,
          });
        }
      }

      return results.sort((a, b) => b.lastCodeUpdateDaysAgo - a.lastCodeUpdateDaysAgo);
    },

    /**
     * Validate documentation follows project standards
     */
    async validateDocStandards(
      projectId: string,
      docContent: string,
      docPath: string
    ): Promise<
      Array<{
        rule: string;
        severity: "error" | "warning";
        message: string;
        suggestion?: string;
      }>
    > {
      const issues: Array<{
        rule: string;
        severity: "error" | "warning";
        message: string;
        suggestion?: string;
      }> = [];

      // Rule: Must have title
      if (!docContent.includes("#")) {
        issues.push({
          rule: "header",
          severity: "error",
          message: "Documentation must start with a title (# Title)",
          suggestion: "Add a title at the top of the document",
        });
      }

      // Rule: Must have description section
      if (!docContent.toLowerCase().includes("## description")) {
        issues.push({
          rule: "description_section",
          severity: "warning",
          message: "Documentation should include a Description section",
          suggestion: "Add ## Description with overview",
        });
      }

      // Rule: API docs must have examples
      if (
        docPath.includes("/api/") &&
        !docContent.includes("```") &&
        !docContent.includes("example")
      ) {
        issues.push({
          rule: "examples",
          severity: "error",
          message: "API documentation must include code examples",
          suggestion: "Add ## Examples section with code snippet",
        });
      }

      // Rule: Long docs should have table of contents
      if (
        docContent.length > 5000 &&
        !docContent.includes("## Table of Contents") &&
        !docContent.includes("## Contents")
      ) {
        issues.push({
          rule: "toc",
          severity: "warning",
          message: "Large documents should include a Table of Contents",
          suggestion:
            "Add ## Table of Contents with links to major sections",
        });
      }

      // Rule: Must not have broken links
      const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
      const brokenLinks = [];
      let match;
      while ((match = linkPattern.exec(docContent)) !== null) {
        const linkTarget = match[2];
        // Very basic check: should start with / or http or be relative
        if (
          !linkTarget.startsWith("/") &&
          !linkTarget.startsWith("http") &&
          !linkTarget.startsWith(".") &&
          linkTarget.includes(" ")
        ) {
          brokenLinks.push(linkTarget);
        }
      }

      if (brokenLinks.length > 0) {
        issues.push({
          rule: "valid_links",
          severity: "warning",
          message: `Found potentially broken links: ${brokenLinks.join(", ")}`,
          suggestion: "Review and fix links that include spaces",
        });
      }

      return issues;
    },

    /**
     * Generate starter documentation stubs
     */
    generateDocStub,

    /**
     * Get recommended documentation structure
     */
    async getDocumentationStructure(projectId: string): Promise<{
      recommendedPaths: string[];
      missingDocs: string[];
      scanDate: Date;
    }> {
      const recommendedPaths = [
        "docs/README.md",
        "docs/CONTRIBUTING.md",
        "docs/ARCHITECTURE.md",
        "docs/API.md",
        "docs/DEPLOYMENT.md",
        "docs/TROUBLESHOOTING.md",
      ];

      // In a real implementation, check which actually exist
      const missingDocs = recommendedPaths; // Simplified

      return {
        recommendedPaths,
        missingDocs,
        scanDate: new Date(),
      };
    },
  };
}

/**
 * Generate documentation stub based on file
 */
function generateDocStub(filepath: string): string {
  const filename = filepath.split("/").pop() || "unknown";
  const title = filename.replace(/\.(ts|js)$/, "").replace(/[-_]/g, " ");

  return `# ${title}

## Description

${title} provides...

## Usage

\`\`\`typescript
import { } from '${filepath}';

// Example usage
\`\`\`

## API Reference

### Main Functions

...

## Examples

...

## See Also

- Related files
- Related documentation
`;
}
