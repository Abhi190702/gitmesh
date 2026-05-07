import {
    pgTable,
    uuid,
    text,
    integer,
    timestamp,
    boolean,
    jsonb,
    index,
} from "drizzle-orm/pg-core";
import { authUsers } from "./auth.js";

/**
 * Project Templates Registry
 *
 * Stores reusable project configuration templates that include:
 * - Agent team composition (roles, budgets, schedules)
 * - Policy rule presets
 * - Project archetype metadata
 *
 * Templates can be community-contributed or system-provided defaults.
 */
export const projectTemplates = pgTable(
    "project_templates",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        name: text("name").notNull(),
        description: text("description"),
        /** Template archetype: cli_tool, js_library, infrastructure, cncf_sandbox, solo_maintainer */
        archetype: text("archetype").notNull().default("cli_tool"),
        /** JSON array of agent configurations */
        agents: jsonb("agents").$type<Array<{
            role: string;
            name: string;
            schedule?: string;
            triggers?: string[];
            budget: number;
        }>>().notNull().default([]),
        /** JSON array of policy definitions */
        policies: jsonb("policies").$type<Array<{
            name: string;
            actionPattern: string;
            conditions?: Record<string, unknown>;
            effect: string;
            priority?: number;
        }>>().notNull().default([]),
        /** Semantic version */
        version: text("version").notNull().default("1.0.0"),
        /** Author user ID */
        authorId: text("author_id").references(() => authUsers.id),
        /** Whether this template is publicly listed */
        communityContributed: boolean("community_contributed").notNull().default(false),
        /** Featured flag (admin-promoted) */
        featured: boolean("featured").notNull().default(false),
        /** Download/usage counter */
        downloadCount: integer("download_count").notNull().default(0),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => ({
        archetypeIdx: index("project_templates_archetype_idx").on(table.archetype),
        communityIdx: index("project_templates_community_idx").on(table.communityContributed),
        authorIdx: index("project_templates_author_idx").on(table.authorId),
    }),
);
