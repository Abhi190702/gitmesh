import { pgTable, uuid, text, integer, timestamp, boolean, uniqueIndex } from "drizzle-orm/pg-core";

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("active"),
    issuePrefix: text("issue_prefix").notNull().default("GM"),
    issueCounter: integer("issue_counter").notNull().default(0),
    budgetMonthlyCents: integer("budget_monthly_cents").notNull().default(0),
    spentMonthlyCents: integer("spent_monthly_cents").notNull().default(0),
    requireOperatorApprovalForNewAgents: boolean("require_board_approval_for_new_agents")
      .notNull()
      .default(true),
    brandColor: text("brand_color"),
    /** URL of the repository this project tracks */
    repoUrl: text("repo_url"),
    /** Forge provider: github | gitlab | forgejo */
    forgeProvider: text("forge_provider"),
    /** Owner / org on the forge */
    forgeOwner: text("forge_owner"),
    /** Repository name on the forge */
    forgeRepo: text("forge_repo"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    /** Last time issues were pulled from the forge (via periodic sync or webhook) */
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),

    /**
     * Project-scoped Ed25519 public key (PEM SPKI) for verifying
     * `activity_attestations`. The matching private key lives in the
     * project's secret store under name `_attestation_signing_key`.
     */
    attestationPublicKey: text("attestation_public_key"),
    /** Bumps on key rotation; current attestations record this version. */
    attestationKeyVersion: integer("attestation_key_version").notNull().default(1),
  },
  (table) => ({
    issuePrefixUniqueIdx: uniqueIndex("projects_issue_prefix_idx").on(table.issuePrefix),
  }),
);
