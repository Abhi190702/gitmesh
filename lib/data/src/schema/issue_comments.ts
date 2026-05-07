import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";
import { issues } from "./issues.js";
import { agents } from "./agents.js";

export const issueComments = pgTable(
  "issue_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    issueId: uuid("issue_id").notNull().references(() => issues.id),
    authorAgentId: uuid("author_agent_id").references(() => agents.id),
    authorUserId: text("author_user_id"),
    body: text("body").notNull(),
    /** Forge comment ID for sync */
    forgeCommentId: text("forge_comment_id"),
    /** Direction of sync: inbound (from forge) or outbound (to forge) */
    syncDirection: text("sync_direction"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    issueIdx: index("issue_comments_issue_idx").on(table.issueId),
    projectIdx: index("issue_comments_project_idx").on(table.projectId),
    projectIssueCreatedAtIdx: index("issue_comments_project_issue_created_at_idx").on(
      table.projectId,
      table.issueId,
      table.createdAt,
    ),
    projectAuthorIssueCreatedAtIdx: index("issue_comments_project_author_issue_created_at_idx").on(
      table.projectId,
      table.authorUserId,
      table.issueId,
      table.createdAt,
    ),
  }),
);
