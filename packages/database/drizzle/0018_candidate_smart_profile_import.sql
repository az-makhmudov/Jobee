CREATE TABLE "profile_import_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source_type" text DEFAULT 'CV' NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"original_filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"storage_key" text NOT NULL,
	"document_id" uuid,
	"ai_consent_given" boolean DEFAULT false NOT NULL,
	"extractor_used" text,
	"raw_text_snippet" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_import_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"section" text NOT NULL,
	"classification" text NOT NULL,
	"confidence_score" real DEFAULT 1 NOT NULL,
	"source_reference" text NOT NULL,
	"extracted_payload" jsonb NOT NULL,
	"existing_entity_id" text,
	"existing_payload" jsonb,
	"conflict_details" text,
	"review_status" text DEFAULT 'PENDING' NOT NULL,
	"user_edited_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profile_import_sessions" ADD CONSTRAINT "profile_import_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_import_items" ADD CONSTRAINT "profile_import_items_session_id_profile_import_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."profile_import_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_import_items" ADD CONSTRAINT "profile_import_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;