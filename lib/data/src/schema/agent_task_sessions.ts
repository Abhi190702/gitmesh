import { pgTable, uuid, text, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";
import { agents } from "./agents.js";
import { heartbeatRuns } from "./heartbeat_runs.js";

export const agentTaskSessions = pgTable(
  "agent_task_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    agentId: uuid("agent_id").notNull().references(() => agents.id),
    adapterType: text("adapter_type").notNull(),
    taskKey: text("task_key").notNull(),
    sessionParamsJson: jsonb("session_params_json").$type<Record<string, unknown>>(),
    sessionDisplayId: text("session_display_id"),
    lastRunId: uuid("last_run_id").references(() => heartbeatRuns.id),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    projectAgentTaskUniqueIdx: uniqueIndex("agent_task_sessions_project_agent_adapter_task_uniq").on(
      table.projectId,
      table.agentId,
      table.adapterType,
      table.taskKey,
    ),
    projectAgentUpdatedIdx: index("agent_task_sessions_project_agent_updated_idx").on(
      table.projectId,
      table.agentId,
      table.updatedAt,
    ),
    projectTaskUpdatedIdx: index("agent_task_sessions_project_task_updated_idx").on(
      table.projectId,
      table.taskKey,
      table.updatedAt,
    ),
  }),
);
