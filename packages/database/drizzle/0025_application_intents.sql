CREATE TABLE "application_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"selected_cv_id" uuid,
	"batch_id" uuid,
	"run_id" uuid,
	"terms_version" text NOT NULL,
	"target_url" text NOT NULL,
	"input_fingerprint" text NOT NULL,
	"manifest_checksum" text,
	"status" text DEFAULT 'AUTHORIZED' NOT NULL,
	"message" text DEFAULT 'Preparing your application in the background.' NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"authorized_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"dispatch_started_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "application_intents" ADD CONSTRAINT "application_intents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "application_intents" ADD CONSTRAINT "application_intents_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "application_intents" ADD CONSTRAINT "application_intents_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "application_intents" ADD CONSTRAINT "application_intents_selected_cv_id_candidate_documents_id_fk" FOREIGN KEY ("selected_cv_id") REFERENCES "public"."candidate_documents"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "application_intents" ADD CONSTRAINT "application_intents_batch_id_preparation_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."preparation_batches"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "application_intents" ADD CONSTRAINT "application_intents_run_id_browser_application_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."browser_application_runs"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "application_intents_user_job_idx" ON "application_intents" USING btree ("user_id","job_id");
--> statement-breakpoint
CREATE INDEX "application_intents_queue_idx" ON "application_intents" USING btree ("status","created_at");
