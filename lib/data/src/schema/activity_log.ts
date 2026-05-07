import { pgTable, uuid, text, timestamp, jsonb, integer, index } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";
import { agents } from "./agents.js";
import { heartbeatRuns } from "./heartbeat_runs.js";

export const activityLog = pgTable(
  "activity_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    actorType: text("actor_type").notNull().default("system"),
    actorId: text("actor_id").notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    agentId: uuid("agent_id").references(() => agents.id),
    runId: uuid("run_id").references(() => heartbeatRuns.id),
    details: jsonb("details").$type<Record<string, unknown>>(),
    /** Policy version that evaluated this action */
    policyVersion: integer("policy_version"),
    /** Policy outcome: allowed | blocked */
    policyOutcome: text("policy_outcome"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    projectCreatedIdx: index("activity_log_project_created_idx").on(table.projectId, table.createdAt),
    runIdIdx: index("activity_log_run_id_idx").on(table.runId),
    entityIdx: index("activity_log_entity_type_id_idx").on(table.entityType, table.entityId),
  }),
);
