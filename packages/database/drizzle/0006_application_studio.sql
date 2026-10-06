CREATE TABLE IF NOT EXISTS "application_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL REFERENCES "jobs"("id") ON DELETE cascade,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"match_analysis_id" uuid REFERENCES "job_match_analyses"("id") ON DELETE set null,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"current_version_number" integer DEFAULT 1 NOT NULL,
	"has_policy_blocker" boolean DEFAULT false NOT NULL,
	"blocker_overridden" boolean DEFAULT false NOT NULL,
	"blocker_override_reason" text,
	"blocker_overridden_at" timestamp with time zone,
	"is_stale" boolean DEFAULT false NOT NULL,
	"readiness_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "application_packages_job_id_idx" ON "application_packages" ("job_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "application_packages_user_id_idx" ON "application_packages" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "application_packages_status_idx" ON "application_packages" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "application_packages_is_stale_idx" ON "application_packages" ("is_stale");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "application_package_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL REFERENCES "application_packages"("id") ON DELETE cascade,
	"version_number" integer NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"input_fingerprint" text NOT NULL,
	"base_document_id" uuid REFERENCES "candidate_documents"("id") ON DELETE set null,
	"base_selection_reason" text,
	"tailored_cv_content" jsonb,
	"cover_letter_content" text,
	"cover_letter_enabled" boolean DEFAULT true NOT NULL,
	"cover_letter_approved" boolean DEFAULT false NOT NULL,
	"change_summary" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"generation_mode" text DEFAULT 'DETERMINISTIC_ONLY' NOT NULL,
	"ai_model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_pkg_versions_package_id_idx" ON "application_package_versions" ("package_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "app_pkg_versions_pkg_version_idx" ON "application_package_versions" ("package_id", "version_number");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "application_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL REFERENCES "application_packages"("id") ON DELETE cascade,
	"version_id" uuid NOT NULL REFERENCES "application_package_versions"("id") ON DELETE cascade,
	"artifact_type" text NOT NULL,
	"storage_key" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256_checksum" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_artifacts_package_id_idx" ON "application_artifacts" ("package_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_artifacts_version_id_idx" ON "application_artifacts" ("version_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_artifacts_type_idx" ON "application_artifacts" ("artifact_type");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "application_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL REFERENCES "application_packages"("id") ON DELETE cascade,
	"version_id" uuid NOT NULL REFERENCES "application_package_versions"("id") ON DELETE cascade,
	"question_text" text NOT NULL,
	"category" text DEFAULT 'GENERAL' NOT NULL,
	"question_type" text NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sensitivity" text DEFAULT 'STANDARD' NOT NULL,
	"answer_source" text DEFAULT 'UNRESOLVED' NOT NULL,
	"source_entity_id" text,
	"proposed_answer" text,
	"human_edited_answer" text,
	"final_answer" text,
	"approval_state" text DEFAULT 'PENDING' NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_questions_package_id_idx" ON "application_questions" ("package_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_questions_version_id_idx" ON "application_questions" ("version_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_questions_approval_state_idx" ON "application_questions" ("approval_state");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "approval_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL REFERENCES "application_packages"("id") ON DELETE cascade,
	"version_id" uuid NOT NULL REFERENCES "application_package_versions"("id") ON DELETE cascade,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"question_id" uuid REFERENCES "application_questions"("id") ON DELETE set null,
	"approval_type" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"subject" text NOT NULL,
	"proposed_value" text,
	"user_edited_value" text,
	"reason" text NOT NULL,
	"risk_level" text DEFAULT 'LOW' NOT NULL,
	"evidence_references" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "approval_requests_pkg_idx" ON "approval_requests" ("package_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "approval_requests_user_idx" ON "approval_requests" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "approval_requests_status_idx" ON "approval_requests" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "approval_requests_type_idx" ON "approval_requests" ("approval_type");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "application_package_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL REFERENCES "application_packages"("id") ON DELETE cascade,
	"version_number" integer,
	"event_type" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_pkg_events_package_id_idx" ON "application_package_events" ("package_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_pkg_events_event_type_idx" ON "application_package_events" ("event_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_pkg_events_created_idx" ON "application_package_events" ("created_at");
