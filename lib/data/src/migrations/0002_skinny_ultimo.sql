CREATE TABLE "activity_attestation_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activity_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_attestations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activity_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"signing_key_version" integer NOT NULL,
	"signed_payload" text NOT NULL,
	"payload_hash" text NOT NULL,
	"signature" text NOT NULL,
	"algorithm" text DEFAULT 'ed25519' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "attestation_public_key" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "attestation_key_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "activity_attestation_queue" ADD CONSTRAINT "activity_attestation_queue_activity_id_activity_log_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activity_log"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_attestation_queue" ADD CONSTRAINT "activity_attestation_queue_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_attestations" ADD CONSTRAINT "activity_attestations_activity_id_activity_log_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activity_log"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_attestations" ADD CONSTRAINT "activity_attestations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "activity_attestation_queue_activity_uniq" ON "activity_attestation_queue" USING btree ("activity_id");--> statement-breakpoint
CREATE INDEX "activity_attestation_queue_next_idx" ON "activity_attestation_queue" USING btree ("next_attempt_at");--> statement-breakpoint
CREATE UNIQUE INDEX "activity_attestations_activity_uniq" ON "activity_attestations" USING btree ("activity_id");--> statement-breakpoint
CREATE INDEX "activity_attestations_project_created_idx" ON "activity_attestations" USING btree ("project_id","created_at");