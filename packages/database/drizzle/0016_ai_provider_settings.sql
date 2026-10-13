-- 0016_ai_provider_settings.sql
-- Add active_ai_provider and active_ai_model to application_policy table

ALTER TABLE "application_policy" ADD COLUMN IF NOT EXISTS "active_ai_provider" text DEFAULT 'gemini' NOT NULL;
ALTER TABLE "application_policy" ADD COLUMN IF NOT EXISTS "active_ai_model" text DEFAULT 'gemini-2.5-flash' NOT NULL;
