import { pgTable, uuid, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";
import { issues } from "./issues.js";

export const issueReadStates = pgTable(
  "issue_read_states",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    issueId: uuid("issue_id").notNull().references(() => issues.id),
    userId: text("user_id").notNull(),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    projectIssueIdx: index("issue_read_states_project_issue_idx").on(table.projectId, table.issueId),
    projectUserIdx: index("issue_read_states_project_user_idx").on(table.projectId, table.userId),
    projectIssueUserUnique: uniqueIndex("issue_read_states_project_issue_user_idx").on(
      table.projectId,
      table.issueId,
      table.userId,
    ),
  }),
);
