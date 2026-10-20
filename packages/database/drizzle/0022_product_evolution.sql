ALTER TABLE browser_application_runs ADD COLUMN IF NOT EXISTS submission_observation jsonb;
ALTER TABLE browser_application_runs ADD COLUMN IF NOT EXISTS authorization_manifest jsonb;
CREATE TABLE IF NOT EXISTS job_search_settings (
 user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 settings jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS preparation_batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(), cancelled_at timestamptz
);
CREATE TABLE IF NOT EXISTS preparation_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), batch_id uuid NOT NULL REFERENCES preparation_batches(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'QUEUED', package_id uuid REFERENCES application_packages(id) ON DELETE SET NULL,
 input_fingerprint text NOT NULL, error text, attempts integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), started_at timestamptz,
 finished_at timestamptz, selected_cv_id uuid REFERENCES candidate_documents(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS preparation_active_job_idx ON preparation_items(user_id,job_id) WHERE status IN ('QUEUED','PREPARING');
CREATE INDEX IF NOT EXISTS preparation_queue_idx ON preparation_items(status,created_at);
CREATE INDEX IF NOT EXISTS preparation_user_batch_idx ON preparation_items(user_id,batch_id);
ALTER TABLE job_search_settings ADD COLUMN IF NOT EXISTS cursors jsonb NOT NULL DEFAULT '{}';
ALTER TABLE job_search_settings ADD COLUMN IF NOT EXISTS last_daily_at timestamptz;
ALTER TABLE job_search_settings ADD COLUMN IF NOT EXISTS discovery_lease_at timestamptz;
ALTER TABLE job_search_settings ADD COLUMN IF NOT EXISTS daily_lease_at timestamptz;
