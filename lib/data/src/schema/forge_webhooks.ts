import { pgTable, uuid, text, timestamp, jsonb, boolean, index } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";

/**
 * Tracks registered forge webhooks for each project.
 * When a project is connected to a forge (GitHub/GitLab/Forgejo),
 * a webhook is registered and its details stored here for lifecycle management.
 */
export const forgeWebhooks = pgTable(
  "forge_webhooks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    /** Forge provider: github | gitlab | forgejo */
    forgeProvider: text("forge_provider").notNull(),
    /** Owner/org on the forge */
    forgeOwner: text("forge_owner").notNull(),
    /** Repository name on the forge */
    forgeRepo: text("forge_repo").notNull(),
    /** Webhook ID returned by the forge API */
    forgeWebhookId: text("forge_webhook_id"),
    /** Secret used to validate incoming webhook payloads */
    webhookSecret: text("webhook_secret"),
    /** Events this webhook is subscribed to */
    events: jsonb("events").$type<string[]>().notNull(),
    /** Whether the webhook is currently active */
    active: boolean("active").notNull().default(true),
    /** Last error from the forge when delivering this webhook */
    lastError: text("last_error"),
    /** Last time a webhook payload was successfully received */
    lastDeliveredAt: timestamp("last_delivered_at", { withTimezone: true }),
    /** Full raw payload from the last webhook delivery (for replay/debugging) */
    rawPayload: text("raw_payload"),
    /** Status of the last webhook delivery: received | processed | failed */
    deliveryStatus: text("delivery_status").notNull().default("unknown"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    projectProviderIdx: index("forge_webhooks_project_provider_idx").on(
      table.projectId,
      table.forgeProvider,
    ),
    forgeWebhookIdIdx: index("forge_webhooks_forge_webhook_id_idx").on(table.forgeWebhookId),
  }),
);
