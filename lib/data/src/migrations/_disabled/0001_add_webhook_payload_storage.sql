CREATE TABLE IF NOT EXISTS "forge_webhooks" (
	"id" uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
	"project_id" uuid NOT NULL,
	"forge_provider" text NOT NULL,
	"forge_owner" text NOT NULL,
	"forge_repo" text NOT NULL,
	"forge_webhook_id" text,
	"webhook_secret" text,
	"events" jsonb NOT NULL,
	"active" boolean NOT NULL DEFAULT true,
	"last_error" text,
	"last_delivered_at" timestamp with time zone,
	"raw_payload" text,
	"delivery_status" text NOT NULL DEFAULT 'unknown',
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	"updated_at" timestamp with time zone NOT NULL DEFAULT now(),
	CONSTRAINT "forge_webhooks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action
);

CREATE INDEX IF NOT EXISTS "forge_webhooks_project_provider_idx" ON "forge_webhooks" ("project_id","forge_provider");
CREATE INDEX IF NOT EXISTS "forge_webhooks_forge_webhook_id_idx" ON "forge_webhooks" ("forge_webhook_id");
