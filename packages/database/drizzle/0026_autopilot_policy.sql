ALTER TABLE "application_policy" ADD COLUMN "autopilot_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "application_policy" ADD COLUMN "autopilot_grant" jsonb;--> statement-breakpoint
ALTER TABLE "application_policy" ADD COLUMN "autopilot_next_run_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "application_intents" ADD COLUMN "autopilot_grant" jsonb;