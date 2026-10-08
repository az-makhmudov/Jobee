CREATE TABLE IF NOT EXISTS "email_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"provider" text DEFAULT 'GMAIL' NOT NULL,
	"email_address" text NOT NULL,
	"encrypted_tokens" text NOT NULL,
	"granted_scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'CONNECTED' NOT NULL,
	"last_sync_at" timestamp with time zone,
	"sync_cursor" text,
	"token_expires_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_accounts_user_email_unique_idx" ON "email_accounts" ("user_id", "email_address");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_accounts_user_id_idx" ON "email_accounts" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_accounts_provider_idx" ON "email_accounts" ("provider");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_accounts_status_idx" ON "email_accounts" ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL REFERENCES "email_accounts"("id") ON DELETE cascade,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"provider_message_id" text NOT NULL,
	"provider_thread_id" text,
	"sender_email" text NOT NULL,
	"sender_name" text,
	"recipient_email" text,
	"subject" text NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"snippet" text,
	"body_text" text DEFAULT '' NOT NULL,
	"classification" text DEFAULT 'UNKNOWN' NOT NULL,
	"confidence" real DEFAULT 0 NOT NULL,
	"classification_reason" text,
	"processing_status" text DEFAULT 'PENDING' NOT NULL,
	"linked_job_id" uuid REFERENCES "jobs"("id") ON DELETE set null,
	"linked_application_id" uuid REFERENCES "applications"("id") ON DELETE set null,
	"linked_contact_id" uuid REFERENCES "application_contacts"("id") ON DELETE set null,
	"content_hash" text NOT NULL,
	"raw_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_messages_account_provider_msg_idx" ON "email_messages" ("account_id", "provider_message_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_messages_account_id_idx" ON "email_messages" ("account_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_messages_user_id_idx" ON "email_messages" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_messages_provider_thread_id_idx" ON "email_messages" ("provider_thread_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_messages_received_at_idx" ON "email_messages" ("received_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_messages_classification_idx" ON "email_messages" ("classification");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_messages_processing_status_idx" ON "email_messages" ("processing_status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_messages_linked_app_idx" ON "email_messages" ("linked_application_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_messages_linked_job_idx" ON "email_messages" ("linked_job_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_thread_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL REFERENCES "email_accounts"("id") ON DELETE cascade,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"provider_thread_id" text NOT NULL,
	"application_id" uuid REFERENCES "applications"("id") ON DELETE set null,
	"job_id" uuid REFERENCES "jobs"("id") ON DELETE set null,
	"company" text,
	"confirmed_by" text DEFAULT 'AUTO' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_thread_links_account_thread_idx" ON "email_thread_links" ("account_id", "provider_thread_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_thread_links_user_id_idx" ON "email_thread_links" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_thread_links_application_id_idx" ON "email_thread_links" ("application_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_thread_links_job_id_idx" ON "email_thread_links" ("job_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_review_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"message_id" uuid NOT NULL REFERENCES "email_messages"("id") ON DELETE cascade,
	"classification" text NOT NULL,
	"confidence" real NOT NULL,
	"proposed_action" text NOT NULL,
	"proposed_target_status" text,
	"proposed_application_id" uuid REFERENCES "applications"("id") ON DELETE set null,
	"proposed_job_id" uuid REFERENCES "jobs"("id") ON DELETE set null,
	"explanation" text NOT NULL,
	"extracted_details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"risk_level" text DEFAULT 'LOW' NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"resolution_note" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_review_items_user_id_idx" ON "email_review_items" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_review_items_message_id_idx" ON "email_review_items" ("message_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_review_items_status_idx" ON "email_review_items" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_review_items_risk_level_idx" ON "email_review_items" ("risk_level");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_review_items_proposed_app_idx" ON "email_review_items" ("proposed_application_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL REFERENCES "email_accounts"("id") ON DELETE cascade,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"trigger" text DEFAULT 'MANUAL' NOT NULL,
	"status" text DEFAULT 'IN_PROGRESS' NOT NULL,
	"messages_found" integer DEFAULT 0 NOT NULL,
	"messages_ingested" integer DEFAULT 0 NOT NULL,
	"auto_synced_count" integer DEFAULT 0 NOT NULL,
	"review_items_created" integer DEFAULT 0 NOT NULL,
	"jobs_discovered_count" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_sync_runs_account_id_idx" ON "email_sync_runs" ("account_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_sync_runs_user_id_idx" ON "email_sync_runs" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_sync_runs_status_idx" ON "email_sync_runs" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_sync_runs_started_at_idx" ON "email_sync_runs" ("started_at");
