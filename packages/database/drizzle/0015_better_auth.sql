-- 0015_better_auth.sql
-- Better Auth integration: users extension, sessions, accounts, verifications, pilot_invitations

-- 1. Extend users table for Better Auth
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" boolean DEFAULT false NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "image" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" text DEFAULT 'user' NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "banned" boolean DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ban_reason" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ban_expires" timestamp with time zone;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "invitation_code" text;

-- 2. Populate existing primary candidate identity from candidate_profiles or default
DO $$
BEGIN
  -- Backfill candidate profile info for primary owner
  UPDATE "users" u
  SET
    "name" = COALESCE((SELECT full_name FROM "candidate_profiles" cp WHERE cp.user_id = u.id LIMIT 1), 'Asadbek Makhmudov'),
    "email" = COALESCE((SELECT email FROM "candidate_profiles" cp WHERE cp.user_id = u.id LIMIT 1), 'asadbek.mzw@gmail.com'),
    "email_verified" = true,
    "role" = 'admin'
  WHERE u.id = '00000000-0000-0000-0000-000000000001';

  -- Backfill any other legacy rows without email/name
  UPDATE "users"
  SET
    "name" = COALESCE("name", 'Candidate'),
    "email" = COALESCE("email", concat(id::text, '@pilot.local'))
  WHERE "name" IS NULL OR "email" IS NULL;
END $$;

-- 3. Enforce NOT NULL on users.name and users.email
ALTER TABLE "users" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique_idx" ON "users" ("email");
CREATE INDEX IF NOT EXISTS "users_system_key_idx" ON "users" ("system_key");

-- 4. Create Better Auth sessions table
CREATE TABLE IF NOT EXISTS "sessions" (
  "id" text PRIMARY KEY,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token" text NOT NULL UNIQUE,
  "expires_at" timestamp with time zone NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "impersonated_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_token_idx" ON "sessions" ("token");

-- 5. Create Better Auth accounts table (credentials and OAuth)
CREATE TABLE IF NOT EXISTS "accounts" (
  "id" text PRIMARY KEY,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamp with time zone,
  "refresh_token_expires_at" timestamp with time zone,
  "scope" text,
  "password" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "accounts_user_id_idx" ON "accounts" ("user_id");
CREATE INDEX IF NOT EXISTS "accounts_provider_account_idx" ON "accounts" ("provider_id", "account_id");

-- 6. Create Better Auth verifications table
CREATE TABLE IF NOT EXISTS "verifications" (
  "id" text PRIMARY KEY,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "verifications_identifier_idx" ON "verifications" ("identifier");

-- 7. Create Pilot Invitations table (invite-only registration)
CREATE TABLE IF NOT EXISTS "pilot_invitations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" text NOT NULL UNIQUE,
  "inviter_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "invited_email" text,
  "role" text DEFAULT 'user' NOT NULL,
  "status" text DEFAULT 'PENDING' NOT NULL,
  "accepted_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "accepted_at" timestamp with time zone,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "pilot_invitations_code_idx" ON "pilot_invitations" ("code");
CREATE INDEX IF NOT EXISTS "pilot_invitations_inviter_idx" ON "pilot_invitations" ("inviter_user_id");
CREATE INDEX IF NOT EXISTS "pilot_invitations_status_idx" ON "pilot_invitations" ("status");
