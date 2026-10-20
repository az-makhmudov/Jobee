# Jobee 2.0 — Data Model Reconciliation

JOB-P1-T02 now exposes the existing work_authorization_countries, internship_eligible and availability preference columns through the normal validated candidate API, including creation, partial updates and explicit clearing. No schema change. Answer content/question edits clear verification unless explicitly reconfirmed; only verified matching saved answers can be reused. See JOBEE_2_IMPLEMENTATION.md.

Updated 2026-10-20 under JOB-P0-T01. No schema changes in this assessment. The detailed 1.x entity reference below remains useful implementation history; actual Drizzle schema/migrations govern discrepancies. Jobee 2.0 conceptual names do not mandate duplicate tables.

| Target concept                                                     | Existing schema / reuse                                                                                                                      | Remaining design delta                                                                                                        |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| CandidateProfile / CandidateFact / education / experience / skills | candidate_profiles, candidate_facts, candidate_education, candidate_experiences, candidate_skills; related projects/languages/certifications | Preserve VERIFIED, allowAiUse, sources and contradictions; unify UI                                                           |
| CandidateDocument / ApplicationAnswer                              | candidate_documents, answer_library, application_questions                                                                                   | Preserve document IDs, approved answer scope/tier and prior versions                                                          |
| JobPreference / AutomationPolicy                                   | job_preferences, application_policy, job_search_settings                                                                                     | Effective versioned policy/consent snapshots and revocation; no automatic permission expansion                                |
| Job / Source / Requirement / Analysis / Match / Decision           | jobs, job_sources, job_requirements, job_match_analyses, job_requirement_evaluations, dimensions/evidence and job events                     | Reuse analyzed decisions in the shared execution path; distinguish fit, blockers and unknowns                                 |
| Application                                                        | applications, unique user/job index                                                                                                          | Preserve frozen submitted provenance and employer lifecycle                                                                   |
| ApplicationAttempt                                                 | browser_application_runs; preparation_items cover earlier preparation work                                                                   | Persist intent spanning preparation through submission; evaluate extending existing records before adding a new attempt table |
| ApplicationPackage / DocumentVersion                               | application_packages, application_package_versions, application_artifacts                                                                    | Keep internal preparation/versioning; remove mandatory studio navigation                                                      |
| ApplicationApproval / Event                                        | approval_requests, application_questions, application_package_events, application_lifecycle_events                                           | Job-scoped initial consent and resumable minimal intervention; preserve append-only history                                   |
| SubmissionEvidence                                                 | browser_application_runs.submission_observation, confirmation_reference, screenshot_paths and protected storage                              | Keep mode/evidence semantics; UNKNOWN_RESULT maps to existing SUBMISSION_UNCERTAIN                                            |
| AgentRun / AgentAction                                             | orchestration_runs, browser-run step_logs, preparation_batches/items and audit_logs                                                          | Link stable attempt/policy IDs and checkpoints rather than duplicate logging systems                                          |
| IntegrationAccount / Sync / Communication                          | email_accounts, calendar_accounts, email_sync_runs, email_messages, email_thread_links, email_review_items                                   | Preserve encryption/tenant ownership; no new universal integration table required                                             |
| Interview / AuditEvent                                             | application_interviews, interview_calendar_links, interview_preparation_briefs, lifecycle events, audit_logs                                 | Contextual UI and scoped permission verification                                                                              |

The repository journal contains 25 migrations (0000–0024). Migration 0023 adds `is_current` (default true) to `job_requirements` and `job_sections`. Source refresh and manual description correction retire prior extraction rows and insert current rows transactionally, preserving IDs referenced by historical evaluations. Current views/matching/interview preparation filter to current rows. The initial isolated local test database had 22 applied; existing migration 0022 was applied to that isolated test target during baseline verification. Development/production migrations were not performed during the initial assessment. Phase 2 subsequently applied the reviewed additive migrations 0022–0024 to localhost/ai_job_agent_dev; original row counts and original-column fingerprints were unchanged across all 57 pre-existing public tables. No production migration was performed. Production migration status in old release logs is historical, not a fresh assertion.

Migration 0024 adds nullable `job_preferences.salary_pay_period`, constrained to YEAR/MONTH/WEEK/DAY/HOUR when supplied. Existing amounts retain unknown units; neither annual pay nor exchange-rate conversion is inferred. The validated preferences API/UI can set or clear the period. Known currencies and periods must match before deterministic salary comparisons.

Preservation rules: retain user/job/application IDs, source metadata, candidate verification, documents and checksums, answer approvals, integration encryption and employer evidence. Add compatible fields only after ownership/state mapping; backfill from evidence and preserve unknowns. Introduce user-facing execution-state projections before considering replacement of stored legacy values. Never reinterpret prior DRY_RUN/PREFILL_ONLY success as submission or old policy flags as expanded Autopilot consent. Retain legacy data/API reads while migrating UI. No destructive cleanup is planned.

---

# Jobee — Data Model & Migration Strategy

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

Even though **Jobee** is currently single-user personal software, data ownership is anchored to an explicit user entity to support multi-account or multi-profile scaling without future schema rewrites. Single-user execution resolves deterministically via `system_key`:

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

---

## 6. Application Studio Entities (`JOB-P3-T01`)

The Application Studio manages versioned, auditable application packages, tailored materials, question responses, and human approval requests.

### 6.1. `application_packages` (Package Entity)

The top-level container binding a candidate, target job, and match analysis into an application package:

- `id`: UUID (Primary Key, defaultRandom)
- `user_id`: UUID NOT NULL (Foreign Key -> `users.id`, CASCADE delete)
- `job_id`: UUID NOT NULL (Foreign Key -> `jobs.id`, CASCADE delete)
- `match_analysis_id`: UUID (Foreign Key -> `job_match_analyses.id`, SET NULL delete)
- `target_role`: TEXT NOT NULL
- `company_name`: TEXT NOT NULL
- `status`: TEXT NOT NULL (Default: `'DRAFT'`) — `'DRAFT' | 'NEEDS_REVIEW' | 'READY'`
- `current_version_number`: INTEGER NOT NULL (Default: 0)
- `input_fingerprint`: VARCHAR(64) NOT NULL
- `is_stale`: BOOLEAN NOT NULL (Default: false)
- `metadata`: JSONB NOT NULL (Default: `{}`)
- `created_at`: TIMESTAMPTZ NOT NULL (Default: now())
- `updated_at`: TIMESTAMPTZ NOT NULL (Default: now())

**Indexes**:

- `application_packages_user_status_idx` on `(user_id, status)`
- `application_packages_job_user_idx` on `(job_id, user_id)`
- `application_packages_stale_idx` on `(is_stale)`

### 6.2. `application_package_versions` (Immutable Version Snapshots)

Immutable snapshots for each generated package iteration:

- `id`: UUID (Primary Key, defaultRandom)
- `package_id`: UUID NOT NULL (Foreign Key -> `application_packages.id`, CASCADE delete)
- `version_number`: INTEGER NOT NULL
- `base_cv_document_id`: UUID (Foreign Key -> `candidate_documents.id`, SET NULL delete)
- `base_cv_mode`: TEXT NOT NULL — `'DOCUMENT_OVERRIDE' | 'ACTIVE_ROLE_CV' | 'ACTIVE_MASTER_CV' | 'CANDIDATE_BRAIN_DIRECT'`
- `tailored_cv_structured`: JSONB NOT NULL (Structured JSON of tailored CV sections, contact, summary, experiences, education, skills)
- `cover_letter_text`: TEXT NOT NULL
- `readiness_score`: INTEGER NOT NULL (Default: 0, range 0-100)
- `validation_issues`: JSONB NOT NULL (Default: `[]` — array of validation warnings/blockers)
- `input_fingerprint`: VARCHAR(64) NOT NULL
- `change_summary`: TEXT
- `created_at`: TIMESTAMPTZ NOT NULL (Default: now())

**Indexes**:

- `app_pkg_versions_pkg_version_idx` on `(package_id, version_number)` (UNIQUE)
- `app_pkg_versions_package_idx` on `(package_id)`

### 6.3. `application_artifacts` (Generated Documents)

Persisted binary (DOCX) and text artifacts generated for each package version:

- `id`: UUID (Primary Key, defaultRandom)
- `package_version_id`: UUID NOT NULL (Foreign Key -> `application_package_versions.id`, CASCADE delete)
- `artifact_type`: TEXT NOT NULL — `'TAILORED_CV_DOCX' | 'TAILORED_CV_TXT' | 'COVER_LETTER_DOCX' | 'COVER_LETTER_TXT'`
- `file_name`: TEXT NOT NULL
- `mime_type`: VARCHAR(100) NOT NULL
- `size_bytes`: INTEGER NOT NULL
- `storage_path`: TEXT NOT NULL
- `sha256_checksum`: VARCHAR(64) NOT NULL
- `created_at`: TIMESTAMPTZ NOT NULL (Default: now())

**Indexes**:

- `application_artifacts_version_idx` on `(package_version_id)`
- `application_artifacts_type_idx` on `(artifact_type)`

### 6.4. `application_questions` (Screening Questions & Responses)

Screening and application questions associated with a package version:

- `id`: UUID (Primary Key, defaultRandom)
- `package_version_id`: UUID NOT NULL (Foreign Key -> `application_package_versions.id`, CASCADE delete)
- `question_text`: TEXT NOT NULL
- `question_type`: TEXT NOT NULL — `'SHORT_TEXT' | 'LONG_TEXT' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'BOOLEAN' | 'NUMERIC' | 'FILE_UPLOAD'`
- `category`: TEXT NOT NULL — `'EXPERIENCE' | 'SKILLS' | 'EDUCATION' | 'WORK_AUTHORIZATION' | 'SPONSORSHIP' | 'SALARY' | 'AVAILABILITY' | 'DIVERSITY' | 'GENERAL'`
- `is_required`: BOOLEAN NOT NULL (Default: true)
- `is_sensitive`: BOOLEAN NOT NULL (Default: false)
- `answer_source`: TEXT NOT NULL — `'ANSWER_LIBRARY' | 'CANDIDATE_FACT' | 'MANUAL_ENTRY' | 'UNRESOLVED'`
- `answer_source_id`: UUID (Nullable reference to source entity)
- `suggested_answer`: TEXT
- `final_answer`: TEXT
- `resolution_status`: TEXT NOT NULL (Default: `'UNRESOLVED'`) — `'AUTO' | 'REVIEW' | 'MANUAL' | 'UNRESOLVED'`
- `confidence`: INTEGER NOT NULL (Default: 50, range 0-100)
- `user_notes`: TEXT
- `created_at`: TIMESTAMPTZ NOT NULL (Default: now())
- `updated_at`: TIMESTAMPTZ NOT NULL (Default: now())

**Indexes**:

- `application_questions_version_idx` on `(package_version_id)`
- `application_questions_category_idx` on `(category)`
- `application_questions_resolution_idx` on `(resolution_status)`

### 6.5. `approval_requests` (Human Approval Queue)

Sensitive or ambiguous declarations requiring explicit human sign-off:

- `id`: UUID (Primary Key, defaultRandom)
- `package_version_id`: UUID NOT NULL (Foreign Key -> `application_package_versions.id`, CASCADE delete)
- `question_id`: UUID (Foreign Key -> `application_questions.id`, SET NULL delete)
- `user_id`: UUID NOT NULL (Foreign Key -> `users.id`, CASCADE delete)
- `title`: TEXT NOT NULL
- `description`: TEXT NOT NULL
- `category`: TEXT NOT NULL
- `risk_level`: TEXT NOT NULL (Default: `'MEDIUM'`) — `'LOW' | 'MEDIUM' | 'HIGH'`
- `status`: TEXT NOT NULL (Default: `'PENDING'`) — `'PENDING' | 'APPROVED' | 'REJECTED'`
- `suggested_value`: TEXT
- `resolved_value`: TEXT
- `rejection_reason`: TEXT
- `resolved_at`: TIMESTAMPTZ
- `created_at`: TIMESTAMPTZ NOT NULL (Default: now())
- `updated_at`: TIMESTAMPTZ NOT NULL (Default: now())

**Indexes**:

- `approval_requests_user_status_idx` on `(user_id, status)`
- `approval_requests_version_idx` on `(package_version_id)`
- `approval_requests_risk_idx` on `(risk_level)`

### 6.6. `application_package_events` (Audit Event Timeline)

Immutable audit log tracking the lifecycle and mutations of application packages:

- `id`: UUID (Primary Key, defaultRandom)
- `package_id`: UUID NOT NULL (Foreign Key -> `application_packages.id`, CASCADE delete)
- `version_id`: UUID (Foreign Key -> `application_package_versions.id`, SET NULL delete)
- `user_id`: UUID NOT NULL (Foreign Key -> `users.id`, CASCADE delete)
- `event_type`: TEXT NOT NULL — `'PACKAGE_CREATED' | 'VERSION_GENERATED' | 'APPROVAL_REQUESTED' | 'APPROVAL_RESOLVED' | 'QUESTION_RESOLVED' | 'STATUS_CHANGED' | 'STALENESS_DETECTED' | 'ARTIFACT_EXPORTED'`
- `description`: TEXT NOT NULL
- `metadata`: JSONB NOT NULL (Default: `{}`)
- `created_at`: TIMESTAMPTZ NOT NULL (Default: now())

**Indexes**:

- `application_package_events_pkg_idx` on `(package_id)`
- `application_package_events_type_idx` on `(event_type)`

---

## 7. Application CRM & Personal ATS Entities (`JOB-P3-T02`)

The Application CRM subsystem persists the full post-selection lifecycle, submission provenance, recruiter relationships, and pipeline progress:

### 7.1. `applications` (Core Application Record)

The root tracking entity linking a candidate and job to lifecycle progress:

- `id`: UUID (Primary Key, defaultRandom)
- `user_id`: UUID NOT NULL (Foreign Key -> `users.id`, CASCADE delete)
- `job_id`: UUID NOT NULL (Foreign Key -> `jobs.id`, CASCADE delete)
- `package_id`: UUID (Foreign Key -> `application_packages.id`, SET NULL delete)
- `status`: TEXT NOT NULL (Default: `'DISCOVERED'`) — Exact 17 canonical statuses:
  - Discovery & Intelligence: `DISCOVERED`, `ANALYZED`, `MATCHED`, `SKIPPED`
  - Preparation & Readiness: `READY_TO_APPLY`, `NEEDS_REVIEW`
  - Submission Execution: `APPLYING`, `APPLIED`, `CONFIRMATION_RECEIVED`
  - Active Pipeline: `SCREENING`, `ASSESSMENT`, `INTERVIEW`, `FINAL_INTERVIEW`, `OFFER`
  - Terminal Outcomes: `REJECTED`, `WITHDRAWN`, `EXPIRED`
- `is_archived`: BOOLEAN NOT NULL (Default: false)
- `archived_at`: TIMESTAMPTZ (Soft archiving timestamp to preserve history and prevent accidental destruction)
- `applied_at`: TIMESTAMPTZ (Frozen timestamp of submission)
- `submission_channel`: TEXT — `'PORTAL' | 'EMAIL' | 'EASY_APPLY' | 'REFERRAL' | 'DIRECT' | 'MANUAL' | 'OTHER'`
- `external_reference`: TEXT (Employer application confirmation number / URL)
- `submitted_package_version_id`: UUID (Foreign Key -> `application_package_versions.id`, SET NULL delete)
- `submitted_cv_artifact_id`: UUID (Foreign Key -> `application_artifacts.id`, SET NULL delete)
- `submitted_cover_letter_artifact_id`: UUID (Foreign Key -> `application_artifacts.id`, SET NULL delete)
- `notes`: TEXT (General application overview notes)
- `next_action`: TEXT (Immediate next task, e.g. "Prepare presentation for Round 2")
- `next_action_due_at`: TIMESTAMPTZ (Deadline for next action)
- `last_activity_at`: TIMESTAMPTZ NOT NULL (Default: now())
- `created_at`: TIMESTAMPTZ NOT NULL (Default: now())
- `updated_at`: TIMESTAMPTZ NOT NULL (Default: now())

**Indexes & Constraints**:

- `applications_user_job_idx` on `(user_id, job_id)` UNIQUE constraint (one tracking record per job)
- `applications_user_status_idx` on `(user_id, status)`
- `applications_job_idx` on `(job_id)`
- `applications_package_idx` on `(package_id)`
- `applications_next_action_due_idx` on `(next_action_due_at)`

### 7.2. `application_lifecycle_events` (Audit Event Timeline)

Append-only audit trail capturing every state change, submission event, and correction:

- `id`: UUID (Primary Key, defaultRandom)
- `application_id`: UUID NOT NULL (Foreign Key -> `applications.id`, CASCADE delete)
- `user_id`: UUID NOT NULL (Foreign Key -> `users.id`, CASCADE delete)
- `from_status`: TEXT
- `to_status`: TEXT NOT NULL
- `trigger`: TEXT NOT NULL — `'MANUAL' | 'AUTOMATED' | 'EMAIL_SYNC' | 'SYSTEM'`
- `actor`: TEXT NOT NULL — `'USER' | 'AGENT' | 'SYSTEM'`
- `reason`: TEXT
- `metadata`: JSONB NOT NULL (Default: `{}`)
- `occurred_at`: TIMESTAMPTZ NOT NULL (Default: now())
- `created_at`: TIMESTAMPTZ NOT NULL (Default: now())

**Indexes**:

- `application_lifecycle_events_app_idx` on `(application_id)`
- `application_lifecycle_events_occurred_idx` on `(occurred_at)`

### 7.3. `application_notes` (Candidate Log Notes)

Chronological context, recruiter impressions, and prep notes:

- `id`: UUID (Primary Key, defaultRandom)
- `application_id`: UUID NOT NULL (Foreign Key -> `applications.id`, CASCADE delete)
- `user_id`: UUID NOT NULL (Foreign Key -> `users.id`, CASCADE delete)
- `content`: TEXT NOT NULL
- `created_at`: TIMESTAMPTZ NOT NULL (Default: now())
- `updated_at`: TIMESTAMPTZ NOT NULL (Default: now())

**Indexes**:

- `application_notes_app_idx` on `(application_id)`

### 7.4. `application_contacts` (Recruiter & Interviewer Directory)

Structured stakeholder profiles associated with the opportunity:

- `id`: UUID (Primary Key, defaultRandom)
- `application_id`: UUID NOT NULL (Foreign Key -> `applications.id`, CASCADE delete)
- `user_id`: UUID NOT NULL (Foreign Key -> `users.id`, CASCADE delete)
- `name`: TEXT NOT NULL
- `role`: TEXT — `'RECRUITER' | 'HIRING_MANAGER' | 'INTERVIEWER' | 'REFERRAL' | 'OTHER'`
- `email`: TEXT
- `phone`: TEXT
- `linkedin_url`: TEXT
- `notes`: TEXT
- `created_at`: TIMESTAMPTZ NOT NULL (Default: now())
- `updated_at`: TIMESTAMPTZ NOT NULL (Default: now())

**Indexes**:

- `application_contacts_app_idx` on `(application_id)`

### 7.5. `application_assessments` (Technical & Cognitive Assessments)

Take-home assignments, coding challenges, and tests:

- `id`: UUID (Primary Key, defaultRandom)
- `application_id`: UUID NOT NULL (Foreign Key -> `applications.id`, CASCADE delete)
- `user_id`: UUID NOT NULL (Foreign Key -> `users.id`, CASCADE delete)
- `title`: TEXT NOT NULL
- `status`: TEXT NOT NULL (Default: `'PENDING'`) — `'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'PASSED' | 'FAILED' | 'EXPIRED'`
- `due_at`: TIMESTAMPTZ
- `completed_at`: TIMESTAMPTZ
- `platform`: TEXT
- `score`: TEXT
- `instructions`: TEXT
- `notes`: TEXT
- `created_at`: TIMESTAMPTZ NOT NULL (Default: now())
- `updated_at`: TIMESTAMPTZ NOT NULL (Default: now())

**Indexes**:

- `application_assessments_app_idx` on `(application_id)`

### 7.6. `application_interviews` (Interview Rounds)

Scheduled phone screens, technical interviews, and onsite loops:

- `id`: UUID (Primary Key, defaultRandom)
- `application_id`: UUID NOT NULL (Foreign Key -> `applications.id`, CASCADE delete)
- `user_id`: UUID NOT NULL (Foreign Key -> `users.id`, CASCADE delete)
- `round_number`: INTEGER NOT NULL (Default: 1)
- `title`: TEXT NOT NULL
- `format`: TEXT — `'PHONE' | 'VIDEO' | 'ONSITE' | 'ASYNC' | 'OTHER'`
- `scheduled_at`: TIMESTAMPTZ NOT NULL
- `duration_minutes`: INTEGER
- `status`: TEXT NOT NULL (Default: `'SCHEDULED'`) — `'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED'`
- `interviewer_names`: JSONB NOT NULL (Default: `[]`)
- `meeting_link`: TEXT
- `feedback`: TEXT
- `notes`: TEXT
- `created_at`: TIMESTAMPTZ NOT NULL (Default: now())
- `updated_at`: TIMESTAMPTZ NOT NULL (Default: now())

**Indexes**:

- `application_interviews_app_idx` on `(application_id)`
- `application_interviews_scheduled_idx` on `(scheduled_at)`

### 7.7. `application_offers` (Compensation & Package Details)

Job offers received, terms, compensation packages, and candidate responses:

- `id`: UUID (Primary Key, defaultRandom)
- `application_id`: UUID NOT NULL (Foreign Key -> `applications.id`, CASCADE delete)
- `user_id`: UUID NOT NULL (Foreign Key -> `users.id`, CASCADE delete)
- `status`: TEXT NOT NULL (Default: `'PENDING'`) — `'PENDING' | 'ACCEPTED' | 'DECLINED' | 'NEGOTIATING' | 'RESCINDED'`
- `base_salary`: NUMERIC(12, 2)
- `currency`: VARCHAR(10) (Default: `'EUR'`)
- `bonus`: NUMERIC(12, 2)
- `equity`: TEXT
- `benefits_summary`: TEXT
- `offer_date`: TIMESTAMPTZ NOT NULL (Default: now())
- `deadline`: TIMESTAMPTZ
- `decision_date`: TIMESTAMPTZ
- `notes`: TEXT
- `created_at`: TIMESTAMPTZ NOT NULL (Default: now())
- `updated_at`: TIMESTAMPTZ NOT NULL (Default: now())

**Indexes**:

- `application_offers_app_idx` on `(application_id)`

---

## 8. Email Intelligence & Status Synchronization Entities (`JOB-P4-T01`)

The Email Intelligence subsystem enables automated ingestion of recruitment communications, job alerts, and state synchronization while maintaining cryptographic safety and deterministic rules.

### 8.1. `email_accounts` (Connected Mail Accounts)

OAuth connection metadata, encrypted tokens, and sync state:

- `id`: UUID (Primary Key, defaultRandom)
- `user_id`: UUID NOT NULL (Foreign Key -> `users.id`, CASCADE delete)
- `provider`: TEXT NOT NULL — `'GMAIL' | 'OUTLOOK' | 'IMAP' | 'FIXTURE'`
- `email_address`: TEXT NOT NULL
- `encrypted_access_token`: TEXT NOT NULL (AES-256-GCM envelope `iv:tag:ciphertext`)
- `encrypted_refresh_token`: TEXT (AES-256-GCM envelope)
- `token_expires_at`: TIMESTAMPTZ
- `scope`: TEXT NOT NULL (Default: `'https://www.googleapis.com/auth/gmail.readonly'`)
- `sync_cursor`: TEXT
- `last_synced_at`: TIMESTAMPTZ
- `is_syncing`: BOOLEAN NOT NULL (Default: false — atomic sync concurrency locking)
- `sync_locked_at`: TIMESTAMPTZ (Lock timestamp with 5-minute timeout window)
- `status`: TEXT NOT NULL (Default: `'CONNECTED'`) — `'CONNECTED' | 'DISCONNECTED' | 'REAUTH_REQUIRED' | 'ERROR' | 'REVOKED'`
- `status_message`: TEXT
- `created_at`: TIMESTAMPTZ NOT NULL (Default: now())
- `updated_at`: TIMESTAMPTZ NOT NULL (Default: now())

**Indexes**:

- `email_accounts_user_idx` on `(user_id)`
- Unique constraint `email_accounts_user_email_unique` on `(user_id, email_address)`

### 8.2. `email_messages` (Inbound Normalized Messages)

Headers, cleaned message text, SHA-256 checksums, and classification metadata:

- `id`: UUID (Primary Key, defaultRandom)
- `account_id`: UUID NOT NULL (Foreign Key -> `email_accounts.id`, CASCADE delete)
- `user_id`: UUID NOT NULL (Foreign Key -> `users.id`, CASCADE delete)
- `provider_message_id`: TEXT NOT NULL
- `provider_thread_id`: TEXT NOT NULL
- `subject`: TEXT NOT NULL
- `from_name`: TEXT
- `from_email`: TEXT NOT NULL
- `to_emails`: JSONB NOT NULL
- `received_at`: TIMESTAMPTZ NOT NULL
- `snippet`: TEXT
- `body_text`: TEXT NOT NULL
- `content_hash`: TEXT NOT NULL (SHA-256 checksum of normalized body)
- `classification`: TEXT — 13 canonical categories
- `confidence`: NUMERIC(4, 3) (0.000 to 1.000)
- `classification_reasons`: JSONB (Array of rule or AI reasons)
- `detected_entities`: JSONB (Company, role, external reference, ATS links)
- `processing_status`: TEXT NOT NULL (Default: `'PROCESSED'`) — `'PENDING' | 'PROCESSED' | 'REVIEW_REQUIRED' | 'FAILED' | 'IGNORED'`
- `created_at`: TIMESTAMPTZ NOT NULL (Default: now())
- `updated_at`: TIMESTAMPTZ NOT NULL (Default: now())

**Indexes**:

- `email_messages_user_idx` on `(user_id)`
- Unique constraint `email_messages_account_provider_msg_unique` on `(account_id, provider_message_id)`
- `email_messages_provider_thread_idx` on `(provider_thread_id)`
- `email_messages_received_idx` on `(received_at)`
- `email_messages_classification_idx` on `(classification)`

### 8.3. `email_thread_links` (Thread Memory Links)

Persistent links between email provider thread IDs and CRM application records:

- `id`: UUID (Primary Key, defaultRandom)
- `user_id`: UUID NOT NULL (Foreign Key -> `users.id`, CASCADE delete)
- `application_id`: UUID NOT NULL (Foreign Key -> `applications.id`, CASCADE delete)
- `provider_thread_id`: TEXT NOT NULL
- `source`: TEXT NOT NULL (Default: `'AUTO'`) — `'AUTO' | 'MANUAL_REVIEW' | 'HEADER_MATCH'`
- `confidence`: NUMERIC(4, 3) NOT NULL (Default: `1.000`)
- `created_at`: TIMESTAMPTZ NOT NULL (Default: now())
- `updated_at`: TIMESTAMPTZ NOT NULL (Default: now())

**Indexes**:

- `email_thread_links_user_idx` on `(user_id)`
- `email_thread_links_app_idx` on `(application_id)`
- Unique constraint `email_thread_links_user_thread_unique` on `(user_id, provider_thread_id)`

### 8.4. `email_review_items` (Human Review Queue)

Uncertain classifications, ambiguous entity links, or high-stakes actions:

- `id`: UUID (Primary Key, defaultRandom)
- `user_id`: UUID NOT NULL (Foreign Key -> `users.id`, CASCADE delete)
- `message_id`: UUID NOT NULL (Foreign Key -> `email_messages.id`, CASCADE delete)
- `application_id`: UUID (Foreign Key -> `applications.id`, SET NULL)
- `job_id`: UUID (Foreign Key -> `jobs.id`, SET NULL)
- `proposed_status`: TEXT (Suggested application state machine status)
- `suggested_action`: TEXT NOT NULL
- `risk_level`: TEXT NOT NULL (Default: `'MEDIUM'`) — `'LOW' | 'MEDIUM' | 'HIGH'`
- `reason`: TEXT NOT NULL
- `resolution_status`: TEXT NOT NULL (Default: `'PENDING'`) — `'PENDING' | 'APPROVED' | 'DISMISSED' | 'REJECTED'`
- `resolved_at`: TIMESTAMPTZ
- `resolution_notes`: TEXT
- `created_at`: TIMESTAMPTZ NOT NULL (Default: now())
- `updated_at`: TIMESTAMPTZ NOT NULL (Default: now())

**Indexes**:

- `email_review_items_user_idx` on `(user_id)`
- `email_review_items_message_idx` on `(message_id)`
- `email_review_items_resolution_idx` on `(resolution_status)`
- `email_review_items_risk_idx` on `(risk_level)`

### 8.5. `email_sync_runs` (Sync Execution Audit Log)

Execution audit and metric tracking for mail sync runs:

- `id`: UUID (Primary Key, defaultRandom)
- `account_id`: UUID NOT NULL (Foreign Key -> `email_accounts.id`, CASCADE delete)
- `user_id`: UUID NOT NULL (Foreign Key -> `users.id`, CASCADE delete)
- `started_at`: TIMESTAMPTZ NOT NULL
- `completed_at`: TIMESTAMPTZ
- `status`: TEXT NOT NULL — `'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED'`
- `messages_found`: INTEGER NOT NULL (Default: 0)
- `messages_processed`: INTEGER NOT NULL (Default: 0)
- `reviews_created`: INTEGER NOT NULL (Default: 0)
- `auto_transitions_applied`: INTEGER NOT NULL (Default: 0)
- `error_message`: TEXT
- `created_at`: TIMESTAMPTZ NOT NULL (Default: now())

**Indexes**:

- `email_sync_runs_account_idx` on `(account_id)`
- `email_sync_runs_user_idx` on `(user_id)`

### 8.6. `oauth_states` (Persistent OAuth Replay & CSRF State Defense)

Persistent, restart-resilient OAuth state replay defense and CSRF protection:

- `id`: UUID (Primary Key, defaultRandom)
- `state_hash`: TEXT NOT NULL (SHA-256 hash of random 128-bit cryptographic nonce)
- `user_id`: UUID NOT NULL (Foreign Key -> `users.id`, CASCADE delete)
- `provider`: TEXT NOT NULL (Default: `'GMAIL'`) — `'GMAIL' | 'OUTLOOK' | 'FIXTURE'`
- `expires_at`: TIMESTAMPTZ NOT NULL (15-minute validity window)
- `consumed_at`: TIMESTAMPTZ (Atomic consumption timestamp; NULL when unconsumed)
- `created_at`: TIMESTAMPTZ NOT NULL (Default: now())

**Indexes**:

- `oauth_states_state_hash_idx` on `(state_hash)`
- `oauth_states_user_idx` on `(user_id)`
- `oauth_states_expires_at_idx` on `(expires_at)`

---

## 9. Identity & Authentication Entities (`JOB-AUTH-01`)

### 9.1. `users` Table (Extensions)

- `name`: TEXT (User display name)
- `email`: TEXT UNIQUE (Normalized user email address with unique index)
- `email_verified`: BOOLEAN DEFAULT false (Email verification flag)
- `image`: TEXT (Avatar URL from Google OAuth or upload)
- `role`: TEXT DEFAULT 'user' ('admin' | 'user')
- `banned`: BOOLEAN DEFAULT false
- `ban_reason`: TEXT
- `ban_expires`: TIMESTAMPTZ
- `invitation_code`: TEXT (Reference to pilot invitation used during onboarding)

### 9.2. `sessions` (Better Auth Sessions)

- `id`: TEXT PRIMARY KEY
- `user_id`: UUID NOT NULL (FK -> `users.id`, CASCADE)
- `token`: TEXT NOT NULL UNIQUE (Session token with unique index)
- `expires_at`: TIMESTAMPTZ NOT NULL
- `ip_address`: TEXT
- `user_agent`: TEXT
- `created_at`, `updated_at`: TIMESTAMPTZ NOT NULL

### 9.3. `accounts` (Better Auth OAuth & Credential Accounts)

- `id`: TEXT PRIMARY KEY
- `user_id`: UUID NOT NULL (FK -> `users.id`, CASCADE)
- `account_id`: TEXT NOT NULL (External OAuth subject ID or email)
- `provider_id`: TEXT NOT NULL ('google' | 'credential')
- `access_token`, `refresh_token`, `id_token`: TEXT
- `access_token_expires_at`, `refresh_token_expires_at`: TIMESTAMPTZ
- `scope`: TEXT
- `password`: TEXT (Scrypt hashed password for 'credential' provider)
- `created_at`, `updated_at`: TIMESTAMPTZ NOT NULL

### 9.4. `verifications` (Better Auth Email Verifications & Password Reset)

- `id`: TEXT PRIMARY KEY
- `identifier`: TEXT NOT NULL (Email or user identifier)
- `value`: TEXT NOT NULL (Verification code or hash)
- `expires_at`: TIMESTAMPTZ NOT NULL
- `created_at`, `updated_at`: TIMESTAMPTZ NOT NULL

### 9.5. `pilot_invitations` (Private Pilot Onboarding Invitations)

- `id`: UUID PRIMARY KEY DEFAULT gen_random_uuid()
- `code`: VARCHAR(64) NOT NULL UNIQUE (Generated invite code, e.g. `pilot_...`)
- `inviter_user_id`: UUID (FK -> `users.id`, SET NULL)
- `invited_email`: VARCHAR(255) (Optional email reservation constraint)
- `role`: VARCHAR(32) NOT NULL DEFAULT 'user'
- `status`: VARCHAR(32) NOT NULL DEFAULT 'PENDING' ('PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED')
- `redeemed_by_user_id`: UUID (FK -> `users.id`, SET NULL)
- `redeemed_at`: TIMESTAMPTZ
- `expires_at`: TIMESTAMPTZ NOT NULL
- `created_at`, `updated_at`: TIMESTAMPTZ NOT NULL

---

## 10. Migration Strategy

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
- `0006_application_studio.sql`: Additive schema for Application Studio, Tailored Materials & Human Approval (`application_packages`, `application_package_versions`, `application_artifacts`, `application_questions`, `approval_requests`, `application_package_events`).
- `0007_application_crm.sql`: Additive schema for Application CRM, Lifecycle, Audit Timeline & Analytics (`applications`, `application_lifecycle_events`, `application_notes`, `application_contacts`, `application_assessments`, `application_interviews`, `application_offers`).
- `0008_application_lifecycle_canonicalization.sql`: Canonical lifecycle migration adding `archived_at` timestamp column and index `applications_archived_at_idx`, plus safe state transition queries reconciling legacy statuses to canonical states.
- `0009_email_intelligence.sql`: Additive schema for Email Intelligence, Job Alerts & Application Status Synchronization (`email_accounts`, `email_messages`, `email_thread_links`, `email_review_items`, `email_sync_runs`).
- `0010_oauth_state_persistence.sql`: Additive schema for persistent OAuth state replay defense and sync concurrency locking (`oauth_states` table, `is_syncing` and `sync_locked_at` columns on `email_accounts`).
- `0011_calendar_interview_preparation.sql`: Additive schema for Calendar Integration & Grounded Interview Preparation Workspace (`calendar_accounts`, `interview_calendar_links`, `interview_preparation_briefs`).
- `0012_browser_application_worker.sql`: Additive schema for Browser Application Worker runs and ATS step logs (`browser_application_runs`).
- `0013_orchestrator_scheduling_notifications.sql`: Additive schema for Autonomous Orchestrator runs, System Notifications center, and User Preferences (`orchestration_runs`, `system_notifications`, `notification_preferences`).
- `0014_candidate_data_quarantine.sql`: Candidate data quarantine and reconfirmation verification fields.
- `0015_better_auth.sql`: Authoritative identity management and session infrastructure via Better Auth (`sessions`, `accounts`, `verifications`, `pilot_invitations`, and `users` authentication columns).

## Product evolution persistence (migration 0022)

- `job_search_settings`: one row per tenant; source/board/CV/default budget settings, traversal cursors, daily/discovery leases and daily completion time.
- `preparation_batches`: tenant, creation and cancellation timestamps.
- `preparation_items`: tenant/job/batch, selected CV, input fingerprint, package link, preparation status, attempts and timing/error fields. An active-job partial unique index prevents duplicate queued/preparing items per tenant/job.
- `browser_application_runs`: additive authorization manifest and typed employer submission observation JSON. Existing internal run ID, employer reference and retained storage keys remain distinct. Evidence access is owner-scoped and expires after 30 days.

No existing CRM state is replaced. Preparation, attempted dispatch, provider confirmation and candidate reconciliation remain separate recorded events.
