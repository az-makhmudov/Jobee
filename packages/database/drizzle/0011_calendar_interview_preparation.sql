-- JOB-P4-T02: Calendar Integration & Interview Preparation
-- This migration adds calendar accounts, interview calendar links,
-- preparation briefs, and extends application_interviews.

-- Calendar accounts (mirrors email_accounts pattern)
CREATE TABLE IF NOT EXISTS "calendar_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "provider" text DEFAULT 'GOOGLE' NOT NULL,
  "email_address" text NOT NULL,
  "encrypted_tokens" text NOT NULL,
  "granted_scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "scope_level" text DEFAULT 'NONE' NOT NULL,
  "status" text DEFAULT 'CONNECTED' NOT NULL,
  "selected_calendar_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "default_calendar_id" text,
  "token_expires_at" timestamp with time zone,
  "error_message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "calendar_accounts_user_email_unique_idx"
  ON "calendar_accounts" ("user_id", "email_address");
CREATE INDEX IF NOT EXISTS "calendar_accounts_user_id_idx"
  ON "calendar_accounts" ("user_id");
CREATE INDEX IF NOT EXISTS "calendar_accounts_provider_idx"
  ON "calendar_accounts" ("provider");
CREATE INDEX IF NOT EXISTS "calendar_accounts_status_idx"
  ON "calendar_accounts" ("status");

-- Extend application_interviews with scheduling/calendar/debrief fields
ALTER TABLE "application_interviews"
  ADD COLUMN IF NOT EXISTS "scheduling_status" text DEFAULT 'CONFIRMED' NOT NULL,
  ADD COLUMN IF NOT EXISTS "meeting_url" text,
  ADD COLUMN IF NOT EXISTS "source_email_message_id" text,
  ADD COLUMN IF NOT EXISTS "debrief_questions_asked" text,
  ADD COLUMN IF NOT EXISTS "debrief_topics_discussed" text,
  ADD COLUMN IF NOT EXISTS "debrief_observations" text,
  ADD COLUMN IF NOT EXISTS "debrief_follow_up_commitments" text,
  ADD COLUMN IF NOT EXISTS "debrief_concerns" text,
  ADD COLUMN IF NOT EXISTS "debrief_expected_next_step" text,
  ADD COLUMN IF NOT EXISTS "debrief_expected_response_date" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "debrief_private_notes" text;

CREATE INDEX IF NOT EXISTS "app_interviews_scheduling_status_idx"
  ON "application_interviews" ("scheduling_status");

-- Interview calendar links (one-to-one: interview <-> calendar event)
CREATE TABLE IF NOT EXISTS "interview_calendar_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "interview_id" uuid NOT NULL REFERENCES "application_interviews"("id") ON DELETE CASCADE,
  "calendar_account_id" uuid NOT NULL REFERENCES "calendar_accounts"("id") ON DELETE CASCADE,
  "calendar_id" text NOT NULL,
  "external_event_id" text NOT NULL,
  "event_url" text,
  "etag" text,
  "last_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "interview_calendar_links_interview_unique_idx"
  ON "interview_calendar_links" ("interview_id");
CREATE INDEX IF NOT EXISTS "interview_calendar_links_calendar_account_idx"
  ON "interview_calendar_links" ("calendar_account_id");
CREATE UNIQUE INDEX IF NOT EXISTS "interview_calendar_links_event_unique_idx"
  ON "interview_calendar_links" ("calendar_account_id", "calendar_id", "external_event_id");

-- Interview preparation briefs
CREATE TABLE IF NOT EXISTS "interview_preparation_briefs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "interview_id" uuid NOT NULL REFERENCES "application_interviews"("id") ON DELETE CASCADE,
  "application_id" uuid NOT NULL REFERENCES "applications"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "version" integer DEFAULT 1 NOT NULL,
  "generation_mode" text DEFAULT 'DETERMINISTIC' NOT NULL,
  "is_stale" boolean DEFAULT false NOT NULL,
  "staleness_reason" text,
  "role_summary" text DEFAULT '' NOT NULL,
  "company_context" text DEFAULT '' NOT NULL,
  "key_requirements" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "candidate_strengths" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "candidate_gaps" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "likely_questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "suggested_answer_frameworks" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "questions_to_ask" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "preparation_checklist" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "human_notes" text,
  "source_fingerprint" text DEFAULT '' NOT NULL,
  "ai_model_used" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "preparation_briefs_interview_idx"
  ON "interview_preparation_briefs" ("interview_id");
CREATE INDEX IF NOT EXISTS "preparation_briefs_application_idx"
  ON "interview_preparation_briefs" ("application_id");
CREATE INDEX IF NOT EXISTS "preparation_briefs_user_idx"
  ON "interview_preparation_briefs" ("user_id");
CREATE INDEX IF NOT EXISTS "preparation_briefs_stale_idx"
  ON "interview_preparation_briefs" ("is_stale");
