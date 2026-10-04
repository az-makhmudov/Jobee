# AI Job Agent — Data Model & Migration Strategy

## 1. Design Conventions & Baseline Rules

All persistence operations follow these foundational standards:

1. **Primary Keys**: Universally Unique Identifiers (UUID v4) using native PostgreSQL `uuid` column type (`defaultRandom()`). Avoid sequential auto-incrementing integer IDs.
2. **Timestamps**:
   - Timezone-aware UTC timestamps (`timestamp('...', { withTimezone: true, mode: 'date' })`).
   - Every entity defines non-null `createdAt` defaulting to current timestamp.
   - Every entity defines non-null `updatedAt` with automatic update hooks.
3. **Naming**:
   - Tables use plural snake_case (e.g., `users`, `candidate_profiles`).
   - Columns use snake_case in SQL and camelCase in TypeScript mappings.
4. **Foreign Keys**:
   - Explicit relational integrity with cascading rules where appropriate (`onDelete: 'cascade'` or `onDelete: 'restrict'`).

---

## 2. Foundational Entities & Deterministic User Identity (`JOB-P1-T01` / `JOB-P1-T02`)

### `users` Table

Even though AI Job Agent is currently single-user personal software, data ownership is anchored to an explicit user entity to support multi-account or multi-profile scaling without future schema rewrites. Single-user execution resolves deterministically via `system_key`:

```sql
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_key VARCHAR(100) UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```

- Primary candidate identity resolved via `system_key = 'default_primary_candidate'`.
- Constant deterministic UUID: `00000000-0000-0000-0000-000000000001`.

---

## 3. Candidate Brain Entities (`JOB-P1-T02`)

The Candidate Brain is the authoritative structured source of candidate truth. Future AI applications may only draw upon explicitly stored, verified candidate facts.

### 3.1. `candidate_profiles`

Core personal bio, contact info, headline, and executive summary.

- Columns: `id`, `user_id` (FK `users`), `full_name`, `preferred_name`, `headline`, `email`, `phone`, `city`, `region`, `country`, `summary`, `availability`, `created_at`, `updated_at`.

### 3.2. `candidate_experiences`

Chronological employment and work experience records.

- Columns: `id`, `user_id` (FK `users`), `organization`, `position`, `location`, `employment_type`, `start_date`, `end_date`, `is_current`, `description`, `achievements` (JSONB array), `display_order`, `verification_status` (`UNVERIFIED`, `VERIFIED`, `REJECTED`), `created_at`, `updated_at`.

### 3.3. `candidate_education`

Academic degrees, institutions, and coursework.

- Columns: `id`, `user_id` (FK `users`), `institution`, `degree`, `field_of_study`, `start_date`, `end_date`, `is_current`, `location`, `description`, `activities`, `display_order`, `verification_status`, `created_at`, `updated_at`.

### 3.4. `candidate_projects`

Personal, academic, and open-source projects.

- Columns: `id`, `user_id` (FK `users`), `name`, `role`, `description`, `start_date`, `end_date`, `project_url`, `skills` (JSONB array), `achievements` (JSONB array), `is_active`, `display_order`, `verification_status`, `created_at`, `updated_at`.

### 3.5. `candidate_skills`

Normalized competencies and technical proficiencies.

- Columns: `id`, `user_id` (FK `users`), `name`, `category`, `proficiency` (`BEGINNER`, `INTERMEDIATE`, `ADVANCED`, `EXPERT`), `years_experience`, `is_active`, `verification_status`, `created_at`, `updated_at`.

### 3.6. `candidate_languages`

Spoken/written languages with proficiency levels.

- Columns: `id`, `user_id` (FK `users`), `language`, `proficiency`, `cefr_level`, `notes`, `verification_status`, `created_at`, `updated_at`.

### 3.7. `candidate_certifications`

Accreditations, professional licenses, and exam credentials.

- Columns: `id`, `user_id` (FK `users`), `name`, `issuing_organization`, `issue_date`, `expiration_date`, `credential_id`, `credential_url`, `verification_status`, `created_at`, `updated_at`.

### 3.8. `candidate_links`

Online footprints (GitHub, LinkedIn, Portfolio, Google Scholar).

- Columns: `id`, `user_id` (FK `users`), `label`, `url`, `display_order`, `created_at`, `updated_at`.

### 3.9. `candidate_facts`

Discrete, auditable atomic assertions with explicit verification and AI permission semantics.

- Columns: `id`, `user_id` (FK `users`), `category`, `fact_key`, `statement`, `structured_value` (JSONB), `source_type`, `source_entity_id`, `verification_status`, `allow_ai_use` (BOOLEAN, default `true`), `created_at`, `updated_at`.
- Invariant: AI engines must never fabricate answers not backed by candidate facts.

### 3.10. `candidate_documents`

Metadata records for uploaded CVs, role-specific variants, and credentials.

- Columns: `id`, `user_id` (FK `users`), `document_type` (`MASTER_CV`, `ROLE_CV`, `COVER_LETTER_TEMPLATE`, `CERTIFICATE`, `PORTFOLIO`, `OTHER`), `display_name`, `original_filename`, `mime_type`, `size_bytes`, `storage_key`, `sha256_checksum`, `role_focus`, `version`, `is_active`, `is_master` (BOOLEAN), `created_at`, `updated_at`.
- Binary files reside on disk via `LocalStorageProvider` in Git-ignored `uploads/`.

### 3.11. `answer_library`

Approved answers for standard recruiter screening questions with explicit automation tiers.

- Columns: `id`, `user_id` (FK `users`), `question`, `category`, `answer`, `notes`, `automation_level` (`AUTO`, `REVIEW`, `MANUAL`), `verification_status`, `is_sensitive` (BOOLEAN), `conditions` (JSONB), `created_at`, `updated_at`.

### 3.12. `job_preferences`

Job search targeting rules and matching criteria.

- Columns: `id`, `user_id` (FK `users`), `target_titles` (JSONB array), `target_categories` (JSONB array), `preferred_locations` (JSONB array), `work_modes` (JSONB array), `employment_types` (JSONB array), `seniority_levels` (JSONB array), `min_salary`, `max_salary`, `currency`, `preferred_languages` (JSONB array), `excluded_companies` (JSONB array), `excluded_keywords` (JSONB array), `accept_unpaid` (BOOLEAN), `willing_to_relocate` (BOOLEAN), `needs_sponsorship` (BOOLEAN), `custom_preferences` (JSONB), `created_at`, `updated_at`.

### 3.13. `application_policy`

Autonomous application guardrails and human review safety thresholds.

- Columns: `id`, `user_id` (FK `users`), `auto_apply_enabled` (BOOLEAN, default `false`), `min_score_for_review` (default `70`), `auto_apply_min_score` (default `85`), `max_applications_per_day` (default `10`), `block_on_unresolved_review` (default `true`), `block_on_manual` (default `true`), `block_on_unknown_sensitive` (default `true`), `created_at`, `updated_at`.

### 3.14. `candidate_audit_events`

Immutable, privacy-preserving event log of modifications across Candidate Brain entities. Historical PII values (names, phones, salaries, answers) are strictly excluded from audit storage.

- Columns: `id`, `user_id` (FK `users`), `action` (`CREATE`, `UPDATE`, `DELETE`), `entity_type` (VARCHAR), `entity_id` (VARCHAR), `changed_fields` (JSONB string array, e.g. `["headline", "city"]`), `metadata` (JSONB operational context object, e.g. `{ factKey, category }` or `{ documentType, sizeBytes }`, null if none), `created_at` (TIMESTAMP WITH TIME ZONE).
- Privacy Invariant: To eliminate the risk of long-term PII accumulation in audit logs, full state snapshots (`before_state`/`after_state`) are replaced with field-level change tracking (`changed_fields`).

---

## 4. Deferred Domain Schemas

The following entities are explicitly deferred until their respective macro-tasks:

- **Job Intelligence (`JOB-P2-T01` / `JOB-P2-T02`)**:
  - `jobs`
  - `job_sources`
  - `job_requirements`
  - `job_scores`
  - `job_decisions`
- **Application Workflow (`JOB-P3-T01` / `JOB-P3-T02`)**:
  - `applications`
  - `application_packages`
  - `application_events`
  - `approval_requests`
- **Communication & Interviews (`JOB-P4-T01` / `JOB-P4-T02`)**:
  - `email_messages` / `email_links`
  - `interviews`
- **Controlled Automation (`JOB-P5-T01` / `JOB-P5-T02`)**:
  - `agent_actions`

---

## 5. Migration Strategy

1. **Generator**: Drizzle Kit inspects TypeScript schemas in `packages/database/src/schema/` and outputs pure SQL migration files into `packages/database/drizzle/`.
   - Command: `npm run db:generate`
2. **Runner**: Programmatic migration execution using `drizzle-orm/node-postgres/migrator` applies pending migrations atomically.
   - Command: `npm run db:migrate`
3. **Health & Connectivity**: Low-level probe (`SELECT 1`) verifies connection pool viability without modifying database state.
   - Command: `npm run db:check`
4. **Safety Invariants**:
   - Migrations are strictly additive in production.
   - Never run raw destructive SQL scripts directly without version-controlled Drizzle migrations.

### Applied Migration Journal:

- `0000_magenta_daimon_hellstrom.sql`: Baseline core platform schema (`users`).
- `0001_tidy_darkstar.sql`: Comprehensive Candidate Brain schema (13 tables: profiles, experiences, education, projects, skills, languages, certifications, links, facts, documents, answer library, job preferences, application policy, candidate audit events).
- `0002_audit_privacy.sql`: Candidate audit privacy refactor — replaces broad `details` snapshot column with `changed_fields` string array and safe operational `metadata` JSONB.
