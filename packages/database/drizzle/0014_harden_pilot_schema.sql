-- 0014_harden_pilot_schema.sql
-- DEF-07: Add unique composite index on application_packages(user_id, job_id)
-- DEF-09: Add foreign key constraint to jobs.duplicate_of_id with ON DELETE SET NULL

CREATE UNIQUE INDEX IF NOT EXISTS "application_packages_user_job_unique_idx"
  ON "application_packages" ("user_id", "job_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jobs_duplicate_of_id_jobs_id_fk'
  ) THEN
    ALTER TABLE "jobs"
      ADD CONSTRAINT "jobs_duplicate_of_id_jobs_id_fk"
      FOREIGN KEY ("duplicate_of_id")
      REFERENCES "jobs"("id")
      ON DELETE SET NULL;
  END IF;
END $$;
