ALTER TABLE "job_requirements" ADD COLUMN IF NOT EXISTS "source_id" uuid;--> statement-breakpoint
ALTER TABLE "job_requirements" ADD COLUMN IF NOT EXISTS "source_section" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_requirements" ADD CONSTRAINT "job_requirements_source_id_job_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."job_sources"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_requirements_source_id_idx" ON "job_requirements" ("source_id");
