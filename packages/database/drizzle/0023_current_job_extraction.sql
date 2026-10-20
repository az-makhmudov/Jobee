-- Preserve prior extracted rows referenced by historical match evaluations.
ALTER TABLE job_requirements ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true;
ALTER TABLE job_sections ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true;
