-- 0017_verifications_id_default.sql
-- Ensure verifications, sessions, and accounts tables have default UUID generation for id

ALTER TABLE "verifications" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "sessions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "accounts" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
