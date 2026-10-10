-- JOB-P5-T02: Autonomous Orchestrator, Scheduling, Notifications & Production Hardening
-- This migration creates orchestration_runs, system_notifications, and notification_preferences.

CREATE TABLE IF NOT EXISTS "orchestration_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "task_type" text DEFAULT 'PIPELINE_CYCLE' NOT NULL,
  "trigger" text DEFAULT 'SCHEDULED' NOT NULL,
  "status" text DEFAULT 'PENDING' NOT NULL,
  "items_processed_count" integer DEFAULT 0 NOT NULL,
  "items_succeeded_count" integer DEFAULT 0 NOT NULL,
  "items_failed_count" integer DEFAULT 0 NOT NULL,
  "step_logs" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "error_message" text,
  "retry_count" integer DEFAULT 0 NOT NULL,
  "max_retries" integer DEFAULT 3 NOT NULL,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "orchestration_runs_user_id_idx"
  ON "orchestration_runs" ("user_id");
CREATE INDEX IF NOT EXISTS "orchestration_runs_status_idx"
  ON "orchestration_runs" ("status");
CREATE INDEX IF NOT EXISTS "orchestration_runs_task_type_idx"
  ON "orchestration_runs" ("task_type");
CREATE INDEX IF NOT EXISTS "orchestration_runs_created_at_idx"
  ON "orchestration_runs" ("created_at");

CREATE TABLE IF NOT EXISTS "system_notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "severity" text DEFAULT 'INFO' NOT NULL,
  "status" text DEFAULT 'UNREAD' NOT NULL,
  "target_type" text DEFAULT 'SYSTEM' NOT NULL,
  "target_id" text,
  "action_url" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "system_notifications_user_id_idx"
  ON "system_notifications" ("user_id");
CREATE INDEX IF NOT EXISTS "system_notifications_status_idx"
  ON "system_notifications" ("status");
CREATE INDEX IF NOT EXISTS "system_notifications_type_idx"
  ON "system_notifications" ("type");
CREATE INDEX IF NOT EXISTS "system_notifications_created_at_idx"
  ON "system_notifications" ("created_at");

CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "email_notifications_enabled" boolean DEFAULT true NOT NULL,
  "notification_email" text,
  "notify_on_approval_requests" boolean DEFAULT true NOT NULL,
  "notify_on_captcha_halt" boolean DEFAULT true NOT NULL,
  "notify_on_auto_apply" boolean DEFAULT true NOT NULL,
  "notify_on_interview_reminders" boolean DEFAULT true NOT NULL,
  "daily_digest_enabled" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
