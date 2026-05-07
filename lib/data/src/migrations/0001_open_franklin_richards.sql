CREATE TABLE "user_push_notification_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"project_id" uuid NOT NULL,
	"provider" text DEFAULT 'fcm' NOT NULL,
	"token" text NOT NULL,
	"device_name" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "activity_log_company_created_idx";--> statement-breakpoint
DROP INDEX "agent_api_keys_company_agent_idx";--> statement-breakpoint
DROP INDEX "agent_config_revisions_company_agent_created_idx";--> statement-breakpoint
DROP INDEX "agent_runtime_state_company_agent_idx";--> statement-breakpoint
DROP INDEX "agent_runtime_state_company_updated_idx";--> statement-breakpoint
DROP INDEX "agent_task_sessions_company_agent_adapter_task_uniq";--> statement-breakpoint
DROP INDEX "agent_task_sessions_company_agent_updated_idx";--> statement-breakpoint
DROP INDEX "agent_task_sessions_company_task_updated_idx";--> statement-breakpoint
DROP INDEX "agent_wakeup_requests_company_agent_status_idx";--> statement-breakpoint
DROP INDEX "agent_wakeup_requests_company_requested_idx";--> statement-breakpoint
DROP INDEX "agents_company_status_idx";--> statement-breakpoint
DROP INDEX "agents_company_reports_to_idx";--> statement-breakpoint
DROP INDEX "approvals_company_status_type_idx";--> statement-breakpoint
DROP INDEX "assets_company_created_idx";--> statement-breakpoint
DROP INDEX "assets_company_provider_idx";--> statement-breakpoint
DROP INDEX "assets_company_object_key_uq";--> statement-breakpoint
DROP INDEX "cost_events_company_occurred_idx";--> statement-breakpoint
DROP INDEX "cost_events_company_agent_occurred_idx";--> statement-breakpoint
DROP INDEX "heartbeat_run_events_company_run_idx";--> statement-breakpoint
DROP INDEX "heartbeat_run_events_company_created_idx";--> statement-breakpoint
DROP INDEX "heartbeat_runs_company_agent_started_idx";--> statement-breakpoint
DROP INDEX "invites_company_invite_state_idx";--> statement-breakpoint
DROP INDEX "issue_attachments_company_issue_idx";--> statement-breakpoint
DROP INDEX "issue_comments_company_issue_created_at_idx";--> statement-breakpoint
DROP INDEX "issue_comments_company_author_issue_created_at_idx";--> statement-breakpoint
DROP INDEX "issue_read_states_company_issue_idx";--> statement-breakpoint
DROP INDEX "issue_read_states_company_user_idx";--> statement-breakpoint
DROP INDEX "issue_read_states_company_issue_user_idx";--> statement-breakpoint
DROP INDEX "join_requests_company_status_type_created_idx";--> statement-breakpoint
DROP INDEX "labels_company_name_idx";--> statement-breakpoint
DROP INDEX "principal_permission_grants_company_permission_idx";--> statement-breakpoint
DROP INDEX "project_memberships_company_principal_unique_idx";--> statement-breakpoint
DROP INDEX "project_memberships_company_status_idx";--> statement-breakpoint
DROP INDEX "project_secrets_company_provider_idx";--> statement-breakpoint
DROP INDEX "project_secrets_company_name_uq";--> statement-breakpoint
ALTER TABLE "invites" ALTER COLUMN "invite_type" SET DEFAULT 'project_join';--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "last_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_push_notification_tokens" ADD CONSTRAINT "user_push_notification_tokens_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_push_notification_tokens" ADD CONSTRAINT "user_push_notification_tokens_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "push_tokens_user_project_idx" ON "user_push_notification_tokens" USING btree ("user_id","project_id");--> statement-breakpoint
CREATE INDEX "push_tokens_token_idx" ON "user_push_notification_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "push_tokens_user_enabled_idx" ON "user_push_notification_tokens" USING btree ("user_id","enabled");--> statement-breakpoint
CREATE INDEX "activity_log_project_created_idx" ON "activity_log" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "agent_api_keys_project_agent_idx" ON "agent_api_keys" USING btree ("project_id","agent_id");--> statement-breakpoint
CREATE INDEX "agent_config_revisions_project_agent_created_idx" ON "agent_config_revisions" USING btree ("project_id","agent_id","created_at");--> statement-breakpoint
CREATE INDEX "agent_runtime_state_project_agent_idx" ON "agent_runtime_state" USING btree ("project_id","agent_id");--> statement-breakpoint
CREATE INDEX "agent_runtime_state_project_updated_idx" ON "agent_runtime_state" USING btree ("project_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_task_sessions_project_agent_adapter_task_uniq" ON "agent_task_sessions" USING btree ("project_id","agent_id","adapter_type","task_key");--> statement-breakpoint
CREATE INDEX "agent_task_sessions_project_agent_updated_idx" ON "agent_task_sessions" USING btree ("project_id","agent_id","updated_at");--> statement-breakpoint
CREATE INDEX "agent_task_sessions_project_task_updated_idx" ON "agent_task_sessions" USING btree ("project_id","task_key","updated_at");--> statement-breakpoint
CREATE INDEX "agent_wakeup_requests_project_agent_status_idx" ON "agent_wakeup_requests" USING btree ("project_id","agent_id","status");--> statement-breakpoint
CREATE INDEX "agent_wakeup_requests_project_requested_idx" ON "agent_wakeup_requests" USING btree ("project_id","requested_at");--> statement-breakpoint
CREATE INDEX "agents_project_status_idx" ON "agents" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "agents_project_reports_to_idx" ON "agents" USING btree ("project_id","reports_to");--> statement-breakpoint
CREATE INDEX "approvals_project_status_type_idx" ON "approvals" USING btree ("project_id","status","type");--> statement-breakpoint
CREATE INDEX "assets_project_created_idx" ON "assets" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "assets_project_provider_idx" ON "assets" USING btree ("project_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "assets_project_object_key_uq" ON "assets" USING btree ("project_id","object_key");--> statement-breakpoint
CREATE INDEX "cost_events_project_occurred_idx" ON "cost_events" USING btree ("project_id","occurred_at");--> statement-breakpoint
CREATE INDEX "cost_events_project_agent_occurred_idx" ON "cost_events" USING btree ("project_id","agent_id","occurred_at");--> statement-breakpoint
CREATE INDEX "heartbeat_run_events_project_run_idx" ON "heartbeat_run_events" USING btree ("project_id","run_id");--> statement-breakpoint
CREATE INDEX "heartbeat_run_events_project_created_idx" ON "heartbeat_run_events" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "heartbeat_runs_project_agent_started_idx" ON "heartbeat_runs" USING btree ("project_id","agent_id","started_at");--> statement-breakpoint
CREATE INDEX "invites_project_invite_state_idx" ON "invites" USING btree ("project_id","invite_type","revoked_at","expires_at");--> statement-breakpoint
CREATE INDEX "issue_attachments_project_issue_idx" ON "issue_attachments" USING btree ("project_id","issue_id");--> statement-breakpoint
CREATE INDEX "issue_comments_project_issue_created_at_idx" ON "issue_comments" USING btree ("project_id","issue_id","created_at");--> statement-breakpoint
CREATE INDEX "issue_comments_project_author_issue_created_at_idx" ON "issue_comments" USING btree ("project_id","author_user_id","issue_id","created_at");--> statement-breakpoint
CREATE INDEX "issue_read_states_project_issue_idx" ON "issue_read_states" USING btree ("project_id","issue_id");--> statement-breakpoint
CREATE INDEX "issue_read_states_project_user_idx" ON "issue_read_states" USING btree ("project_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "issue_read_states_project_issue_user_idx" ON "issue_read_states" USING btree ("project_id","issue_id","user_id");--> statement-breakpoint
CREATE INDEX "join_requests_project_status_type_created_idx" ON "join_requests" USING btree ("project_id","status","request_type","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "labels_project_name_idx" ON "labels" USING btree ("project_id","name");--> statement-breakpoint
CREATE INDEX "principal_permission_grants_project_permission_idx" ON "principal_permission_grants" USING btree ("project_id","permission_key");--> statement-breakpoint
CREATE UNIQUE INDEX "project_memberships_project_principal_unique_idx" ON "project_memberships" USING btree ("project_id","principal_type","principal_id");--> statement-breakpoint
CREATE INDEX "project_memberships_project_status_idx" ON "project_memberships" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "project_secrets_project_provider_idx" ON "project_secrets" USING btree ("project_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "project_secrets_project_name_uq" ON "project_secrets" USING btree ("project_id","name");