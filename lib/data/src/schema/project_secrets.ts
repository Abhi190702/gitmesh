import { pgTable, uuid, text, timestamp, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";
import { agents } from "./agents.js";

export const projectSecrets = pgTable(
  "project_secrets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    name: text("name").notNull(),
    provider: text("provider").notNull().default("local_encrypted"),
    externalRef: text("external_ref"),
    latestVersion: integer("latest_version").notNull().default(1),
    description: text("description"),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    projectIdx: index("project_secrets_project_idx").on(table.projectId),
    projectProviderIdx: index("project_secrets_project_provider_idx").on(table.projectId, table.provider),
    projectNameUq: uniqueIndex("project_secrets_project_name_uq").on(table.projectId, table.name),
  }),
);
