CREATE TABLE "activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"actor_type" text DEFAULT 'system' NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"agent_id" uuid,
	"run_id" uuid,
	"details" jsonb,
	"policy_version" integer,
	"policy_outcome" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_config_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"created_by_agent_id" uuid,
	"created_by_user_id" text,
	"source" text DEFAULT 'patch' NOT NULL,
	"rolled_back_from_revision_id" uuid,
	"changed_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"before_config" jsonb NOT NULL,
	"after_config" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"version" integer DEFAULT 1 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"action_pattern" text NOT NULL,
	"conditions" jsonb,
	"effect" text DEFAULT 'allow' NOT NULL,
	"effect_config" jsonb,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_runtime_state" (
	"agent_id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"adapter_type" text NOT NULL,
	"session_id" text,
	"state_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_run_id" uuid,
	"last_run_status" text,
	"total_input_tokens" bigint DEFAULT 0 NOT NULL,
	"total_output_tokens" bigint DEFAULT 0 NOT NULL,
	"total_cached_input_tokens" bigint DEFAULT 0 NOT NULL,
	"total_cost_cents" bigint DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_task_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"adapter_type" text NOT NULL,
	"task_key" text NOT NULL,
	"session_params_json" jsonb,
	"session_display_id" text,
	"last_run_id" uuid,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_wakeup_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"source" text NOT NULL,
	"trigger_detail" text,
	"reason" text,
	"payload" jsonb,
	"status" text DEFAULT 'queued' NOT NULL,
	"coalesced_count" integer DEFAULT 0 NOT NULL,
	"requested_by_actor_type" text,
	"requested_by_actor_id" text,
	"idempotency_key" text,
	"run_id" uuid,
	"forge_event_type" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'general' NOT NULL,
	"title" text,
	"icon" text,
	"status" text DEFAULT 'idle' NOT NULL,
	"reports_to" uuid,
	"capabilities" text,
	"adapter_type" text DEFAULT 'process' NOT NULL,
	"adapter_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"runtime_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"budget_monthly_cents" integer DEFAULT 0 NOT NULL,
	"spent_monthly_cents" integer DEFAULT 0 NOT NULL,
	"permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_heartbeat_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approval_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"approval_id" uuid NOT NULL,
	"author_agent_id" uuid,
	"author_user_id" text,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"type" text NOT NULL,
	"requested_by_agent_id" uuid,
	"requested_by_user_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"payload" jsonb NOT NULL,
	"decision_note" text,
	"decided_by_user_id" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"object_key" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"sha256" text NOT NULL,
	"original_filename" text,
	"created_by_agent_id" uuid,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "cost_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"issue_id" uuid,
	"subproject_id" uuid,
	"goal_id" uuid,
	"billing_code" text,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_cents" integer NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forge_webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"forge_provider" text NOT NULL,
	"forge_owner" text NOT NULL,
	"forge_repo" text NOT NULL,
	"forge_webhook_id" text,
	"webhook_secret" text,
	"events" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_error" text,
	"last_delivered_at" timestamp with time zone,
	"raw_payload" text,
	"delivery_status" text DEFAULT 'unknown' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"level" text DEFAULT 'task' NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"parent_id" uuid,
	"owner_agent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "heartbeat_run_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"event_type" text NOT NULL,
	"stream" text,
	"level" text,
	"color" text,
	"message" text,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "heartbeat_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"invocation_source" text DEFAULT 'on_demand' NOT NULL,
	"trigger_detail" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"error" text,
	"wakeup_request_id" uuid,
	"exit_code" integer,
	"signal" text,
	"usage_json" jsonb,
	"result_json" jsonb,
	"session_id_before" text,
	"session_id_after" text,
	"log_store" text,
	"log_ref" text,
	"log_bytes" bigint,
	"log_sha256" text,
	"log_compressed" boolean DEFAULT false NOT NULL,
	"stdout_excerpt" text,
	"stderr_excerpt" text,
	"error_code" text,
	"external_run_id" text,
	"context_snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instance_user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'instance_admin' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"invite_type" text DEFAULT 'company_join' NOT NULL,
	"token_hash" text NOT NULL,
	"allowed_join_types" text DEFAULT 'both' NOT NULL,
	"defaults_payload" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"invited_by_user_id" text,
	"revoked_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issue_approvals" (
	"project_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"approval_id" uuid NOT NULL,
	"linked_by_agent_id" uuid,
	"linked_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issue_approvals_pk" PRIMARY KEY("issue_id","approval_id")
);
--> statement-breakpoint
CREATE TABLE "issue_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"issue_comment_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issue_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"author_agent_id" uuid,
	"author_user_id" text,
	"body" text NOT NULL,
	"forge_comment_id" text,
	"sync_direction" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issue_labels" (
	"issue_id" uuid NOT NULL,
	"label_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issue_labels_pk" PRIMARY KEY("issue_id","label_id")
);
--> statement-breakpoint
CREATE TABLE "issue_read_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"last_read_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"subproject_id" uuid,
	"goal_id" uuid,
	"parent_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'backlog' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"assignee_agent_id" uuid,
	"assignee_user_id" text,
	"checkout_run_id" uuid,
	"execution_run_id" uuid,
	"execution_agent_name_key" text,
	"execution_locked_at" timestamp with time zone,
	"created_by_agent_id" uuid,
	"created_by_user_id" text,
	"issue_number" integer,
	"identifier" text,
	"request_depth" integer DEFAULT 0 NOT NULL,
	"billing_code" text,
	"assignee_adapter_overrides" jsonb,
	"forge_issue_number" integer,
	"forge_pr_number" integer,
	"forge_url" text,
	"forge_state" text,
	"last_synced_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"hidden_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "join_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invite_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"request_type" text NOT NULL,
	"status" text DEFAULT 'pending_approval' NOT NULL,
	"request_ip" text NOT NULL,
	"requesting_user_id" text,
	"request_email_snapshot" text,
	"agent_name" text,
	"adapter_type" text,
	"capabilities" text,
	"agent_defaults_payload" jsonb,
	"claim_secret_hash" text,
	"claim_secret_expires_at" timestamp with time zone,
	"claim_secret_consumed_at" timestamp with time zone,
	"created_agent_id" uuid,
	"approved_by_user_id" text,
	"approved_at" timestamp with time zone,
	"rejected_by_user_id" text,
	"rejected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "principal_permission_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"principal_type" text NOT NULL,
	"principal_id" text NOT NULL,
	"permission_key" text NOT NULL,
	"scope" jsonb,
	"granted_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_goals" (
	"subproject_id" uuid NOT NULL,
	"goal_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_goals_subproject_id_goal_id_pk" PRIMARY KEY("subproject_id","goal_id")
);
--> statement-breakpoint
CREATE TABLE "project_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"principal_type" text NOT NULL,
	"principal_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"membership_role" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_secret_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"secret_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"material" jsonb NOT NULL,
	"value_sha256" text NOT NULL,
	"created_by_agent_id" uuid,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "project_secrets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"provider" text DEFAULT 'local_encrypted' NOT NULL,
	"external_ref" text,
	"latest_version" integer DEFAULT 1 NOT NULL,
	"description" text,
	"created_by_agent_id" uuid,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"archetype" text DEFAULT 'cli_tool' NOT NULL,
	"agents" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"policies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"version" text DEFAULT '1.0.0' NOT NULL,
	"author_id" text,
	"community_contributed" boolean DEFAULT false NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"download_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"subproject_id" uuid NOT NULL,
	"name" text NOT NULL,
	"cwd" text,
	"repo_url" text,
	"repo_ref" text,
	"metadata" jsonb,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"issue_prefix" text DEFAULT 'GM' NOT NULL,
	"issue_counter" integer DEFAULT 0 NOT NULL,
	"budget_monthly_cents" integer DEFAULT 0 NOT NULL,
	"spent_monthly_cents" integer DEFAULT 0 NOT NULL,
	"require_board_approval_for_new_agents" boolean DEFAULT true NOT NULL,
	"brand_color" text,
	"repo_url" text,
	"forge_provider" text,
	"forge_owner" text,
	"forge_repo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subprojects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"goal_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'backlog' NOT NULL,
	"lead_agent_id" uuid,
	"target_date" date,
	"color" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_run_id_heartbeat_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."heartbeat_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_api_keys" ADD CONSTRAINT "agent_api_keys_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_api_keys" ADD CONSTRAINT "agent_api_keys_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_config_revisions" ADD CONSTRAINT "agent_config_revisions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_config_revisions" ADD CONSTRAINT "agent_config_revisions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_config_revisions" ADD CONSTRAINT "agent_config_revisions_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_policies" ADD CONSTRAINT "agent_policies_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runtime_state" ADD CONSTRAINT "agent_runtime_state_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runtime_state" ADD CONSTRAINT "agent_runtime_state_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_task_sessions" ADD CONSTRAINT "agent_task_sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_task_sessions" ADD CONSTRAINT "agent_task_sessions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_task_sessions" ADD CONSTRAINT "agent_task_sessions_last_run_id_heartbeat_runs_id_fk" FOREIGN KEY ("last_run_id") REFERENCES "public"."heartbeat_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_wakeup_requests" ADD CONSTRAINT "agent_wakeup_requests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_wakeup_requests" ADD CONSTRAINT "agent_wakeup_requests_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_reports_to_agents_id_fk" FOREIGN KEY ("reports_to") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_comments" ADD CONSTRAINT "approval_comments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_comments" ADD CONSTRAINT "approval_comments_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."approvals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_comments" ADD CONSTRAINT "approval_comments_author_agent_id_agents_id_fk" FOREIGN KEY ("author_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_requested_by_agent_id_agents_id_fk" FOREIGN KEY ("requested_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_subproject_id_subprojects_id_fk" FOREIGN KEY ("subproject_id") REFERENCES "public"."subprojects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forge_webhooks" ADD CONSTRAINT "forge_webhooks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_parent_id_goals_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_owner_agent_id_agents_id_fk" FOREIGN KEY ("owner_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartbeat_run_events" ADD CONSTRAINT "heartbeat_run_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartbeat_run_events" ADD CONSTRAINT "heartbeat_run_events_run_id_heartbeat_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."heartbeat_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartbeat_run_events" ADD CONSTRAINT "heartbeat_run_events_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartbeat_runs" ADD CONSTRAINT "heartbeat_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartbeat_runs" ADD CONSTRAINT "heartbeat_runs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartbeat_runs" ADD CONSTRAINT "heartbeat_runs_wakeup_request_id_agent_wakeup_requests_id_fk" FOREIGN KEY ("wakeup_request_id") REFERENCES "public"."agent_wakeup_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_approvals" ADD CONSTRAINT "issue_approvals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_approvals" ADD CONSTRAINT "issue_approvals_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_approvals" ADD CONSTRAINT "issue_approvals_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."approvals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_approvals" ADD CONSTRAINT "issue_approvals_linked_by_agent_id_agents_id_fk" FOREIGN KEY ("linked_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_attachments" ADD CONSTRAINT "issue_attachments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_attachments" ADD CONSTRAINT "issue_attachments_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_attachments" ADD CONSTRAINT "issue_attachments_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_attachments" ADD CONSTRAINT "issue_attachments_issue_comment_id_issue_comments_id_fk" FOREIGN KEY ("issue_comment_id") REFERENCES "public"."issue_comments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_comments" ADD CONSTRAINT "issue_comments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_comments" ADD CONSTRAINT "issue_comments_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_comments" ADD CONSTRAINT "issue_comments_author_agent_id_agents_id_fk" FOREIGN KEY ("author_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_labels" ADD CONSTRAINT "issue_labels_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_labels" ADD CONSTRAINT "issue_labels_label_id_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."labels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_labels" ADD CONSTRAINT "issue_labels_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_read_states" ADD CONSTRAINT "issue_read_states_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_read_states" ADD CONSTRAINT "issue_read_states_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_subproject_id_subprojects_id_fk" FOREIGN KEY ("subproject_id") REFERENCES "public"."subprojects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_parent_id_issues_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_assignee_agent_id_agents_id_fk" FOREIGN KEY ("assignee_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_checkout_run_id_heartbeat_runs_id_fk" FOREIGN KEY ("checkout_run_id") REFERENCES "public"."heartbeat_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_execution_run_id_heartbeat_runs_id_fk" FOREIGN KEY ("execution_run_id") REFERENCES "public"."heartbeat_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_invite_id_invites_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."invites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_created_agent_id_agents_id_fk" FOREIGN KEY ("created_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labels" ADD CONSTRAINT "labels_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "principal_permission_grants" ADD CONSTRAINT "principal_permission_grants_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_goals" ADD CONSTRAINT "project_goals_subproject_id_subprojects_id_fk" FOREIGN KEY ("subproject_id") REFERENCES "public"."subprojects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_goals" ADD CONSTRAINT "project_goals_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_goals" ADD CONSTRAINT "project_goals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_memberships" ADD CONSTRAINT "project_memberships_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_secret_versions" ADD CONSTRAINT "project_secret_versions_secret_id_project_secrets_id_fk" FOREIGN KEY ("secret_id") REFERENCES "public"."project_secrets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_secret_versions" ADD CONSTRAINT "project_secret_versions_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_secrets" ADD CONSTRAINT "project_secrets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_secrets" ADD CONSTRAINT "project_secrets_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_templates" ADD CONSTRAINT "project_templates_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_workspaces" ADD CONSTRAINT "project_workspaces_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_workspaces" ADD CONSTRAINT "project_workspaces_subproject_id_subprojects_id_fk" FOREIGN KEY ("subproject_id") REFERENCES "public"."subprojects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subprojects" ADD CONSTRAINT "subprojects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subprojects" ADD CONSTRAINT "subprojects_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subprojects" ADD CONSTRAINT "subprojects_lead_agent_id_agents_id_fk" FOREIGN KEY ("lead_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_log_company_created_idx" ON "activity_log" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_log_run_id_idx" ON "activity_log" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "activity_log_entity_type_id_idx" ON "activity_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "agent_api_keys_key_hash_idx" ON "agent_api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "agent_api_keys_company_agent_idx" ON "agent_api_keys" USING btree ("project_id","agent_id");--> statement-breakpoint
CREATE INDEX "agent_config_revisions_company_agent_created_idx" ON "agent_config_revisions" USING btree ("project_id","agent_id","created_at");--> statement-breakpoint
CREATE INDEX "agent_config_revisions_agent_created_idx" ON "agent_config_revisions" USING btree ("agent_id","created_at");--> statement-breakpoint
CREATE INDEX "agent_policies_project_enabled_priority_idx" ON "agent_policies" USING btree ("project_id","enabled","priority");--> statement-breakpoint
CREATE INDEX "agent_policies_project_action_idx" ON "agent_policies" USING btree ("project_id","action_pattern");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_policies_project_name_version_idx" ON "agent_policies" USING btree ("project_id","name","version");--> statement-breakpoint
CREATE INDEX "agent_runtime_state_company_agent_idx" ON "agent_runtime_state" USING btree ("project_id","agent_id");--> statement-breakpoint
CREATE INDEX "agent_runtime_state_company_updated_idx" ON "agent_runtime_state" USING btree ("project_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_task_sessions_company_agent_adapter_task_uniq" ON "agent_task_sessions" USING btree ("project_id","agent_id","adapter_type","task_key");--> statement-breakpoint
CREATE INDEX "agent_task_sessions_company_agent_updated_idx" ON "agent_task_sessions" USING btree ("project_id","agent_id","updated_at");--> statement-breakpoint
CREATE INDEX "agent_task_sessions_company_task_updated_idx" ON "agent_task_sessions" USING btree ("project_id","task_key","updated_at");--> statement-breakpoint
CREATE INDEX "agent_wakeup_requests_company_agent_status_idx" ON "agent_wakeup_requests" USING btree ("project_id","agent_id","status");--> statement-breakpoint
CREATE INDEX "agent_wakeup_requests_company_requested_idx" ON "agent_wakeup_requests" USING btree ("project_id","requested_at");--> statement-breakpoint
CREATE INDEX "agent_wakeup_requests_agent_requested_idx" ON "agent_wakeup_requests" USING btree ("agent_id","requested_at");--> statement-breakpoint
CREATE INDEX "agents_company_status_idx" ON "agents" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "agents_company_reports_to_idx" ON "agents" USING btree ("project_id","reports_to");--> statement-breakpoint
CREATE INDEX "approval_comments_project_idx" ON "approval_comments" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "approval_comments_approval_idx" ON "approval_comments" USING btree ("approval_id");--> statement-breakpoint
CREATE INDEX "approval_comments_approval_created_idx" ON "approval_comments" USING btree ("approval_id","created_at");--> statement-breakpoint
CREATE INDEX "approvals_company_status_type_idx" ON "approvals" USING btree ("project_id","status","type");--> statement-breakpoint
CREATE INDEX "assets_company_created_idx" ON "assets" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "assets_company_provider_idx" ON "assets" USING btree ("project_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "assets_company_object_key_uq" ON "assets" USING btree ("project_id","object_key");--> statement-breakpoint
CREATE INDEX "cost_events_company_occurred_idx" ON "cost_events" USING btree ("project_id","occurred_at");--> statement-breakpoint
CREATE INDEX "cost_events_company_agent_occurred_idx" ON "cost_events" USING btree ("project_id","agent_id","occurred_at");--> statement-breakpoint
CREATE INDEX "forge_webhooks_project_provider_idx" ON "forge_webhooks" USING btree ("project_id","forge_provider");--> statement-breakpoint
CREATE INDEX "forge_webhooks_forge_webhook_id_idx" ON "forge_webhooks" USING btree ("forge_webhook_id");--> statement-breakpoint
CREATE INDEX "goals_project_idx" ON "goals" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "heartbeat_run_events_run_seq_idx" ON "heartbeat_run_events" USING btree ("run_id","seq");--> statement-breakpoint
CREATE INDEX "heartbeat_run_events_company_run_idx" ON "heartbeat_run_events" USING btree ("project_id","run_id");--> statement-breakpoint
CREATE INDEX "heartbeat_run_events_company_created_idx" ON "heartbeat_run_events" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "heartbeat_runs_company_agent_started_idx" ON "heartbeat_runs" USING btree ("project_id","agent_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "instance_user_roles_user_role_unique_idx" ON "instance_user_roles" USING btree ("user_id","role");--> statement-breakpoint
CREATE INDEX "instance_user_roles_role_idx" ON "instance_user_roles" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX "invites_token_hash_unique_idx" ON "invites" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "invites_company_invite_state_idx" ON "invites" USING btree ("project_id","invite_type","revoked_at","expires_at");--> statement-breakpoint
CREATE INDEX "issue_approvals_issue_idx" ON "issue_approvals" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX "issue_approvals_approval_idx" ON "issue_approvals" USING btree ("approval_id");--> statement-breakpoint
CREATE INDEX "issue_approvals_project_idx" ON "issue_approvals" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "issue_attachments_company_issue_idx" ON "issue_attachments" USING btree ("project_id","issue_id");--> statement-breakpoint
CREATE INDEX "issue_attachments_issue_comment_idx" ON "issue_attachments" USING btree ("issue_comment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "issue_attachments_asset_uq" ON "issue_attachments" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "issue_comments_issue_idx" ON "issue_comments" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX "issue_comments_project_idx" ON "issue_comments" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "issue_comments_company_issue_created_at_idx" ON "issue_comments" USING btree ("project_id","issue_id","created_at");--> statement-breakpoint
CREATE INDEX "issue_comments_company_author_issue_created_at_idx" ON "issue_comments" USING btree ("project_id","author_user_id","issue_id","created_at");--> statement-breakpoint
CREATE INDEX "issue_labels_issue_idx" ON "issue_labels" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX "issue_labels_label_idx" ON "issue_labels" USING btree ("label_id");--> statement-breakpoint
CREATE INDEX "issue_labels_project_idx" ON "issue_labels" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "issue_read_states_company_issue_idx" ON "issue_read_states" USING btree ("project_id","issue_id");--> statement-breakpoint
CREATE INDEX "issue_read_states_company_user_idx" ON "issue_read_states" USING btree ("project_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "issue_read_states_company_issue_user_idx" ON "issue_read_states" USING btree ("project_id","issue_id","user_id");--> statement-breakpoint
CREATE INDEX "issues_project_status_idx" ON "issues" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "issues_project_assignee_status_idx" ON "issues" USING btree ("project_id","assignee_agent_id","status");--> statement-breakpoint
CREATE INDEX "issues_project_assignee_user_status_idx" ON "issues" USING btree ("project_id","assignee_user_id","status");--> statement-breakpoint
CREATE INDEX "issues_project_parent_idx" ON "issues" USING btree ("project_id","parent_id");--> statement-breakpoint
CREATE INDEX "issues_subproject_idx" ON "issues" USING btree ("subproject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "issues_identifier_idx" ON "issues" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "issues_forge_issue_idx" ON "issues" USING btree ("project_id","forge_issue_number");--> statement-breakpoint
CREATE UNIQUE INDEX "join_requests_invite_unique_idx" ON "join_requests" USING btree ("invite_id");--> statement-breakpoint
CREATE INDEX "join_requests_company_status_type_created_idx" ON "join_requests" USING btree ("project_id","status","request_type","created_at");--> statement-breakpoint
CREATE INDEX "labels_project_idx" ON "labels" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "labels_company_name_idx" ON "labels" USING btree ("project_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "principal_permission_grants_unique_idx" ON "principal_permission_grants" USING btree ("project_id","principal_type","principal_id","permission_key");--> statement-breakpoint
CREATE INDEX "principal_permission_grants_company_permission_idx" ON "principal_permission_grants" USING btree ("project_id","permission_key");--> statement-breakpoint
CREATE INDEX "project_goals_subproject_idx" ON "project_goals" USING btree ("subproject_id");--> statement-breakpoint
CREATE INDEX "project_goals_goal_idx" ON "project_goals" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "project_goals_project_idx" ON "project_goals" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_memberships_company_principal_unique_idx" ON "project_memberships" USING btree ("project_id","principal_type","principal_id");--> statement-breakpoint
CREATE INDEX "project_memberships_principal_status_idx" ON "project_memberships" USING btree ("principal_type","principal_id","status");--> statement-breakpoint
CREATE INDEX "project_memberships_company_status_idx" ON "project_memberships" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "project_secret_versions_secret_idx" ON "project_secret_versions" USING btree ("secret_id","created_at");--> statement-breakpoint
CREATE INDEX "project_secret_versions_value_sha256_idx" ON "project_secret_versions" USING btree ("value_sha256");--> statement-breakpoint
CREATE UNIQUE INDEX "project_secret_versions_secret_version_uq" ON "project_secret_versions" USING btree ("secret_id","version");--> statement-breakpoint
CREATE INDEX "project_secrets_project_idx" ON "project_secrets" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_secrets_company_provider_idx" ON "project_secrets" USING btree ("project_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "project_secrets_company_name_uq" ON "project_secrets" USING btree ("project_id","name");--> statement-breakpoint
CREATE INDEX "project_templates_archetype_idx" ON "project_templates" USING btree ("archetype");--> statement-breakpoint
CREATE INDEX "project_templates_community_idx" ON "project_templates" USING btree ("community_contributed");--> statement-breakpoint
CREATE INDEX "project_templates_author_idx" ON "project_templates" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "project_workspaces_project_subproject_idx" ON "project_workspaces" USING btree ("project_id","subproject_id");--> statement-breakpoint
CREATE INDEX "project_workspaces_subproject_primary_idx" ON "project_workspaces" USING btree ("subproject_id","is_primary");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_issue_prefix_idx" ON "projects" USING btree ("issue_prefix");--> statement-breakpoint
CREATE INDEX "projects_project_idx" ON "subprojects" USING btree ("project_id");