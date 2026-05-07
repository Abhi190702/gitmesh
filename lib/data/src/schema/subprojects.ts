import { pgTable, uuid, text, timestamp, date, index } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";
import { goals } from "./goals.js";
import { agents } from "./agents.js";

export const subprojects = pgTable(
  "subprojects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    goalId: uuid("goal_id").references(() => goals.id),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("backlog"),
    leadAgentId: uuid("lead_agent_id").references(() => agents.id),
    targetDate: date("target_date"),
    color: text("color"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    projectIdx: index("projects_project_idx").on(table.projectId),
  }),
);
