-- JOB-P5-T01: Browser Application Worker & Initial ATS Adapters
-- This migration creates browser_application_runs for tracking Playwright execution.

CREATE TABLE IF NOT EXISTS "browser_application_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "application_id" uuid NOT NULL REFERENCES "applications"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "package_version_id" uuid REFERENCES "application_package_versions"("id") ON DELETE SET NULL,
  "ats_provider" text DEFAULT 'UNKNOWN' NOT NULL,
  "target_url" text NOT NULL,
  "mode" text DEFAULT 'DRY_RUN' NOT NULL,
  "status" text DEFAULT 'PENDING' NOT NULL,
  "fields_detected_count" integer DEFAULT 0 NOT NULL,
  "fields_filled_count" integer DEFAULT 0 NOT NULL,
  "unmatched_required_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "step_logs" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "screenshot_paths" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "confirmation_reference" text,
  "error_message" text,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "browser_runs_application_id_idx"
  ON "browser_application_runs" ("application_id");
CREATE INDEX IF NOT EXISTS "browser_runs_user_id_idx"
  ON "browser_application_runs" ("user_id");
CREATE INDEX IF NOT EXISTS "browser_runs_status_idx"
  ON "browser_application_runs" ("status");
CREATE INDEX IF NOT EXISTS "browser_runs_created_at_idx"
  ON "browser_application_runs" ("created_at");
