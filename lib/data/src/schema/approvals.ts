import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";
import { agents } from "./agents.js";

export const approvals = pgTable(
  "approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    type: text("type").notNull(),
    requestedByAgentId: uuid("requested_by_agent_id").references(() => agents.id),
    requestedByUserId: text("requested_by_user_id"),
    status: text("status").notNull().default("pending"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    decisionNote: text("decision_note"),
    decidedByUserId: text("decided_by_user_id"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    projectStatusTypeIdx: index("approvals_project_status_type_idx").on(
      table.projectId,
      table.status,
      table.type,
    ),
  }),
);
