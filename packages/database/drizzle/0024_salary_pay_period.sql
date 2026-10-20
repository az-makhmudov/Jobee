-- Existing preferences keep unknown units until the candidate explicitly supplies them.
ALTER TABLE job_preferences ADD COLUMN IF NOT EXISTS salary_pay_period text;
ALTER TABLE job_preferences ADD CONSTRAINT job_preferences_salary_pay_period_check
  CHECK (salary_pay_period IS NULL OR salary_pay_period IN ('YEAR', 'MONTH', 'WEEK', 'DAY', 'HOUR'));
