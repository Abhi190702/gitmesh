import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";
import { approvals } from "./approvals.js";
import { agents } from "./agents.js";

export const approvalComments = pgTable(
  "approval_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    approvalId: uuid("approval_id").notNull().references(() => approvals.id),
    authorAgentId: uuid("author_agent_id").references(() => agents.id),
    authorUserId: text("author_user_id"),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    projectIdx: index("approval_comments_project_idx").on(table.projectId),
    approvalIdx: index("approval_comments_approval_idx").on(table.approvalId),
    approvalCreatedIdx: index("approval_comments_approval_created_idx").on(
      table.approvalId,
      table.createdAt,
    ),
  }),
);
