CREATE TABLE IF NOT EXISTS "oauth_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state_hash" text NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_accounts" ADD COLUMN IF NOT EXISTS "is_syncing" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "email_accounts" ADD COLUMN IF NOT EXISTS "sync_locked_at" timestamp with time zone;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "oauth_states" ADD CONSTRAINT "oauth_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "oauth_states_hash_idx" ON "oauth_states" USING btree ("state_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_states_user_id_idx" ON "oauth_states" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_states_expires_at_idx" ON "oauth_states" USING btree ("expires_at");
