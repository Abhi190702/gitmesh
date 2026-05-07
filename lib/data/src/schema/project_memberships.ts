import { pgTable, uuid, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";

export const projectMemberships = pgTable(
  "project_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    principalType: text("principal_type").notNull(),
    principalId: text("principal_id").notNull(),
    status: text("status").notNull().default("active"),
    membershipRole: text("membership_role"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    projectPrincipalUniqueIdx: uniqueIndex("project_memberships_project_principal_unique_idx").on(
      table.projectId,
      table.principalType,
      table.principalId,
    ),
    principalStatusIdx: index("project_memberships_principal_status_idx").on(
      table.principalType,
      table.principalId,
      table.status,
    ),
    projectStatusIdx: index("project_memberships_project_status_idx").on(table.projectId, table.status),
  }),
);
