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

---

## 4. Job Ingestion Subsystem Schemas (`JOB-P2-T01`)

The Job Ingestion subsystem introduces 5 PostgreSQL tables under Drizzle ORM representing canonical normalized postings, raw source provenance, extracted requirements, detected sections, and lifecycle audit events.

### 4.1. `jobs` (Canonical Normalized Postings)

Represents the deduplicated, normalized representation of an ingested job posting.

- `id`: UUID (Primary Key, defaultRandom)
- `user_id`: UUID (Foreign Key -> `users.id`, CASCADE delete)
- `state`: TEXT NOT NULL (Default: `'NEW'`) — `'NEW' | 'INGESTED' | 'NEEDS_REVIEW' | 'INVALID' | 'DUPLICATE' | 'ARCHIVED'`
- `title`: TEXT NOT NULL
- `company`: TEXT NOT NULL
- `company_url`: TEXT
- `description`: TEXT NOT NULL (Plain text or markdown)
- `description_html`: TEXT (Sanitized HTML)
- `location_text`: TEXT
- `city`: TEXT
- `region`: TEXT
- `country`: TEXT
- `workplace_type`: TEXT NOT NULL (Default: `'UNKNOWN'`) — `'REMOTE' | 'HYBRID' | 'ONSITE' | 'UNKNOWN'`
- `employment_type`: TEXT NOT NULL (Default: `'UNKNOWN'`) — `'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP' | 'TEMPORARY' | 'APPRENTICESHIP' | 'VOLUNTEER' | 'OTHER' | 'UNKNOWN'`
- `seniority`: TEXT NOT NULL (Default: `'UNKNOWN'`) — `'INTERNSHIP' | 'ENTRY' | 'JUNIOR' | 'MID' | 'SENIOR' | 'LEAD' | 'MANAGER' | 'DIRECTOR' | 'EXECUTIVE' | 'UNKNOWN'`
- `department`: TEXT
- `min_salary`: INTEGER
- `max_salary`: INTEGER
- `currency`: TEXT (ISO 4217 code)
- `pay_period`: TEXT — `'YEAR' | 'MONTH' | 'HOUR' | 'WEEK' | 'DAY' | 'UNKNOWN'`
- `compensation_raw`: TEXT
- `posted_date`: TIMESTAMPTZ
- `expiration_date`: TIMESTAMPTZ
- `discovered_date`: TIMESTAMPTZ NOT NULL (Default: now())
- `last_checked_date`: TIMESTAMPTZ
- `original_url`: TEXT
- `canonical_url`: TEXT
- `application_url`: TEXT
- `provider`: TEXT NOT NULL (Default: `'GENERIC'`) — `'GREENHOUSE' | 'LEVER' | 'ASHBY' | 'LINKEDIN' | 'GENERIC' | 'MANUAL'`
- `source_external_id`: TEXT
- `source_company_id`: TEXT
- `content_hash`: TEXT NOT NULL (SHA-256 fingerprint)
- `is_duplicate`: BOOLEAN NOT NULL (Default: false)
- `duplicate_of_id`: UUID (Self-reference foreign key)
- `has_manual_edits`: BOOLEAN NOT NULL (Default: false)
- `manual_edit_fields`: JSONB NOT NULL (Default: `[]`)
- `created_at`: TIMESTAMPTZ NOT NULL (Default: now())
- `updated_at`: TIMESTAMPTZ NOT NULL (Default: now())

**Indexes**:

- `jobs_user_state_idx` on `(user_id, state)`
- `jobs_user_company_idx` on `(user_id, company)`
- `jobs_user_provider_idx` on `(user_id, provider)`
- `jobs_user_content_hash_idx` on `(user_id, content_hash)`
- `jobs_canonical_url_idx` on `(canonical_url)`
- `jobs_provider_external_id_idx` on `(provider, source_external_id)`

### 4.2. `job_sources` (Raw Provenance & Ingestion History)

Immutably archives the raw HTML, plain text, and provider metadata for every retrieval attempt.

- `id`: UUID (Primary Key, defaultRandom)
- `job_id`: UUID NOT NULL (Foreign Key -> `jobs.id`, CASCADE delete)
- `user_id`: UUID NOT NULL (Foreign Key -> `users.id`, CASCADE delete)
- `provider`: TEXT NOT NULL — `'GREENHOUSE' | 'LEVER' | 'ASHBY' | 'LINKEDIN' | 'GENERIC' | 'MANUAL'`
- `ingestion_method`: TEXT NOT NULL — `'PASTE_TEXT' | 'URL_IMPORT' | 'API'`
- `source_url`: TEXT
- `canonical_url`: TEXT
- `external_job_id`: TEXT
- `raw_title`: TEXT
- `raw_company`: TEXT
- `raw_location`: TEXT
- `raw_description`: TEXT NOT NULL (Clean plain-text extraction)
- `raw_metadata`: JSONB (Parsed schema.org metadata or structured payload properties)
- `raw_payload`: TEXT (Nullable diagnostic snippet only; full raw HTML payload is discarded upon extraction)
- `content_hash`: TEXT NOT NULL (SHA-256 fingerprint)
- `ingestion_status`: TEXT NOT NULL — `'COMPLETED' | 'DUPLICATE' | 'NEEDS_REVIEW' | 'FAILED' | 'NEEDS_MANUAL_TEXT'`
- `parser_version`: TEXT NOT NULL (Default: `'1.0.0'`)
- `error_message`: TEXT
- `retrieved_at`: TIMESTAMPTZ NOT NULL (Default: now())
- `created_at`: TIMESTAMPTZ NOT NULL (Default: now())

> **Raw-Source Retention Policy**: PostgreSQL is strictly not used as a permanent third-party webpage archive. Temporary HTML is ingested, parsed into structured fields, plain text, and metadata, and discarded immediately (`raw_payload = null`).

### 4.3. `job_requirements` (Structured Extracted Requirements)

Discrete hiring requirements parsed conservatively from qualifications sections:

- `id`: UUID (Primary Key, defaultRandom)
- `job_id`: UUID NOT NULL (Foreign Key -> `jobs.id`, CASCADE delete)
- `user_id`: UUID NOT NULL (Foreign Key -> `users.id`, CASCADE delete)
- `source_id`: UUID (Foreign Key -> `job_sources.id`, SET NULL on delete)
- `source_section`: TEXT (Section header where requirement originated, e.g. `'Required Qualifications'`)
- `raw_text`: TEXT NOT NULL
- `normalized_text`: TEXT
- `category` (Requirement Semantic Type): TEXT NOT NULL (Default: `'OTHER'`) — `'EXPERIENCE' | 'SKILL' | 'EDUCATION' | 'LANGUAGE' | 'LOCATION' | 'WORK_AUTHORIZATION' | 'CERTIFICATION' | 'RESPONSIBILITY' | 'OTHER'`
- `requirement_strength` (Requirement Strength): TEXT NOT NULL (Default: `'UNKNOWN'`) — `'MANDATORY' | 'PREFERRED' | 'UNKNOWN'`
- `display_order`: INTEGER NOT NULL (Default: 0)
- `created_at`: TIMESTAMPTZ NOT NULL (Default: now())

> **Requirement Type vs. Strength Invariant**: Semantic category (`category`) and necessity level (`requirement_strength`) are strictly orthogonal. Sections with explicit requirement headings ("Required Qualifications", "Minimum Qualifications") yield `MANDATORY`. Explicit preference sections ("Nice to have", "Preferred Qualifications") yield `PREFERRED`. Ambiguous sections ("Qualifications", "What you bring") yield `UNKNOWN` unless bullet text explicitly states necessity.
>
> **Responsibility Separation**: Routine workplace responsibilities are preserved in `job_sections` (`section_type = 'RESPONSIBILITIES'`) and are excluded from `job_requirements` to ensure future matching in `JOB-P2-T02` does not misinterpret job duties as mandatory hiring requirements.

### 4.4. `job_sections` (Structured Content Sections)

Preserves semantic sections detected in job descriptions.

- `id`: UUID (Primary Key, defaultRandom)
- `job_id`: UUID NOT NULL (Foreign Key -> `jobs.id`, CASCADE delete)
- `user_id`: UUID NOT NULL (Foreign Key -> `users.id`, CASCADE delete)
- `section_type`: TEXT NOT NULL (Default: `'OTHER'`) — `'RESPONSIBILITIES' | 'QUALIFICATIONS' | 'PREFERRED_QUALIFICATIONS' | 'BENEFITS' | 'ABOUT_COMPANY' | 'OTHER'`
- `title`: TEXT NOT NULL
- `content`: TEXT NOT NULL
- `display_order`: INTEGER NOT NULL (Default: 0)
- `created_at`: TIMESTAMPTZ NOT NULL (Default: now())

### 4.5. `job_events` (Job Lifecycle & Mutation Audit Log)

Provides complete auditable history of ingestion, deduplication, updates, and archival.

- `id`: UUID (Primary Key, defaultRandom)
- `job_id`: UUID NOT NULL (Foreign Key -> `jobs.id`, CASCADE delete)
- `user_id`: UUID NOT NULL (Foreign Key -> `users.id`, CASCADE delete)
- `event_type`: TEXT NOT NULL — `'JOB_INGESTED' | 'JOB_NORMALIZED' | 'JOB_UPDATED' | 'JOB_ARCHIVED' | 'JOB_DUPLICATE_DETECTED'`
- `changed_fields`: JSONB NOT NULL (Default: `[]`)
- `metadata`: JSONB
- `created_at`: TIMESTAMPTZ NOT NULL (Default: now())

### 4.6. Deduplication Strategy & Precedence

To guarantee idempotent ingestion across repeated URL fetches or text pastes:

1. **Provider + External Job ID**: Primary identity for ATS jobs (`GREENHOUSE`, `LEVER`, `ASHBY`, `LINKEDIN`).
2. **Canonical URL**: URL normalized without tracking parameters (`utm_*`, `ref`, `source`, `gclid`).
3. **Content Fingerprint (`content_hash`)**: SHA-256 hash of normalized title, company, location, and description snippet.
4. **Similar-but-Distinct Jobs**: Different titles (e.g. "Project Coordinator" vs. "Senior Project Coordinator") or distinct locations/descriptions remain strictly separate jobs.

---

## 5. Requirement Analysis, Matching & Policy Decision Engine (`JOB-P2-T02`)

Implements the intelligence and policy authorization layer evaluating job suitability against Candidate Brain credentials and preferences.

### 5.1. `job_match_analyses` (Overall Match Analyses)

Records versioned composite match analyses, policy decisions, and state hashes:

- `id`: UUID (Primary Key, defaultRandom)
- `job_id`: UUID NOT NULL (Foreign Key -> `jobs.id`, CASCADE delete)
- `user_id`: UUID NOT NULL (Foreign Key -> `users.id`, CASCADE delete)
- `overall_score`: INTEGER NOT NULL (Composite score 0-100)
- `confidence_score`: INTEGER NOT NULL (Confidence score 0-100)
- `decision`: TEXT NOT NULL — `'MATCH' | 'REVIEW' | 'SKIP'`
- `auto_apply_eligible`: BOOLEAN NOT NULL (Default: false — preliminary eligibility only, never auto-submitted)
- `analysis_mode`: TEXT NOT NULL (Default: `'DETERMINISTIC_ONLY'`) — `'DETERMINISTIC_ONLY' | 'AI_ENRICHED'`
- `algorithm_version`: TEXT NOT NULL (Default: `'1.0.0'`)
- `input_fingerprint`: TEXT NOT NULL (SHA-256 state hash of candidate + job data)
- `is_stale`: BOOLEAN NOT NULL (Default: false)
- `ai_provider`: TEXT (Nullable, e.g. `'gemini' | 'mock'`)
- `ai_model`: TEXT (Nullable, e.g. `'gemini-1.5-flash'`)
- `strengths`: JSONB NOT NULL (Default: `[]` — string array of key strengths)
- `gaps`: JSONB NOT NULL (Default: `[]` — string array of identified gaps)
- `unknowns`: JSONB NOT NULL (Default: `[]` — string array of unstated/missing criteria)
- `warnings`: JSONB NOT NULL (Default: `[]` — string array of warnings)
- `hard_blockers`: JSONB NOT NULL (Default: `[]` — string array of policy violations)
- `reason_codes`: JSONB NOT NULL (Default: `[]` — string array of decision reason codes)
- `summary_explanation`: TEXT NOT NULL
- `created_at`: TIMESTAMPTZ NOT NULL (Default: now())
- `updated_at`: TIMESTAMPTZ NOT NULL (Default: now())

**Indexes**:

- `job_match_analyses_user_decision_idx` on `(user_id, decision)`
- `job_match_analyses_job_user_idx` on `(job_id, user_id)`
- `job_match_analyses_fingerprint_idx` on `(input_fingerprint)`
- `job_match_analyses_stale_idx` on `(is_stale)`

### 5.2. `job_match_dimensions` (Dimensional Fit Breakdown)

Breaks down compatibility across 8 discrete dimensions:

- `id`: UUID (Primary Key, defaultRandom)
- `analysis_id`: UUID NOT NULL (Foreign Key -> `job_match_analyses.id`, CASCADE delete)
- `job_id`: UUID NOT NULL (Foreign Key -> `jobs.id`, CASCADE delete)
- `dimension`: TEXT NOT NULL — `'ROLE_FIT' | 'SKILLS_FIT' | 'EXPERIENCE_FIT' | 'EDUCATION_FIT' | 'LOCATION_FIT' | 'LANGUAGE_FIT' | 'COMPENSATION_FIT' | 'WORK_AUTHORIZATION_FIT'`
- `score`: INTEGER (Nullable, 0-100; null if unknown or not applicable)
- `weight`: INTEGER NOT NULL (Nominal dimension weight, e.g. 25, 20, 15, 10)
- `status`: TEXT NOT NULL (Default: `'SCORED'`) — `'SCORED' | 'UNKNOWN' | 'NOT_APPLICABLE'`
- `reason`: TEXT NOT NULL
- `created_at`: TIMESTAMPTZ NOT NULL (Default: now())

**Indexes**:

- `job_match_dimensions_analysis_idx` on `(analysis_id)`
- `job_match_dimensions_job_dimension_idx` on `(job_id, dimension)`

### 5.3. `job_requirement_evaluations` (Grounded Requirement Evaluations)

Maps individual job requirements deterministically to candidate evidence:

- `id`: UUID (Primary Key, defaultRandom)
- `analysis_id`: UUID NOT NULL (Foreign Key -> `job_match_analyses.id`, CASCADE delete)
- `job_requirement_id`: UUID NOT NULL (Foreign Key -> `job_requirements.id`, CASCADE delete)
- `job_id`: UUID NOT NULL (Foreign Key -> `jobs.id`, CASCADE delete)
- `user_id`: UUID NOT NULL (Foreign Key -> `users.id`, CASCADE delete)
- `status`: TEXT NOT NULL — `'MET' | 'PARTIAL' | 'NOT_MET' | 'UNKNOWN' | 'NOT_APPLICABLE'`
- `source`: TEXT NOT NULL (Default: `'DETERMINISTIC'`) — `'DETERMINISTIC' | 'AI_ENRICHED'`
- `evidence_ids`: JSONB NOT NULL (Default: `[]` — array of candidate evidence IDs, e.g. `['candidate_skill:uuid']`)
- `evidence_items`: JSONB NOT NULL (Default: `[]` — array of structured evidence objects with `id`, `type`, `label`)
- `reason`: TEXT NOT NULL
- `confidence`: INTEGER NOT NULL (Default: 50, range 0-100)
- `contributes_to_blocker`: BOOLEAN NOT NULL (Default: false)
- `created_at`: TIMESTAMPTZ NOT NULL (Default: now())

**Indexes**:

- `job_requirement_evals_analysis_idx` on `(analysis_id)`
- `job_requirement_evals_job_req_idx` on `(job_id, job_requirement_id)`
- `job_requirement_evals_status_idx` on `(status)`

---

## 6. Deferred Domain Schemas

The following entities are explicitly deferred until their respective macro-tasks:

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

## 7. Migration Strategy

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
- `0003_jobs_foundation.sql`: Job Ingestion, parsing, normalization, and provenance schema (`jobs`, `job_sources`, `job_requirements`, `job_sections`, `job_events`).
- `0004_job_requirements_source_context.sql`: Additive hardening for job requirements (`source_id` foreign key to `job_sources.id` and `source_section` text column for provenance tracking).
- `0005_matching_intelligence.sql`: Additive schema for Requirement Analysis, Matching & Policy Decision Engine (`job_match_analyses`, `job_match_dimensions`, `job_requirement_evaluations`).
