CREATE TABLE IF NOT EXISTS "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"job_id" uuid NOT NULL REFERENCES "jobs"("id") ON DELETE cascade,
	"current_package_id" uuid REFERENCES "application_packages"("id") ON DELETE set null,
	"submitted_package_version_id" uuid REFERENCES "application_package_versions"("id") ON DELETE set null,
	"submitted_cv_artifact_id" uuid REFERENCES "application_artifacts"("id") ON DELETE set null,
	"submitted_cover_letter_artifact_id" uuid REFERENCES "application_artifacts"("id") ON DELETE set null,
	"status" text DEFAULT 'READY_TO_APPLY' NOT NULL,
	"source" text DEFAULT 'DIRECT' NOT NULL,
	"application_url" text,
	"submission_method" text,
	"external_reference_id" text,
	"applied_at" timestamp with time zone,
	"last_status_change_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"terminal_reason" text,
	"terminal_stage" text,
	"next_action" text,
	"next_action_type" text,
	"follow_up_at" timestamp with time zone,
	"notes" text,
	"is_archived" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "applications_user_job_unique_idx" ON "applications" ("user_id", "job_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "applications_user_id_idx" ON "applications" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "applications_job_id_idx" ON "applications" ("job_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "applications_status_idx" ON "applications" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "applications_follow_up_at_idx" ON "applications" ("follow_up_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "applications_applied_at_idx" ON "applications" ("applied_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "applications_is_archived_idx" ON "applications" ("is_archived");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "application_lifecycle_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL REFERENCES "applications"("id") ON DELETE cascade,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"event_type" text NOT NULL,
	"previous_status" text,
	"new_status" text,
	"actor" text DEFAULT 'USER' NOT NULL,
	"note" text,
	"safe_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_events_application_id_idx" ON "application_lifecycle_events" ("application_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_events_user_id_idx" ON "application_lifecycle_events" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_events_event_type_idx" ON "application_lifecycle_events" ("event_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_events_created_at_idx" ON "application_lifecycle_events" ("created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "application_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL REFERENCES "applications"("id") ON DELETE cascade,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"content" text NOT NULL,
	"author" text DEFAULT 'USER' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_notes_application_id_idx" ON "application_notes" ("application_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_notes_user_id_idx" ON "application_notes" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "application_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL REFERENCES "applications"("id") ON DELETE cascade,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"title" text,
	"company" text,
	"linkedin_url" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_contacts_application_id_idx" ON "application_contacts" ("application_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_contacts_user_id_idx" ON "application_contacts" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "application_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL REFERENCES "applications"("id") ON DELETE cascade,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"title" text NOT NULL,
	"assessment_type" text NOT NULL,
	"provider" text,
	"status" text DEFAULT 'RECEIVED' NOT NULL,
	"received_at" timestamp with time zone,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"url" text,
	"score" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_assessments_application_id_idx" ON "application_assessments" ("application_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_assessments_status_idx" ON "application_assessments" ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "application_interviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL REFERENCES "applications"("id") ON DELETE cascade,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"round_title" text NOT NULL,
	"interview_type" text NOT NULL,
	"status" text DEFAULT 'SCHEDULED' NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer,
	"timezone" text,
	"location_or_url" text,
	"interviewer_name" text,
	"contact_id" uuid REFERENCES "application_contacts"("id") ON DELETE set null,
	"notes" text,
	"feedback" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_interviews_application_id_idx" ON "application_interviews" ("application_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_interviews_scheduled_at_idx" ON "application_interviews" ("scheduled_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_interviews_status_idx" ON "application_interviews" ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "application_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL REFERENCES "applications"("id") ON DELETE cascade,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"base_salary" integer,
	"total_comp" integer,
	"currency" text DEFAULT 'USD' NOT NULL,
	"employment_type" text,
	"proposed_start_date" text,
	"deadline_at" timestamp with time zone,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_offers_application_id_idx" ON "application_offers" ("application_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_offers_status_idx" ON "application_offers" ("status");
