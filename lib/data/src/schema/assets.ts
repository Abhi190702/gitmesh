import { pgTable, uuid, text, integer, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";
import { agents } from "./agents.js";

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    provider: text("provider").notNull(),
    objectKey: text("object_key").notNull(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    sha256: text("sha256").notNull(),
    originalFilename: text("original_filename"),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    projectCreatedIdx: index("assets_project_created_idx").on(table.projectId, table.createdAt),
    projectProviderIdx: index("assets_project_provider_idx").on(table.projectId, table.provider),
    projectObjectKeyUq: uniqueIndex("assets_project_object_key_uq").on(table.projectId, table.objectKey),
  }),
);
