CREATE TABLE IF NOT EXISTS "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"state" text DEFAULT 'NEW' NOT NULL,
	"title" text NOT NULL,
	"company" text NOT NULL,
	"company_url" text,
	"description" text NOT NULL,
	"description_html" text,
	"location_text" text,
	"city" text,
	"region" text,
	"country" text,
	"workplace_type" text DEFAULT 'UNKNOWN' NOT NULL,
	"employment_type" text DEFAULT 'UNKNOWN' NOT NULL,
	"seniority" text DEFAULT 'UNKNOWN' NOT NULL,
	"department" text,
	"min_salary" integer,
	"max_salary" integer,
	"currency" text,
	"pay_period" text,
	"compensation_raw" text,
	"posted_date" timestamp with time zone,
	"expiration_date" timestamp with time zone,
	"discovered_date" timestamp with time zone DEFAULT now() NOT NULL,
	"last_checked_date" timestamp with time zone,
	"original_url" text,
	"canonical_url" text,
	"application_url" text,
	"provider" text DEFAULT 'GENERIC' NOT NULL,
	"source_external_id" text,
	"source_company_id" text,
	"content_hash" text NOT NULL,
	"is_duplicate" boolean DEFAULT false NOT NULL,
	"duplicate_of_id" uuid,
	"has_manual_edits" boolean DEFAULT false NOT NULL,
	"manual_edit_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_user_state_idx" ON "jobs" ("user_id", "state");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_user_company_idx" ON "jobs" ("user_id", "company");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_user_provider_idx" ON "jobs" ("user_id", "provider");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_user_content_hash_idx" ON "jobs" ("user_id", "content_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_canonical_url_idx" ON "jobs" ("canonical_url");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_provider_external_id_idx" ON "jobs" ("provider", "source_external_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL REFERENCES "jobs"("id") ON DELETE cascade,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"provider" text NOT NULL,
	"ingestion_method" text NOT NULL,
	"source_url" text,
	"canonical_url" text,
	"external_job_id" text,
	"raw_title" text,
	"raw_company" text,
	"raw_location" text,
	"raw_description" text NOT NULL,
	"raw_metadata" jsonb,
	"raw_payload" text,
	"content_hash" text NOT NULL,
	"ingestion_status" text DEFAULT 'COMPLETED' NOT NULL,
	"parser_version" text DEFAULT '1.0.0' NOT NULL,
	"error_message" text,
	"retrieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_sources_job_id_idx" ON "job_sources" ("job_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_sources_user_id_idx" ON "job_sources" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_sources_provider_external_idx" ON "job_sources" ("provider", "external_job_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL REFERENCES "jobs"("id") ON DELETE cascade,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"raw_text" text NOT NULL,
	"normalized_text" text,
	"category" text DEFAULT 'OTHER' NOT NULL,
	"requirement_strength" text DEFAULT 'UNKNOWN' NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_requirements_job_id_idx" ON "job_requirements" ("job_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_requirements_category_idx" ON "job_requirements" ("category");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL REFERENCES "jobs"("id") ON DELETE cascade,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"section_type" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_sections_job_id_idx" ON "job_sections" ("job_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_sections_type_idx" ON "job_sections" ("section_type");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL REFERENCES "jobs"("id") ON DELETE cascade,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"event_type" text NOT NULL,
	"changed_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_events_job_id_idx" ON "job_events" ("job_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_events_event_type_idx" ON "job_events" ("event_type");
