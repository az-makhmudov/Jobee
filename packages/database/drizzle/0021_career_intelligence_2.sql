-- Migration 0021: Candidate Brain & AI Career Intelligence 2.0

-- 1. candidate_profiles extensions
ALTER TABLE "candidate_profiles" ADD COLUMN IF NOT EXISTS "career_stage" text;
ALTER TABLE "candidate_profiles" ADD COLUMN IF NOT EXISTS "target_salary" integer;
ALTER TABLE "candidate_profiles" ADD COLUMN IF NOT EXISTS "target_salary_currency" text DEFAULT 'USD';
ALTER TABLE "candidate_profiles" ADD COLUMN IF NOT EXISTS "transferable_capabilities" jsonb DEFAULT '[]'::jsonb;

-- 2. candidate_experiences extensions
ALTER TABLE "candidate_experiences" ADD COLUMN IF NOT EXISTS "responsibilities" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "candidate_experiences" ADD COLUMN IF NOT EXISTS "skills" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "candidate_experiences" ADD COLUMN IF NOT EXISTS "industry" text;
ALTER TABLE "candidate_experiences" ADD COLUMN IF NOT EXISTS "transferable_capabilities" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "candidate_experiences" ADD COLUMN IF NOT EXISTS "source_reference" text;
ALTER TABLE "candidate_experiences" ADD COLUMN IF NOT EXISTS "source_entity_id" text;
ALTER TABLE "candidate_experiences" ADD COLUMN IF NOT EXISTS "allow_ai_use" boolean DEFAULT false NOT NULL;
ALTER TABLE "candidate_experiences" ADD COLUMN IF NOT EXISTS "confidence" integer;
ALTER TABLE "candidate_experiences" ADD COLUMN IF NOT EXISTS "last_confirmed_at" timestamp with time zone;
ALTER TABLE "candidate_experiences" ADD COLUMN IF NOT EXISTS "has_contradiction" boolean DEFAULT false NOT NULL;
ALTER TABLE "candidate_experiences" ADD COLUMN IF NOT EXISTS "contradiction_details" text;

-- 3. candidate_education extensions
ALTER TABLE "candidate_education" ADD COLUMN IF NOT EXISTS "honors" text;
ALTER TABLE "candidate_education" ADD COLUMN IF NOT EXISTS "source_reference" text;
ALTER TABLE "candidate_education" ADD COLUMN IF NOT EXISTS "source_entity_id" text;
ALTER TABLE "candidate_education" ADD COLUMN IF NOT EXISTS "allow_ai_use" boolean DEFAULT false NOT NULL;
ALTER TABLE "candidate_education" ADD COLUMN IF NOT EXISTS "confidence" integer;
ALTER TABLE "candidate_education" ADD COLUMN IF NOT EXISTS "last_confirmed_at" timestamp with time zone;
ALTER TABLE "candidate_education" ADD COLUMN IF NOT EXISTS "has_contradiction" boolean DEFAULT false NOT NULL;
ALTER TABLE "candidate_education" ADD COLUMN IF NOT EXISTS "contradiction_details" text;

-- 4. candidate_skills extensions
ALTER TABLE "candidate_skills" ADD COLUMN IF NOT EXISTS "is_tool" boolean DEFAULT false NOT NULL;
ALTER TABLE "candidate_skills" ADD COLUMN IF NOT EXISTS "transferable_capabilities" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "candidate_skills" ADD COLUMN IF NOT EXISTS "source_reference" text;
ALTER TABLE "candidate_skills" ADD COLUMN IF NOT EXISTS "source_entity_id" text;
ALTER TABLE "candidate_skills" ADD COLUMN IF NOT EXISTS "allow_ai_use" boolean DEFAULT false NOT NULL;
ALTER TABLE "candidate_skills" ADD COLUMN IF NOT EXISTS "confidence" integer;
ALTER TABLE "candidate_skills" ADD COLUMN IF NOT EXISTS "last_confirmed_at" timestamp with time zone;
ALTER TABLE "candidate_skills" ADD COLUMN IF NOT EXISTS "has_contradiction" boolean DEFAULT false NOT NULL;
ALTER TABLE "candidate_skills" ADD COLUMN IF NOT EXISTS "contradiction_details" text;

-- 5. candidate_certifications extensions
ALTER TABLE "candidate_certifications" ADD COLUMN IF NOT EXISTS "source_reference" text;
ALTER TABLE "candidate_certifications" ADD COLUMN IF NOT EXISTS "source_entity_id" text;
ALTER TABLE "candidate_certifications" ADD COLUMN IF NOT EXISTS "allow_ai_use" boolean DEFAULT false NOT NULL;
ALTER TABLE "candidate_certifications" ADD COLUMN IF NOT EXISTS "confidence" integer;
ALTER TABLE "candidate_certifications" ADD COLUMN IF NOT EXISTS "last_confirmed_at" timestamp with time zone;
ALTER TABLE "candidate_certifications" ADD COLUMN IF NOT EXISTS "has_contradiction" boolean DEFAULT false NOT NULL;
ALTER TABLE "candidate_certifications" ADD COLUMN IF NOT EXISTS "contradiction_details" text;

-- 6. candidate_projects extensions
ALTER TABLE "candidate_projects" ADD COLUMN IF NOT EXISTS "source_reference" text;
ALTER TABLE "candidate_projects" ADD COLUMN IF NOT EXISTS "source_entity_id" text;
ALTER TABLE "candidate_projects" ADD COLUMN IF NOT EXISTS "allow_ai_use" boolean DEFAULT false NOT NULL;
ALTER TABLE "candidate_projects" ADD COLUMN IF NOT EXISTS "confidence" integer;
ALTER TABLE "candidate_projects" ADD COLUMN IF NOT EXISTS "last_confirmed_at" timestamp with time zone;
ALTER TABLE "candidate_projects" ADD COLUMN IF NOT EXISTS "has_contradiction" boolean DEFAULT false NOT NULL;
ALTER TABLE "candidate_projects" ADD COLUMN IF NOT EXISTS "contradiction_details" text;

-- 7. candidate_languages extensions
ALTER TABLE "candidate_languages" ADD COLUMN IF NOT EXISTS "source_reference" text;
ALTER TABLE "candidate_languages" ADD COLUMN IF NOT EXISTS "source_entity_id" text;
ALTER TABLE "candidate_languages" ADD COLUMN IF NOT EXISTS "allow_ai_use" boolean DEFAULT false NOT NULL;
ALTER TABLE "candidate_languages" ADD COLUMN IF NOT EXISTS "confidence" integer;
ALTER TABLE "candidate_languages" ADD COLUMN IF NOT EXISTS "last_confirmed_at" timestamp with time zone;
ALTER TABLE "candidate_languages" ADD COLUMN IF NOT EXISTS "has_contradiction" boolean DEFAULT false NOT NULL;
ALTER TABLE "candidate_languages" ADD COLUMN IF NOT EXISTS "contradiction_details" text;

-- 8. candidate_facts extensions
ALTER TABLE "candidate_facts" ADD COLUMN IF NOT EXISTS "confidence" integer;
ALTER TABLE "candidate_facts" ADD COLUMN IF NOT EXISTS "last_confirmed_at" timestamp with time zone;
ALTER TABLE "candidate_facts" ADD COLUMN IF NOT EXISTS "has_contradiction" boolean DEFAULT false NOT NULL;
ALTER TABLE "candidate_facts" ADD COLUMN IF NOT EXISTS "contradiction_details" text;
ALTER TABLE "candidate_facts" ADD COLUMN IF NOT EXISTS "sources" jsonb DEFAULT '[]'::jsonb;

-- 9. job_preferences extensions
ALTER TABLE "job_preferences" ADD COLUMN IF NOT EXISTS "adjacent_roles" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "job_preferences" ADD COLUMN IF NOT EXISTS "preferred_industries" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "job_preferences" ADD COLUMN IF NOT EXISTS "career_transitions" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "job_preferences" ADD COLUMN IF NOT EXISTS "long_term_goals" text;
ALTER TABLE "job_preferences" ADD COLUMN IF NOT EXISTS "development_priorities" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "job_preferences" ADD COLUMN IF NOT EXISTS "availability" text;
ALTER TABLE "job_preferences" ADD COLUMN IF NOT EXISTS "work_authorization_countries" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "job_preferences" ADD COLUMN IF NOT EXISTS "internship_eligible" boolean;
ALTER TABLE "job_preferences" ADD COLUMN IF NOT EXISTS "learned_preferences" jsonb;

-- 10. job_match_analyses extensions
ALTER TABLE "job_match_analyses" ADD COLUMN IF NOT EXISTS "career_fit_category" text;
ALTER TABLE "job_match_analyses" ADD COLUMN IF NOT EXISTS "transferable_skills" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "job_match_analyses" ADD COLUMN IF NOT EXISTS "learned_ranking_adjustment" integer DEFAULT 0 NOT NULL;
ALTER TABLE "job_match_analyses" ADD COLUMN IF NOT EXISTS "learned_adjustment_reason" text;
CREATE INDEX IF NOT EXISTS "job_match_analyses_career_fit_idx" ON "job_match_analyses" ("career_fit_category");

-- 11. candidate_job_feedback table
CREATE TABLE IF NOT EXISTS "candidate_job_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"job_id" uuid NOT NULL REFERENCES "jobs"("id") ON DELETE cascade,
	"feedback_type" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "candidate_job_feedback_user_idx" ON "candidate_job_feedback" ("user_id");
CREATE INDEX IF NOT EXISTS "candidate_job_feedback_job_idx" ON "candidate_job_feedback" ("job_id");
CREATE INDEX IF NOT EXISTS "candidate_job_feedback_user_job_idx" ON "candidate_job_feedback" ("user_id", "job_id");

-- 12. candidate_intelligence_suggestions table
CREATE TABLE IF NOT EXISTS "candidate_intelligence_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"suggestion_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"payload" jsonb NOT NULL,
	"evidence" text,
	"source_document_id" text,
	"confidence" integer,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "candidate_intelligence_suggestions_user_idx" ON "candidate_intelligence_suggestions" ("user_id");
CREATE INDEX IF NOT EXISTS "candidate_intelligence_suggestions_status_idx" ON "candidate_intelligence_suggestions" ("status");
CREATE INDEX IF NOT EXISTS "candidate_intelligence_suggestions_user_status_idx" ON "candidate_intelligence_suggestions" ("user_id", "status");
