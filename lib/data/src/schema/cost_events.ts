import { pgTable, uuid, text, timestamp, integer, index } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";
import { agents } from "./agents.js";
import { issues } from "./issues.js";
import { subprojects } from "./subprojects.js";
import { goals } from "./goals.js";

export const costEvents = pgTable(
  "cost_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    agentId: uuid("agent_id").notNull().references(() => agents.id),
    issueId: uuid("issue_id").references(() => issues.id),
    subprojectId: uuid("subproject_id").references(() => subprojects.id),
    goalId: uuid("goal_id").references(() => goals.id),
    billingCode: text("billing_code"),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costCents: integer("cost_cents").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    projectOccurredIdx: index("cost_events_project_occurred_idx").on(table.projectId, table.occurredAt),
    projectAgentOccurredIdx: index("cost_events_project_agent_occurred_idx").on(
      table.projectId,
      table.agentId,
      table.occurredAt,
    ),
  }),
);
