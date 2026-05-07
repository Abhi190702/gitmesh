import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { projects } from "./projects.js";
import { subprojects } from "./subprojects.js";

export const projectWorkspaces = pgTable(
  "project_workspaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    subprojectId: uuid("subproject_id").notNull().references(() => subprojects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    cwd: text("cwd"),
    repoUrl: text("repo_url"),
    repoRef: text("repo_ref"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    projectProjectIdx: index("project_workspaces_project_subproject_idx").on(table.projectId, table.subprojectId),
    subprojectPrimaryIdx: index("project_workspaces_subproject_primary_idx").on(table.subprojectId, table.isPrimary),
  }),
);
