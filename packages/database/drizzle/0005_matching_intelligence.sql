CREATE TABLE IF NOT EXISTS "job_match_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL REFERENCES "jobs"("id") ON DELETE cascade,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"overall_score" integer NOT NULL,
	"confidence_score" integer NOT NULL,
	"decision" text NOT NULL,
	"auto_apply_eligible" boolean DEFAULT false NOT NULL,
	"analysis_mode" text NOT NULL,
	"algorithm_version" text NOT NULL,
	"input_fingerprint" text NOT NULL,
	"is_stale" boolean DEFAULT false NOT NULL,
	"ai_provider" text,
	"ai_model" text,
	"strengths" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"gaps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"unknowns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hard_blockers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reason_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"summary_explanation" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_match_analyses_job_id_idx" ON "job_match_analyses" ("job_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_match_analyses_user_id_idx" ON "job_match_analyses" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_match_analyses_decision_idx" ON "job_match_analyses" ("decision");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_match_analyses_score_idx" ON "job_match_analyses" ("overall_score");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_match_analyses_is_stale_idx" ON "job_match_analyses" ("is_stale");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_match_analyses_job_created_idx" ON "job_match_analyses" ("job_id", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_requirement_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"analysis_id" uuid NOT NULL REFERENCES "job_match_analyses"("id") ON DELETE cascade,
	"job_requirement_id" uuid NOT NULL REFERENCES "job_requirements"("id") ON DELETE cascade,
	"job_id" uuid NOT NULL REFERENCES "jobs"("id") ON DELETE cascade,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"status" text NOT NULL,
	"source" text NOT NULL,
	"evidence_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evidence_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reason" text NOT NULL,
	"confidence" integer NOT NULL,
	"contributes_to_blocker" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_req_eval_analysis_id_idx" ON "job_requirement_evaluations" ("analysis_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_req_eval_job_req_id_idx" ON "job_requirement_evaluations" ("job_requirement_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_req_eval_job_id_idx" ON "job_requirement_evaluations" ("job_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_match_dimensions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"analysis_id" uuid NOT NULL REFERENCES "job_match_analyses"("id") ON DELETE cascade,
	"job_id" uuid NOT NULL REFERENCES "jobs"("id") ON DELETE cascade,
	"dimension" text NOT NULL,
	"score" integer,
	"weight" integer NOT NULL,
	"status" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_match_dim_analysis_id_idx" ON "job_match_dimensions" ("analysis_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_match_dim_job_id_idx" ON "job_match_dimensions" ("job_id");
