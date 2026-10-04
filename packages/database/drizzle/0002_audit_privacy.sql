ALTER TABLE "candidate_audit_events" ADD COLUMN "changed_fields" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "candidate_audit_events" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "candidate_audit_events" DROP COLUMN "details";