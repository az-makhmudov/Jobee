-- Additive migration for application lifecycle canonicalization and archiving
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "applications_archived_at_idx" ON "applications" ("archived_at");
--> statement-breakpoint
-- Safe data translation for non-canonical status values if any exist in the database
UPDATE "applications" SET "status" = 'READY_TO_APPLY' WHERE "status" = 'READY';
--> statement-breakpoint
UPDATE "applications" SET "status" = 'NEEDS_REVIEW' WHERE "status" = 'PREPARING';
--> statement-breakpoint
UPDATE "applications" SET "status" = 'MATCHED' WHERE "status" = 'SAVED';
