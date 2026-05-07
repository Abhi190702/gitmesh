import { pgTable, uuid, text, timestamp, index, primaryKey } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";
import { issues } from "./issues.js";
import { approvals } from "./approvals.js";
import { agents } from "./agents.js";

export const issueApprovals = pgTable(
  "issue_approvals",
  {
    projectId: uuid("project_id").notNull().references(() => projects.id),
    issueId: uuid("issue_id").notNull().references(() => issues.id, { onDelete: "cascade" }),
    approvalId: uuid("approval_id").notNull().references(() => approvals.id, { onDelete: "cascade" }),
    linkedByAgentId: uuid("linked_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    linkedByUserId: text("linked_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.issueId, table.approvalId], name: "issue_approvals_pk" }),
    issueIdx: index("issue_approvals_issue_idx").on(table.issueId),
    approvalIdx: index("issue_approvals_approval_idx").on(table.approvalId),
    projectIdx: index("issue_approvals_project_idx").on(table.projectId),
  }),
);
