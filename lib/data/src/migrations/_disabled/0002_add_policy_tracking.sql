-- Add policy tracking columns to activity_log table
ALTER TABLE "activity_log" ADD COLUMN IF NOT EXISTS "policy_version" integer;
ALTER TABLE "activity_log" ADD COLUMN IF NOT EXISTS "policy_outcome" text;

CREATE INDEX IF NOT EXISTS "activity_log_policy_outcome_idx" ON "activity_log" ("project_id","policy_outcome");
