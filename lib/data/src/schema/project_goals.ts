import { pgTable, uuid, timestamp, index, primaryKey } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";
import { subprojects } from "./subprojects.js";
import { goals } from "./goals.js";

export const projectGoals = pgTable(
  "project_goals",
  {
    subprojectId: uuid("subproject_id").notNull().references(() => subprojects.id, { onDelete: "cascade" }),
    goalId: uuid("goal_id").notNull().references(() => goals.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.subprojectId, table.goalId] }),
    subprojectIdx: index("project_goals_subproject_idx").on(table.subprojectId),
    goalIdx: index("project_goals_goal_idx").on(table.goalId),
    projectIdx: index("project_goals_project_idx").on(table.projectId),
  }),
);
