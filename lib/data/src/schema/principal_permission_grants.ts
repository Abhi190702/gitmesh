import { pgTable, uuid, text, timestamp, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";

export const principalPermissionGrants = pgTable(
  "principal_permission_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    principalType: text("principal_type").notNull(),
    principalId: text("principal_id").notNull(),
    permissionKey: text("permission_key").notNull(),
    scope: jsonb("scope").$type<Record<string, unknown> | null>(),
    grantedByUserId: text("granted_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueGrantIdx: uniqueIndex("principal_permission_grants_unique_idx").on(
      table.projectId,
      table.principalType,
      table.principalId,
      table.permissionKey,
    ),
    projectPermissionIdx: index("principal_permission_grants_project_permission_idx").on(
      table.projectId,
      table.permissionKey,
    ),
  }),
);
