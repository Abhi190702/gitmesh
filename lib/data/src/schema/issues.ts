import {
  type AnyPgColumn,
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { subprojects } from "./subprojects.js";
import { goals } from "./goals.js";
import { projects } from "./projects.js";
import { heartbeatRuns } from "./heartbeat_runs.js";

export const issues = pgTable(
  "issues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    subprojectId: uuid("subproject_id").references(() => subprojects.id),
    goalId: uuid("goal_id").references(() => goals.id),
    parentId: uuid("parent_id").references((): AnyPgColumn => issues.id),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("backlog"),
    priority: text("priority").notNull().default("medium"),
    assigneeAgentId: uuid("assignee_agent_id").references(() => agents.id),
    assigneeUserId: text("assignee_user_id"),
    checkoutRunId: uuid("checkout_run_id").references(() => heartbeatRuns.id, { onDelete: "set null" }),
    executionRunId: uuid("execution_run_id").references(() => heartbeatRuns.id, { onDelete: "set null" }),
    executionAgentNameKey: text("execution_agent_name_key"),
    executionLockedAt: timestamp("execution_locked_at", { withTimezone: true }),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id),
    createdByUserId: text("created_by_user_id"),
    issueNumber: integer("issue_number"),
    identifier: text("identifier"),
    requestDepth: integer("request_depth").notNull().default(0),
    billingCode: text("billing_code"),
    assigneeAdapterOverrides: jsonb("assignee_adapter_overrides").$type<Record<string, unknown>>(),
    /** Forge issue number (e.g., GitHub issue #42) */
    forgeIssueNumber: integer("forge_issue_number"),
    /** Forge PR number if this issue tracks a PR */
    forgePrNumber: integer("forge_pr_number"),
    /** URL on the forge */
    forgeUrl: text("forge_url"),
    /** State on the forge (open/closed/merged) */
    forgeState: text("forge_state"),
    /** Last time forge data was synced */
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    projectStatusIdx: index("issues_project_status_idx").on(table.projectId, table.status),
    assigneeStatusIdx: index("issues_project_assignee_status_idx").on(
      table.projectId,
      table.assigneeAgentId,
      table.status,
    ),
    assigneeUserStatusIdx: index("issues_project_assignee_user_status_idx").on(
      table.projectId,
      table.assigneeUserId,
      table.status,
    ),
    parentIdx: index("issues_project_parent_idx").on(table.projectId, table.parentId),
    subprojectIdx: index("issues_subproject_idx").on(table.subprojectId),
    identifierIdx: uniqueIndex("issues_identifier_idx").on(table.identifier),
    forgeIssueIdx: index("issues_forge_issue_idx").on(table.projectId, table.forgeIssueNumber),
  }),
);
