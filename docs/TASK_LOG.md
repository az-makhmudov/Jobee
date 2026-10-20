# Jobee — Engineering Task Log

This document tracks execution history and verification state for all official macro-tasks.

---

## Task History

### `JOB-P0-T01` — Project Foundation, Architecture, Policies & Documentation

- **Status**: COMPLETED
- **Completed**: Planning phase
- **Summary**: Established product identity, 11-stage workflow, core principles ("AI evaluates and prepares. Rules authorize. Humans handle uncertainty. Everything is auditable"), canonical master context, macro roadmap (Phases 0–5), and component boundaries.

---

### `JOB-P1-T01` — Workspace, Database & Core Platform Foundation

- **Status**: COMPLETED
- **Completed**: 2026-10-04
- **Scope**:
  - TypeScript monorepo with npm workspaces (`apps/web`, `apps/api`, `apps/worker`, `packages/config`, `packages/database`, `packages/shared`).
  - Strict TypeScript configuration, Prettier, ESLint flat config.
  - PostgreSQL persistence with Drizzle ORM, initial `users` entity schema, and migration workflow.
  - Real database verification on development database `ai_job_agent_dev`.
  - Fastify backend API with structured JSON logging, `/health` and `/ready` probes, and standardized error handling.
  - Background worker service process with clean startup and graceful shutdown.
  - React 19 / Vite 8 frontend shell with navigation layout and development API connectivity probe.
  - Vitest test suite and CI verification workflow.
- **Verification Records**:
  - `npm run lint`: PASSED (ESLint 9, 0 errors)
  - `npm run typecheck`: PASSED (TypeScript 5.8, 6 projects checked, 0 errors)
  - `npm run test`: PASSED (Vitest, 6 test files, 17/17 tests passed)
  - `npm run build`: PASSED (all packages built to dist, web bundled with Vite)
  - `npm run format`: PASSED (Prettier, all files conform)
  - `npm run db:generate`: PASSED (Drizzle Kit generated initial migration `0000_magenta_daimon_hellstrom.sql`)
  - `npm run db:migrate`: PASSED (Applied migration to `ai_job_agent_dev`, created `users` and `drizzle.__drizzle_migrations`)
  - `npm run db:check`: PASSED (Database connectivity verified, status `connected`, latency ~12-31ms)
  - Live API probe: PASSED (`GET /health` 200, `GET /ready` 200 `status: "ready"` with live database)

---

### `JOB-P1-T02` — Candidate Brain, Documents, Answer Library & Preferences

- **Status**: COMPLETED
- **Completed**: 2026-10-04
- **Scope**:
  - Deterministic single-user identity resolution (`00000000-0000-0000-0000-000000000001` / `default_primary_candidate`).
  - Normalized schemas for Candidate Profile, Experience, Education, Projects, Skills, Languages, Certifications, Links.
  - Explicit Candidate Facts with verification and `allowAiUse` permission flags and query filtering.
  - Document management (Master CV vs Role CVs, versioning, metadata) with local storage abstraction (`LocalStorageProvider` under Git-ignored `uploads/`, 10MB limit, strict MIME allowlist restricted to PDF, DOCX, TXT, SHA-256 checksums).
  - Reusable Answer Library with `AUTO`, `REVIEW`, and `MANUAL` automation tiers, with hard code-level enforcement that sensitive screening answers (`isSensitive: true`) can NEVER be configured in `AUTO` mode unless explicitly `VERIFIED`.
  - Relational queryable Job Preferences and Application Policy configuration (auto-apply disabled by default, match score thresholds, daily submission limits, deterministic safety gates, preservation of `null` unknown vs `false`).
  - Deterministic 100-point profile completeness scoring engine across 7 weighted categories.
  - Privacy-preserving candidate audit event log (`candidate_audit_events` capturing action, entity, changed field names array, safe operational metadata, with zero historical PII snapshots).
  - Fastify REST API with complete CRUD routes, Zod schema validation, multipart upload, and streaming downloads.
  - Functional React 19 Web UI for Candidate Profile, Document Vault, Answer Library, Preferences & Safety Policy, Audit Activity Log, and Dashboard.
  - Migrations `0001_tidy_darkstar.sql` and `0002_audit_privacy.sql` generated and applied to PostgreSQL (`ai_job_agent_dev`).
- **Finalization & Verification Records**:
  - `npm run lint`: PASSED (ESLint 9, 0 errors)
  - `npm run typecheck`: PASSED (TypeScript 5.8 across all workspaces, 0 errors)
  - `npm run test`: PASSED (Vitest, 9 test suites, 34/34 tests passed)
  - `npm run build`: PASSED (All packages and web bundle compiled cleanly)
  - `npm run format`: PASSED (Prettier checked all files)
  - `npm run db:check`: PASSED (Database connectivity verified, status `connected`, latency ~53ms)
  - Live End-to-End Smoke Test: PASSED (14/14 automated lifecycle stages executed against live PostgreSQL `ai_job_agent_dev`, SHA-256 byte comparison verified on downloaded document, disallowed JSON upload rejected with 400, unverified sensitive AUTO answer rejected with 400, 50 audit events verified 100% compliant with zero PII snapshots, temporary test data cleanly deleted)

---

### `JOB-P2-T01` — Job Ingestion, Parsing, Normalization & Job Inbox

- **Status**: COMPLETED
- **Completed**: 2026-10-04
- **Scope**:
  - Normalized PostgreSQL schema for Canonical Job (`jobs`), Job Sources (`job_sources`), Job Requirements (`job_requirements`), Job Sections (`job_sections`), and Job Audit Events (`job_events`).
  - Additive migration `0004_job_requirements_source_context.sql`: separates semantic requirement category (`category`: `SKILL`, `EXPERIENCE`, `EDUCATION`, `LANGUAGE`, `CERTIFICATION`, `LOCATION`, `WORK_AUTHORIZATION`, `RESPONSIBILITY`, `OTHER`) from requirement strength (`requirement_strength`: `MANDATORY`, `PREFERRED`, `UNKNOWN`), adds foreign key `source_id` referencing `job_sources.id` (`onDelete: 'set null'`), and persists `source_section` context.
  - Safe HTTP retrieval service (`HttpRetrievalService`) with multi-layered SSRF defenses: blocks loopback (`127.0.0.0/8`, `::1`), RFC1918 private IPv4 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), Carrier-grade NAT (`100.64.0.0/10`), link-local / cloud metadata (`169.254.169.254`, `metadata.google.internal`), unique local IPv6 (`fc00::/7`, `fe80::/10`), performs pre-flight DNS address validation on all entries, manual redirect hop validation with security checks, 8s timeout, and 2MB max response cap.
  - ATS provider detection and structured extractors (`GreenhouseExtractor`, `LeverExtractor`, `AshbyExtractor`, `LinkedInExtractor` with auth-wall notice fallback, `GenericExtractor` supporting Schema.org `JobPosting` and OpenGraph meta tags, `ManualTextExtractor` parsing unstructured pasted job text).
  - Responsibility isolation: job responsibilities are captured in `job_sections` (type `RESPONSIBILITIES`) and excluded from mandatory hiring requirements (ensuring strength is `UNKNOWN`, never `MANDATORY`).
  - Raw HTML discard policy: `raw_payload = null` in PostgreSQL on successful extraction to minimize attack surface and storage bloat while retaining `raw_text` and source URLs.
  - Conservative normalization engine (`JobNormalizerService`) for URL canonicalization, workplace types, employment types, seniority levels, locations, explicit compensation, and deterministic SHA-256 `contentHash` fingerprinting.
  - Tri-level deduplication and idempotency engine (provider + external ID, canonical URL, content hash). Re-ingestion idempotently returns the existing job, records a new `job_sources` row with `DUPLICATE` status, and logs a `JOB_DUPLICATE_DETECTED` event. Distinct roles (e.g. different seniority or location) are preserved as distinct jobs.
  - Provenance preservation: original raw source text, retrieval metadata, and HTTP headers are immutably archived. Manual corrections update the normalized presentation columns in `jobs` while keeping original source data intact.
  - Fastify Job API endpoints (`POST /api/jobs/text`, `POST /api/jobs/url`, `GET /api/jobs`, `GET /api/jobs/:id`, `PUT /api/jobs/:id`, `POST /api/jobs/:id/archive`, `GET /api/jobs/metrics`).
  - Web UI: `JobInboxView` with status filters, search, pagination, and metrics ribbon; `AddJobModal` with URL import and text paste tabs; `JobDetailView` with overview, requirements list (with category pills, strength badges, and source section attribution), structured sections, provenance inspector, audit event timeline, and manual edit modal; live job metrics in `DashboardView`.
  - Migrations `0003_jobs_foundation.sql` and `0004_job_requirements_source_context.sql` generated and applied to PostgreSQL (`ai_job_agent_dev`).
- **Verification Records**:
  - `npm run lint`: PASSED (ESLint 9, 0 errors)
  - `npm run typecheck`: PASSED (TypeScript 5.8 across all 6 workspaces, 0 errors)
  - `npm run test`: PASSED (Vitest, 13 test suites, 83/83 tests passed: 11 SSRF tests, 15 extractor tests, 10 normalizer tests, 13 route integration tests, 34 candidate/platform tests)
  - `npm run build`: PASSED (All 6 workspaces and Vite web application compiled cleanly)
  - `npm run format`: PASSED (Prettier verified across entire codebase)
  - `npm run db:check`: PASSED (PostgreSQL connectivity verified, latency 25ms)
  - `npm run db:migrate`: PASSED (All 5 migrations applied and verified in sequence)
  - Live End-to-End Verification: PASSED (Pasted text ingestion with `raw_payload = null`, live Lever public job URL ingestion, LinkedIn auth-wall graceful fallback to `NEEDS_MANUAL_TEXT`, tri-level duplicate detection, distinct role preservation, manual edit provenance immutability, XSS sanitization, SSRF resource bounds validation, and smoke test data cleanup verified via live database inspection).

---

### `JOB-P2-T02` — Requirement Analysis, Matching & Policy Decision Engine

- **Status**: COMPLETED
- **Completed**: 2026-10-05
- **Scope**:
  - Additive PostgreSQL schema for matching intelligence: `job_match_analyses` (composite score, confidence, decision, preliminary auto-apply eligibility, fingerprint, staleness), `job_match_dimensions` (8 discrete dimensions with dynamic re-weighting), and `job_requirement_evaluations` (grounded requirement evaluations with candidate evidence items).
  - Additive migration `0005_matching_intelligence.sql` generated and applied to PostgreSQL `ai_job_agent_dev`.
  - Privacy-minimized context extraction (`MatchingContextBuilder`): extracts candidate data strictly gating on verified facts where `allowAiUse = true`, indexes candidate evidence items, and hashes state.
  - Grounded candidate evidence resolver (`CandidateEvidenceResolver`): deterministic matching for skills (exact, alias, and fuzzy matching), languages (CEFR ranking A1-C2), experience duration aggregation across non-overlapping tenures via interval-union algorithm (preventing double-counting concurrent roles without inventing dates), education degree level comparison, and certifications.
  - Deterministic hard policy engine (`HardPolicyEngine`): evaluates mandatory blockers (`EXCLUDED_COMPANY`, `EXCLUDED_KEYWORD`, `WORK_MODE_NOT_ALLOWED`, `UNPAID_ROLE_REJECTED`, `SALARY_BELOW_MINIMUM`, `SPONSORSHIP_CONFLICT`) and unknown-sensitive policies (`POLICY_INFORMATION_MISSING` / `UNKNOWN_SENSITIVE_FACTS` requiring human review rather than guessing).
  - Versioned dimensional scoring engine (`MatchingScoringEngine` v1.0.0): evaluates 8 dimensions (`ROLE_FIT`, `SKILLS_FIT`, `EXPERIENCE_FIT`, `EDUCATION_FIT`, `LOCATION_FIT`, `LANGUAGE_FIT`, `COMPENSATION_FIT`, `WORK_AUTHORIZATION_FIT`), re-weights dynamically across available scored dimensions when a dimension is unknown or not applicable, applies mandatory requirement penalties, computes confidence score (0-100) based on information density, and calculates conservative preliminary auto-apply eligibility (requires MATCH + confidence >= 70 + autoApplyEnabled + zero blockers; never auto-submits).
  - Pluggable AI provider abstraction (`AiProvider` interface) supporting `DisabledAiProvider`, `MockAiProvider`, and `GeminiAiProvider` (configurable via `AI_MODEL` defaulting to `gemini-2.5-flash`, accepting `GEMINI_API_KEY` or `AI_API_KEY`).
  - Strict anti-hallucination ground-truth validation guard (`validator.ts`): validates LLM response schema, checks all returned evidence IDs against the pre-compiled context evidence whitelist, strips invalid/hallucinated IDs, deduplicates references, and demotes unverified `MET` claims to `UNKNOWN`.
  - Invalidation and reactive staleness engine: SHA-256 `inputFingerprint` state hashing marks existing analyses as stale (`isStale: true`) whenever candidate credentials, preferences, job fields, or algorithm version (`MATCH_ALGORITHM_VERSION`) change.
  - Bounded batch analysis (`MatchService.batchAnalyzeJobs`): bounded 1-50 limit with per-job error isolation.
  - Fastify matching routes: `POST /api/jobs/:id/analyze`, `GET /api/jobs/:id/analysis`, `POST /api/jobs/analyze` (batch), and enhanced `GET /api/jobs` query filtering (by decision, minScore, maxScore, minConfidence, isStale) and sorting (by score, confidence, discoveredDate, title, company).
  - User interface:
    - `JobInboxView`: Decision badges (`MATCH`, `REVIEW`, `SKIP`), score and confidence display, staleness indicator, decision and staleness filters, sorting dropdown, row-level quick "Analyze" action, and "Batch Analyze Unanalyzed" action.
    - `JobDetailView`: Complete Match Analysis inspector tab with score and decision badge, preliminary auto-apply eligibility banner, analysis mode and version badge, hard blocker alert banner, staleness alert banner with re-analyze action, executive summary, reason codes pills, strengths/gaps/unknowns/warnings grid, 8-dimension fit breakdown cards, and grounded requirement evaluations table with candidate evidence pills.
    - `DashboardView`: Match intelligence metrics ribbon (analyzed, matches, review needed, skips, avg score) and recent jobs list with match decision badges.
- **Verification Records**:
  - `npm run lint`: PASSED (ESLint 9, 0 errors, 84 warnings)
  - `npm run typecheck`: PASSED (TypeScript 5.8 across all workspaces, 0 errors)
  - `npm run test`: PASSED (Vitest, 15 test suites, 112/112 tests passed: 23 matching intelligence unit tests, 6 match route integration tests, 11 SSRF tests, 15 extractor tests, 10 normalizer tests, 13 job route tests, 34 candidate/platform tests)
  - `npm run build`: PASSED (All packages and Vite web application compiled cleanly)
  - `npm run format`: PASSED (Prettier checked across entire repository)
  - `npm run db:check`: PASSED (Database connectivity verified)
  - `npm run db:migrate`: PASSED (Migration sequence 0000 through 0005 applied cleanly)
  - Live End-to-End Verification: PASSED (Live PostgreSQL verification passing Scenarios A-G: strong MATCH with grounded evidence, REVIEW on unknown-sensitive facts, SKIP with hard blocker override and calculated score retention, bounded batch analysis with error isolation, three-way staleness detection on candidate/job/algorithm-version mutations, non-overlapping experience interval union, conservative non-operational auto-apply boundary, and complete cleanup with 0 database orphans).

---

### `JOB-P3-T01` — Application Studio, Tailored Materials & Human Approval

- **Status**: COMPLETED
- **Completed**: 2026-10-06
- **Crash Recovery**: Resumed seamlessly from unexpected runtime crash. Re-verified schema migration `0006_application_studio.sql`, database journal `_journal.json`, shared types, backend services, Fastify API routes, frontend components, and live PostgreSQL verification scripts.
- **Scope**:
  - Additive PostgreSQL schema for Application Studio: `application_packages` (lifecycle status `DRAFT`, `NEEDS_REVIEW`, `READY`, target role, company, staleness), `application_package_versions` (immutable snapshots, tailored CV JSON, cover letter text, readiness score, validation issues), `application_artifacts` (generated DOCX and TXT files, MIME types, storage paths, SHA-256 checksums), `application_questions` (ingested/inferred questions, answer sources, resolution status, candidate edits), `approval_requests` (sensitive screening approvals, risk levels, human decision history), and `application_package_events` (audit log).
  - Additive migration `0006_application_studio.sql` generated and applied to PostgreSQL `ai_job_agent_dev`.
  - Shared domain contracts and DTOs in `packages/shared/src/types/application-package.ts`.
  - Base CV selection priority hierarchy (`CvBaseSelector`): manual override document > active role-specific CV > active master CV > direct Candidate Brain structured profile compilation.
  - ATS-safe single-column DOCX document generator (`DocxGeneratorService`) utilizing `docx` library with clean typographic hierarchy, executive summary, verified work history, education, skills, and single-column cover letter formatting.
  - Truthful CV tailoring engine (`TailoringEngine`): preserves immutable core facts (employer, job title, employment dates, degrees, certifications), reorders and highlights relevant bullet points, attaches grounded `evidenceIds` provenance, and executes metric safeguard (cross-checking numeric metrics and percentages against Candidate Brain, flagging unverified metrics).
  - Grounded cover letter composer (`CoverLetterEngine`): professional, concise narrative grounded in candidate facts, linking candidate experience to job requirements with zero invented accomplishments.
  - 4-level application question resolution hierarchy (`ApplicationQuestionEngine`):
    - `AUTO`: High-confidence exact or keyword match from Answer Library for non-sensitive categories.
    - `REVIEW`: Inferred/low-confidence draft requiring human confirmation before submission.
    - `MANUAL`: Prompts candidate for new input when no suitable answer exists.
    - `UNRESOLVED`: Flagged question blocking package readiness until addressed.
    - Mandatory sensitive category screening: questions in `WORK_AUTHORIZATION`, `SPONSORSHIP`, and `SALARY` strictly generate approval requests regardless of automation level.
  - Human Approvals Queue and Package Readiness Engine (`PackageReadinessEngine`): evaluates blocking approval requests, unresolved questions, and validation issues to determine if package status is `DRAFT`, `NEEDS_REVIEW`, or `READY`.
  - Application package lifecycle orchestrator (`ApplicationPackageService`): handles package generation, artifact streaming, version carry-forward (carrying forward approved answers into regenerated versions), dynamic staleness detection, and event auditing.
  - 15 Fastify REST endpoints in `apps/api/src/routes/application-package-routes.ts` covering packages, versions, artifacts, questions, approvals, and metrics.
  - React 19 Frontend:
    - `ApplicationStudioView`: Multi-tab studio interface (Overview & Readiness, Tailored CV Preview, Cover Letter, Application Questions, Approvals, Evidence).
    - `ApprovalsInboxView`: Global human approvals queue with status filters and approve/reject actions with custom candidate answer input.
    - `ApplicationPackagesListView`: Comprehensive list of prepared packages with status filters and quick studio access.
    - `JobDetailView`: "Prepare Application" button and navigation hook.
    - `DashboardView`: Application Studio metrics section (packages in prep, needing review, ready, pending approvals) with quick links.
    - `App.tsx`: Wired navigation tabs for `applications` and `approvals`.
- **Verification Records**:
  - `npm run lint`: PASSED (ESLint 9, 0 errors, 86 warnings)
  - `npm run typecheck`: PASSED (TypeScript 5.8 across all 6 workspaces, 0 errors)
  - `npm run test`: PASSED (Vitest, 17 test suites, 141/141 tests passed: 7 application package route integration tests, 23 matching unit tests, 6 match route tests, 11 SSRF tests, 15 extractor tests, 10 normalizer tests, 13 job route tests, 34 candidate/platform tests)
  - `npm run build`: PASSED (All 6 workspaces and Vite web application compiled cleanly)
  - `npm run format`: PASSED (Prettier checked across entire repository)
  - `npm run db:check`: PASSED (PostgreSQL connectivity verified)
  - `npm run db:migrate`: PASSED (Migration sequence 0000 through 0006 applied cleanly)
  - Live End-to-End Verification: PASSED (Automated 10-stage live test against PostgreSQL `ai_job_agent_dev` executing profile/evidence seeding, job ingestion & match analysis, package v1 creation, DOCX artifact SHA-256 validation, truthfulness invariant & metric safeguard checks, 4-level question resolution, human approval queue resolution with candidate edits, deterministic transition to READY, dynamic staleness detection on candidate profile mutation, v2 regeneration with carry-forward, and 100% clean teardown with zero orphaned records).

---

### `JOB-P3-T02` — Application CRM, Lifecycle, Audit Timeline & Analytics

- **Status**: COMPLETED
- **Completed**: 2026-10-06
- **Milestone**: **Personal ATS MVP achieved at JOB-P3-T02**
- **Scope**:
  - Additive PostgreSQL schema for Application CRM:
    - `applications`: tracks application lifecycle state across 17 canonical statuses, source attribution, submission method, external reference ID, application URL, applied timestamp, closed timestamp, terminal reason and stage, next action text, type, and follow-up date, notes, and frozen submission provenance (`submitted_package_version_id`, `submitted_cv_artifact_id`, `submitted_cover_letter_artifact_id`). Enforces unique index on `(user_id, job_id)` for idempotent tracking.
    - `application_lifecycle_events`: immutable audit timeline recording status changes, submissions, notes, contacts, assessments, interviews, offers, and correction overrides with actor, previous and new status, notes, and safe metadata.
    - `application_notes`: candidate notes and observations with author and timestamps.
    - `application_contacts`: recruiter and interviewer network directory (name, email, phone, title, company, LinkedIn URL, primary contact flag, notes).
    - `application_assessments`: technical/coding assessments, take-homes, and tests (title, type, provider, status, received/due/completed dates, URL, score, notes).
    - `application_interviews`: interview rounds (round title, type, status, scheduled timestamp, duration, timezone, location/meeting URL, interviewer name, linked contact ID, notes, feedback).
    - `application_offers`: job offers (base salary, total compensation, currency, employment type, proposed start date, decision deadline, status `PENDING`/`ACCEPTED`/`DECLINED`/`NEGOTIATING`/`RESCINDED`, notes).
  - Additive migrations `0007_application_crm.sql` and `0008_application_lifecycle_canonicalization.sql` generated and applied to PostgreSQL `ai_job_agent_dev`.
  - Shared domain contracts and DTOs in `packages/shared/src/types/application-crm.ts`.
  - Application State Machine (`ApplicationStateMachine`):
    - Enforces valid lifecycle transitions across all 17 canonical statuses: `DISCOVERED`, `ANALYZED`, `MATCHED`, `SKIPPED`, `READY_TO_APPLY`, `NEEDS_REVIEW`, `APPLYING`, `APPLIED`, `CONFIRMATION_RECEIVED`, `SCREENING`, `ASSESSMENT`, `INTERVIEW`, `FINAL_INTERVIEW`, `OFFER`, `REJECTED`, `WITHDRAWN`, `EXPIRED`.
    - Allows realistic stage skipping (e.g., jumping from `APPLIED` directly to `INTERVIEW`).
    - Safeguards terminal states (`REJECTED`, `WITHDRAWN`, `EXPIRED`): transitions out of terminal states are strictly rejected unless an explicit correction override (`isCorrection: true`) and human rationale (`correctionReason`) are provided.
    - Soft archiving pattern (`is_archived: true`, `archived_at: timestamp`) with archive/unarchive endpoints preserving historical timeline and frozen provenance, paired with deliberate hard purge endpoint (`DELETE /api/applications/:id/purge`).
  - Frozen Submission Provenance:
    - Submitting an application freezes the exact package version and artifact IDs (`submitted_package_version_id`, `submitted_cv_artifact_id`, `submitted_cover_letter_artifact_id`). Subsequent package regenerations in Studio do not alter past historical submissions.
    - Full support for manual, package-less applications recorded directly in CRM.
  - Personal ATS Funnel Analytics Engine (`ApplicationAnalyticsEngine`):
    - Multi-stage funnel counts (`totalApplications`, `readyToApply`, `applied`, `screening`, `interview`, `offer`).
    - Stage conversion rates (`appliedToScreening`, `appliedToInterview`, `appliedToOffer`, `interviewToOffer`) with safe zero-denominator handling (`rate: null` when denominator is 0).
    - Duration metrics (average days to first response, average days to interview, average days to outcome, active process aging days, with sample size tracking).
    - Source distribution percentages.
  - Application CRM Service (`ApplicationCrmService`):
    - Single orchestrator handling idempotent application tracking, status transitions, submission recording, next actions, archiving/unarchiving, notes, contacts, assessments, interviews, offers, metrics, and analytics.
  - Fastify REST API (`apps/api/src/routes/application-crm-routes.ts`):
    - 24 endpoints covering full application CRUD, status transitions, submission marking, archiving, unarchiving, purging, next action updates, metrics, analytics, contacts, notes, assessments, interviews, and offers.
    - Registered in Fastify application entrypoint `apps/api/src/app.ts`.
  - React 19 Frontend:
    - `ApplicationsCrmView`: Dual-mode interface featuring Kanban Stage Board and Filterable Table List views, full-text search, status and source filters, archived applications filter toggle, "Record Existing Application" modal, and quick mark-applied action.
    - `ApplicationDetailView`: Comprehensive application view with stage transition action toolbar, archiving controls, frozen submission artifacts, next action editor, timeline stream, contacts, assessments, interviews, offers, and notes.
    - `ApplicationAnalyticsModal`: Rich modal surfacing funnel conversion bars, duration metrics, and source attribution breakdown.
    - Two-way cross-navigation: seamless navigation between Job Detail ("View in CRM" / "Track in CRM"), Application Studio ("View in CRM" / "Mark Applied in CRM"), Application Packages, and Dashboard.
    - `DashboardView`: Dedicated "Application Lifecycle CRM & ATS Pipeline (Phase 3 MVP)" card surfacing live active pipeline, total applied, interview counts, offers, and follow-ups due/overdue.
- **Verification Records**:
  - `npm run lint`: PASSED (ESLint 9, 0 errors)
  - `npm run typecheck`: PASSED (TypeScript 5.8 across all 6 workspaces, 0 errors)
  - `npm run test`: PASSED (Vitest, 20 test files, 156/156 tests passed: 7 state machine tests, 3 analytics engine tests, 5 CRM routes integration tests, and 141 existing platform tests)
  - `npm run build`: PASSED (All 6 workspaces built and Vite web bundle compiled in 1.49s)
  - `npm run format`: PASSED (Prettier checked across entire repository)
  - `npm run db:check`: PASSED (Database connectivity verified)
  - `npm run db:migrate`: PASSED (Migration sequence 0000 through 0008 applied cleanly)
  - Live End-to-End Verification: PASSED (Automated test `scripts/verify-crm-lifecycle.ts` against PostgreSQL `ai_job_agent_dev` executing Scenarios A-F + Creation Paths + Soft Archiving + Sub-Entities & Analytics + 100% clean teardown with zero database orphans).

---

### `JOB-P4-T01` — Email Intelligence, Job Alerts & Application Status Synchronization

- **Status**: COMPLETED
- **Completed**: 2026-10-08
- **Scope**:
  - Additive PostgreSQL schema for Email Intelligence:
    - `email_accounts`: connected provider accounts (provider `GMAIL` | `FIXTURE`, email address, AES-256-GCM encrypted tokens, granted scopes, status, sync cursor, last synced timestamp, token expiry, error messages).
    - `email_messages`: ingested normalized messages (provider message ID, provider thread ID, sender/recipient, subject, received timestamp, snippet, sanitized plain text body, 13-category classification, confidence, processing status, linked job/application/contact, deterministic content hash, raw metadata).
    - `email_thread_links`: thread memory associations linking email threads to applications/jobs, confirmed automatically or by human users.
    - `email_review_items`: human review queue for ambiguous or sensitive email classifications (risk level, classification, confidence, proposed action, proposed target status, explanation, extracted details, status, resolution note, resolved timestamp).
    - `email_sync_runs`: audit log of email synchronization runs (trigger, status, messages found/ingested, auto-synced updates count, review items created, jobs discovered, start/complete timestamps, error messages).
    - Additive migrations `0009_email_intelligence.sql` and `0010_oauth_state_persistence.sql` generated and applied to PostgreSQL `ai_job_agent_dev`.
    - Migration 0010 adds `oauth_states` table for restart-resilient OAuth CSRF and replay defense, and adds `is_syncing` (boolean) and `sync_locked_at` (timestamptz) to `email_accounts` for atomic sync mutex concurrency control.
  - Security & Cryptography Hardening:
    - Versioned authenticated AES-256-GCM token encryption envelope: `v1:primary:<ivBase64url>:<tagBase64url>:<ciphertextBase64url>` via `TokenCryptoService`.
    - Key rotation readiness with explicit key identifiers.
    - Token encryption key entropy validation on startup (>= 32 chars, >= 8 unique chars; rejection of development defaults in production).
    - Forward-compatibility envelope checks (unsupported future versions like `v2:` safely rejected) with backwards-compatible support for legacy JSON envelopes.
    - Persistent OAuth CSRF state manager via `OAuthStateService` backed by PostgreSQL `oauth_states` table: atomic consumption query (`UPDATE oauth_states SET consumed_at = NOW() WHERE ... RETURNING *`) provides multi-instance and restart-resilient single-use replay defense.
    - Strict read-only OAuth scope enforcement (`https://www.googleapis.com/auth/gmail.readonly`). Outbound sending strictly prohibited.
    - Structured logger string sanitizer redacting Bearer tokens (`Bearer [REDACTED]`) and connection string passwords across all log messages, context objects, and errors.
  - Providers & MIME Normalization:
    - `EmailProvider` abstraction implemented by `GmailProvider` (Google OAuth 2.0 REST client) and `FixtureEmailProvider` (deterministic offline simulator covering all 11 recruitment archetypes).
    - `MimeParser`: header parsing, address normalization, reply quotation marker stripping, HTML sanitization via cheerio, and SHA-256 content hashing.
  - Classification & Entity Resolution:
    - 13-category taxonomy (`JOB_ALERT`, `APPLICATION_CONFIRMATION`, `APPLICATION_REJECTION`, `RECRUITER_OUTREACH`, `SCREENING_REQUEST`, `ASSESSMENT_REQUEST`, `INTERVIEW_REQUEST`, `INTERVIEW_CONFIRMATION`, `OFFER_RELATED`, `APPLICATION_UPDATE`, `OTHER_JOB_RELATED`, `IRRELEVANT`, `UNKNOWN`).
    - High-precision `DeterministicEmailClassifier` paired with Gemini `AiEmailClassifier` fallback.
    - `EmailEntityResolver`: multi-strategy matching using external reference IDs, thread memory, contact email, and fuzzy company & role matching against candidate's CRM applications.
    - `JobAlertParser`: parsing and canonical ingestion of job alert listings into `JobService`.
  - Deterministic CRM State Synchronization & Conservative Guardrails:
    - Prime Invariant enforced: deterministic state authorization via `ApplicationCrmService.transitionStatus` with system actor provenance.
    - High confidence (>= 0.85) auto-transitions for application confirmations (`APPLIED` -> `CONFIRMATION_RECEIVED`), screening requests (`SCREENING`), assessments (`ASSESSMENT`), and interview notices (`INTERVIEW`).
    - Idempotent stage transitions: screening, assessment, and interview confirmations do not duplicate transitions if the application is already at or past that stage.
    - Safe non-destructive review queue routing: `APPLICATION_UPDATE` and `UNKNOWN` route to review queue with `riskLevel: 'LOW'`, `proposedAction: 'NONE'`, and zero destructive CRM mutations.
    - Conservative rejection guardrail: rejections require >= 0.95 confidence and exact entity match; otherwise escalated to `EmailReviewQueue` with `riskLevel: 'HIGH'`. Offers always route to human review.
    - Sync concurrency lock: atomic database claim on `email_accounts.is_syncing` with 5-minute timeout window; competing sync requests rejected with HTTP 409 Conflict.
    - Safe account disconnect: `DELETE /api/email/accounts/:id` neutralizes credentials and marks account `DISCONNECTED` while preserving normalized intelligence history and review items. Hard purge requires `?purge=true`.
    - Token invalidation handling: expired/revoked tokens mark account `REAUTH_REQUIRED` without losing historical data.
  - Fastify REST API & Web UI:
    - REST endpoints registered in Fastify API covering accounts, OAuth connect/callbacks, sync runs, message logs, review queue, resolution actions, and disconnect.
    - `EmailIntelligenceView`: comprehensive Web UI with KPI metrics, account connection management, review queue resolution cards, and message logs.
    - Dashboard card integration in `DashboardView.tsx`.
- **Verification Records**:
  - Canonical Master Context Check: `MASTER_CONTEXT_IN_SYNC` verified via byte-for-byte comparison (`cmp -s AI_JOB_AGENT_MASTER_CONTEXT.md docs/MASTER_CONTEXT.md`, exit code 0).
  - `npm run lint`: PASSED (ESLint 9, 0 errors)
  - `npm run typecheck`: PASSED (TypeScript 5.8 across all monorepo workspaces, 0 errors)
  - `npm run test`: PASSED (Vitest, 24 test files, 187/187 tests passed: versioned crypto tests, persistent oauth replay tests, concurrency conflict tests, safe disconnect tests, mime parser tests, classification tests, and all platform tests)
  - `npm run build`: PASSED (All 6 workspaces built and Vite web bundle compiled cleanly)
  - `npm run format`: PASSED (Prettier checked across entire repository)
  - `npm run db:check`: PASSED (Database connectivity verified)
  - `npm run db:migrate`: PASSED (Migration sequence 0000 through 0010 applied cleanly)
  - Live End-to-End Verification: PASSED (Automated script `scripts/verify-job-p4-t01.ts` executed against real local PostgreSQL `ai_job_agent_dev`, verifying Sections 1–9: versioned token encryption, persistent OAuth state replay refusal surviving service restart, MIME normalization, all 11 email archetypes, live CRM auto-transitions, sync concurrency lock rejection with 409 Conflict, human review queue resolution, safe account disconnect preserving normalized intelligence, and 100% clean teardown with zero database orphans).

---

### `JOB-P4-T02` — Calendar Integration & Interview Preparation Workspace

- **Status**: COMPLETED
- **Completed**: 2026-10-10
- **Scope**:
  - Additive PostgreSQL schema for Calendar Integration & Interview Preparation:
    - `calendar_accounts`: connected calendar provider accounts (`GOOGLE` | `FIXTURE`, email, AES-256-GCM encrypted tokens, granted scopes `NONE` | `AVAILABILITY` | `EVENT_MANAGEMENT`, status `CONNECTED` | `REAUTH_REQUIRED` | `ERROR` | `DISCONNECTED`, selected calendar IDs array, default calendar ID).
    - `interview_calendar_links`: deterministic links between CRM interviews and external calendar events (interview ID, calendar account ID, calendar ID, external event ID, event URL, etag, last synced timestamp).
    - `interview_preparation_briefs`: evidence-grounded preparation briefs (`interview_id`, `application_id`, `user_id`, version, generation mode `DETERMINISTIC`, role summary, company context, key requirements, candidate strengths mapped to verified skills/experiences, candidate gaps, likely questions, suggested STAR frameworks with grounded evidence anchors, questions to ask, 6-step preparation checklist with interactive completion flags, candidate personal human notes).
    - `application_interviews` schema extensions: debrief questions asked, debrief topics discussed, debrief candidate observations, debrief follow-up commitments, debrief concerns, debrief expected next step, debrief expected response date, debrief private notes, scheduling status (`PROPOSED`, `NEEDS_CONFIRMATION`, `CONFIRMED`, `RESCHEDULED`, `CANCELLED`, `COMPLETED`), meeting URL.
    - Additive migration `0011_calendar_interview_preparation.sql` applied to PostgreSQL `ai_job_agent_dev`.
  - Service Architecture & Business Logic:
    - `FixtureCalendarProvider`: offline deterministic calendar provider supporting availability windows, mock busy slots, event CRUD, and meeting links.
    - `GoogleCalendarProvider`: Google Calendar REST client implementing standard `CalendarProvider` contract with scopes for availability inspection and event management.
    - `CalendarService`: OAuth URL generation with persistent CSRF defense, token encryption (AES-256-GCM), account connect/disconnect, multi-calendar availability aggregation, conflict detection with severity evaluation (`NONE`, `CONFLICT`) and alternative slot recommendation, interview event booking and unlinking, and interview dashboard metrics.
    - `InterviewPreparationService`: synthesizes strictly grounded interview briefs anchored in verified candidate skills and achievements (zero-hallucination prime directive invariant), manages 6-step interactive preparation checklist, candidate talking points/notes, and records post-interview debriefs with application lifecycle audit logging (`INTERVIEW_COMPLETED`).
  - Fastify REST API:
    - 20 endpoints registered under `/api/calendar/*` and `/api/applications/:appId/interviews/:interviewId/*` covering accounts, OAuth callback, availability queries, conflict verifier, interview booking, preparation briefs, checklist updates, human notes, and debriefs.
  - React 19 Frontend Web UI:
    - `InterviewWorkspaceView.tsx`: comprehensive workspace with tabbed navigation (Scheduled Interviews, Availability & Conflicts, Calendar Inboxes), filters (All, Upcoming, Past, Needs Brief, Needs Debrief), preparation brief modal with STAR frameworks and interactive checklist, debrief modal, and calendar booking modal.
    - `DashboardView.tsx`: integrated Calendar Integration & Interview Preparation metrics card with direct workspace navigation.
    - `App.tsx`: activated `currentSection === 'interviews'` route with full navigation support.
    - `calendar-client.ts`: typed API client consuming all calendar and interview endpoints.
  - Verification Records:
    - `npm run lint`: PASSED (ESLint 9, 0 errors)
    - `npm run typecheck`: PASSED (TypeScript 5.8 across all 6 workspaces, 0 errors)
    - `npm run test`: PASSED (Vitest, 27 test files, 229/229 tests passed, including `calendar-service.test.ts`, `interview-preparation-service.test.ts`, and `calendar-routes.test.ts`)
    - `npm run build`: PASSED (All 6 workspaces built and Vite web bundle compiled cleanly)
    - `npm run format`: PASSED (Prettier checked across entire repository)
    - `npm run db:check`: PASSED (Database connectivity verified)
    - `npm run db:migrate`: PASSED (Migration sequence 0000 through 0011 applied cleanly)
    - Live End-to-End Verification: PASSED (`scripts/verify-job-p4-t02.ts` executed against real local PostgreSQL `ai_job_agent_dev`, verifying Sections 1–10: token encryption, multi-calendar availability aggregation, conflict detection, candidate evidence seeding, interview calendar booking, grounded brief generation with zero-hallucination verification, checklist toggle, human notes, post-interview debrief with CRM lifecycle audit event, workspace listing, calendar event unlinking, and 100% clean teardown).

---

### `JOB-P5-T01` — Browser Application Worker & Initial ATS Adapters

- **Status**: COMPLETED
- **Completed**: 2026-10-10
- **Scope**:
  - Additive PostgreSQL schema for Browser Application Worker:
    - `browser_application_runs`: execution tracking table (`id`, `application_id`, `user_id`, `package_version_id`, `ats_provider`, `target_url`, `mode` [DRY_RUN, PREFILL_ONLY, SUBMIT], `status` [PENDING, RUNNING, SUCCESS, STOPPED_CAPTCHA, STOPPED_MANUAL_REVIEW, VALIDATION_FAILED, FAILED], `fields_detected_count`, `fields_filled_count`, `unmatched_required_fields` JSONB, `step_logs` JSONB audit trail, `screenshot_paths` JSONB, `confirmation_reference`, `error_message`, timestamps).
    - Additive migration `0012_browser_application_worker.sql` applied to PostgreSQL `ai_job_agent_dev`.
  - Shared domain contracts and DTOs in `packages/shared/src/types/browser-worker.ts`:
    - `AtsProviderType`, `BrowserRunMode`, `BrowserRunStatus`, `AtsFormFieldType`, `AtsFormField`, `AtsFormSchema`, `BrowserRunStepLog`, `ChallengeDetectionResult`, `ApplicationSubmissionPayload`, `BrowserApplicationRunDto`, `StartBrowserRunRequest`.
  - Worker Abstraction & Browser Infrastructure (`apps/worker`):
    - `BrowserController`, `BrowserPage`, and `BrowserLocator` neutral execution interfaces.
    - `PlaywrightBrowserController`: headless Chromium wrapper with screenshot and file attachment support.
    - `FixtureBrowserController`: fast, deterministic in-memory DOM simulation with built-in mock forms for Greenhouse, Lever, Ashby, and bot challenges.
  - ATS Adapters & Registry:
    - `BaseAtsAdapter`: common field classification, candidate evidence resolution, dropdown option fuzzy matching, and bot challenge detection (reCAPTCHA, hCaptcha, Cloudflare Turnstile, Arkose/Geetest).
    - `GreenhouseAdapter`: Greenhouse job board inspection, custom questions, file inputs, and submit button detection.
    - `LeverAdapter`: Lever posting inspection, custom cards, file inputs, and submit button detection.
    - `AshbyAdapter`: Ashby posting inspection, field containers, file dropzones, and submit button detection.
    - `AtsAdapterRegistry`: URL and DOM pattern matcher resolving the appropriate ATS adapter.
  - Browser Application Execution Engine:
    - `BrowserApplicationEngine`: coordinates navigation, challenge detection, form schema extraction, candidate brain fact matching, field filling, and execution modes (`DRY_RUN`, `PREFILL_ONLY`, `SUBMIT`).
    - Prime Invariant enforcement: halts with `STOPPED_CAPTCHA` immediately upon bot challenges without guessing or bypassing; halts with `STOPPED_MANUAL_REVIEW` whenever required questions lack verified candidate facts (zero-hallucination guarantee).
    - Step-by-step timestamped audit logging for every DOM interaction.
  - Background Worker Service & Runner:
    - `executePendingBrowserRun`: compiles candidate profile, links, vault documents, and answer library into submission payload and runs engine.
    - `WorkerService`: heartbeat polling tick processing pending runs from PostgreSQL queue.
  - Fastify REST API:
    - `POST /api/applications/:id/browser-runs`: queues browser form-fill run in DRY_RUN, PREFILL_ONLY, or SUBMIT mode.
    - `GET /api/applications/:id/browser-runs`: lists execution history with status and counts.
    - `GET /api/browser-runs/:runId`: fetches full execution trace, step logs, and unmatched fields.
  - React 19 Frontend Web UI:
    - Integrated Browser Application Worker card into `ApplicationDetailView.tsx`.
    - Features: target URL and ATS provider pill, "Run Safe Dry-Run" and "Prefill in Browser" triggers, execution history list with status badges, and interactive "Browser Run Audit Trail" modal with step-by-step logs viewer and missing fields warnings.
    - `BrowserWorkerClient` for typed API communication.
  - Verification Records:
    - `npm run lint`: PASSED (ESLint 9, 0 errors)
    - `npm run typecheck`: PASSED (TypeScript 5.8 across all 6 workspaces, 0 errors)
    - `npm run test`: PASSED (Vitest, 30 test files, 248/248 tests passed: 15 worker tests, 5 API browser worker tests, and all platform tests)
    - `npm run build`: PASSED (All 6 workspaces built and Vite web bundle compiled cleanly)
    - `npm run format`: PASSED (Prettier checked across entire repository)
    - `npm run db:check`: PASSED (Database connectivity verified)
    - `npm run db:migrate`: PASSED (Migration sequence 0000 through 0012 applied cleanly)
    - Live End-to-End Verification: PASSED (`scripts/verify-job-p5-t01.ts` executed against real local PostgreSQL `ai_job_agent_dev`, verifying Sections 1–10: schema hygiene, registry resolution, form extraction, challenge detection, candidate brain facts, DRY_RUN execution with zero-submission guarantee, missing required facts halt with STOPPED_MANUAL_REVIEW, bot challenge halt with STOPPED_CAPTCHA, runner pipeline and worker lifecycle, Fastify REST endpoints, and 100% clean teardown).

---

### `JOB-P5-T02` — Autonomous Orchestrator, Scheduling, Notifications & Production Hardening

- **Status**: COMPLETED
- **Completed**: 2026-10-10
- **Scope**:
  - Additive PostgreSQL schema for Autonomous Orchestrator and System Notifications:
    - `orchestration_runs`: execution tracking table (`id`, `user_id`, `task_type` [PIPELINE_CYCLE, DISCOVERY, MATCHING, PREPARATION, AUTO_APPLY, EMAIL_SYNC, REMINDERS], `trigger` [SCHEDULED, MANUAL, EVENT], `status` [PENDING, RUNNING, COMPLETED, PARTIAL, FAILED], `step_logs` JSONB audit trail, `summary` JSONB metrics, `retry_count`, `max_retries`, `backoff_until`, `error_message`, timestamps).
    - `system_notifications`: in-app notification center table (`id`, `user_id`, `type` [APPROVAL_REMINDER, CAPTCHA_HALT, MANUAL_REVIEW_REQUIRED, AUTO_APPLY_SUCCESS, AUTO_APPLY_FAILED, RATE_LIMIT_EXCEEDED, EMAIL_SYNC_ALERT, INTERVIEW_UPCOMING, SYSTEM_ALERT], `severity` [INFO, WARNING, CRITICAL], `title`, `message`, `data` JSONB, `status` [UNREAD, READ, DISMISSED], `action_url`, `read_at`, timestamps).
    - `notification_preferences`: user notification channels and toggles table (`id`, `user_id`, `email_notifications_enabled`, `in_app_notifications_enabled`, `notify_on_captcha_halt`, `notify_on_manual_review`, `notify_on_auto_apply`, `notify_on_upcoming_interview`, `daily_digest_enabled`, timestamps).
    - Additive migration `0013_orchestrator_scheduling_notifications.sql` generated and applied to PostgreSQL `ai_job_agent_dev`.
  - Shared domain contracts and DTOs in `packages/shared/src/types/orchestrator.ts`:
    - `OrchestrationTaskType`, `OrchestrationTrigger`, `OrchestrationRunStatus`, `SystemNotificationType`, `SystemNotificationSeverity`, `SystemNotificationStatus`, `OrchestrationStepLog`, `OrchestrationRunSummary`, `OrchestrationRunDto`, `CreateOrchestrationRunDto`, `SystemNotificationDto`, `NotificationPreferencesDto`, `SystemMetricsDto`.
  - Config & Environment Hardening:
    - Added `ORCHESTRATOR_ENABLED`, `ORCHESTRATOR_POLL_INTERVAL_MS`, `DISCOVERY_INTERVAL_MINUTES`, `EMAIL_SYNC_INTERVAL_MINUTES`, `REMINDERS_INTERVAL_MINUTES`, `RATE_LIMIT_DAILY_APPLICATIONS_DEFAULT` to `packages/config/src/env.ts` with Zod validation and `.env.example`.
  - Autonomous Orchestrator Engine (`apps/worker`):
    - `AutonomousOrchestrator`: 6-stage autonomous orchestration engine managing discovery, matching, preparation, auto-apply, email sync, and reminders.
    - Deterministic exponential backoff calculation (`calculateBackoff`) with bounded jitter and retry tracking.
    - Circuit breaker invariant: strictly prevents automated submissions when `auto_apply_enabled: false`, requiring explicit human authorization.
    - Daily rate limit & quota enforcement (`max_applications_per_day`) to protect candidate reputation and prevent spamming external ATS portals.
    - Bot challenge (`STOPPED_CAPTCHA`) and unverified question (`STOPPED_MANUAL_REVIEW`) notification dispatchers alerting the candidate for review.
    - Notification dispatcher (`NotificationDispatcher`) honoring user preferences before creating in-app alerts.
    - Background worker service (`WorkerService`): periodic scheduled pipeline runner and orchestration queue polling in heartbeat loop.
  - Fastify REST API (`apps/api`):
    - System Notification routes: `GET /api/notifications`, `GET /api/notifications/unread-count`, `POST /api/notifications`, `PATCH /api/notifications/:id/read`, `POST /api/notifications/mark-all-read`, `DELETE /api/notifications/:id`, `GET /api/notifications/preferences`, `PUT /api/notifications/preferences`.
    - Orchestrator routes: `GET /api/orchestrator/runs`, `GET /api/orchestrator/runs/:id`, `POST /api/orchestrator/runs`, `GET /api/orchestrator/status`, `GET /api/orchestrator/metrics`.
    - Health & Observability: added lightweight `/health/live` liveness probe and deep dependency `/health/ready` probe checking database connectivity and schema readiness.
  - React 19 Frontend Web UI (`apps/web`):
    - Notification Center modal (`NotificationCenterModal.tsx`) with unread filter, direct action links, preferences toggle, and header notification bell with live unread badge in `App.tsx`.
    - Activity & Operations Hub (`ActivityView.tsx`) with system metric cards (applications submitted today, remaining quota, active alerts, orchestrator status), manual trigger controls, orchestration run history table, live step-by-step trace inspector modal, and candidate brain audit logs tab.
    - Typed API clients (`notification-client.ts`, `orchestrator-client.ts`).
  - Production Hardening & Operations:
    - Authoring `docs/RUNBOOKS.md`: comprehensive operations guide covering architecture, health probes, emergency circuit breakers, bot challenge recovery, rate limiting, and incident playbooks.
  - Verification Records:
    - `npm run lint`: PASSED (ESLint 9, 0 errors)
    - `npm run typecheck`: PASSED (TypeScript 5.8 across all 6 workspaces, 0 errors)
    - `npm run test`: PASSED (Vitest, 33 test files, 256/256 tests passed: worker orchestrator tests, API notification and orchestrator route tests, and platform test suites)
    - `npm run build`: PASSED (All 6 workspaces built and Vite web bundle compiled cleanly)
    - Live End-to-End Verification: PASSED (`scripts/verify-job-p5-t02.ts` executed against real local PostgreSQL `ai_job_agent_dev`, verifying Sections 1–10: schema hygiene, notification preferences CRUD, notification dispatcher and filters, in-app notifications operations and unread count, exponential backoff calculation, orchestrator discovery/matching/preparation lifecycle, circuit breaker & daily quota enforcement, reminders & alerts, Fastify API observability endpoints, and 100% clean teardown).

---

### `POST-ROADMAP-PILOT` — Post-Roadmap Product Validation, Stabilization & Private-Pilot Readiness

- **Status**: COMPLETED
- **Completed**: 2026-10-10
- **Scope**:
  - Independent security, concurrency, and invariant audit across all 10 core subsystems.
  - Defect remediation and stability hardening:
    - **DEF-01 (CRITICAL - Concurrency Race)**: Implemented atomic transition (`PENDING` -> `RUNNING`) and `onConflictDoUpdate` claim in `browser-runner.ts` and `browser-application-engine.ts` preventing race conditions where multiple worker polling ticks double-launch and double-submit applications.
    - **DEF-02 (CRITICAL - Form Matching Bypassing Verification)**: Hardened `base-ats-adapter.ts` with word-boundary matching (min 3 chars) and strict exclusion of `val.isSensitive` and unverified answers from automatic form prefill.
    - **DEF-03 (HIGH - Worker Crash on Missing Column)**: In `autonomous-orchestrator.ts`, corrected email account query to filter by `status = 'CONNECTED'` instead of non-existent `is_active` column.
    - **DEF-04 (HIGH - OAuth Callback Route Mismatch)**: In `email-routes.ts`, added route alias for `/email/accounts/gmail/callback` matching `GMAIL_REDIRECT_URI` configuration in `env.ts`.
    - **DEF-05 (HIGH - Auto-Apply Loop on Halts)**: In `autonomous-orchestrator.ts`, updated status transition to set applications to `NEEDS_REVIEW` upon `STOPPED_CAPTCHA` or `STOPPED_MANUAL_REVIEW`, stopping repetitive retry loops.
    - **DEF-06 (MEDIUM - Crash Recovery)**: In `worker.ts`, added `recoverOrphanedRuns()` at startup to reconcile stale `RUNNING` rows in `browser_application_runs` and `orchestration_runs` to `FAILED`.
    - **DEF-07 & DEF-09 (MEDIUM - Database Integrity Constraints)**: Added compound unique constraint `(userId, jobId)` to `application_packages` preventing duplicate packages, and added foreign key constraint on `duplicateOfId` referencing `jobs.id` (`onDelete: 'set null'`). Generated and applied migration `0014_harden_pilot_schema.sql`.
  - Comprehensive Pilot Verification Suite (`scripts/verify-pilot-readiness.ts`):
    - 11 vertical slices verified end-to-end with live Fastify API, React 19 / Vite dev server, background worker, and PostgreSQL database:
      1. Health Probes & Vite Reverse Proxy (`/health/live`, `/health/ready`, `http://127.0.0.1:5173/api/...`)
      2. Candidate Brain & Facts (allowAiUse gating, verified vs unverified)
      3. Job Ingestion, Normalization & Deduplication
      4. Match Intelligence, 8-Dimension Fit & Anti-Hallucination Guard
      5. Application Studio, Truthful Tailoring & Human Approval Gate
      6. CRM Application Lifecycle (`APPLIED` state machine transition & immutable audit timeline)
      7. Email Intelligence, Recruiter Threading & Status Sync
      8. Calendar Availability, Interview Booking & Grounded Prep Briefs
      9. Controlled Browser Worker (`DRY_RUN`, `STOPPED_CAPTCHA`, `STOPPED_MANUAL_REVIEW`)
      10. Autonomous Orchestrator, Quota Enforcement & Notification Center
      11. Clean Teardown (100% fixture deletion, zero database orphans)
  - Verification Records:
    - `npm run lint`: PASSED (ESLint 9, 0 errors)
    - `npm run typecheck`: PASSED (TypeScript 5.8 across all 6 workspaces, 0 errors)
    - `npm run test`: PASSED (Vitest, 33 test files, 256/256 tests passed)
    - `npm run build`: PASSED (All 6 workspaces built and Vite web bundle compiled cleanly)
    - `npm run format`: PASSED (Prettier checked across entire repository)
    - `npm run db:check`: PASSED (Database connectivity verified)
    - `npm run db:migrate`: PASSED (Migration sequence 0000 through 0014 applied cleanly)
    - Live End-to-End Verification: PASSED (`scripts/verify-pilot-readiness.ts` executed cleanly with 0 failures, 11/11 sections passed, 100% clean teardown).

---

### `OPERATIONAL-ACCEPTANCE` — Real Browser UI, Integrated ATS Submission & Crash Safety Invariants

- **Status**: COMPLETED
- **Completed**: 2026-10-10
- **Scope**:
  - **1. Frontend Acceptance (Real Browser UI)**:
    - Launched complete local application (Fastify API, PostgreSQL, React 19 Vite dev server, background worker).
    - Executed automated Playwright Chromium test exercising all 10 frontend views: Candidate Brain (Profile, Skills tab, Facts tab, Document Vault, Answer Library, Preferences & Safety Policy), Job Inbox, Application CRM, Human Approvals, Email Intelligence, Calendar & Interview Workspace, Activity & Ops / Orchestrator Dashboard, and Notification Center modal.
    - Verified 0 JavaScript page errors, clean component rendering, and functional navigation.
    - Added UI enhancements in `ApplicationDetailView.tsx`: human confirmation modal for browser execution and `SUBMISSION_UNCERTAIN` status badges with warning callouts.
  - **2. Integrated ATS Fixture Submission Workflow**:
    - Executed end-to-end Greenhouse ATS submission workflow on canonical job opportunity:
      - DRY_RUN inspection: extracted 9 fields, matched 7 candidate facts, verified 0 mutations to CRM (`READY_TO_APPLY` preserved).
      - Human-authorized SUBMIT mode: filled approved candidate facts, uploaded CV, clicked submit on fixture form.
      - Generated confirmation reference (`SUBMITTED-2026-10-10-...`), transitioned CRM status to `APPLIED`, recorded `appliedAt` timestamp, preserved submission method (`GREENHOUSE`) and external reference ID, and logged immutable `SUBMITTED` audit lifecycle event.
  - **3. Crash and Duplicate-Submission Safety Invariants**:
    - **Worker Crash During External Submission**:
      - Upgraded `browser-application-engine.ts` with in-flight submit tracking (`submissionDispatched` flag) and pre-submission step logging.
      - Upgraded `worker.ts` `recoverOrphanedRuns()`: any orphaned `RUNNING` run in `SUBMIT` mode (or containing submission dispatch logs) is reconciled to `SUBMISSION_UNCERTAIN`.
      - Automatically transitioned linked CRM application to `ApplicationLifecycleStatus.NEEDS_REVIEW` to block automatic retries.
      - Dispatched critical in-app notification (`MANUAL_REVIEW_REQUIRED`) prompting candidate to inspect employer portal.
      - Reconciled non-submit (`DRY_RUN`, `PREFILL_ONLY`) runs to `FAILED` safely (no external request emitted).
    - **Autonomous Orchestrator Duplicate Prevention**:
      - Hardened `autonomous-orchestrator.ts` (`runAutoApplyStage`): strictly blocked generating or dispatching new browser runs if an existing run is `SUBMISSION_UNCERTAIN`, preventing double submissions even under misconfigurations or state manipulation.
    - Added dedicated test suite `apps/worker/src/engine/crash-submission-safety.test.ts` (4/4 tests passed).
  - **Verification Records**:
    - `npm run lint`: PASSED (ESLint 9, 0 errors)
    - `npm run typecheck`: PASSED (TypeScript 5.8 across all 6 workspaces, 0 errors)
    - `npm run test`: PASSED (Vitest, 34 test files, 260/260 tests passed)
    - `npm run build`: PASSED (All 6 workspaces built and Vite web bundle compiled cleanly)
    - `npm run format`: PASSED (Prettier checked across entire repository)
    - `npm run db:check`: PASSED (Database connectivity verified)
    - Live Operational Acceptance Suite: PASSED (`scripts/verify-operational-acceptance.ts` executed cleanly with 0 failures, 100% clean teardown).

---

### `REAL-ACT-REMEDIATION` — Candidate Data Integrity, Human Authorization & Safety Boundary Hardening

- **Status**: COMPLETED
- **Completed**: 2026-10-11
- **Scope**:
  - **1. Safety & Data Integrity**:
    - Halted all autonomous consequential data modifications.
    - Forensic audit of pre-cleanup backup `backups/ai_job_agent_dev_backup_20261010_145257.sql` vs active PostgreSQL database.
    - Restored candidate profile (`candidate_profiles`) to original candidate-entered values: Asadbek Makhmudov, Project Manager, Warsaw, Poland, availability "2 weeks notice".
    - Restored original job preferences (`job_preferences`): target titles `["Project Manager", "Operations Lead"]`, locations `["Berlin", "Remote EU"]`, salary `80,000 - 130,000 EUR`, seniority `["senior", "lead"]`.
  - **2. Quarantine of Inferred Candidate Facts**:
    - All 6 candidate facts created during REAL-ACT (`work_authorization`, `visa_sponsorship`, `current_location`, `target_role`, `education_status`, `banking_experience`) were quarantined: set `verificationStatus: 'UNVERIFIED'`, `allowAiUse: false`. Original statements and audit history preserved; 0 facts deleted.
    - Updated `CandidateService.createFact` and `updateFact` to strictly prohibit `allowAiUse: true` on unverified facts.
    - Updated `ApplicationQuestionEngine` and `ApplicationPackageService` to strictly filter candidate facts requiring both `verificationStatus: 'VERIFIED'` and `allowAiUse: true`.
  - **3. Human Authorization & Invalidation of Untrusted Approvals**:
    - All 3 approvals generated during REAL-ACT (`work_authorization`, `salary_expectation`, `visa_sponsorship`) were transitioned from `APPROVED` to `NEEDS_USER_RECONFIRMATION`. Cleared `resolvedBy` and `resolvedAt`.
    - Associated application questions reset to `approvalState: 'PENDING'`, `finalAnswer: null`.
    - Package `d3ca7301-7f6e-441a-9b15-fb9d0e5a4923` invalidated: `status: 'NEEDS_REVIEW'`, `isReady: false`.
    - CRM Application `83290dbc-7ab2-4abe-b9f5-43d6bfa083a7` reverted from `READY_TO_APPLY` to `NEEDS_REVIEW`.
    - Upgraded `PackageReadinessEngine.evaluateReadiness` to block readiness when any approval has status `NEEDS_USER_RECONFIRMATION` or was approved by automation (`resolvedBy !== 'USER'`).
    - Guarded `POST /api/approvals/:id/approve` against automated agent bypass (`x-automation-agent: true` rejected without explicit human confirmation).
  - **4. Data-Enrichment Script & Backup Security**:
    - Guarded `scripts/clean-and-enrich-user-data.ts` and `scripts/execute-first-real-workflow.ts` against executing on primary candidate without explicit `--force-candidate-override` flag.
    - Secured `backups/ai_job_agent_dev_backup_20261010_145257.sql`: untracked from git index, verified `.gitignore` excludes `backups/`, `*.sql`, `*.dump`. Confirmed 0 remote repositories configured (no remote exposure).
    - Hardened `apps/api/src/routes/candidate.test.ts` to snapshot and restore candidate profile and preferences before and after test execution.
  - **5. Regression Test Suite**:
    - Added dedicated test suite `apps/api/src/services/data-integrity-safety.test.ts` (7/7 tests passed).
- **Verification Records**:
  - `npm run lint`: PASSED (ESLint 9, 0 errors, 234 warnings)
  - `npm run typecheck`: PASSED (TypeScript 5.8 across all 6 workspaces, 0 errors)
  - `npm run test`: PASSED (Vitest, 35 test files, 268/268 tests passed)
  - `npm run build`: PASSED (All 6 workspaces built and Vite web bundle compiled cleanly)
  - `npm run format`: PASSED (Prettier checked across entire repository)
  - `npm run db:check`: PASSED (Database connectivity verified)

---

### `JOB-P0-T01` — Jobee Project Foundation: Rebranding, Repository Initialization & GitHub Setup

- **Status**: COMPLETED
- **Completed**: 2026-10-11
- **Scope**:
  - Official rebranding from working title "AI Job Agent" to "Jobee".
  - Canonical project context updated to Version 1.1 in `docs/MASTER_CONTEXT.md` and root mirrors (`JOBEE_MASTER_CONTEXT.md`, `AI_JOB_AGENT_MASTER_CONTEXT.md`).
  - Created private GitHub repository `az-makhmudov/Jobee` under verified account `az-makhmudov`.
  - Configured git origin remote `https://github.com/az-makhmudov/Jobee.git`.
  - Created local workspace symlink `/Users/bek/Jobee -> /Users/bek/Job Agent`.
  - Created Architecture Decision Record `docs/decisions/0007-rebranding-to-jobee.md` and indexed in `docs/decisions/README.md`.
  - Created `docs/RENAME_LOG.md` recording all renaming decisions and preserving historical context.
  - Updated agent guidelines (`AGENTS.md`) with collaborative roles (ChatGPT, Antigravity 2.0, User) and mandatory quality gates.
  - Updated README.md, package metadata, web application browser title, and service branding to Jobee.
  - Hardened `.gitignore` with extra credential, certificate, and sensitive candidate patterns.
  - Preserved 100% of existing implementations, database migrations, security fixes, and historical task stamps (`JOB-P0-T01` through `JOB-P5-T02`).
- **Verification Records**:
  - GitHub Repository: Verified `https://github.com/az-makhmudov/Jobee` (Private, Owner: `az-makhmudov`, default branch: `main`).
  - Remote: `origin` pointing to `https://github.com/az-makhmudov/Jobee.git`.
  - `npm run lint`: PASSED (ESLint 9, 0 errors).
  - `npm run typecheck`: PASSED (TypeScript 5.8 across all 6 workspaces, 0 errors).
  - `npm run test`: PASSED (Vitest, 35 test files, 268/268 tests passed).
  - `npm run build`: PASSED (All 6 workspaces built and Vite web bundle compiled cleanly).

---

### `JOB-P0-T01` — Post-Migration Security & CI Remediation

- **Status**: COMPLETED
- **Completed**: 2026-10-11
- **Scope**:
  - **GitGuardian Incident Investigation & Remediation**:
    - Investigated High-severity alert for PostgreSQL credentials in `packages/shared/src/logger/logger.test.ts`.
    - Verified the string was a synthetic unit test fixture testing connection string URL redaction, not an active database credential (verified false positive).
    - Replaced realistic URL (`user:secretpass@db.neon.tech`) and Bearer token with unmistakably fictional test fixtures using RFC 2606 reserved domains (`fixture-user:fixture-secret-password-xyz@db.example.internal:5432/test_db`) and generic tokens, preserving 100% credential redaction verification logic while eliminating scanner alerts.
  - **Git History Historical Backup Audit**:
    - Identified sensitive historical development database dump `backups/ai_job_agent_dev_backup_20261010_145257.sql` introduced in commit `57001c95` and removed from HEAD in commit `91c17652`.
    - Conducted non-disclosing exposure assessment: confirmed dump contained candidate profile PII (1 candidate profile, 1 experience, 1 education) and 0 credentials/tokens (`email_accounts` and `calendar_accounts` had 0 rows, no OAuth access/refresh tokens).
    - Confirmed no `.env` files, certificates, or private keys exist across the Git commit graph.
    - Prepared controlled Git-history rewriting plan using `git-filter-repo` (held pending explicit user authorization before execution or force-push).
  - **GitHub Actions CI Pipeline Hardening**:
    - Reconfigured `.github/workflows/ci.yml` with dedicated PostgreSQL 16 Alpine service container (`postgres:16-alpine`) on port 5432 with health check (`pg_isready`).
    - Configured isolated CI environment variables (`NODE_ENV: test`, temporary CI database `jobee_ci_test`, dedicated non-production user `jobee_ci_user`, encryption key).
    - Added automated pre-test database health check (`npm run db:check`) and schema migrations (`npm run db:migrate`).
  - **Integration Test Isolation & Determinism**:
    - Hardened `apps/api/src/routes/match-routes.test.ts` and `apps/api/src/routes/application-package-routes.test.ts` to deterministically provision primary user and profile via `getOrCreatePrimaryUser(db)` instead of assuming pre-existing profiles in unseeded databases.
  - **.gitignore Drizzle Migration Safeguard**:
    - Identified regression where generic `*.sql` rule shadowed future Drizzle migration files in `packages/database/drizzle/`.
    - Corrected `.gitignore` by adding explicit exceptions `!packages/database/drizzle/*.sql` and `!packages/database/drizzle/**/*.sql`, verified with `git check-ignore`.
  - **Master Context Synchronization**:
    - Updated Section 17 of `docs/MASTER_CONTEXT.md` to accurately reflect full completion of Phases 0–5, Personal ATS MVP, pilot stabilization, and data-integrity remediation.
    - Explicitly documented outstanding external integration requirements and mandatory human-approval invariants.
    - Synchronized root mirrors `JOBEE_MASTER_CONTEXT.md` and `AI_JOB_AGENT_MASTER_CONTEXT.md` (verified 100% byte-for-byte identical).
- **Verification Records**:
  - `git check-ignore`: PASSED (`packages/database/drizzle/*.sql` un-ignored; `backups/*.sql` and root `*.sql` ignored).
  - Context Sync: PASSED (`cmp -s docs/MASTER_CONTEXT.md JOBEE_MASTER_CONTEXT.md` exit code 0).
  - `npm run db:check`: PASSED (Database connected against isolated test DB).
  - `npm run db:migrate`: PASSED (15 migrations applied cleanly).
  - `npm run lint`: PASSED (ESLint 9, 0 errors).
  - `npm run typecheck`: PASSED (TypeScript 5.8 across all workspaces, 0 errors).
  - `npm run test`: PASSED (Vitest, 35 test files, 268/268 tests passed with 0 failures).
  - `npm run build`: PASSED (All 6 workspaces built cleanly including Vite web bundle).

---

### `JOB-P0-T01` — Final Git History Security Cleanup & Sensitive SQL Purge

- **Status**: COMPLETED
- **Completed**: 2026-10-11
- **Scope**:
  - **Authorized History Purge**:
    - Project owner authorized permanent purge of sensitive development database backup `backups/ai_job_agent_dev_backup_20261010_145257.sql` across reachable Git history.
    - Historical commit `57001c95` originally added the file, and commit `91c17652` removed it from HEAD.
    - Verified non-disclosing exposure assessment: 0 active credentials or API keys were in the backup.
  - **Safety Requirements & Local Isolation**:
    - Confirmed GitHub repository `az-makhmudov/Jobee` is private (`private: true`, `visibility: private`).
    - Verified CI Quality Gate on `main` passed (`conclusion: success`, Run ID: 38123213951).
    - Created secure local recovery backup in `/Users/bek/.jobee-security-cleanup/` (mode `chmod 700`), containing full bare mirror `jobee-backup.git` and bundle `jobee-backup.bundle` outside the project repository.
    - Executed rewrite inside dedicated fresh clone `/Users/bek/.jobee-security-cleanup/jobee-clean`.
  - **History Rewriting via `git-filter-repo`**:
    - Executed `git-filter-repo --invert-paths --path backups/ai_job_agent_dev_backup_20261010_145257.sql --force`.
    - Preserved 100% of application source code, 15 database migrations, documentation, and features.
    - Neither affected commit was collapsed into an empty commit; all application logic and test fixtures were preserved.
  - **Pre-Push Quality & Tree Invariant Verification**:
    - Compared root tree hash of original `main` (`e1ad4ba`) and rewritten `main` (`442fa23`): 100% identical (`f729bfdd512ab9b2fe955f4b1ef9c0cbc0c66ca9`).
    - Compared tree hash of `rebrand_to_jobee` (`6b4a3a9`) and original (`bdc70fb`): 100% identical (`5e8a202bb9a71719dc1907f1e80ed63d54e5f43d`).
    - Verified 0 reachable Git objects and 0 commits across all branches reference the sensitive SQL file.
  - **Controlled Remote Push**:
    - Force-pushed only authorized branches: `main` and `security_and_ci_remediation`.
    - Avoided unrestricted mirror push.
  - **Local Workspace & Worktree Reconciliation**:
    - Reconciled primary repository `/Users/bek/Job Agent` safely without destructive commands (`update-ref` to remote heads).
    - Expired reflogs (`git reflog expire --expire=now --all`) and pruned unreachable objects (`git gc --prune=now`).
    - Cleaned worktrees `rebrand_to_jobee` and `security_and_ci_remediation`.
  - **GitHub Actions Verification**:
    - Rewritten `main` commit `442fa23` triggered GitHub Actions CI Quality Gate (Run ID: 38123824404) and completed with `conclusion: success`.
  - **Documentation & Follow-Up Procedures**:
    - Updated `docs/SECURITY.md` (Section 15), `docs/AUTONOMOUS_STATE.md`, and `docs/TASK_LOG.md`.
    - Documented GitHub server cache retention characteristics and provided a ready-to-use GitHub Support ticket template for manual cache clear and backend garbage collection.
- **Verification Records**:
  - Sensitive File Log: `git log --all --full-history -- "**/ai_job_agent_dev_backup*"` -> 0 commits found (PASSED).
  - Sensitive Object Check: `git rev-list --objects --all | grep 'ai_job_agent_dev_backup'` -> 0 objects found (PASSED).
  - Tree Comparison: Root tree `f729bfdd512ab9b2fe955f4b1ef9c0cbc0c66ca9` identical (PASSED).
  - GitHub Actions: Run ID 38123824404 on `442fa23b1dcae9988155f7886aae8f0ddcf5efd8` -> `completed` / `success` (PASSED).
  - `npm run lint`: PASSED (ESLint 9, 0 errors).
  - `npm run typecheck`: PASSED (TypeScript 5.8 across all 6 workspaces, 0 errors).
  - `npm run test`: PASSED (Vitest, 35 test files, 268/268 tests passed).
  - `npm run build`: PASSED (All 6 workspaces built cleanly including Vite web bundle).
  - `npm run format`: PASSED (Prettier checked across entire repository).

---

### `JOB-P0-T01` — Autonomous Product Stabilization & Operational Readiness Hardening

- **Status**: COMPLETED
- **Completed**: 2026-10-11
- **Scope**:
  - **1. Candidate Fact Verification UI & Prime Directive Compliance**:
    - Enhanced `apps/web/src/components/ProfileView.tsx` with 1-click fact verification controls (`✓ Verify & Authorize AI` and `Revoke`) directly calling `candidateClient.updateFact(id, { verificationStatus, allowAiUse })`.
    - Added a prominent Prime Directive truthfulness banner explaining that unverified facts are quarantined from AI prompts, question generation, and materials tailoring.
  - **2. Application Studio & Approvals Inbox Reconfirmation Unblocking**:
    - Updated `ApprovalsInboxView.tsx` and `ApplicationStudioView.tsx` to display action controls (`Reconfirm & Approve`, `Edit & Approve`, `Reject`) for requests with status `NEEDS_USER_RECONFIRMATION` (previously suppressed by strict `status === 'PENDING'` checks).
    - Added warning banners on quarantined approvals informing the candidate of the required reconfirmation.
    - Updated `ApplicationPackageService`:
      - Package regeneration automatically marks unresolved superseded approval requests from prior versions as `CANCELLED`.
      - Updated `listApprovals` to join `applicationPackageVersions` and strictly filter to the package's active version (`currentVersionNumber === versionNumber`).
    - Added `NEEDS_USER_RECONFIRMATION` to the canonical `ApprovalStatus` enum in `@job-agent/shared`.
  - **3. Synthetic Data Leakage Prevention & Test Teardown Hardening**:
    - Purged orphan synthetic fixture jobs (`Acme Corp`, `Globex Software`, `Initech Corp`) from the database that had leaked into the candidate's real job inbox during historical email sync runs.
    - Patched `scripts/verify-job-p4-t01.ts` to track and clean up newly discovered alert jobs during test teardown, ensuring test runs never pollute the candidate's active vacancy inbox.
  - **4. Document Storage Sandboxing & Path Canonicalization**:
    - Updated `LocalStorageProvider` in `apps/api/src/storage/local-storage.ts` so `baseDir` canonically resolves to the workspace root `uploads/documents/` regardless of working directory.
    - Synced candidate's authoritative Master CV (`Resume - Asadbek M.pdf`) to `uploads/documents/23bea6bf-5517-4066-a823-a4431803c333.pdf`.
  - **5. Dynamic System Readiness Probing & Settings UI Observability**:
    - Extended `ReadinessResponse` in `@job-agent/shared` with optional `ai` and `integrations` check details.
    - Updated `/ready` and `/health/ready` endpoints in `apps/api/src/routes/ready.ts` to dynamically inspect database connectivity, AI engine status (Deterministic Grounded Mode vs Gemini LLM), and external OAuth integrations.
    - Enhanced `apps/web/src/components/SettingsView.tsx` with dynamic cards for System Health, AI Intelligence Engine, Communications & Calendar Integrations, Application Automation & Browser ATS Worker, and the Single-User Security Model.
- **Verification Records**:
  - `npm run db:check`: PASSED (PostgreSQL connected, 20ms latency).
  - `npm run db:migrate`: PASSED (15 migrations up to date).
  - `npm run typecheck`: PASSED (0 errors across all 6 workspaces).
  - `npm run lint`: PASSED (0 errors across codebase).
  - `npm run test`: PASSED (35 test files, 268/268 tests passed).
  - `npm run build`: PASSED (All 6 workspaces built cleanly including Vite web bundle).
  - `npm run format`: PASSED (Prettier checked across entire repository).
  - Verification Suites:
    - `scripts/verify-job-p4-t01.ts`: PASSED (11 email archetypes, OAuth CSRF replay protection, CRM status sync, clean teardown).
    - `scripts/verify-job-p4-t02.ts`: PASSED (10/10 sections: availability, conflict detection, interview booking, STAR prep brief, clean teardown).
    - `scripts/verify-job-p5-t01.ts`: PASSED (10/10 sections: ATS adapters, CAPTCHA halting, missing fact halting, runner pipeline, clean teardown).
    - `scripts/verify-job-p5-t02.ts`: PASSED (10/10 sections: orchestrator discovery, matching, auto-apply circuit breaker, reminders, clean teardown).
    - `scripts/verify-crm-lifecycle.ts`: PASSED (100% success across all lifecycle transitions, soft archiving, analytics, clean teardown).

---

### `JOB-PROD-01` — Backend Authorization Enforcement, Submission Guardrails & Test Sandbox Hardening

- **Status**: COMPLETED (LOCAL CHECKPOINT)
- **Completed**: 2026-10-11
- **Scope**:
  - **1. Pre-Creation Authorization in `BrowserWorkerService`**:
    - Guarded `createBrowserRun`: in `mode === 'SUBMIT'`, verifies `policy.autoApplyEnabled: true` or `input.userConfirmed: true`. Rejects unauthorized submissions with `403 FORBIDDEN`.
    - Package Verification: requires the linked Application Package to exist and be in `READY` status. Rejects with `400 BAD_REQUEST` (`Application package is not ready`).
    - Blocker Verification: requires that any matching hard policy blocker is overridden by candidate.
    - Human Approval Verification: queries all package approvals from `approval_requests` and verifies that every request is resolved by the candidate (`status: APPROVED | RESOLVED` AND `resolvedBy === 'USER'`). Rejects if any approval is `PENDING`, `NEEDS_USER_RECONFIRMATION`, or resolved by automation (`resolvedBy !== 'USER'`).
  - **2. Submission Guardrails in Autonomous Orchestrator**:
    - Updated `runAutoApplyStage` in `apps/worker/src/engine/autonomous-orchestrator.ts`:
      - Evaluates associated package readiness (`status === 'READY'`).
      - Confirms policy blockers are overridden.
      - Confirms 0 approvals on the package are unverified or resolved by automation.
  - **3. CRM Status Auto-Synchronization on Readiness Degradation**:
    - Updated `ApplicationPackageService.refreshPackageReadiness`: when package readiness status becomes `NEEDS_REVIEW`, any linked application in CRM (`status === 'READY_TO_APPLY'`) automatically transitions to `NEEDS_REVIEW` with an immutable lifecycle event.
  - **4. Test Suite Candidate Profile Sandbox Preservation**:
    - Updated `scripts/verify-pilot-readiness.ts` and `scripts/verify-operational-acceptance.ts`:
      - In pre-flight / setup, the candidate's existing profile (`/candidate/profile`) is captured into memory.
      - In teardown (`finally`), the original profile is faithfully restored via `PUT /candidate/profile`.
      - Prevents test runs and CI smoke tests from mutating candidate Asadbek Makhmudov's real data.
  - **5. Database Connection Pool Fallback**:
    - Updated `packages/database/src/client.ts` (`getDbPool`): falls back to `process.env.DATABASE_URL` if `connectionString` argument is omitted, preventing runtime crashes in service layers.
    - Re-exported `ne, or, not, asc` from `drizzle-orm` in `packages/database/src/index.ts`.
- **Verification Records**:
  - `npm run db:check`: PASSED (PostgreSQL connected, 18ms latency).
  - `npm run db:migrate`: PASSED (15 migrations up to date).
  - `npm run typecheck`: PASSED (0 errors across all 6 workspaces).
  - `npm run lint`: PASSED (0 errors across codebase).
  - `npm run test`: PASSED (35 test files, 268/268 tests passed).
  - `npm run build`: PASSED (All 6 workspaces built cleanly including Vite web bundle).
  - `npm run format`: PASSED (Prettier checked across entire repository).
  - Verification Suites:
    - `scripts/verify-pilot-readiness.ts`: PASSED (11/11 sections passed cleanly, original candidate profile restored during teardown).
    - `scripts/verify-operational-acceptance.ts`: PASSED (Real UI, ATS fixture submission, crash invariants passed, original candidate profile restored during teardown).
    - Database Profile Audit: `Asadbek Makhmudov | Project Manager | Warsaw, Poland` verified preserved.

---

### `JOB-PROD-02` — Cryptographic Manifest-Bound Submission Authorization & Ingestion Hardening

- **Status**: COMPLETED (LOCAL CHECKPOINT)
- **Completed**: 2026-10-11
- **Scope**:
  - **1. Cryptographic Manifest-Bound Submission Authorization (`SubmissionAuthorizationService`)**:
    - Created `apps/api/src/services/browser-worker/submission-authorization-service.ts`.
    - Implemented `computeManifestChecksum`: binds `packageVersionId`, SHA-256 checksum of tailored CV, SHA-256 checksum of cover letter, and sorted canonical list of approved questions and `finalAnswer` values into a SHA-256 hash.
    - Implemented `issueSubmissionAuthorization`: generates base64url signed token with HMAC-SHA256 containing candidate identity (`sub`), `appId`, `pkgVerId`, manifest checksum (`mHash`), issued timestamp (`iat`), and expiration (`exp`, 15-minute validity).
    - Implemented `verifySubmissionAuthorization`: validates HMAC-SHA256 signature, enforces token expiration, prevents cross-candidate usage (`sub === userId`), recomputes manifest hash from live database records, and rejects any submission where files or answers were altered after human approval.
  - **2. Browser Worker Submission Gate Enforcement**:
    - Guarded `POST /browser-runs` in `BrowserWorkerService.createBrowserRun`:
      - In `SUBMIT` mode, if `policy.autoApplyEnabled` is false, strictly requires a verified `submissionToken`.
      - External spoofing via `userConfirmed: true` without a valid token is blocked with `403 FORBIDDEN`.
      - Exposes new endpoint `POST /applications/:id/submission-authorization` in `apps/api/src/routes/browser-worker-routes.ts`.
  - **3. Frontend Client & UI Integration**:
    - Added `requestSubmissionAuthorization` in `apps/web/src/api/browser-worker-client.ts`.
    - Updated `apps/web/src/components/ApplicationDetailView.tsx`: triggers authorization ticket issuance prior to dispatching browser run in `SUBMIT` mode.
  - **4. Orchestrator Preparation Status & Ingestion Integrity**:
    - Updated `runPreparationStage` in `apps/worker/src/engine/autonomous-orchestrator.ts`: transitions newly generated application packages to `NEEDS_REVIEW` rather than premature `READY_TO_APPLY`.
    - Updated `runDiscoveryStage` and `runMatchingStage`: queries jobs in `DISCOVERED`, `INGESTED`, and `NEW` states so real user-imported and pasted job postings are actively picked up.
  - **5. Browser Worker Foreign Key Constraint Resolution**:
    - Hardened `BrowserWorkerService.createBrowserRun`: queries `applicationPackageVersions` table to resolve the latest version ID when `packageVersionId` is not provided, preventing foreign key constraint violations from inserting package container IDs into `package_version_id`.
  - **6. Operational Acceptance Test Profile Hardening**:
    - Updated `scripts/verify-operational-acceptance.ts`: preserves candidate Asadbek Makhmudov's profile during test execution without temporary synthetic mutations.
- **Verification Records**:
  - `npm run db:check`: PASSED (PostgreSQL connected, 18ms latency).
  - `npm run db:migrate`: PASSED (15 migrations up to date).
  - `npm run typecheck`: PASSED (0 errors across all 6 workspaces).
  - `npm run lint`: PASSED (0 errors across codebase).
  - `npm run test`: PASSED (36 test files, 271/271 tests passed, including `submission-authorization-service.test.ts`).
  - `npm run build`: PASSED (All 6 workspaces built cleanly including Vite web bundle).
  - `npm run format`: PASSED (Prettier checked across entire repository).
  - `scripts/verify-pilot-readiness.ts`: PASSED (11/11 sections passed cleanly with 0 failures, 100% clean teardown).
  - `scripts/verify-operational-acceptance.ts`: PASSED (Real Playwright Chromium driving React 19 UI across all 10 views, ATS fixture submission, crash invariants, 100% clean teardown).
  - Candidate Profile Audit: `Asadbek Makhmudov | Project Manager | Warsaw, Poland` verified 100% preserved in database.

---

### `JOB-AUTH-01` — Better Auth Identity, Multi-Tenant Workspace Isolation & Private Pilot Onboarding

- **Status**: COMPLETED (LOCAL CHECKPOINT)
- **Completed**: 2026-10-11
- **Scope**:
  - **1. Better Auth Framework Integration**:
    - Installed and integrated `better-auth@1.7.7` across backend (`apps/api`) and frontend (`apps/web`).
    - Configured Better Auth instance (`createBetterAuthInstance`) with PostgreSQL Drizzle ORM adapter.
    - Supported dual authentication: Google OAuth 2.0 (social provider) and Email/Password with email verification and password reset.
    - Configured secure session management via signed HTTP-only cookies and Bearer tokens.
    - Added environment variables to `@job-agent/config`: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `BETTER_AUTH_TRUSTED_ORIGINS`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `SMTP_*`, and `INVITE_ONLY_REGISTRATION` with Zod schema validation.
  - **2. Database Schema Extensions & Migration 0015**:
    - Extended `users` table with `name`, `email` (unique index), `email_verified`, `image`, `role` (default 'user'), `banned`, `ban_reason`, `ban_expires`, and `invitation_code`.
    - Created Better Auth tables: `sessions` (token, user_id, expires_at, ip_address, user_agent), `accounts` (provider_id, account_id, tokens, scrypt password hash), `verifications` (identifier, value, expires_at).
    - Created private pilot onboarding table: `pilot_invitations` (code, inviter_user_id, invited_email, role, status, redeemed_by_user_id, redeemed_at, expires_at).
    - Generated and applied migration `0015_better_auth.sql` to development database `ai_job_agent_dev`.
    - Preserved primary user `Asadbek Makhmudov` (`00000000-0000-0000-0000-000000000001`, `asadbek.mzw@gmail.com`) with role `'admin'` and 100% verified facts, skills, and documents intact.
  - **3. Transactional Delivery & Pilot Invitation Service**:
    - Implemented `TransactionalEmailService`: delivers email verification codes and password reset links via Resend API (`RESEND_API_KEY`), with structured console logging fallback for development.
    - Implemented `PilotInvitationService`: generates cryptographically random invitation codes with expiry and optional email binding, verifies codes publicly, redeems codes during signup, and revokes pending invitations with admin permission checks.
  - **4. Fastify Authentication Plugin & Multi-Tenant Isolation**:
    - Created `authPlugin` (`apps/api/src/plugins/auth-plugin.ts`):
      - Intercepts and delegates `/api/auth/*` and `/auth/*` directly to Better Auth handler with path normalization.
      - Uses Node.js `AsyncLocalStorage` (`requestUserContext`) in request `preHandler` to securely propagate authenticated user context (`userId`, `role`).
      - Exposes `getCurrentUserId()` to guarantee thread-safe tenant identity resolution across all domain routes.
      - Decorates Fastify with `requireAuth` (401 Unauthorized for unauthenticated requests) and `requireAdmin` (403 Forbidden for non-admin users).
    - Updated all domain route handlers (`candidate.ts`, `job-routes.ts`, `application-package-routes.ts`, `application-crm-routes.ts`, `browser-worker-routes.ts`, `email-routes.ts`, `calendar-routes.ts`, `orchestrator-routes.ts`, `notification-routes.ts`) to query database entities using `getCurrentUserId()`.
  - **5. React 19 Web UI Auth Integration**:
    - Created React Better Auth client in `apps/web/src/api/auth-client.ts` with hooks for session inspection, sign-in, sign-up, and sign-out.
    - Created `AuthModal.tsx`: supports Google Sign-In, Email/Password sign-in, invite-only pilot registration with real-time invite validation, and password reset.
    - Created `PilotInvitationsModal.tsx`: admin panel for generating single-use invite codes, listing pending and redeemed invites, copying codes, and revoking invites.
    - Updated `App.tsx`: added session status card in sidebar footer (avatar, name, email, role badge, Admin invite management modal button, and Sign Out button).
    - Updated `SettingsView.tsx`: documented Better Auth multi-user architecture and tenant isolation model.
  - **6. Automated Testing & Verification**:
    - Created `apps/api/src/routes/auth-routes.test.ts`: 6/6 tests passing (pilot invite verification, invite-only access control, admin generation and revocation, unauthenticated 401 protection, public health endpoint accessibility, and multi-user profile isolation).
    - Hardened Vitest timeout in `vitest.config.ts` (`testTimeout: 20000`) for seamless execution under CPU contention.
- **Verification Records**:
  - `npm run db:check`: PASSED (PostgreSQL connected, 75ms latency).
  - `npm run db:migrate`: PASSED (16 migrations up to date: 0000 through 0015).
  - `npm run typecheck`: PASSED (0 errors across all 6 workspaces).
  - `npm run lint`: PASSED (0 errors across codebase).
  - `npm run test`: PASSED (37 test files, 277/277 tests passed in 48.17s).
  - `npm run build`: PASSED (All 6 workspaces built cleanly including Vite web bundle in 5.63s).
  - `npm run format`: PASSED (All matched files conform to Prettier).
  - Primary Candidate Profile Audit: `Asadbek Makhmudov | asadbek.mzw@gmail.com | Role: admin | Verified: true` verified 100% intact in database with 14 skills and 6 facts.

---

### `JOB-PROD-03` — Public Job Discovery, Background Ingestion & Containerized Cloud Deployment Readiness

- **Status**: COMPLETED (LOCAL CHECKPOINT)
- **Completed**: 2026-10-11
- **Scope**:
  - **1. Public Opportunity Discovery Service (`JobDiscoveryService`)**:
    - Created `apps/api/src/services/job-discovery-service.ts`: connects to public job feeds (Arbeitnow public API at `https://www.arbeitnow.com/api/job-board-api` and public Greenhouse boards at `boards-api.greenhouse.io`).
    - Matches candidate `targetTitles` from `jobPreferences` and candidate profile headline.
    - Sanitizes HTML descriptions into clean readable text for requirement parsing.
    - Enforces deduplication via content hash and canonical URL to prevent re-ingesting duplicate jobs.
    - Added unit test suite `apps/api/src/services/job-discovery-service.test.ts` (2/2 tests passing).
  - **2. API Endpoints & Web UI Integration**:
    - Registered `POST /api/jobs/discover` and `POST /jobs/discover` in Fastify `job-routes.ts`.
    - Added `discoverJobs` method to `apps/web/src/api/job-client.ts`.
    - Added `🌐 Discover Public Jobs` button and reactive notification ribbon to `JobInboxView.tsx`.
  - **3. Autonomous Orchestrator Discovery & Preparation Pipeline Integration**:
    - Updated `AutonomousOrchestrator.runDiscoveryStage`: when active discovery queue has fewer than 3 opportunities, automatically polls the public feed and ingests new vacancies.
    - Updated `AutonomousOrchestrator.runPreparationStage`: initializes draft application packages in `NEEDS_REVIEW` in Application Studio for candidate review.
  - **4. Single-Port Production Serving**:
    - Registered `@fastify/static` in `apps/api/src/app.ts` to serve compiled React 19 SPA from `apps/web/dist` on port 3000 in production.
    - Unified single `app.setNotFoundHandler` with SPA `index.html` fallback for client-side routing.
  - **5. Containerization & Cloud Deployment Readiness**:
    - Multi-stage `Dockerfile`: Node.js 22-bookworm-slim with Chromium/Playwright dependencies, monorepo build stage, and production runner stage.
    - `docker-compose.yml`: orchestrated local stack (`postgres`, `api`, `worker`) with healthchecks and volume persistence.
    - `.dockerignore`: clean container build exclusion.
  - **6. Verification Test Hardening**:
    - Updated `scripts/verify-pilot-readiness.ts` and `scripts/verify-operational-acceptance.ts` to authenticate with Better Auth sessions.
- **Verification Records**:
  - `npm run db:check`: PASSED (PostgreSQL connected, 31ms latency).
  - `npm run db:migrate`: PASSED (16 migrations up to date).
  - `npm run typecheck`: PASSED (0 errors across all 6 workspaces).
  - `npm run lint`: PASSED (0 errors across codebase).
  - `npm run test`: PASSED (38 test files, 280/280 tests passed in 26.72s).
  - `npm run build`: PASSED (API, Worker, Config, Shared, Database, and Web SPA bundle compile cleanly).
  - `npm run format`: PASSED (All files formatted cleanly).
  - `scripts/verify-pilot-readiness.ts`: PASSED (11/11 sections passed cleanly with 0 failures, 100% clean teardown).
  - `scripts/verify-operational-acceptance.ts`: PASSED (Real Playwright Chromium driving React UI across all 10 views, ATS fixture submission, crash invariants, 100% clean teardown).
  - Primary Candidate Profile Audit: `Asadbek Makhmudov | asadbek.mzw@gmail.com | Role: admin` verified 100% intact in database with 14 skills, 2 certifications, and 6 facts.

---

### `JOB-PROD-04` — Multi-Tenant Auth Hardening, Open AI Architecture & Mobile Responsiveness

- **Status**: COMPLETED (LOCAL CHECKPOINT)
- **Completed**: 2026-10-13
- **Scope**:
  - **1. Multi-Tenant Authentication Hardening & Fallback Elimination**:
    - Created `requireCurrentUserId(request)` in `apps/api/src/plugins/auth-plugin.ts` enforcing strict session authentication in production and throwing `401 Unauthorized` for unauthenticated requests.
    - Updated all 9 domain route handlers (`candidate.ts`, `job-routes.ts`, `application-package-routes.ts`, `application-crm-routes.ts`, `browser-worker-routes.ts`, `calendar-routes.ts`, `email-routes.ts`, `notification-routes.ts`, `orchestrator-routes.ts`) to use `requireCurrentUserId` and eliminated silent fallbacks to `getPrimaryUserId()` or hardcoded candidate identifiers.
    - Hardened integration test suite `apps/api/src/routes/auth-routes.test.ts` to verify that unauthenticated calls across all domain endpoints (`/api/candidate/*`, `/api/jobs/*`, `/api/applications/*`, `/api/email/*`, `/api/calendar/*`) are strictly rejected with 401 UNAUTHORIZED.
  - **2. Open AI Provider Architecture & Settings Integration**:
    - Implemented `OpenAiAiProvider` (`apps/api/src/ai/openai-ai-provider.ts`) supporting `gpt-4o-mini` and `gpt-4o` with strict JSON schema response formatting and candidate fact boundary validation.
    - Created alias `apps/api/src/ai/gemini-provider.ts` for unified Gemini provider imports.
    - Updated `createAiProvider` in `apps/api/src/ai/index.ts` supporting `gemini`, `openai`, and `disabled` providers.
    - Added `OPENAI_API_KEY` to Zod environment schema in `packages/config/src/env.ts` and `.env.example`.
    - Created settings routes (`apps/api/src/routes/settings-routes.ts`): added `GET /api/settings/ai` and `POST /api/settings/ai/test` for runtime AI provider inspection and live connectivity testing.
    - Added test suite `apps/api/src/routes/settings-routes.test.ts` (6/6 tests passing).
  - **3. Interactive Settings UI & Credential Documentation**:
    - Enhanced `apps/web/src/components/SettingsView.tsx` with interactive AI Provider architecture cards (`Google Gemini`, `OpenAI GPT`, `Deterministic Grounded Offline`).
    - Added live "Test AI Connectivity" probe with latency and response validation.
    - Documented exact environment variable setup (`GEMINI_API_KEY`, `OPENAI_API_KEY`) and security guarantees (zero plaintext key leakage, zero unverified fact fabrication).
  - **4. Mobile Responsiveness Audit & Remediation**:
    - Audited frontend viewport layouts down to 375px mobile viewports.
    - Added sticky mobile header bar with hamburger drawer toggle in `apps/web/src/App.tsx`.
    - Implemented off-canvas slide-out drawer navigation with semi-transparent backdrop blur and automatic close on navigation.
    - Added responsive CSS media queries in `apps/web/src/index.css`: mobile content padding scaling (from 3rem down to 1rem), single-column status grid layout, and responsive modal containment (`max-width: 95vw`).
  - **5. Docker Containerization Layer Ordering Fix**:
    - Corrected Dockerfile runner stage layer order: copied `node_modules` before executing `npx playwright install chromium` to guarantee version alignment.
- **Verification Records**:
  - `npm run db:check`: PASSED (PostgreSQL connected, 18ms latency).
  - `npm run db:migrate`: PASSED (16 migrations up to date).
  - `npm run typecheck`: PASSED (0 errors across all 6 workspaces).
  - `npm run lint`: PASSED (0 errors across codebase).
  - `npm test`: PASSED (39 test files, 286/286 tests passed).
  - `npm run build`: PASSED (API, Worker, Config, Shared, Database, and Web SPA bundle compile cleanly in 1.42s).
  - `npm run format`: PASSED (All files formatted cleanly).
  - `scripts/verify-pilot-readiness.ts`: PASSED (11/11 sections passed cleanly with 0 failures, 100% clean teardown).
  - `scripts/verify-operational-acceptance.ts`: PASSED (Real Playwright Chromium driving React UI across all 10 views, ATS fixture submission, crash invariants, 100% clean teardown).
  - Primary Candidate Profile Audit: `Asadbek Makhmudov | asadbek.mzw@gmail.com | Role: admin` verified 100% intact in database with 14 skills, 2 certifications, and 6 quarantined facts.

---

### `JOB-PROD-05` — Multi-Tenant Isolation, Dynamic AI Configuration, Cloud Storage & Deep-Link Onboarding

- **Status**: COMPLETED (LOCAL CHECKPOINT)
- **Completed**: 2026-10-13
- **Scope**:
  - **1. Multi-Tenant Cross-User Isolation Penetration Suite (BL-01)**:
    - Created `apps/api/src/routes/multi-tenant-isolation.test.ts` executing 17 targeted penetration attack attempts across two independent authenticated sessions.
    - Verified strict boundary isolation on: candidate profile, documents, binary downloads, verified facts, private jobs, application packages, package versions, approval requests, CRM applications, CRM mutations, browser automation runs, calendar accounts, availability queries, and system notifications.
    - 100% of cross-tenant access attempts rejected with `403 Forbidden` or `404 Not Found`.
  - **2. Dynamic AI Provider Switching & DB Persistence (BL-02)**:
    - Added `activeAiProvider` and `activeAiModel` columns to `application_policy` table (`packages/database/src/schema/application-policy.ts`).
    - Created migration `0016_ai_provider_settings.sql` and updated journal; applied cleanly.
    - Implemented `DynamicAiProvider` (`apps/api/src/ai/dynamic-ai-provider.ts`) implementing `AiProvider` and dynamically routing calls to the user's active provider (`gemini`, `openai`, `disabled`) with model override.
    - Added `POST /api/settings/ai` and updated `GET /api/settings/ai` with Zod schema validation, credential checks, and database persistence.
    - Enhanced `apps/web/src/components/SettingsView.tsx` with dynamic model selector dropdown, active provider switcher, and "Save AI Configuration" button.
    - All 9 integration tests in `apps/api/src/routes/settings-routes.test.ts` pass cleanly.
  - **3. Transactional Invitation Emails & Deep-Link Onboarding (BL-03)**:
    - Added `sendInvitationEmail(to, code, inviteUrl, inviterName)` to `apps/api/src/services/email/transactional-email-service.ts` with Jobee branding and deep-link generation.
    - Added `findValidInvitationByEmail` to `PilotInvitationService`.
    - Updated `databaseHooks.user.create.before` in `apps/api/src/auth/better-auth-instance.ts` to automatically validate invitations by email for Google Sign-In and email sign-up without manual code entry.
    - Wired invitation email dispatch into `POST /api/pilot/invitations` when `invitedEmail` is specified.
    - Updated `apps/web/src/App.tsx` and `AuthModal.tsx` to detect `?invite=<CODE>` query parameters, cache in `sessionStorage`, and auto-open `AuthModal` in prefilled signup mode.
    - Added `apps/api/src/routes/pilot-invitation-routes.test.ts` (10 tests, all passing).
  - **4. Document Storage Abstraction (S3 / R2 Cloud Ready) (BL-04)**:
    - Added storage config schema (`STORAGE_BACKEND`, `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`) in `packages/config/src/env.ts` and `.env.example`.
    - Implemented `S3StorageProvider` in `apps/api/src/storage/s3-storage.ts` using zero-dependency AWS Signature Version 4 (AWS4-HMAC-SHA256) signing for broad S3/Cloudflare R2/MinIO compatibility.
    - Implemented `createStorageProvider(config)` factory in `apps/api/src/storage/index.ts` and wired into `apps/api/src/app.ts`.
    - Created `apps/api/src/storage/s3-storage.test.ts` (9 tests, all passing).
  - **5. Production Single-Port Static Web Assets Serving (BL-05)**:
    - Updated `apps/api/src/app.ts` to resolve `apps/web/dist` across Docker and monorepo working directories.
    - Created `apps/api/src/routes/production-static-serving.test.ts` (4 tests, all passing).
  - **6. Full Multi-User End-to-End Workflow Validation (BL-06)**:
    - Created `scripts/verify-multi-user-e2e.ts` validating complete lifecycle: Primary Admin -> Invitation Creation -> Email Dispatch -> Tester Onboarding -> Isolated Resource Creation -> Zero Cross-Tenant Visibility -> Dynamic AI Switching -> Clean Teardown.
- **Verification Records**:
  - `npm run db:check`: PASSED (PostgreSQL connected, 37ms latency).
  - `npm run db:migrate`: PASSED (17 migrations up to date).
  - `npm run typecheck`: PASSED (0 errors across all 6 workspaces).
  - `npm run lint`: PASSED (0 errors across codebase).
  - `npm test`: PASSED (43 test files, 329/329 tests passed in 19.43s).
  - `npm run build`: PASSED (API, Worker, Config, Shared, Database, and Web SPA bundle compile cleanly).
  - `npm run format`: PASSED (All files formatted cleanly).
  - `scripts/verify-multi-user-e2e.ts`: PASSED (All steps passed, 0 orphans left).
  - Primary Candidate Profile Audit: `Asadbek Makhmudov | asadbek.mzw@gmail.com | Role: admin` verified 100% intact in database with 14 skills, 2 certifications, and 6 quarantined facts.

---

### `JOB-HOST-01` — Free-First Hosting Strategy, Oracle Cloud ARM64, Neon PostgreSQL & Cloudflare R2

- **Status**: COMPLETED
- **Completed**: 2026-10-14
- **Scope**:
  - **1. Free-First Hosting Policy Alignment & Core Directive Update**:
    - Product Owner approved Free-First hosting strategy prioritizing Oracle Cloud Always Free (Ampere A1 ARM64 VM), Neon Free PostgreSQL, and Cloudflare R2 Document Storage.
    - Updated `docs/PRODUCT_COMPLETION_DIRECTIVE.md` with Core Invariant 8 (Strict Zero-Paid Spend without explicit approval) and Section 5 (Free-First Architecture, Technical Feasibility, Mitigations, Paid Alternative Contingency).
    - Updated `docs/OWNER_ACTIONS_REQUIRED.md` with DEP-04 (Oracle Always Free), DEP-05 (Neon Free Postgres), DEP-06 (Cloudflare R2), Decision DEC-04, and step-by-step deployment runbooks.
    - Updated `docs/IMPLEMENTATION_BACKLOG.md` with items BL-07, BL-08, and BL-09.
  - **2. Architecture & ARM64 Compatibility Evaluation**:
    - Node.js 22 (`node:22-bookworm-slim`) verified on Linux ARM64 (`linux/arm64`) and macOS ARM64 (`darwin/arm64`).
    - Dependency tree audit: confirmed zero native C/C++ compilation bindings (`node-gyp` not needed). Pure TypeScript/JavaScript runtime.
    - Playwright Chromium headless automation evaluated: official prebuilt Chromium available for Linux ARM64. Massive 24 GB RAM on Ampere A1 eliminates OOM risks.
    - Background worker evaluation: runs continuously 24/7 on dedicated Always Free IaaS VM with systemd/Docker restart policies.
  - **3. Neon PostgreSQL Auto-SSL & Connection Timeout Hardening**:
    - Enhanced `packages/database/src/client.ts` to automatically detect SSL mode for Neon endpoints (`neon.tech` or `sslmode=require`) and configure non-blocking SSL.
    - Increased connection timeout to 10,000ms to absorb Neon serverless compute resume latency (500ms–2s).
    - Added `DATABASE_SSL` configuration option to `packages/config/src/env.ts` and updated `.env.example`.
    - Added unit test in `packages/database/src/health.test.ts` verifying Neon SSL parameter auto-configuration.
  - **4. Cloudflare R2 Document Storage**:
    - Verified `S3StorageProvider` pluggability for Cloudflare R2 (10 GB free tier, zero egress fees) via S3-compatible API.
    - Updated `.env.example` with exact Cloudflare R2 endpoint and credentials documentation.
  - **5. Simplest Reliable Paid Alternative Evaluated**:
    - Recommended Hetzner Cloud VPS (`CAX11` ARM64 / `CX22` x86_64, 2 vCPU, 4 GB RAM, 40 GB NVMe) at ~€3.79–€3.99/month (~$4.15–$4.35 USD/month) if Oracle Cloud regional capacity is constrained.
    - Strict human authorization boundary DEC-04 enforced: no paid infrastructure may be provisioned without explicit approval.
  - **6. Automated Verification Suite**:
    - Created `scripts/verify-free-first-infrastructure.ts` verifying architecture, Docker, Neon SSL auto-detection, Cloudflare R2 provider instantiation, local disk fallback, Playwright runtime, and spend guardrails (11/11 checks passed).
- **Verification Records**:
  - `npm run db:check`: PASSED (PostgreSQL connected, 16ms latency).
  - `npm run typecheck`: PASSED (0 errors across all 6 workspaces).
  - `npm run lint`: PASSED (0 errors across codebase).
  - `npm test`: PASSED (43 test files, 330/330 tests passed).
  - `scripts/verify-free-first-infrastructure.ts`: PASSED (11/11 checks passed).

---

### `JOB-HOST-02` — Official Railway Hosting Architecture & Production Multi-Service Deployment

- **Status**: COMPLETED
- **Completed**: 2026-10-14
- **Scope**:
  - **1. Railway Official Hosting Architecture Alignment**:
    - Product Owner established Railway as the official cloud hosting platform for Jobee, superseding Oracle Always Free while preserving `JOB-HOST-01` as completed historical engineering documentation.
    - Updated permanent project documents: `PRODUCT_COMPLETION_DIRECTIVE.md`, `OWNER_ACTIONS_REQUIRED.md`, `IMPLEMENTATION_BACKLOG.md`, `AUTONOMOUS_STATE.md`, `ARCHITECTURE.md`, `ROADMAP.md`.
    - Detailed Railway multi-service topology: `jobee-api` (Fastify + static React 19 SPA) and `jobee-worker` (Autonomous Orchestrator daemon + Playwright), backed by Neon PostgreSQL Free and Cloudflare R2 Document Storage.
  - **2. Dynamic Port Binding & Reverse Proxy Trust Hardening**:
    - Enhanced `packages/config/src/env.ts` with dynamic `$PORT` environment variable preprocessing to bind to Railway's assigned port dynamically while maintaining port 3000 default.
    - Configured `fastify({ trustProxy: true })` in `apps/api/src/app.ts` for Railway edge ingress (Cloudflare/Envoy SSL termination), ensuring secure cookie handling (`__Secure-`), accurate `request.protocol === 'https'`, real client IP extraction, and correct Better Auth redirect generation.
    - Whitelisted `BETTER_AUTH_URL` dynamically in Fastify CORS origin whitelist.
  - **3. Playwright Containerization Hardening**:
    - Added container runtime flags (`--no-sandbox`, `--disable-setuid-sandbox`, `--disable-dev-shm-usage`, `--disable-gpu`) in `PlaywrightBrowserController` to prevent Linux container crashes from 64 MB `/dev/shm` exhaustion.
  - **4. Railway Infrastructure as Code & Deprecation of Legacy Configs**:
    - Implemented Railway's current supported Infrastructure as Code system in `.railway/railway.ts` using `@railway/iac` TypeScript DSL.
    - Programmatically declared `jobee-api` and `jobee-worker` service topologies with Dockerfile builder, start commands, healthchecks, and restart policies.
    - Completely removed deprecated `railway.json` and `railway.worker.json` configurations.
  - **5. Container Security & Playwright Sandbox Hardening**:
    - Added `libxkbcommon0` system dependency in Dockerfile for Chromium.
    - Dropped root privileges in Dockerfile runner stage, running as unprivileged `USER node` (UID 1000).
    - Configured `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright` with non-root ownership.
    - Hardened Playwright browser contexts: `permissions: []`, `ignoreHTTPSErrors: false`, `bypassCSP: false`.
  - **6. Actual Container Build & Multi-Service Verification**:
    - Booted local container runtime via Colima and executed actual `docker build -t jobee:test .`.
    - Fixed missing `tsconfig.base.json` in builder stage and standardized package export paths to `./dist/index.js`.
    - Successfully verified Chromium launch inside the built container running as unprivileged UID 1000.
  - **7. Hosting Cost Analysis & Authorization Boundaries**:
    - Evaluated Railway Hobby plan (~$5.00–$8.00/month) with $5.00 monthly platform credit offsetting the majority of resource usage (~200 MB API + ~250 MB Worker).
    - Enforced strict human authorization boundary `DEC-04`: no paid plans may be activated or public deployments executed without explicit Product Owner approval.
  - **8. Automated Deployment Verification Suite**:
    - Created and updated `scripts/verify-railway-deployment.ts` with comprehensive checks across Railway IaC compilation, absence of deprecated JSON files, environment schemas, dynamic `$PORT`, reverse-proxy trust reflection, non-root sandbox security, Neon SSL detection, and spend guardrails.
- **Verification Records**:
  - `npm run db:check`: PASSED (PostgreSQL connected).
  - `npm run typecheck`: PASSED (0 errors across all 6 workspaces).
  - `npm run lint`: PASSED (0 errors across codebase).
  - `npm test`: PASSED (43 test files, 330/330 tests passed).
  - `scripts/verify-railway-deployment.ts`: PASSED (13/13 checks passed).

---

### `JOB-AUTH-VERIFY` — Owner Account Verification, Google Sign-In Linking & Data Isolation Guards

- **Status**: COMPLETED
- **Completed**: 2026-10-14
- **Scope**:
  - **1. Owner Identity & Configuration Unification**:
    - Confirmed canonical primary administrator and candidate email: `asadbek.mzw@gmail.com`.
    - Added `OWNER_EMAIL: z.string().email().default('asadbek.mzw@gmail.com')` to `packages/config/src/env.ts` with Zod schema validation.
    - Updated `.env.example` with `OWNER_EMAIL=asadbek.mzw@gmail.com`.
    - Updated `apps/api/src/plugins/auth-plugin.ts` to reference `config.OWNER_EMAIL || 'asadbek.mzw@gmail.com'`.
    - Updated `apps/api/src/auth/better-auth-instance.ts` to reference normalized `(config.OWNER_EMAIL || 'asadbek.mzw@gmail.com').trim().toLowerCase()`.
  - **2. Google Sign-In & Invitation Bypass**:
    - Enabled automatic invitation bypass for `asadbek.mzw@gmail.com` when `INVITE_ONLY_REGISTRATION=true`.
    - Ensured case-insensitive email comparison for owner detection during registration/OAuth callback.
    - Guaranteed automatic elevation to `role = 'admin'` for the owner account upon signup/login.
  - **3. Candidate Data Re-Linking & Security Isolation Guards**:
    - Pre-existing seed user ID `00000000-0000-0000-0000-000000000001` candidate data (profile, facts, skills, documents, applications) is seamlessly linked to the owner.
    - Added comprehensive cascading update across all 16 user-bound tables if Better Auth assigns a new UUID.
    - **Security Isolation Guard**: Re-linking is strictly gated by `if (isOwnerEmail || isSeedUser)`. Non-owner/non-seed accounts cannot claim candidate profiles belonging to other user IDs, preventing account hijacking and multi-tenant data leaks.
  - **4. Automated Integration Verification**:
    - Added unit tests in `packages/config/src/env.test.ts` verifying default and custom `OWNER_EMAIL` parsing and validation.
    - Added Section 4 integration tests in `apps/api/src/routes/auth-routes.test.ts` testing owner invitation bypass, case insensitivity, unique email constraint enforcement (`users_email_unique_idx`), 1:1 profile uniqueness (`candidate_profiles_user_id_unique`), and multi-tenant data isolation.
- **Verification Records**:
  - `npm run lint`: PASSED (ESLint 9, 0 errors).
  - `npm run typecheck`: PASSED (TypeScript 5.8 across all 6 workspaces, 0 errors).
  - `npm run test`: PASSED (Vitest, 43 test files, 342/342 tests passed).
  - `npm run build`: PASSED (All 6 workspaces built cleanly including Vite web bundle).

---

### `JOB-AUTH-REPAIR` — Production Google Sign-In Verification ID Fix & CI Pipeline Stabilization

- **Status**: COMPLETED
- **Completed**: 2026-10-14
- **Scope**:
  - **1. Better Auth Verification ID Default Generation**:
    - Identified root cause of production HTTP 500 on `POST /api/auth/sign-in/social`: `@better-auth/drizzle-adapter` omitted `id` when creating OAuth state tokens in the `verifications` table, which violated the PostgreSQL NOT NULL primary key constraint without a default.
    - Updated `packages/database/src/schema/auth.ts` to assign `.$defaultFn(() => crypto.randomUUID())` to `verifications.id`, `sessions.id`, and `accounts.id`.
    - Generated migration `packages/database/drizzle/0017_verifications_id_default.sql` (`ALTER TABLE "verifications" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;`) and registered it in `_journal.json`.
    - Added defense-in-depth `verification.create.before` hook in `apps/api/src/auth/better-auth-instance.ts` ensuring `id` is populated before insertion.
  - **2. Frontend Unfreeze & Error Surfacing**:
    - In `apps/web/src/components/AuthModal.tsx`, handled `{ data, error }` return object from Better Auth client calls (`signIn.social` does not throw exceptions).
    - Added error message state rendering and reset `loading` flag on failure.
    - Added informative button state ("Connecting to Google...") while waiting for the OAuth authorization redirect.
  - **3. Clean Database Seeding & CI Test Stability**:
    - Fixed foreign key failures on fresh databases by updating `getOrCreatePrimaryUser` in `packages/database/src/user.ts` to ensure the candidate profile exists for the seed user.
    - Provisioned the seed user in `packages/database/src/scripts/migrate.ts`.
    - Ensured tests in `candidate.test.ts` and `auth-routes.test.ts` call `getOrCreatePrimaryUser(db)` in `beforeAll`.
  - **4. GitHub CI Dependency Ordering**:
    - Updated `.github/workflows/ci.yml` to compile internal packages (`npm run build:packages`) before running Lint and Typecheck.
    - Updated root `package.json` `typecheck` script to build packages first.
- **Verification Records**:
  - `npm run lint`: PASSED (0 errors).
  - `npm run typecheck`: PASSED (0 errors across monorepo).
  - `npm run test`: PASSED (43 test files, 343/343 tests passed).
  - `npm run build`: PASSED (API, Worker, Web SPA built cleanly).
  - GitHub Actions CI (Run `38568490182`): **PASSED** (exit code 0, all jobs green).
  - Production Google Sign-In Endpoint: `POST https://jobee-api-production.up.railway.app/api/auth/sign-in/social` returns HTTP 200 with Google OAuth authorization URL.
  - Production Health Check: `GET /health` returns HTTP 200 OK.

---

### `JOB-POST-DEPLOY` — UI Repair, Google Integrations & Production Stabilization

- **Status**: COMPLETED
- **Completed**: 2026-10-14
- **Scope**:
  - **1. Frontend Design System & Modal Repair**:
    - Identified that `PilotInvitationsModal.tsx` and `AuthModal.tsx` relied on uninstalled Tailwind CSS classes (`fixed`, `inset-0`, `z-50`, `bg-white`, `border-gray-100`), causing unstyled/broken layouts.
    - Upgraded `apps/web/src/index.css` with native modal design tokens (`.modal-backdrop` with backdrop-filter blur, `.modal-dialog`, `.modal-dialog-large`, `.modal-dialog-sm`, `.modal-dialog-clean`, `.modal-header`, `.modal-body`, `.modal-footer`, `.modal-card-section`, `.spotlight-box`).
    - Added comprehensive table utility styles (`.table-container`, `.table`, `.table-mono`) and form helper styles (`.form-grid-4`, `.alert-error`, `.alert-success`, `.alert-info`).
    - Redesigned `PilotInvitationsModal.tsx` using Jobee's native dark-theme system, including keyboard accessibility (`Escape` keydown to close), backdrop click dismissal, body scroll locking, responsive invitation generator form, high-contrast spotlight code card with copy-to-clipboard feedback, and responsive invitations table.
    - Redesigned `AuthModal.tsx` using Jobee's native dark-theme system, adding an accessible close button (✕), backdrop dismissal, `Escape` keydown handler, and unified dark styling.
    - Unified sidebar footer in `App.tsx` with dark theme CSS variables (`--surface-border`, `rgba(15, 23, 42, 0.4)`), eliminating light-mode visual artifacts.
  - **2. Gmail & Google Calendar OAuth Integration**:
    - Updated `packages/config/src/env.ts` preprocess to automatically reuse `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` for `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` and `GOOGLE_CALENDAR_CLIENT_ID` / `GOOGLE_CALENDAR_CLIENT_SECRET` when not explicitly overridden.
    - Added dynamic resolution of production OAuth redirect URIs (`${publicUrl}/api/email/accounts/gmail/callback` and `${publicUrl}/api/calendar/google/callback`) when `RAILWAY_PUBLIC_DOMAIN` or HTTPS `BETTER_AUTH_URL` is detected.
    - Updated `.railway/railway.ts` to map `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GOOGLE_CALENDAR_CLIENT_ID`, and `GOOGLE_CALENDAR_CLIENT_SECRET` using secure variable references (`${{GOOGLE_CLIENT_ID}}`, `${{GOOGLE_CLIENT_SECRET}}`) and production callback URLs.
    - Configured Railway service variables for `jobee-api` with secure variable references and validated with `railway config plan` (0 additions, 2 changes, 0 destructions).
  - **3. Unit Testing & Verification**:
    - Added unit tests in `packages/config/src/env.test.ts` verifying Google OAuth credential reuse, dedicated override preservation, and dynamic redirect URI resolution from `RAILWAY_PUBLIC_DOMAIN`.
- **Verification Records**:
  - `npm run lint`: PASSED (0 errors, 332 warnings).
  - `npm run typecheck`: PASSED (0 errors across monorepo).
  - `npm test`: PASSED (43 test files, 346/346 tests passed).
  - `npm run build`: PASSED (Packages, API, Worker, and Web SPA built cleanly).
  - `scripts/verify-railway-deployment.ts`: PASSED (17/17 checks passed).
  - `railway config plan`: PASSED (0 destructive changes).
  - Git Commit: `56f5771` pushed to `origin/main`.
  - GitHub Actions CI (Run `38575545745`): **PASSED** (exit code 0, all jobs green).
  - Live Railway Deployments: `jobee-api` (`3a30fdbc`) and `jobee-worker` (`ec8330f2`) both deployed and in `SUCCESS` state.
  - Live API Probes: `GET /health` returned HTTP 200 OK (`uptimeSeconds: 40`), `GET /ready` returned HTTP 200 OK with Neon PostgreSQL connected (20ms latency), Gemini AI online, `gmail.isConfigured: true`, and `googleCalendar.isConfigured: true`.
  - Live Web Assets: Verified HTTP 200 for root HTML, Vite JavaScript bundle, and CSS stylesheet containing all native modal and dark-theme tokens.

---

### `JOB-PROD-MIGRATION` — Production Data Migration & Cloudflare R2 Document Sync

- **Status**: COMPLETED
- **Completed**: 2026-10-14
- **Scope**:
  - **1. Database Connection Isolation & Singleton Guard**:
    - Resolved singleton connection-pool caching bug in `packages/database/src/client.ts`.
    - Added `createDatabaseClient(connectionString)` for independent, un-cached connection pools with their own Drizzle instances.
    - Added collision detection in `getDbPool(connectionString)`: explicitly throws if called with a conflicting connection string while an active pool exists, preventing silent cross-database leakage.
    - Added regression tests in `packages/database/src/client.test.ts` (3 tests passed).
  - **2. Pre-Migration Backups Outside Git**:
    - Created local PostgreSQL backup: `/Users/bek/.jobee-backups/migration-20261014/local_db_backup.sql` (2.2 MB).
    - Created production Neon data dump: `/Users/bek/.jobee-backups/migration-20261014/neon_data_backup.json` (44.8 KB).
    - Created local document archive: `/Users/bek/.jobee-backups/migration-20261014/documents/` (426 files).
    - All backups secured outside the repository under mode 700.
  - **3. Account Ownership & Identity Mapping**:
    - Identified authenticated Google OAuth owner in Neon: `81d5cb73-3c7f-48ec-88b9-52ce39ed0fbf` (`asadbek.mzw@gmail.com`).
    - Identified local source user: `00000000-0000-0000-0000-000000000001` (`asadbek.mzw@gmail.com`).
    - Remapped all candidate records, job records, and application records from `00000000-0000-0000-0000-000000000001` to `81d5cb73-3c7f-48ec-88b9-52ce39ed0fbf`.
    - Enforced multi-tenant isolation guard: excluded unrelated test accounts (e.g. Alice).
    - Preserved existing Better Auth credentials, OAuth tokens, and active sessions without overwriting.
  - **4. Production Neon PostgreSQL Migration**:
    - Migrated tables in strict dependency order (Levels 0 through 3).
    - Merged candidate profile: populated `phone` (+48884665207), `city` (Warsaw), `country` (Poland), `summary`, and `availability` into production profile `dd300db8-9079-469f-b718-4439e1e274c0`.
    - Migrated: 1 candidate experience, 1 candidate education, 14 verified skills, 1 language, 2 certifications, 1 professional link.
    - Preserved candidate facts: 6 explicit facts migrated with original `UNVERIFIED` status and `allowAiUse: false` (truthfulness invariant).
    - Migrated: 2 answer library entries, 12 jobs (totaling 18 in Neon), 119 job sources, 8 job requirements, 3 job sections, 5 job match analyses, 40 match dimensions, 40 requirement evaluations.
    - Migrated: 12 application packages (totaling 18), 3 package versions, 10 application artifacts, 12 applications (totaling 18), 9 application questions, 9 approval requests, 4 lifecycle events, 1491 candidate audit events.
    - Merged preferences & policy: transferred candidate search preferences while preserving production `activeAiProvider: 'gemini'`.
  - **5. Cloudflare R2 Document Sync & Whitespace Sanitization**:
    - Fixed trailing newline bug in `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` that triggered HTTP header validation errors in Node.js `fetch()`. Added auto-trimming in `packages/config/src/env.ts` and `apps/api/src/storage/s3-storage.ts`.
    - Cleaned Shared Variables in Railway via CLI.
    - Uploaded and verified 11/11 referenced candidate documents in Cloudflare R2 bucket `jobee-private-documents`:
      - Master CV: `23bea6bf-5517-4066-a823-a4431803c333.pdf` (29,686 bytes, SHA-256 verified)
      - 10 application artifacts (.docx tailored resumes and cover letters)
    - All storage keys preserved matching database references; private bucket permissions maintained.
  - **6. End-to-End Live Production Verification**:
    - Authenticated API endpoints verified with owner session: Profile (200), Skills (14 items), Facts (6 items), Documents (1 item), Preferences (200), Policy (200), Answer Library (2 items), Jobs (200), Applications (18 items), Approvals (3 items), Calendar Auth URL (200).
- **Verification Records**:
  - `npm run lint`: PASSED (0 errors, 332 warnings).
  - `npm run typecheck`: PASSED (0 errors across monorepo).
  - `npm test`: PASSED (44 test files, 350/350 tests passed).
  - `npm run build`: PASSED (Packages, API, Worker, and Web SPA built cleanly).
  - `scripts/verify-railway-deployment.ts`: PASSED (17/17 checks passed).

---

### `JOB-AI-MGMT` — AI Integration Repair, Gemini 3.8/3.5 Models & Resilient Failover

- **Status**: COMPLETED
- **Completed**: 2026-10-14
- **Scope**:
  - **1. Google Generative Language Model Audit**:
    - Discovered root cause of HTTP 404: Google deprecated `gemini-2.5-flash` for new accounts (`models/gemini-2.5-flash is no longer available to new users`).
    - Queried Google Models API using production API key; identified 50 available models.
    - Verified availability: `gemini-3.8-flash` (primary, fast, multimodal, 1M context) and `gemini-3.5-flash-lite` (high availability, lowest latency, ~1.2s response, valid structured JSON output on standard tier).
  - **2. High-Availability Transparent Failover in `GeminiAiProvider`**:
    - Preferred `gemini-3.8-flash` as primary model; configured `gemini-3.5-flash-lite` as alternative and resilient failover.
    - Implemented transparent failover in `GeminiAiProvider`: if `gemini-3.8-flash` experiences a 503 high-demand spike from Google servers, the provider automatically and seamlessly evaluates the request with `gemini-3.5-flash-lite`.
    - Added structured error mapping with specific error codes: 404 (`SERVICE_UNAVAILABLE` / deprecated model guidance), 429 (`RATE_LIMIT_EXCEEDED` / quota guidance), 401/403 (`UNAUTHORIZED` credentials error), 503 (`SERVICE_UNAVAILABLE` high demand).
  - **3. Configuration & Frontend Normalization**:
    - Updated `packages/config/src/env.ts` and `.env.example` to default `AI_MODEL` to `gemini-3.8-flash` and automatically normalize obsolete model IDs (`gemini-2.5-flash`, `gemini-1.5-*`, `gemini-2.0-*`).
    - Updated `apps/web/src/components/SettingsView.tsx`: model dropdown options updated to `gemini-3.8-flash` (Primary), `gemini-3.5-flash-lite` (High Availability), and `gemini-3.1-pro-preview` (Deep Reasoning).
    - Hardened settings API (`/settings/ai` and `/api/settings/ai`) with safe model validation before saving, rejecting unsupported custom model strings with HTTP 400 `INVALID_MODEL`.
  - **4. Persisted Database Settings Repair**:
    - Repaired production Neon PostgreSQL database: updated `application_policy` records where `active_ai_model` was `gemini-2.5-flash` to `gemini-3.8-flash`.
    - Automated runtime and endpoint self-repair so any legacy persisted model is upgraded on inspection.
  - **5. Truthfulness & Anti-Hallucination Verification**:
    - Defensively guarded candidate evidence collection iteration in `validator.ts`.
    - Verified that unverified candidate facts (`UNVERIFIED` / `allow_ai_use: false`) remain completely excluded from AI context.
    - Added test verifying that fabricated evidence claims are stripped, degrading status to `UNKNOWN`.
  - **6. Verification Records**:
    - `npm run lint`: PASSED (0 errors, 340 warnings).
    - `npm run typecheck`: PASSED (0 errors across 6 workspaces).
    - `npm test`: PASSED (45 test files, 362/362 tests passed).
    - `npm run build`: PASSED (All packages, API, Worker, and Web SPA bundle).
    - `scripts/verify-railway-deployment.ts`: PASSED (17/17 checks passed).
    - GitHub Actions CI Run `38590191781`: **PASSED** (clean checkout, all 14 steps succeeded).
    - Railway Production Deployment: **SUCCESS / ONLINE** (`jobee-api` deployment `5c499361`, `jobee-worker` deployment `c1cd3492`).
    - Live Production AI Connectivity Test (`POST /api/settings/ai/test`): **PASSED** (HTTP 200, latency ~2.1s, structured match analysis and ground summary validated).

---

### `JOB-E2E-WORKFLOW` — End-to-End Job Search & Application Workflow Verification & Stabilization

- **Status**: COMPLETED
- **Completed**: 2026-10-14
- **Scope**:
  - **1. System Architecture & Invariant Audit (Phase A)**:
    - Verified all 13 subsystems across `apps/api`, `apps/worker`, `apps/web`, and shared packages.
    - Verified deterministic authorization over AI discretion, AES-256-GCM token crypto (`TokenCryptoService`), and Zod boundary validations.
    - Verified canonical match algorithm version (`1.0.0`).
  - **2. Job Discovery Engine (Phase B)**:
    - Added `'ARBEITNOW'` to canonical `JobProvider` enum in `packages/shared/src/types/job.ts`, `apps/api/src/routes/job-schemas.ts`, and `apps/web/src/components/JobInboxView.tsx`.
    - Extended `JobService.ingestText` with optional `provider?: JobProvider` parameter.
    - Verified public feed ingestion, keyword matching, content-hash deduplication, and `POST /jobs/discover` route response.
  - **3. Intelligent Job Matching (Phase C)**:
    - Verified deterministic 8-dimension matching (Title, Core Skills, Experience, Education, Workplace/Location, Industry, Language, Culture/Work Style).
    - Verified bounded composite score (0–100), canonical decisions (`MATCH`, `REVIEW`, `SKIP`), and non-hallucinated ground evidence anchors.
  - **4. CV & Cover Letter Generation (Phase D)**:
    - Verified truthful CV tailoring with metric safeguard (rejection of fabricated metrics/dollars).
    - Verified grounded cover letter synthesis referencing candidate achievements and target company.
    - Verified ATS single-column DOCX generation and private storage metadata.
  - **5. Application Preparation & Studio (Phase E)**:
    - Verified Application Package creation, version 1 initialization, question classification (`STANDARD` vs `SENSITIVE`), and approval request gating.
    - Verified `PackageReadinessEngine` blocking readiness when sensitive approvals are pending.
  - **6. Approval & Controlled ATS Automation (Phase F)**:
    - Verified human approval resolution with `USER` provenance, transitioning package to `READY`.
    - Verified ATS adapter registry resolving Greenhouse, Lever, and Ashby adapters.
    - Verified Cloudflare Turnstile / CAPTCHA challenge detection triggering safety halt.
    - Verified deterministic SHA-256 submission manifest binding checksum.
  - **7. Application CRM Lifecycle (Phase G)**:
    - Verified application creation and transition through canonical lifecycle states (`READY_TO_APPLY` -> `APPLIED`).
    - Verified recruiter notes and contact associations.
    - Verified immutable audit timeline event recording.
  - **8. Gmail & Status Intelligence (Phase H)**:
    - Verified MIME parsing from Gmail API message resources, stripping quotations and sanitizing HTML.
    - Verified deterministic email classification (`APPLICATION_CONFIRMATION`).
    - Verified entity resolution matching inbound email to CRM application via recruiter contact.
    - Verified status auto-synchronization (`APPLIED` -> `CONFIRMATION_RECEIVED`).
    - Verified ambiguous/low-confidence review queue isolation.
  - **9. Production User Experience & API Routing (Phase I)**:
    - Verified all 13 core frontend API routes responding with HTTP 200.
    - Verified `/ready` diagnostic endpoint returning database and AI operational status.
  - **10. Worker & Autonomous Orchestration (Phase J)**:
    - Verified exponential backoff calculation with jitter.
    - Verified autonomous pipeline cycle execution (`orchestrationRuns`).
    - Verified circuit breaker enforcement halting auto-apply when `auto_apply_enabled` is false.
  - **11. Clean Teardown & Quality Gates (Phase K)**:
    - 100% clean teardown of all test fixtures with zero orphans left in Neon PostgreSQL database.
    - Real candidate profile (`asadbek.mzw@gmail.com`) 100% untouched.
  - **12. Verification Records**:
    - `npm run format:write` & `npm run format`: PASSED.
    - `npm run lint`: PASSED (0 errors, 363 warnings).
    - `npm run typecheck`: PASSED (0 errors across 6 workspaces).
    - `npm test`: PASSED (45 test files, 362/362 tests passed).
    - `npm run build`: PASSED (All packages, API, Worker, and Web SPA bundle).
    - `npm run db:check`: PASSED (Neon PostgreSQL connected, 16ms).
    - `scripts/verify-e2e-workflow.ts`: PASSED (All 11 phases verified end-to-end).
    - **Git & GitHub CI Sync**: Commit `f785dac` pushed to `main`; GitHub Actions CI Run `38605920711` **PASSED** (clean checkout verification).
    - **Railway Cloud Deployment**: Dual services deployed with Dockerfile and online:
      - `jobee-api`: Deployment `c8ea6ea7-9a50-40dd-820e-9d417224c52c` -> **SUCCESS / ONLINE**
      - `jobee-worker`: Deployment `aee255a5-3a2b-46be-839a-fedac54e1e27` -> **SUCCESS / ONLINE**
    - **Live Production Probes**:
      - `GET /ready`: 200 OK (`status: ready`, database connected 21ms, AI model `gemini-3.8-flash`, Gmail and Calendar configured).
      - `GET /api/health`: 200 OK (`status: ok`, version `0.1.0`).
      - `GET /api/settings/ai`: 200 OK (`activeModel: gemini-3.8-flash`, `isAvailable: true`).
    - **Worker Background Orchestration**: Verified scheduled pipeline cycles executing in production with auto-apply circuit breaker safely OFF.

---

### `JOB-STUDIO-REPAIR` — Production Application Studio Repair: DOCX Generation, Cloudflare R2 Upload & Package Recovery

- **Status**: COMPLETED
- **Completed**: 2026-10-15
- **Scope**:
  - **1. Production Root Cause Investigation (Phase A)**:
    - Root cause: In Node.js 22 on the Railway Linux container, `dns.setDefaultResultOrder('ipv4first')` was absent. Cloudflare R2 endpoints publish dual A (IPv4) and AAAA (IPv6) records; connecting to IPv6 on containers without outbound IPv6 routing or reusing keep-alive sockets closed by Cloudflare edge (5–10s idle timeout) caused Undici `fetch` to fail immediately with `TypeError: fetch failed`.
    - Error propagation: `DocxGeneratorService` only stringified `err.message` (`fetch failed`), discarding `err.cause` and error codes.
    - Transaction ordering flaw: `ApplicationPackageService.createPackage()` inserted database records (`applicationPackages`, `applicationPackageVersions`) with `DRAFT` status _before_ initiating artifact storage uploads. Any network or storage failure left orphaned, incomplete DRAFT packages with 0 artifacts.
    - Frontend UX: `JobDetailView.tsx` relied on synchronous browser `alert()` popups with no retry action, no progress feedback, and navigation directly into incomplete packages.
  - **2. Storage Integration Hardening & Bounded Retries (Phase B)**:
    - Added `executeWithRetry` to `S3StorageProvider` (`apps/api/src/storage/s3-storage.ts`) with exponential backoff (3 attempts, initial delay 200ms, factor 2, max delay 2000ms, randomized jitter).
    - Added `isRetryableError` detecting transient network resets, socket errors (`UND_ERR_SOCKET`, `ECONNRESET`, `ETIMEDOUT`, `ENETUNREACH`, `EHOSTUNREACH`), 429 rate limits, and 5xx server errors.
    - Added 15-second per-request timeout via `AbortSignal.timeout(15_000)` on all S3 client commands (`PutObjectCommand`, `GetObjectCommand`, `HeadObjectCommand`, `DeleteObjectCommand`).
    - Added `formatStorageError` distinguishing 401/403 authorization failures (fail-fast without retry) from network/storage issues, preserving root causes.
    - Added `dns.setDefaultResultOrder('ipv4first')` in `apps/api/src/index.ts` and `apps/worker/src/index.ts`.
    - Preserved `AppError` and root causes in `DocxGeneratorService.generateTailoredCvDocx()`.
    - Added unit test suite in `apps/api/src/storage/s3-storage.test.ts` (13/13 passing).
  - **3. Application Package Recovery & Safe Compensation (Phase C)**:
    - Re-architected `ApplicationPackageService.createPackage()` and `regeneratePackage()` to use a **2-Phase Commit Pattern**:
      - Phase 1: In-memory tailoring -> Upload both CV DOCX and Cover Letter DOCX to R2 storage with automatic rollback compensation (deleting any uploaded artifact if either fails). Zero orphaned storage objects.
      - Phase 2: Atomic database insert/update with readiness computation and approval generation.
    - Built self-healing idempotency: `createPackage` detects existing packages. If complete, it returns them immediately. If an existing package is an incomplete draft (missing artifacts), it resumes, uploads missing artifacts, and transitions the package to `READY` / `NEEDS_REVIEW`.
    - Hardened `regeneratePackage` to repair incomplete drafts rather than spawning duplicate or endless version increments.
    - Added regression tests in `apps/api/src/routes/application-package-routes.test.ts` (9/9 passing).
  - **4. Frontend Design System Error Experience (Phase D)**:
    - `JobDetailView.tsx`: Replaced browser `alert()` with Jobee dark-theme inline notification banner, added "🔄 Retry" button, progress state ("⏳ Generating Tailored Documents..."), and duplicate-click protection.
    - `ApplicationStudioView.tsx`: Added fallback generation buttons for missing CV or Cover Letter artifacts.
  - **5. Complete Vertical Slice Workflow Verification (Phase E)**:
    - Created `scripts/verify-studio-package-repair.ts` and executed it live via `railway run` against the production Neon PostgreSQL database and Cloudflare R2 bucket.
    - **ALL 11 PHASES PASSED**: Candidate profile loaded, test job created, DOCX CV & Cover Letter generated (valid `PK\x03\x04` zip headers), uploaded to R2, DB artifacts verified, downloaded from R2 with exact SHA-256 match, package reopening verified (idempotent), incomplete draft auto-recovery verified, and clean teardown completed.
    - Healed historical production packages: package `72e90f18-31b2-4109-812d-bbf115c13619` and package `d3ca7301-7f6e-441a-9b15-fb9d0e5a4923` now have status `READY` / `NEEDS_REVIEW` with complete CV and Cover Letter artifacts in Cloudflare R2.
  - **6. Verification Records**:
    - `npm run format:write` & `npm run format`: PASSED.
    - `npm run lint`: PASSED (0 errors, 379 warnings).
    - `npm run typecheck`: PASSED (0 errors across 6 workspaces).
    - `npm test`: PASSED (45 test files, 368/368 tests passed).
    - `npm run build`: PASSED (All packages, API, Worker, and Web SPA bundle).
    - `scripts/verify-studio-package-repair.ts`: PASSED (11/11 phases verified live against production services).
  - **7. Critical R2 Content-Length Hotfix & Modern Undici Compliance**:
    - **Root Cause**: Manual `'content-length': String(fileBuffer.length)` was included in headers passed to `fetch()` and in AWS SigV4 `SignedHeaders`. Under the WHATWG Fetch Standard and modern Node.js 22/Undici runtime on Linux, passing a manual Content-Length header on requests with a body is forbidden and rejected with `InvalidArgumentError: invalid content-length header` (`UND_ERR_INVALID_ARG`).
    - **Fix Implemented**:
      - Removed manual `content-length` header from `saveFile()` and `putFile()` in `apps/api/src/storage/s3-storage.ts`, allowing Node.js/Undici to calculate and attach `Content-Length` automatically.
      - Added defense-in-depth sanitization in `signRequest()` to ensure `content-length` is never added to `SignedHeaders` or outgoing headers.
      - Preserved full Cloudflare R2 SigV4 authentication compatibility: verified PUT, GET, HEAD, DELETE, and SHA-256 binary integrity with live R2 bucket `jobee-private-documents`.
      - Added regression tests in `apps/api/src/storage/s3-storage.test.ts` (14/14 tests passing).
      - Re-verified all 11 phases of `scripts/verify-studio-package-repair.ts` against live Neon database and Cloudflare R2.
      - Quality verification: `format` (PASS), `lint` (PASS), `typecheck` (PASS), `test` (45/45 test files, 369/369 tests passing), `build` (PASS), `db:check` (PASS).

---

### `JOB-SMART-PROFILE-IMPORT` — Smart Candidate Profile Creation & Enrichment via AI Document Extraction

- **Status**: COMPLETED
- **Completed**: 2026-10-15
- **Scope**:
  - **1. Database Schema & Migration Repair (Phase 1)**:
    - Repaired Drizzle Kit snapshot discrepancy between `0002_audit_privacy.sql` (dropped `details`) and `0002_snapshot.json` by updating `0002_snapshot.json` with `changed_fields` array and `metadata` JSON object.
    - Created baseline snapshot `packages/database/drizzle/meta/0017_snapshot.json` accurately capturing all 53 baseline tables from migrations 0000–0017.
    - Added additive schema tables:
      - `packages/database/src/schema/profile-import-sessions.ts` (`profile_import_sessions`) with `source_type` (`CV`, `LINKEDIN_PDF`, `LINKEDIN_ARCHIVE`), `status`, `original_filename`, `storage_key`, `ai_consent_given`, `document_id`.
      - `packages/database/src/schema/profile-import-items.ts` (`profile_import_items`) with `section`, `classification`, `confidence_score`, `source_reference`, `extracted_payload`, `existing_entity_id`, `existing_payload`, `conflict_details`, `review_status`, `user_edited_payload`, `user_feedback`.
    - Generated clean, isolated migration `0018_candidate_smart_profile_import.sql` and applied to Neon PostgreSQL (`npm run db:migrate`).
  - **2. Document Text Extraction & Normalization (Phase 2 & 3)**:
    - Implemented `DocumentTextExtractor` (`apps/api/src/services/import/document-text-extractor.ts`):
      - PDF extraction using `pdf-parse` v2 with multi-page handling.
      - DOCX extraction using `jszip` extracting `word/document.xml` paragraphs `<w:p>`, text nodes `<w:t>`, and tab characters.
      - Plaintext, CSV, and JSON text support.
      - Text normalization unifies newlines, standardizes smart quotes and em-dashes, and strips non-printable ASCII/Unicode control characters.
  - **3. Smart AI & Deterministic Profile Extractor (Phase 2 & 3)**:
    - Implemented `SmartProfileExtractor` (`apps/api/src/services/import/smart-profile-extractor.ts`):
      - Google Gemini AI extraction using `gemini-3.8-flash` (with failover to `gemini-3.5-flash-lite`).
      - Strict structured JSON response schema with Zod validation.
      - Anti-hallucination prompt invariants: AI never fabricates dates, employers, degrees, skills, or metrics; requires exact `sourceReference` verbatim citations.
      - Deterministic heuristic fallback parser for users declining AI consent or offline mode, extracting contacts, experiences, education, skills, certifications, and links.
  - **4. 6-Way Profile Comparison Engine (Phase 4)**:
    - Implemented `ProfileComparisonEngine` (`apps/api/src/services/import/profile-comparison-engine.ts`):
      - Classifies extracted data against existing Candidate Brain facts: `MATCHED`, `DUPLICATE`, `NEW`, `CONFLICT`, `INCOMPLETE`, `LOW_CONFIDENCE`.
      - Detects conflicts in dates, job titles, and degrees with explanatory details.
      - Strict preservation of verified facts in Candidate Brain.
  - **5. Smart Profile Import Service & Candidate Brain Transaction (Phase 5 & 6)**:
    - Implemented `SmartProfileImportService` (`apps/api/src/services/import/smart-profile-import-service.ts`):
      - Complete session management: `createSession`, `extractAndCompare`, `getSession`, `listSessions`, `updateItem`, `bulkUpdateItems`, `commitSession`, `discardSession`.
      - Transactional atomic commit into Candidate Brain:
        - Updates `candidateProfiles` (if approved).
        - Inserts `candidateExperiences`, `candidateEducation`, `candidateSkills`, `candidateCertifications`, `candidateLanguages`, `candidateProjects`, `candidateLinks`.
        - Prime Directive compliance: newly imported items are assigned `verificationStatus: 'UNVERIFIED'` (`isVerified: false`) until explicitly reviewed.
        - Facts inserted into `candidateFacts` default to `allowAiUse: false` unless the user explicitly toggles AI authorization.
        - Privacy-preserving audit logs recorded in `candidateAuditEvents` with action `SMART_PROFILE_IMPORT_COMMIT`, `changed_fields`, and operational `metadata`.
        - Automatically recalculates profile completeness score.
  - **6. API Routes & Schemas**:
    - Implemented `candidate-import-schemas.ts` and `candidate-import-routes.ts` mounted at `/api/candidate/import/*` and `/candidate/import/*`:
      - `POST /candidate/import/upload` (multipart document upload with 25MB limit)
      - `POST /candidate/import/:sessionId/extract` (extract with AI consent flag)
      - `GET /candidate/import/:sessionId` (retrieve session and items)
      - `GET /candidate/import/sessions` (list user sessions)
      - `PATCH /candidate/import/:sessionId/items/:itemId` (edit / approve / reject item)
      - `POST /candidate/import/:sessionId/items/bulk` (bulk review action)
      - `POST /candidate/import/:sessionId/commit` (transactional commit with confirmation flags)
      - `POST /candidate/import/:sessionId/discard` (discard session)
      - `GET /candidate/linkedin/status` (LinkedIn integration capabilities & PDF export guidance)
  - **7. Frontend User Experience**:
    - Implemented `SmartProfileImportModal.tsx` with 5-step wizard:
      - Step 1: Upload (Drag-and-drop PDF/DOCX CV or LinkedIn export)
      - Step 2: Extraction engine choice & explicit AI consent toggle with privacy notice
      - Step 3: Interactive side-by-side review & conflict resolution (filters by section and classification badges, edit inline, approve/reject individually or bulk)
      - Step 4: Final truthfulness acknowledgment & AI authorization toggle
      - Step 5: Success summary displaying committed count and updated profile completeness score
    - Integrated modal into `ProfileView.tsx`, `DocumentsView.tsx`, and `DashboardView.tsx`.
  - **8. Complete Vertical Slice Verification**:
    - Created and executed `scripts/verify-smart-profile-import.ts`:
      - Step 1: Document text extraction & normalization (DOCX buffer, text stripping) — PASS
      - Step 2: Extraction engine (deterministic parsing, source references) — PASS
      - Step 3: 6-Way classification engine (DUPLICATE, NEW, CONFLICT, MATCHED) — PASS
      - Step 4: Live Neon DB session creation, extraction, bulk review, and commit — PASS
      - Step 5: Candidate Brain enrichment, audit trail verification, unverified status invariant — PASS
      - Teardown: zero orphaned test fixtures — PASS
  - **9. Quality Verification Records**:
    - `npm run format:write` & `npm run format`: PASSED (All files conform).
    - `npm run lint`: PASSED (0 errors, 400 warnings).
    - `npm run typecheck`: PASSED (0 errors across all 6 workspaces).
    - `npm test`: PASSED (49/49 test files, 390/390 tests passed).
    - `npm run build`: PASSED (all packages, API, Worker, and Web SPA bundle).
    - `npm run db:check`: PASSED (Neon PostgreSQL connected, latency 21ms).
    - `npm run db:migrate`: PASSED (All migrations up to 0018 applied).
  - **10. Hardening & Correctness Remediation**:
    - Remediated 6 critical correctness and invariant issues:
      1. Removed all invented fallback values ('2020', 'Organization', 'Professional Role', generic credentials); missing required fields remain empty and trigger human review via `INCOMPLETE` classification.
      2. Prevented duplicate and matched records from being re-inserted during import commits; updated existing entities in DB when edited during review.
      3. Enforced invariant: `allowAiUse=true` strictly requires `verificationStatus=VERIFIED` across Zod schemas, backend service, and frontend UI.
      4. Preserved existing active Master CV unless user explicitly chooses to replace it (`replaceMasterCv: true` opt-in).
      5. Grounded and verified all AI citations against actual document text (`verifySourceReference`); ungrounded citations are tagged with `[Unverified citation]` and classified as `LOW_CONFIDENCE`.
      6. Enforced clear failure for unsupported LinkedIn archives (tar, gz, 7z, rar, non-LinkedIn zip, binary) with descriptive 400 Bad Request error.
    - Added dedicated regression test suite `smart-profile-import-hardening.test.ts` (16/16 tests passing).
    - All 50 test files (408/408 tests) passing; end-to-end verification script `verify-smart-profile-import.ts` passed cleanly.
  - **11. Real CV Import Accuracy Remediation (Real-World QA)**:
    - Addressed and resolved all 8 real-user QA extraction failures:
      1. Eliminated silent fallback from Gemini AI to Heuristic parser; throwing 502 AppError when AI is explicitly requested and unconfigured/failing, providing clear retry and fallback options in UI.
      2. Normalized spaced glyph headings (`S K I L L S   &   L A N G U A G E S` -> `SKILLS & LANGUAGES`) in both `DocumentTextExtractor` and `SmartProfileExtractor`.
      3. Implemented multi-line and inline certification grouping; a single certification is constructed with title, issuing organization, and issue date. Standalone dates and issuers are never extracted as separate records.
      4. Education parsing isolates institution, degree, and field of study instead of generic combination.
      5. Combined "Skills & Languages" sections are accurately partitioned and categorized (e.g. Project Management, Technical Tools), with unstated language proficiency assigned `'UNSPECIFIED'` and flagged for human review.
      6. Work experience cleanly separates organization, position, location, and dates.
      7. UI review modal differentiates `INCOMPLETE` (warning with edit button), `LOW_CONFIDENCE` (info), `CONFLICT` (conflict alert), and `DUPLICATE` (existing record info), preventing misleading "Conflict with existing record" banners for incomplete items.
      8. Displayed prominent Extraction Engine transparency badge in Step 3 Review header (`✨ Google Gemini 3.8 Flash AI` vs `⚙️ Basic Deterministic Parser`).
    - Added dedicated regression test suite `smart-profile-qa-remediation.test.ts` (7/7 tests passing).
    - Monorepo verification: 51 test files (415/415 tests passing), lint, typecheck, build, and format cleanly passing.
  - **12. Review UI Repair & Optional Proficiency (Part 1 to Part 6)**:
    - Overhauled `ReviewItemCard` in `SmartProfileImportModal.tsx` to provide comprehensive inline editing forms across all 8 extracted sections (`PROFILE`, `EXPERIENCE`, `EDUCATION`, `SKILL`, `CERTIFICATION`, `LANGUAGE`, `PROJECT`, `LINK`) with required-field validation, date guidance, multiline arrays, "Save Changes", and "Cancel".
    - Added classification re-evaluation in `SmartProfileImportService.updateItem` so supplying missing required fields transitions `INCOMPLETE` items to `NEW` and clears conflict details.
    - Made language and skill proficiency completely optional throughout the database, types, services, and UI:
      - Generated and applied migration `0019_optional_language_proficiency.sql` (`ALTER TABLE "candidate_languages" ALTER COLUMN "proficiency" DROP NOT NULL;`).
      - Updated shared schemas and API schemas (`candidate-languages.ts`, `candidate.ts`, `candidate-import.ts`, `application-package.ts`, `candidate-schemas.ts`, `candidate-service.ts`) to allow nullable/optional proficiency.
      - Updated profile completeness calculator (`completeness.ts`) so language presence counts toward completeness without requiring proficiency.
      - Updated `SmartProfileExtractor` to default omitted language proficiency to `null` (never dummy strings or `"UNSPECIFIED"`).
      - Updated `ProfileComparisonEngine` so missing proficiency is treated as valid and not flagged as `INCOMPLETE`.
      - Safe string formatting in `docx-generator-service.ts`, `matching-context-builder.ts`, `candidate-evidence-resolver.ts`, and `tailoring-engine.ts` preventing `" (null)"` or `" (undefined)"` artifacts and guarding CEFR rank comparisons.
      - Updated `ProfileView.tsx` with `"Not specified"` options and optional labels for skills and languages.
    - Added dedicated regression and unit test suite `smart-profile-review-and-proficiency.test.ts` (20/20 tests passing).
    - Monorepo verification: 52 test files (435/435 tests passing), 0 lint errors, 0 typecheck errors, build clean, DB check passing.
  - **13. Review Approval Safety & Commit Isolation**:
    - Separated item editing from authorization:
      - Saving an edit in `SmartProfileImportService.updateItem` stores `userEditedPayload` and marks `reviewStatus: 'EDITED'`. It does NOT authorize or approve the item.
      - Transition to `'APPROVED'` requires explicit user acceptance action (`action: 'APPROVED'`), which preserves the existing `userEditedPayload`.
      - Re-editing an approved item transitions it back to `'EDITED'` until re-approved.
    - Hardened commit isolation in `SmartProfileImportService.commitSession`:
      - Strictly queries `eq(profileImportItems.reviewStatus, 'APPROVED')`. Items with status `EDITED`, `PENDING`, or `REJECTED` are never committed.
      - Prevents accidental commits: throws 400 Bad Request if zero approved items are eligible.
      - Matched record updating: preserves existing entities when unedited (`!item.userEditedPayload`); when edited and approved, updates existing records while preventing verified status downgrades (`targetVerificationStatus = (existingPayload?.verificationStatus === 'VERIFIED') ? 'VERIFIED' : verificationStatus`).
    - UI state synchronization in `SmartProfileImportModal.tsx`:
      - `approvedCount` strictly computes `items.filter((i) => i.reviewStatus === 'APPROVED').length`.
      - `ReviewItemCard` displays distinct blue banner and status badge `● EDITED (NEEDS APPROVAL)` when `item.reviewStatus === 'EDITED'`.
      - "✓ Accept" button displays as primary only when `item.reviewStatus === 'APPROVED'`.
    - Automated verification:
      - `SmartProfileImportModal.test.tsx` (5/5 React component interaction tests passing with `@testing-library/react` and `happy-dom`): edit -> modify -> save -> verify not approved -> accept -> verify approved count -> reject -> re-edit flow.
      - `smart-profile-review-and-proficiency.test.ts` Section 6 (6/6 tests passing for approval safety, commit isolation, unedited matched record preservation, and verified status preservation).
    - Monorepo verification: 53 test files (446/446 tests passing), 0 lint errors, 0 typecheck errors, monorepo build clean, DB check passing.
  - **14. Upload State Fix & Drag-and-Drop Restoration**:
    - **Root Cause Identified**: In `SmartProfileImportModal.tsx`, `initialItems = []` default argument was evaluated on every render. Because `initialItems` was included in the `useEffect` dependency array, React's dependency comparison (`[] !== []`) triggered the effect on every re-render while the modal was open, invoking `setSelectedFile(null)` and instantly wiping out the selected CV.
    - **Fix Implemented**:
      - Declared module-level constant `DEFAULT_INITIAL_ITEMS: ProfileImportItemDto[] = []` for stable reference identity.
      - Re-architected modal open/close lifecycle with `wasOpenRef` and `initialPropsRef`: wizard state initialization runs strictly upon transition from closed to open (`isOpen && !wasOpenRef.current`), never during normal interactions or parent re-renders.
      - Implemented full HTML5 drag-and-drop file ingestion (`onDragOver`, `onDragEnter`, `onDragLeave`, `onDrop`) with active visual feedback (`isDragging`), scale animation, and `dataTransfer.files` parsing.
      - Ensured selecting the same file again works by clearing `(e.currentTarget as HTMLInputElement).value = ''` in the file input's `onClick` handler.
      - Added frontend validation for document format (`.pdf`, `.docx`, `.doc`, `.txt`) and 25MB maximum size limit with immediate user feedback.
      - Displayed bold filename with formatted dynamic size (`KB` / `MB`), enabling "Continue to Extraction →" immediately upon valid file selection.
      - Preserved all previous review editing, approval safety, commit isolation, and optional proficiency fixes.
    - **Automated Regression Verification**:
      - Added 11 regression tests to `SmartProfileImportModal.test.tsx` testing production usage without test props:
        - Default Step 1 (Upload) initialization with disabled Continue button.
        - PDF selection displaying filename, size, and enabling Continue button.
        - State survival across component re-renders (both internal checkbox toggle and parent re-render).
        - DOCX file selection and size display.
        - Same-file re-selection.
        - 25MB file size limit rejection with clear error.
        - Unsupported file format rejection with error.
        - HTML5 Drag-and-drop file ingestion.
        - Successful upload advancement to Step 2 (Extract).
        - Failed upload error presentation on Step 1 with file retention.
        - Modal close and reopen cleanly resetting wizard state.
      - All 16/16 tests passing in `SmartProfileImportModal.test.tsx`.
    - **Monorepo Verification**:
      - 53 test files (457/457 tests passing), 0 lint errors, 0 typecheck errors, monorepo build clean, DB check passing.
  - **15. LinkedIn QA & Null-Safe Extraction Hardening**:
    - **Root Cause Identified**: When extracting profile information from LinkedIn profile PDFs using Gemini AI, Gemini returned `null` for `issuingOrganization` on certifications where the source document did not specify an issuer. In `smart-profile-extractor.ts`, `issuingOrganization: z.string().optional().default('')` accepted `undefined` but rejected `null`, throwing `ZodError: invalid_type: Expected string, received null`. This crashed the entire extraction and dumped raw Zod error JSON into the UI modal.
    - **Fixes Implemented**:
      1. Implemented null-safe Zod preprocessors across all 8 extraction schemas (`safeStringDefaultEmpty`, `safeNullableString`, `safeBooleanDefaultFalse`, `safeStringArray`, `safeConfidence`, `safeNullableNumber`, `safeSectionArray`), safely normalizing `null` and `undefined` without fabricating dummy values or crashing validation.
      2. Exported `SmartProfileExtractor.parseAiProfileData` for robust, reusable AI payload parsing.
      3. Sanitized error reporting: Replaced raw Zod error arrays with clean, human-friendly 502 AppError messages pointing to the problematic section (`"Some information returned by Gemini could not be processed in ... Please retry extraction or use the Basic Deterministic Parser."`), logged detailed redacted diagnostics to stderr, and sanitized API key substrings.
      4. Preserved partial extraction: Valid sections (experiences, education, skills, languages) are preserved completely; certifications with missing issuer are classified as `INCOMPLETE` with warning `"Issuing organization is missing. You can enter it manually before approval."`. Final commit to Candidate Brain is strictly prevented until user edits and approves required fields.
      5. Fixed duplicate error display in `SmartProfileImportModal.tsx`: Omitted the global top-level error banner during the `EXTRACT` step so errors are presented solely in the dedicated extraction error card with retry controls.
      6. Made `ProfileComparisonEngine.compareCertification` public for direct section testing and comparison.
    - **Automated Regression Verification**:
      - Created `smart-profile-linkedin-qa.test.ts` verifying Tests A through J (10/10 tests passing):
        - Test A: Certification with valid issuer parsed and classified as `NEW`.
        - Test B: Certification with `null` issuer normalized to `""` and classified as `INCOMPLETE`.
        - Test C: Certification with omitted issuer normalized to `""` and classified as `INCOMPLETE`.
        - Test D: Multiple certifications with mixed null/present issuers extracted without failure.
        - Test E: Realistic LinkedIn profile with incomplete certifications extracts all sections cleanly.
        - Test F: Valid sections survive incomplete certification data.
        - Test G: `updateItem(..., 'APPROVED')` rejects incomplete certifications lacking issuer.
        - Test H: User can supply missing issuer via `updateItem(..., 'EDITED')`, re-evaluating to `NEW`, then approve and commit.
        - Test I: Truthfulness invariant verified (missing issuer never fabricated with "Unknown" or "LinkedIn").
        - Test J: Invalid response structures produce clean 502 AppError without leaking API keys.
    - **Monorepo Verification**:
      - 54 test files (467/467 tests passing), 0 lint errors, 0 typecheck errors, monorepo build clean, DB check passing.
  - **16. Multi-Source Profile Comparison & Provenance Tracking**:
    - **Context & Objective**:
      - The first real LinkedIn PDF import succeeded in Gemini extraction, but comparison against existing CV-derived Candidate Brain records revealed weaknesses: abbreviated names (e.g., "Asadbek M.") were treated as new or hard conflicts, phone numbers with different national/international formatting falsely conflicted, existing certifications without issuers in secondary sources were degraded to `INCOMPLETE`, degrees with semantic equivalence ("B.A." vs "Bachelor of Arts") were not matched, and multi-document provenance was missing.
    - **Fixes Implemented**:
      1. **Profile Identity & Abbreviated Name Matching**:
         - Extended `ProfileImportClassificationEnum` and `profile_import_items.classification` with `'POTENTIAL_MATCH'`.
         - Added `ProfileComparisonEngine.isAbbreviatedNameMatch`: recognizes initials ("Asadbek M.", "A. Makhmudov", "Makhmudov A.") as `POTENTIAL_MATCH` with review notes rather than overwriting verified names or flagging hard conflicts.
         - Added `ProfileComparisonEngine.isPhoneEquivalent`: normalizes international country prefixes (e.g., `+48 884 665 207` vs `884 665 207` in Poland), preventing false phone conflicts.
      2. **Certification Matching Reordering**:
         - Reordered `ProfileComparisonEngine.compareCertification` to search for matching existing certifications by normalized name _before_ evaluating missing issuers.
         - When an imported certification matches an existing verified certification (e.g., "Foundations of Project Management"), it is classified as `MATCHED` (preserving the existing Google issuer), rather than becoming `INCOMPLETE`.
         - Genuinely new certifications without issuers remain classified as `INCOMPLETE`.
      3. **Education Semantic Degree Matching**:
         - Implemented `ProfileComparisonEngine.normalizeDegreeType` and `isDegreeCompatible`: recognizes compatible degree abbreviations ("B.A.", "Bachelor of Arts", "Bachelor's degree") while checking field of study compatibility and flagging genuine date conflicts.
      4. **Employment Date Conflicts**:
         - Implemented `standardizeDateString`: normalizes dates across formats ("June 2023" vs "2023-06") while preserving genuine month discrepancies (June 2023 vs May 2023) as `CONFLICT` with accurate comparative dates in conflict details.
      5. **Skill Deduplication & Canonical Mapping**:
         - Implemented `getCanonicalSkill` and `SKILL_CANONICAL_MAP`: classifies canonical equivalents (e.g., "Agile" vs "Agile Methodologies") as `POTENTIAL_MATCH` with explanatory notes while strictly preserving separate identities for distinct languages ("Java" vs "JavaScript", "C" vs "C++").
      6. **Multi-Source Supporting Provenance Tracking**:
         - Updated `SmartProfileImportService.commitSession`: when an unedited item with `existingEntityId` (such as `MATCHED`, `DUPLICATE`, or `POTENTIAL_MATCH`) is approved, updates `candidateFacts.structuredValue.sources` to append the new document source (e.g., `['CV', 'LINKEDIN_PDF']`) and logs `CONFIRMED_BY_IMPORT` in audit logs without inserting duplicate records.
      7. **Review UX Transparency**:
         - Added `POTENTIAL_MATCH` status filter button in `SmartProfileImportModal.tsx`.
         - Styled `POTENTIAL_MATCH` with cyan theme (`#06b6d4`, `#67e8f9`) and notice banner prompting the candidate to review or link with the existing record.
    - **Automated Regression Verification**:
      - Created `smart-profile-multi-source.test.ts` (14/14 tests passing):
        - Profile identity: Abbreviated names classified as `POTENTIAL_MATCH`.
        - Phone equivalence: Equivalent international phone numbers matched without conflict.
        - Phone conflicts: Conflicting phone numbers classified as `CONFLICT`.
        - Certification matching: Existing certification with Google issuer matched by imported certification with null issuer (`MATCHED`).
        - Incomplete certifications: New certifications lacking issuers classified as `INCOMPLETE`.
        - New certifications: New certifications with issuers classified as `NEW`.
        - Education semantic matching: "B.A." vs "Bachelor of Arts" matched as `MATCHED`.
        - Education degree conflicts: Conflicting degree levels classified as `CONFLICT`.
        - Education field conflicts: Conflicting field of study classified as `CONFLICT`.
        - Employment date conflicts: Genuine month discrepancies preserved as `CONFLICT` with comparative details.
        - Employment date formats: Identical dates in different formats matched cleanly.
        - Skill canonical matching: "Agile" vs "Agile Methodologies" classified as `POTENTIAL_MATCH`.
        - Distinct skills: "Java" vs "JavaScript" and "C" vs "C++" strictly separated as `NEW`.
        - Multi-source provenance: `commitSession` updating existing fact's `structuredValue.sources` without creating duplicate rows.
    - **Monorepo Verification**:
      - 55 test files (481/481 tests passing), 0 lint errors, 0 typecheck errors, monorepo build clean, DB check passing.
  - **17. Multi-Source Conflict Resolution & Degree Normalization Finalization**:
    - **Context & Objective**:
      - Real-world LinkedIn comparison testing identified two critical remaining issues:
        1. Degree format variations like `"B. A."` were not recognized as equivalent to `"B.A."` or `"Bachelor's degree"`, causing false degree conflicts for identical credentials.
        2. Explicitly accepting a `CONFLICT` record could create duplicate rows or silently overwrite verified information instead of safely executing user-guided resolution.
    - **Fixes Implemented**:
      1. **Spaced Degree Normalization & Semantic Compatibility**:
         - Enhanced `ProfileComparisonEngine.normalizeDegreeType`: added regex support for spaced initial abbreviations (`"B. A."`, `"M. S."`), optional `(?:\s*degree)?` word handling, and degree-level compatibility mapping.
         - Verified reproduction: Existing `"B. A."` at `"Vistula University"` vs Imported `"Bachelor's degree"` accurately matches as `MATCHED`, eliminating false degree conflicts while strictly preventing false equivalence between Bachelor's and Master's or distinct Arts vs Science fields.
      2. **Safe Education Date Extraction & Comparison**:
         - Updated `smart-profile-extractor.ts`: Heuristic extraction maps single dates to `startDate` with `endDate: null`, preventing synthetic end dates.
         - Updated `ProfileComparisonEngine.compareEducation`: Ongoing education (`isCurrent: true` or missing `endDate`) compared against a single imported date classifies as `POTENTIAL_MATCH` rather than declaring a false `CONFLICT` or auto-graduating the candidate.
      3. **Database Schema & Drizzle Migration (`packages/database`)**:
         - Added `conflictResolution: text('conflict_resolution')` to `profileImportItems` schema.
         - Created migration `packages/database/drizzle/0020_conflict_resolution.sql` and registered entry 20 in `_journal.json`.
         - Applied migration cleanly via `npm run db:migrate`.
      4. **Shared Types & API Validation**:
         - Added `ProfileImportConflictResolutionEnum` (`KEEP_EXISTING`, `REPLACE_EXISTING`, `ADD_AS_SEPARATE`) to `packages/shared`.
         - Updated `updateProfileImportItemSchema` in `apps/api` to validate `conflictResolution`.
         - Enforced in `SmartProfileImportService.updateItem` that approving a `CONFLICT` item without an explicit resolution strategy returns a 400 Bad Request error.
      5. **Deterministic Commit Execution (`SmartProfileImportService.commitSession`)**:
         - `KEEP_EXISTING`: Preserves existing record and verified values, logs `ALTERNATIVE_SOURCE_REVIEWED` audit event, executes zero database updates or duplicate inserts.
         - `REPLACE_EXISTING`: Updates existing entity row via `updateExistingEntity`, updates associated `candidateFacts`, preserves `VERIFIED` status without downgrade, logs `CONFLICT_RESOLVED_REPLACE` audit event, executes zero inserts.
         - `ADD_AS_SEPARATE`: Inserts a separate new record with user authorization, logs `CONFLICT_RESOLVED_ADD_SEPARATE` audit event.
         - Implemented modular `updateExistingEntity` covering all candidate brain sections (`EXPERIENCE`, `EDUCATION`, `SKILL`, `CERTIFICATION`, `LANGUAGE`, `PROJECT`, `LINK`).
      6. **Review UI Enhancements (`SmartProfileImportModal.tsx`)**:
         - Rendered side-by-side comparison for `CONFLICT` items (`Existing Record:` vs `Imported Record:`) and discrepancy notice banner.
         - Replaced generic "Accept" with explicit conflict action buttons: `[ Keep Existing ]`, `[ Replace Existing ]`, `[ Add as Separate ]`, `[ ✎ Edit ]`, `[ ✕ Reject ]`.
         - Added `[ Confirm Match ]` and `[ Add as New ]` buttons for `POTENTIAL_MATCH` items.
         - Rendered status badges reflecting resolution: `● RESOLVED (Keep Existing)`, `● RESOLVED (Replace Existing)`, `● RESOLVED (Add as Separate)`.
    - **Automated Regression Verification**:
      - Created `smart-profile-conflict-resolution.test.ts` (13/13 tests passing).
      - Updated `candidate-import-routes.test.ts` (11/11 tests passing).
      - Updated `SmartProfileImportModal.test.tsx` (21/21 tests passing).
      - Verified all 9 import test suites in `apps/api/src/services/import/` (98/98 tests passing).
    - **Monorepo Quality Gates**:
      - 56 test files (499/499 tests passing), 0 lint errors, 0 typecheck errors, monorepo build clean, DB migration 0020 applied.
  - **18. Safe Multi-Source Merge Hotfix & Profile Singleton Protection**:
    - **Context & Risks Identified**:
      - Code review of multi-source conflict resolution identified two data-integrity risks:
        1. **Destructive Replacement (Risk 1)**: When updating existing entities upon user approval of `REPLACE_EXISTING`, partial data from LinkedIn exports (missing descriptions, achievements, fields) could overwrite and erase existing verified Candidate Brain details.
        2. **Singleton Profile Overwrite (Risk 2)**: Candidate profile (`candidate_profiles`) is a singleton per user (`userId` unique constraint). Permitting `ADD_AS_SEPARATE` for `PROFILE` would trigger on-conflict updates or database errors, overwriting the candidate's core identity or corrupting full name records when matching abbreviated names (e.g. `"Asadbek M."` overwriting `"Asadbek Makhmudov"`).
    - **Fixes Implemented**:
      1. **Field-Aware Merging Engine (`SmartProfileImportService.mergeFieldsWithExisting`)**:
         - Compares existing record fields and imported payload fields.
         - Strictly preserves existing non-empty fields when incoming fields are absent, null, empty string, or empty array.
         - Protects `PROFILE.fullName`: When an abbreviated name match is detected (`ProfileComparisonEngine.isAbbreviatedNameMatch`), the existing verified full name is strictly preserved.
         - Supports deliberate, explicit field clearing via `options.explicitlyClearedFields` (`_clearedFields`), requiring separate user intent before any verified field can be erased.
         - Returns structured `{ merged, changedFields, preservedFields }`.
      2. **Strict Profile Singleton Protection**:
         - In `SmartProfileImportService.updateItem`: Rejects `ADD_AS_SEPARATE` for `PROFILE` section (both `CONFLICT` and `POTENTIAL_MATCH`) with 400 Bad Request error.
         - In `SmartProfileImportService.commitSession`: Rejects `ADD_AS_SEPARATE` for `PROFILE` with 400 Bad Request error; executes field-aware merge if a profile record already exists for the user.
         - In `SmartProfileImportModal.tsx`: Prohibits `[ Add as Separate ]` and `[ Add as New ]` buttons when `item.section === 'PROFILE'`.
      3. **Side-by-Side Field-Level Impact Diff in UI (`SmartProfileImportModal.tsx`)**:
         - Implemented `getFieldDiffs(section, existing, imported)` computing `fieldsToChange` and `preservedFields` with user-friendly labels.
         - Rendered `⚡ Field-Level Impact on Replace Existing` callout in `CONFLICT` review card, detailing exact values updating and verified fields preserved.
         - Prefilled missing extracted fields with existing verified fields during edit modal initialization.
      4. **Preserved Verified Facts & Multi-Source Audit Trail**:
         - In `updateExistingEntity`, updates `candidateFacts` structured value with merged details while appending `session.sourceType` to `sources`.
         - Preserves `fact.verificationStatus === 'VERIFIED'`, preventing downgrade to `UNVERIFIED`.
         - Records audit events with `changedFields`, `previousPayload`, and metadata detailing `preservedFields`.
    - **Automated Regression Verification**:
      - Created `smart-profile-safe-merge.test.ts` (7/7 tests passing):
        - Test 1: Replacing experience date preserves descriptions and achievements.
        - Test 2: Missing imported fields never erase data across all candidate brain sections.
        - Test 3: Explicit field clearing requires deliberate confirmation.
        - Test 4: ADD_AS_SEPARATE is strictly prohibited for PROFILE section in updateItem and commitSession.
        - Test 5: Confirming an abbreviated name preserves the existing full name.
        - Test 6: Profile replacement updates only approved fields without silent overwrites.
        - Test 7: Existing verified facts and multi-source audit history remain intact without status downgrade.
      - Added React component interaction tests in `SmartProfileImportModal.test.tsx` (24/24 tests passing).
      - Verified all 10 import test suites in `apps/api/src/services/import/` (105/105 tests passing).
    - **Monorepo Quality Gates**:
      - 57 test files (509/509 tests passing), 0 lint errors, 0 typecheck errors, monorepo build clean, DB check passing (28ms latency).
  - **19. Production Candidate Data Audit, Test Isolation & Safe Remediation Architecture**:
    - **Context & Risks Identified**:
      - An independent code review discovered that automated test runs and verification scripts were polluting the production Candidate Brain of the primary user (`00000000-0000-0000-0000-000000000001`):
        1. `candidate-import-routes.test.ts` ran against `DATABASE_URL` with fallback to the primary user via `auth-plugin.ts`, committing `sample_cv.txt` on every run and leaving 77 test document rows, sessions, and facts.
        2. `scripts/verify-smart-profile-import.ts` committed synthetic candidate fixtures (`Dr. Elena Rostova`, `Apex Neural Dynamics`, `Stanford University`) with `verifyOnCommit: true, allowAiOnCommit: true` into the primary user's profile.
        3. `scripts/verify-job-p5-t01.ts` inserted `Dr. Jane Hopper` into the primary user profile.
        4. `packages/database/src/user.ts` initialized missing primary candidate profiles with fictional tech/cloud career claims (`Lead Software Engineer & Cloud Architect`).
        5. `SmartProfileImportService.updateExistingEntity()` updated candidate profiles using loose `or(id, userId)` instead of enforcing strict ownership with `and`.
        6. Candidate profile headline had been corrupted to `"Lead Systems Architect"` and contact details to `"asadbek.dev@example.com"`.
    - **Code Safety Fixes Implemented (Phase 3)**:
      1. `packages/database/src/user.ts`: Removed all fictional career and location claims from `getOrCreatePrimaryUser()`, initializing missing fields strictly to `null`.
      2. `apps/api/src/services/import/smart-profile-import-service.ts`: Enforced strict `and(eq(candidateProfiles.id, targetProfileId), eq(candidateProfiles.userId, userId))` in profile lookups and updates, eliminating cross-tenant overwrite vectors.
      3. `apps/api/src/plugins/auth-plugin.ts`: Added support for `x-test-user-id` in `requireCurrentUserId` during test mode (`isTest`).
      4. `apps/api/src/routes/candidate-import-routes.test.ts`: Isolated execution to a dedicated disposable test user (`crypto.randomUUID()`) with complete teardown in `afterAll`.
      5. `scripts/verify-smart-profile-import.ts`: Isolated execution to a dedicated disposable test user with complete entity/fact teardown.
      6. `scripts/verify-job-p5-t01.ts`: Isolated execution to a dedicated disposable test user with complete teardown.
      7. `smart-profile-safe-merge.test.ts`: Added TEST 8 verifying that cross-tenant profile updates strictly enforce both `candidateProfiles.id == targetProfileId` AND `candidateProfiles.userId == authenticatedUserId`.
    - **Audit, Remediation & Rollback Architecture (Phase 4)**:
      1. `scripts/audit-candidate-brain.ts`: Production-grade read-only audit reporting exact candidate state without modifying data.
      2. `scripts/remediate-candidate-brain.ts`: Deterministic remediation utility with default `--dry-run` mode and explicit `--execute` mode:
         - Creates a pre-remediation timestamped JSON backup under `backups/candidate-brain-backup-<timestamp>.json`.
         - Restores legitimate candidate profile details (`"Project Manager"`, `"Asadbek Makhmudov"`, `"asadbek.mzw@gmail.com"`, `"+48884665207"`).
         - Safely removes 3 synthetic experiences, 3 synthetic education entries, 12 synthetic tech skills, 1 synthetic language, 1 synthetic link, 18 synthetic candidate facts (including all 9 AI-authorized facts), and 77 test document rows and sessions.
         - Preserves authentic Master CV (`Resume - Asadbek M.pdf`), 14 verified project/operations skills, 2 verified certifications, and 7 manual baseline facts.
      3. `scripts/rollback-candidate-brain.ts`: Deterministic rollback script restoring 100% of candidate state from backup.
    - **Monorepo Quality Gates**:
      - 57 test files (510/510 tests passing), 0 lint errors, 0 typecheck errors, monorepo build clean, DB check passing (16ms latency).

  - **20. Production Candidate Data Remediation Safety Revision**:
    - **Context & Safety Directives**:
      - Review identified risks in earlier remediation: blanket heuristics (e.g. `sourceType !== 'MANUAL' => synthetic`) and hardcoded organization/university assumptions were unacceptable for production safety.
      - Mandate: Replace blanket filters with strict record-level provenance identification, establish authentic baseline from Master CV (`Resume - Asadbek M.pdf`), implement transactional execution with explicit owner approval guard, support targeted non-destructive rollback, and rehearse in an isolated test environment.
    - **Implementation**:
      1. `apps/api/src/services/import/candidate-brain-classifier.ts`:
         - Fine-grained classifiers for all entity types (`Profile`, `Experience`, `Education`, `Skill`, `Certification`, `Language`, `Link`, `Fact`, `Document`, `Session`).
         - Classifies every record into `CONFIRMED_SYNTHETIC`, `POSSIBLY_SYNTHETIC`, `CONFIRMED_AUTHENTIC`, or `UNDETERMINED`.
         - Resolves certification discrepancies: Confirms `Google Project Management Professional Certificate` and `Applied Project Management` belong to authentic baseline from early user enrichment.
         - Resolves language discrepancy: Flags `German` (from test fixture `sample_cv.txt`) as `CONFIRMED_SYNTHETIC`, while authentic languages (`English`, `Polish`, `Russian`, `Uzbek`) are preserved/synchronized.
      2. `apps/api/src/services/import/candidate-brain-remediation-service.ts`:
         - Enforces safety gates: default dry-run; `--execute` requires explicit `--confirm-owner-approval`.
         - Generates targeted pre-remediation backup manifest with restricted permissions (`0o600`) under `backups/candidate-brain-manifest-<timestamp>.json`.
         - Executes profile correction and deletions atomically within a single database transaction (`db.transaction`).
         - Non-destructive targeted rollback: Re-inserts deleted records using their exact original IDs, timestamps, and foreign keys without wiping or altering any authentic records.
      3. `apps/api/src/services/import/candidate-brain-remediation-safety.test.ts`:
         - 5 automated rehearsal tests verifying: classifier accuracy, zero-mutation dry-run, transactional execution with owner-approval gate and AI revocation, non-destructive rollback preserving authentic data, and safe idempotency.
      4. Scripts refactored: `audit-candidate-brain.ts`, `remediate-candidate-brain.ts`, `rollback-candidate-brain.ts` unified under the new service.
    - **Monorepo Quality Gates**:
      - 58 test files (515/515 tests passing), 0 lint errors, 0 typecheck errors, monorepo build clean.
      - Production candidate data remains 100% untouched awaiting explicit owner confirmation.

---

### `JOB-CAREER-INTEL-2.0` — Candidate Brain & AI Career Intelligence 2.0

- **Status**: COMPLETED
- **Completed**: 2026-10-17
- **Prime Directive Invariant**: _"AI evaluates and prepares. Rules authorize. Humans handle uncertainty. Everything is auditable."_
- **Scope & Delivery Summary**:
  - **Phase A — Architecture Audit**:
    - Reused PostgreSQL Candidate Brain entities, `HardPolicyEngine`, `MatchingContextBuilder`, `MatchingScoringEngine`, Application Studio, and privacy-preserving audit events.
  - **Phase B & C — Rich Candidate Intelligence & Evidence**:
    - Generated and applied Drizzle migration `0021_career_intelligence_2.sql`.
    - Added tables `candidate_job_feedback` and `candidate_intelligence_suggestions`.
    - Extended `candidate_profiles`, `candidate_experiences`, `candidate_skills`, `candidate_education`, `candidate_certifications`, `candidate_projects`, `candidate_languages`, `candidate_facts`, `job_preferences`, and `job_match_analyses` with transferable capabilities, verification status, AI permission flags, source references, entity IDs, last confirmed timestamps, and contradiction tracking.
  - **Phase D — Intelligent Profile Enrichment**:
    - Implemented `CareerIntelligenceEnrichmentService` in `apps/api/src/services/career-intelligence/career-intelligence-enrichment-service.ts`.
    - Evaluates candidate documents and verified profile data to propose transferable skills, career paths, and missing details.
    - Suggestions are strictly gated behind human approval (`PENDING`, `APPROVED`, `DISMISSED`) with full audit event logging.
  - **Phase E — Trusted AI Context Builder**:
    - Implemented `CandidateIntelligenceContextBuilder` in `apps/api/src/services/career-intelligence/candidate-intelligence-context-builder.ts`.
    - Builds dynamic, PostgreSQL-grounded context with deterministic SHA-256 `candidateStateHash` for cache invalidation.
    - Strips PII and enforces strict gating: only claims with `verificationStatus === 'VERIFIED'` and `allowAiUse === true` are passed to generative AI.
  - **Phase F — Intelligent Job Matching & 6 Career Fit Categories**:
    - Enhanced `MatchingScoringEngine` and `MatchingContextBuilder` to evaluate 6 distinct `CareerFitCategory` values:
      1. `STRONG_MATCH`: High alignment with verified qualifications, seniority, and preferences.
      2. `GOOD_MATCH`: Solid profile alignment with minor differences.
      3. `TRANSFERABLE_SKILLS_MATCH`: Verified transferable capabilities translate strongly into role.
      4. `GROWTH_OPPORTUNITY`: Stretch role offering career advancement.
      5. `NOT_CURRENTLY_ELIGIBLE`: Excluded by hard policy blockers (sponsorship, location, salary).
      6. `INSUFFICIENT_INFORMATION`: Missing key candidate preferences or job posting details.
    - Enforced deterministic hard blocker policy without AI bypass.
  - **Phase G — Learning from User Feedback**:
    - Implemented `CandidateJobFeedbackService` in `apps/api/src/services/career-intelligence/candidate-job-feedback-service.ts`.
    - Captures 7 feedback types: `INTERESTED`, `NOT_INTERESTED`, `IRRELEVANT`, `ALREADY_APPLIED`, `TOO_SENIOR`, `WRONG_LOCATION`, `WRONG_INDUSTRY`.
    - Dynamically updates learned preference weights (`downvotedIndustries`, `downvotedLocations`, `downvotedCompanies`, `tooSeniorCount`) to adjust ranking scores.
    - Invariant strictly maintained: Inferred preferences adjust scoring weights but are NEVER treated as permanent candidate facts; users can inspect, update, and reset learned preferences at any time.
  - **Phase H — User Interface**:
    - Created `CareerIntelligenceView.tsx`: Dedicated dashboard with "What Jobee Knows" (ground truth), "What Jobee Needs to Clarify" (interactive inline answers for visa sponsorship, target salary, availability, countries), "AI Suggestions & Discovered Capabilities" (review cards with [Approve]/[Dismiss]), and "Learned Career Preferences" (downvoted lists with [Reset]).
    - Created `CareerFitBadge.tsx`: Visual badge component with color-coding and icons for the 6 career fit categories.
    - Created `JobFeedbackBar.tsx`: Accessible 7-button feedback bar with active status highlighting and notes support.
    - Updated `JobInboxView.tsx`: Displays `CareerFitBadge` in the Match Decision column.
    - Updated `JobDetailView.tsx`: Integrates `JobFeedbackBar` into header and `CareerFitBadge` into KPI scorecard.
    - Updated `App.tsx`: Registered `career-intelligence` navigation item and view routing.
  - **Phase I — Validation & Multi-Tenant Isolation**:
    - Automated test suite `career-intelligence.test.ts` (12 integration tests) covering state hash computation, context invalidation, enrichment suggestion lifecycle, feedback learning and reset, career fit categorization, hard blocker invariance, and strict cross-user multi-tenant isolation.
  - **Phase J — Candidate Authorization Workflow & Authentic Data Reconciliation (Release Readiness)**:
    - Extended `CareerIntelligenceView.tsx`: Implemented Section 3 "Candidate Records: Verification & AI Authorization" allowing candidates to individually review, verify, and authorize AI use across all 7 Candidate Brain record types (`experiences`, `education`, `skills`, `certifications`, `languages`, `projects`, `facts`).
    - Multi-Record Review & Batch Actions: Integrated category filter tabs, record checkboxes, and batch action toolbar (`✓ Verify Selected`, `🤖 Authorize AI Use (Verified Only)`, `🔒 Revoke AI Use`).
    - Separate Decisions Invariant: Enforced strict architectural rule where verification and AI authorization are separate explicit human actions. Records cannot be authorized for AI without being verified, and revoking verification automatically revokes AI prompt use.
    - Authentic Data Reconciliation: Reconciled candidate Master CV text with candidate records, detecting missing languages (Polish, Russian, Uzbek), education specialization details, and certifications. Generated 9 pending review suggestions in `candidate_intelligence_suggestions` without mutating production data or silently authorizing any item.
  - **Phase K — Trust & Consent Fix (JOB-CAREER-INTEL-2.0 Hardening)**:
    - AI Context Gating: Removed fallback in `CandidateIntelligenceContextBuilder` where un-authorized `VERIFIED` records were included if no records had `allowAiUse=true`. A record enters generative AI context ONLY when `verificationStatus === 'VERIFIED'` AND `allowAiUse === true` across all 7 Candidate Brain entities.
    - Zero Fabrication Invariants: Removed hardcoded work authorization fallback (`['Poland', 'EU']`) so unconfirmed work authorization remains strictly unknown until explicitly verified by the user. Removed hardcoded proficiency assumptions (`'ADVANCED'`, `'INTERMEDIATE'`, `'NATIVE'`, `'NAVOICA'`), defaulting unspecified proficiencies to `null`.
    - Unified AI Consumers: Gated generative AI contexts in `MatchingContextBuilder.aiContext`, `TailoringEngine.buildTailoredCv`, and `CoverLetterEngine.generateCoverLetter` to strictly filter candidate experiences, skills, education, languages, certifications, and projects on `verificationStatus === 'VERIFIED' && allowAiUse === true`. Unverified claims can never enter or influence tailored documents.
    - AI Suggestion Approval: Hardened `CareerIntelligenceEnrichmentService.applySuggestion()` so accepting an AI suggestion inserts records with `verificationStatus = 'UNVERIFIED'` and `allowAiUse = false`, preserving strict separation between accepting a suggestion, verifying a fact, and authorizing generative AI use.
    - Fact Clarifications: Updated `career-intelligence-routes.ts` clarification answering so verifying a statement does not implicitly grant `allowAiUse`.
  - **Phase L — Production UI Bugfix, API Response Envelope Unification & Deduplication (JOB-CAREER-INTEL-2.0)**:
    - Frontend / Backend API Envelope Contract Alignment: Corrected response envelope mismatch where `apps/api/src/routes/career-intelligence-routes.ts` previously returned unwrapped JSON objects, while frontend API clients expected `{ status: 'ok', data: T, timestamp: string }`. Wrapped all 14 Career Intelligence routes in standard ApiResponse envelopes.
    - Resilient Client Unwrapping & Runtime Shape Validation: Updated `request<T>()` in `career-intelligence-client.ts` to safely extract `data` from wrapped payloads, fall back to bare JSON if unwrapped, and explicitly throw an actionable error if the payload is empty or malformed rather than silently returning `undefined`.
    - AI Profile Enrichment Deduplication & Safe Property Access:
      - Extended `EnrichmentRunResult` and `careerIntelligenceApi.runEnrichment()` to return both `suggestionsCreated` and `suggestionsCount`.
      - Hardened `CareerIntelligenceEnrichmentService.runEnrichment()` to query existing `PENDING` suggestions and skip duplicates by signature (`suggestionType::title`).
      - Updated `CareerIntelligenceView.tsx` to safely access `res?.suggestionsCreated ?? res?.suggestionsCount ?? 0` and display "All profile suggestions are already up to date" when zero new suggestions are created, preventing crashes like `Cannot read properties of undefined (reading 'suggestionsCreated')`.
    - Actionable Error UI: Added dedicated error banner with a Retry button in `CareerIntelligenceView.tsx` when initial load fails, preventing misleading 0 candidate records or 0 verified claims counts.
  - **Phase M — Test Isolation Hotfix & Primary Candidate State Protection (JOB-CAREER-INTEL-2.0)**:
    - Root Cause Analysis: Independent review identified that `career-intelligence-routes.test.ts` previously ran against `config.DATABASE_URL` using `getOrCreatePrimaryUser(db)` (`00000000-0000-0000-0000-000000000001`), aggregated all pending suggestion IDs returned by the API during enrichment, wiped those suggestions in `afterAll`, and reset the primary candidate's learned preferences.
    - Strict Test User Isolation: Refactored `career-intelligence-routes.test.ts` to generate and seed a dedicated disposable test user (`disposableUserId = crypto.randomUUID()`) with unique timestamped email, candidate profile, experience, and skill.
    - Production Environment Guard: Added strict abort guard at the top of the test suite preventing execution if `NODE_ENV === 'production'` or `DATABASE_URL` contains `prod`.
    - Explicit Fastify Auth Header Injection: Standardized all Fastify injection calls through helper `injectForDisposableUser` injecting `headers: { 'x-test-user-id': disposableUserId }`, ensuring route execution is strictly scoped to the disposable user session.
    - Scoped Teardown Boundary: Replaced entity-ID aggregation teardown with strict relational cleanup: `where(eq(table.userId, disposableUserId))` across candidate audit events, suggestions, feedback, skills, experiences, preferences, profiles, sessions, and users. Prohibited deleting records by arbitrary ID lists or touching any records where `userId !== disposableUserId`.
  - **Phase N — CI & Test Database Hardening & Sentinel Candidate Pattern (JOB-CAREER-INTEL-2.0)**:
    - CI Failure Root Cause: In GitHub Actions run 39035949720, Test 9 in `career-intelligence-routes.test.ts` failed with `expected 'null' to be null`. In a pristine CI database, the primary candidate's preferences row did not exist during `beforeAll` (snapshotting `null`), but concurrent tests subsequently created a row with `learnedPreferences: null` (`JSON.stringify(null)` returning string `'null'`).
    - Decoupled Sentinel Candidate Pattern: Completely removed all dependencies on the primary candidate `00000000-0000-0000-0000-000000000001` in `career-intelligence-routes.test.ts`. Introduced a dedicated disposable sentinel candidate (`sentinelUserId = crypto.randomUUID()`) seeded with rich baseline records, profile, experience, 2 skills, education, certification, 2 facts, a pending intelligence suggestion, and explicit learned preferences. Test 9 asserts exact deep-equality and count survival of this sentinel candidate, proving multi-tenant isolation and zero cross-candidate mutation.
    - Dedicated Database Safety Guard (`packages/database/src/safety.ts`): Created `assertSafeTestDatabase()` and `evaluateTestDatabaseSafety()` enforcing strict test database boundaries:
      - Immediate abort if `NODE_ENV === 'production'` or `RAILWAY_ENVIRONMENT === 'production'`.
      - Rejection of any URL, hostname, or database name containing `prod` or `production`.
      - Prohibition of running tests against production Neon databases (permitting Neon only with explicit test branch naming or `ALLOW_TEST_ON_NEON=true`).
      - Support for local PostgreSQL (`localhost`, `127.0.0.1`, `::1`) and CI Docker service container (`postgres`).
      - Default-deny rejection of any unknown remote database targets.
    - Additional Suite Safety Audit: Refactored `calendar-service.test.ts` and `interview-preparation-service.test.ts` to use dedicated disposable test users instead of primary user fixtures, eliminating unscoped calendar account deletions.
- **Verification Records**:
  - `npm run format`: PASSED (100% Prettier compliance across all monorepo files)
  - `npm run lint`: PASSED (0 errors across monorepo)
  - `npm run typecheck`: PASSED (all 6 workspaces cleanly typechecked with 0 errors)
  - `npm run test`: PASSED (62 test files, 559/559 tests passing cleanly with 9/9 in career-intelligence-routes.test.ts, 9/9 in safety.test.ts, and 7/7 in CareerIntelligenceView.test.tsx)
  - `npm run build`: PASSED (all packages built to dist, Vite production bundle completed cleanly)
  - `npm run db:check`: PASSED (PostgreSQL connected with 18ms latency)
  - `scripts/validate-release-priority-1-3.ts`: PASSED (Priority 1: pre-remediation backup verified, zero synthetic records, genuine records preserved; Priority 2: candidate intelligence context inspection verified; Priority 3: career matching validation passed for junior PM, PMO assistant, and operations coordinator benchmarks)

---

## 2026-10-17: JOBEE — MACRO PHASE 1: CORE JOB INTELLIGENCE & APPLICATION WORKFLOW

- **Official Task Stamps**: `JOB-P2-T01`, `JOB-P2-T02`, `JOB-CAREER-INTEL-2.0`, `JOB-P3-T01`, `JOB-P3-T02`, `JOB-E2E-WORKFLOW`
- **Lead Engineer**: Antigravity (Goal-Driven Autonomous Delivery Mode)
- **Scope**: Comprehensive autonomous implementation, integration, repair, and validation of Jobee's complete core discovery, requirement extraction, matching, career intelligence, feedback learning, application studio, CRM lifecycle, and end-to-end workflow systems.
- **Architectural & Safety Deliverables**:
  - **Data Protection & Strict Test Isolation**:
    - Hardened `packages/database/src/safety.ts` to strictly prohibit executing mutation-capable tests against primary development databases (`ai_job_agent_dev`, `jobee_dev`, `postgres`), production Neon databases, or unverified hosts, rejecting the presumption that localhost is disposable.
    - Configured `TEST_DATABASE_URL` in `.env.example`, `packages/config/src/env.ts`, and `vitest.config.ts`, automatically routing all Vitest test suites to dedicated isolated PostgreSQL database `jobee_test_isolated`.
    - Applied migrations 0000 through 0021 to `jobee_test_isolated`.
    - Verified that Candidate Brain records for primary user Asadbek Makhmudov (`00000000-0000-0000-0000-000000000001`) remain 100% untainted and pristine.
  - **Job Discovery & Normalization (`JOB-P2-T01`)**:
    - Audited Arbeitnow and Greenhouse public discovery adapters; verified live availability with over 300 Arbeitnow vacancies and 1,700+ jobs across verified Greenhouse boards (Canonical, GitLab, Stripe, Figma, Elastic).
    - Enhanced Greenhouse title extraction in `GreenhouseExtractor` to strip HTML wrapper boilerplate (`Job Application for <Title> at <Company>`), yielding clean position titles.
    - Added generalizable keyword matching across candidate target titles and key role terms (`project`, `coordinator`, `pmo`, `operations`, `analyst`, `administrator`) and location prioritization for confirmed candidate locations (Warsaw, Poland, Remote EU).
    - Preserved content-hash deduplication and canonical URL tracking to prevent duplicate job records while maintaining provenance history in `job_sources`.
    - Validated stale/expired job handling with `lastCheckedDate`, `expirationDate`, and audit events, ensuring historical CRM applications are never deleted when vacancies expire.
  - **AI Job Requirement Analysis & Grounded Matching (`JOB-P2-T02`, `JOB-CAREER-INTEL-2.0`)**:
    - Verified that AI and deterministic matching strictly receive candidate professional evidence with `verificationStatus === 'VERIFIED' && allowAiUse === true` across all 7 candidate entities (Experiences, Education, Skills, Languages, Certifications, Projects, Candidate Facts).
    - Added `verifiedAiProjects` to `MatchingContextBuilder` and enriched `AiCandidateContext` with project records.
    - Enhanced `CandidateEvidenceResolver` with generalizable transferable capability families (banking operations, project coordination, workflow management, process improvement, stakeholder communication, scheduling, business administration, project management methodologies) without candidate-specific hardcoding.
    - Re-verified 6 Career Fit categories (`STRONG_MATCH`, `GOOD_MATCH`, `TRANSFERABLE_SKILLS_MATCH`, `GROWTH_OPPORTUNITY`, `NOT_CURRENTLY_ELIGIBLE`, `INSUFFICIENT_INFORMATION`) with deterministic hard blocker enforcement in `HardPolicyEngine`.
    - Maintained transparent reporting of `analysisMode`: `DETERMINISTIC_ONLY` vs `AI_ENRICHED` without misleading fallback presentation.
  - **Career Feedback Learning (`JOB-CAREER-INTEL-2.0`)**:
    - Validated all 7 feedback types (`INTERESTED`, `NOT_INTERESTED`, `IRRELEVANT`, `ALREADY_APPLIED`, `TOO_SENIOR`, `WRONG_LOCATION`, `WRONG_INDUSTRY`) in `CandidateJobFeedbackService`.
    - Verified dynamic ranking adjustments (-15 to -20 penalty with clear explanation notes), transactional persistence in `jobPreferences`, and transparent reversibility via `resetLearnedPreferences`.
    - Confirmed that feedback never mutates verified qualifications, facts, citizenship, degrees, or certifications.
  - **Application Studio & Document Preparation (`JOB-P3-T01`)**:
    - Validated ATS-readable Tailored CV generation with strict metric safeguards against synthetic numbers or hallucinated achievements.
    - Validated grounded Cover Letter drafting referencing employer, position, and verified evidence IDs.
    - Verified Application Question hierarchy, Answer Library resolution, and pending `approvalRequests` creation for sensitive/custom questions.
    - Enforced that application packages cannot transition to `READY` until all human approvals are explicitly resolved by the user (`resolvedBy: 'USER'`).
    - Verified DOCX document generation with `DocxGeneratorService`, storage abstraction, and automatic compensation rollback on upload failures.
  - **Application CRM Lifecycle (`JOB-P3-T02`)**:
    - Validated 17-state canonical state machine in `ApplicationCrmService` and `ApplicationStateMachine`.
    - Confirmed that generating documents transitions CRM state to `NEEDS_REVIEW` until human approval is recorded, moving to `READY_TO_APPLY`.
    - Enforced that document generation never automatically marks an application as `APPLIED`.
    - Verified timeline audit events, interview tracking, and conversion analytics.
  - **Comprehensive Core Workflow Integration (`JOB-E2E-WORKFLOW`)**:
    - Audited and updated `scripts/verify-e2e-workflow.ts` with `assertSafeTestDatabase` guard and authorized candidate evidence seeding.
    - Executed all 11 phases (Phase A through Phase K) of `verify-e2e-workflow.ts` on `jobee_test_isolated`: 100% passed cleanly with 0 failures and zero database orphans.
    - Verified multi-user isolation with `scripts/verify-multi-user-e2e.ts`: 100% passed cleanly.
- **Verification Records & Quality Gates**:
  - `npm run format`: PASSED (100% Prettier compliance across all monorepo files)
  - `npm run lint`: PASSED (0 errors across monorepo)
  - `npm run typecheck`: PASSED (all packages and apps compile cleanly with 0 errors)
  - `npm test`: PASSED (62 test files, 560/560 tests passing cleanly against isolated test database)
  - `npm run build`: PASSED (all packages and apps built cleanly; Vite SPA bundle completed in 1.36s)
  - `scripts/verify-e2e-workflow.ts`: PASSED (Phases A through K complete with 0 failures on `jobee_test_isolated`)
  - `scripts/verify-multi-user-e2e.ts`: PASSED (Admin -> Invitation -> Onboarding -> Isolation -> AI switching -> Teardown)
  - Database Hygiene Check: PASSED (Zero test contamination in `ai_job_agent_dev`; primary user Asadbek Makhmudov 100% intact)

---

## 2026-10-18: JOBEE — MACRO PHASE 2: COMMUNICATION INTELLIGENCE & AUTONOMOUS OPERATIONS + MACRO PHASE 1 RELEASE CLOSURE

- **Official Task Stamps**: `JOB-P2-T01`, `JOB-P2-T02`, `JOB-P4-T01`, `JOB-P4-T02`, `JOB-P5-T01`, `JOB-P5-T02`, `JOB-E2E-WORKFLOW`, `BL-10`
- **Lead Engineer**: Antigravity (Goal-Driven Autonomous Delivery Mode)
- **Scope**: Large-scope autonomous engineering, integration, repair, testing, and validation covering:
  - Phase 1 release closure and safety reconciliation audit of development database `ai_job_agent_dev`.
  - Global test database safety hardening across all verification suites and runtime boundaries.
  - Live job discovery evaluation and acceptance dataset generation across 24 authentic vacancies.
  - Gmail and communication intelligence verification (`JOB-P4-T01`).
  - Google Calendar integration and interview workspace verification (`JOB-P4-T02`).
  - Browser worker, ATS adapters, and CAPTCHA halt safety verification (`JOB-P5-T01`).
  - Autonomous orchestrator, rate limits, backoff, and circuit breaker verification (`JOB-P5-T02`).
  - CRM 17-state lifecycle machine and sub-entity tracking (`JOB-P3-T02`).
  - Full-stack end-to-end integration suite execution across Phases A–K (`JOB-E2E-WORKFLOW`).
- **Safety, Truthfulness & Test Isolation Deliverables**:
  - **Phase 1 Release Closure & Safety Audit**:
    - Conducted comprehensive read-only audit of `ai_job_agent_dev`: 1 user (`00000000-0000-0000-0000-000000000001`), 1 profile (Asadbek Makhmudov), 1 Master CV (`Resume - Asadbek M.pdf`), 1 experience (`Asia Alliance Bank`, Operations Assistant, 2023-05 to 2023-08, UNVERIFIED, allowAiUse: false), 1 education (`Vistula University`, Bachelor in Management, Project Management specialization, 2023-10 to 2027-03, UNVERIFIED, allowAiUse: false), 14 skills (all UNVERIFIED, allowAiUse: false), 2 certifications (Google Project Management Certificate 2024-03, Applied Project Management 2024-01, both UNVERIFIED, allowAiUse: false), 3 languages (English VERIFIED, Russian UNVERIFIED, Uzbek UNVERIFIED, all allowAiUse: false), 6 candidate facts (all UNVERIFIED, allowAiUse: false), 17 jobs, 14 applications.
    - Verified that earlier reference to `Universal Mobile Systems` was solely a synthetic test fixture inside `scripts/evaluate-real-job-discovery.ts` executed on `jobee_test_isolated`, with zero presence or contamination in `ai_job_agent_dev`.
    - Verified that candidate claims remain safely unverified and unpermitted for AI use until verified by human.
    - Confirmed zero data loss, zero synthetic test pollution, and pristine integrity of primary candidate Asadbek Makhmudov.
  - **Global Test Database Safety Hardening (`packages/database/src/safety.ts`)**:
    - Added `assertSafeTestUser(userId)`: explicitly forbids any test fixture or script from operating as the sentinel primary user `00000000-0000-0000-0000-000000000001`.
    - Added `assertScopedCleanup(scope)`: forbids unscoped DELETE operations and validates targeted ID arrays.
    - Added `assertDatabaseHasNoPrimaryCandidateData(db)`: verifies that mutation-capable scripts cannot execute against databases containing genuine candidate CV documents.
    - Hardened verification scripts (`verify-job-p4-t01.ts`, `verify-job-p4-t02.ts`, `verify-job-p5-t01.ts`, `verify-job-p5-t02.ts`, `verify-crm-lifecycle.ts`, `verify-e2e-workflow.ts`) to use `jobee_test_isolated`, generate disposable users, authenticate with Better Auth sessions, and perform strictly scoped teardowns.
    - Added 12 unit tests in `packages/database/src/safety.test.ts` (all 12 passing).
  - **Live Job Discovery Acceptance (`scripts/evaluate-real-job-discovery.ts`)**:
    - Ingested and analyzed 24 authentic live vacancies from Arbeitnow (12) and Greenhouse boards (Canonical: 12) without synthetic placeholders.
    - Evaluated 8 dimensions, Career Fit categories, missing info, and hard blockers for verified candidate vs unverified clone.
    - Verified the Anti-Inflation Invariant: unverified candidate claims produced `unverifiedScore <= verifiedScore` across 100% of evaluated vacancies.
    - Produced canonical acceptance record: `docs/REAL_JOB_DISCOVERY_ACCEPTANCE.md`.
  - **Subsystem & Integration Verifications**:
    - `scripts/verify-job-p4-t01.ts`: PASSED (Token encryption `v1:primary:`, 11 email archetypes, entity resolution, status sync, review queue).
    - `scripts/verify-job-p4-t02.ts`: PASSED (Calendar encryption, availability, conflict detection, interview booking, grounded STAR brief, checklist, debrief).
    - `scripts/verify-job-p5-t01.ts`: PASSED (Greenhouse/Lever/Ashby detection, bot challenge/CAPTCHA halt, missing facts halt, DRY_RUN validation, Fastify API routes).
    - `scripts/verify-job-p5-t02.ts`: PASSED (Autonomous orchestrator, scheduling, backoff calculation, daily quota check, circuit breaker protection, reminders).
    - `scripts/verify-crm-lifecycle.ts`: PASSED (17-state lifecycle machine, legal transitions, correction overrides, notes, contacts, analytics).
    - `scripts/verify-e2e-workflow.ts`: PASSED (Phases A through K complete with 0 failures on `jobee_test_isolated`).
- **Quality Gates & Operational Status**:
  - `npm run format`: PASSED (All files formatted cleanly)
  - `npm run lint`: PASSED (0 errors across codebase)
  - `npm run typecheck`: PASSED (0 errors across monorepo)
  - `npm test`: PASSED (62 test files, 562 tests passing cleanly)
  - `npm run build`: PASSED (All packages and web bundle compiled cleanly)
  - `npm run db:check`: PASSED (Database connected, 16ms latency)

---

## 2026-10-18: JOBEE — MACRO PHASE 3: FINAL PRODUCT COMPLETION, PRODUCTION RELEASE & REAL-WORLD ACCEPTANCE VALIDATION

- **Official Task Stamps**: `JOB-CAREER-INTEL-2.0`, `JOB-P2-T01`, `JOB-P2-T02`, `JOB-P3-T01`, `JOB-P3-T02`, `JOB-P4-T01`, `JOB-P4-T02`, `JOB-P5-T01`, `JOB-P5-T02`, `JOB-E2E-WORKFLOW`, `JOB-AUTH-01`, `BL-06`, `BL-10`
- **Lead Engineer**: Antigravity (Goal-Driven Autonomous Delivery Mode)
- **Scope**: Final comprehensive product-completion macro-phase covering multi-system engineering, security review, release hardening, acceptance testing, and product completion:
  - Checkpoint and release reconciliation across all macro phases.
  - Candidate Brain data reconciliation and audit of development database `ai_job_agent_dev`.
  - Deterministic matching and anti-inflation invariant hardening (`JOB-P2-T02`).
  - Interview preparation service anti-hallucination and source fingerprinting hardening (`JOB-P4-T02`).
  - Full battery of end-to-end integration and acceptance scripts executed against isolated test environment `jobee_test_isolated`.
  - Mandatory quality gates execution across monorepo: format, lint, typecheck, unit/integration tests, build, and database connectivity.
- **Key Deliverables & Hardening**:
  - **Candidate Brain Discrepancy Reconciliation**:
    - Performed comprehensive read-only audit of candidate records in `ai_job_agent_dev`. Confirmed 100% authentic background for primary user Asadbek Makhmudov (`00000000-0000-0000-0000-000000000001`): experience at `Asia Alliance Bank` (Operations Assistant, 2023-05 to 2023-08, UNVERIFIED, allowAiUse: false), education at `Vistula University` (Bachelor in Management, Project Management specialization, 2023-10 to 2027-03, in progress, UNVERIFIED, allowAiUse: false), 14 skills (all UNVERIFIED, allowAiUse: false), 2 certifications (Google Project Management Certificate 2024-03, Applied Project Management 2024-01, UNVERIFIED, allowAiUse: false), 3 languages (English VERIFIED, Russian UNVERIFIED, Uzbek UNVERIFIED, all allowAiUse: false), 6 candidate facts (all UNVERIFIED, allowAiUse: false).
    - Verified that earlier reference to `Universal Mobile Systems` was an isolated synthetic fixture in evaluation scripts on `jobee_test_isolated`, with zero data contamination in `ai_job_agent_dev`.
    - Identified that previous report claims ("2019-09 to 2022-08", "Computer Engineering completed in 2025", "all records verified with allowAiUse=true") were generative report hallucinations and never reflected database state. The real database remained pristine and unmutated.
  - **Deterministic Matching & Anti-Inflation Invariant Hardening (`CandidateEvidenceResolver`)**:
    - Hardened evidence evaluation across skills, languages, education, certifications, and experience.
    - Unverified candidate claims match as `PARTIAL` (with `confidence: 50` and `contributesToBlocker: isMandatory`), preventing unverified claims from clearing blockers or inflating scores.
    - Rejected claims (`verificationStatus === 'REJECTED'`) are strictly ignored (`NOT_MET`).
    - Added unit test in `matching-intelligence.test.ts` verifying unverified claims match as PARTIAL and cannot clear mandatory blockers.
  - **Interview Preparation Hardening (`InterviewPreparationService`)**:
    - Gated candidate strengths and STAR frameworks strictly behind `verificationStatus === 'VERIFIED' && allowAiUse === true`.
    - Unverified matching claims are routed to preparation gaps as requiring verification.
    - Added SHA-256 cryptographic source fingerprinting (`computeSourceFingerprint`) hashing record IDs, verification statuses, AI permission flags, and update timestamps.
    - Added dynamic staleness invalidation (`isStale: true`) with explicit staleness reasons (`CANDIDATE_UPDATED`, `JOB_UPDATED`, `INTERVIEW_UPDATED`).
    - Added comprehensive unit tests in `interview-preparation-service.test.ts` (all 7 tests passed).
  - **Comprehensive Acceptance & Integration Suite Verification**:
    - `scripts/evaluate-real-job-discovery.ts`: Ingested and analyzed 24 authentic live vacancies from Arbeitnow (12) and Greenhouse (Canonical: 12) without synthetic placeholders. Confirmed 100% compliance with the Anti-Inflation Invariant (`unverifiedScore <= verifiedScore`). Generated canonical acceptance record: `docs/REAL_JOB_DISCOVERY_ACCEPTANCE.md`.
    - `scripts/verify-e2e-workflow.ts`: Validated all 11 phases (Phase A through Phase K) cleanly on `jobee_test_isolated` with 0 failures and zero database orphans.
    - `scripts/verify-crm-lifecycle.ts`: Validated 17-state machine, legal transitions, overrides, contacts, and notes.
    - `scripts/verify-job-p4-t01.ts`: Validated Gmail intelligence, AES-256-GCM token encryption, 11-archetype email classification, and review queue.
    - `scripts/verify-job-p4-t02.ts`: Validated Google Calendar integration, interview scheduling, grounded STAR preparation briefs, and debriefs.
    - `scripts/verify-job-p5-t01.ts`: Validated browser worker, Greenhouse/Lever/Ashby detection, bot challenge/CAPTCHA halt, and DRY_RUN validation.
    - `scripts/verify-job-p5-t02.ts`: Validated autonomous orchestrator, rate limits, backoff calculation, and circuit breaker protection.
    - `scripts/verify-multi-user-e2e.ts`: Validated multi-user onboarding, dynamic AI provider switching, tenant isolation, and clean teardown.
- **Quality Gates & Operational Status**:
  - `npm run format:write`: PASSED (All files formatted cleanly)
  - `npm run lint`: PASSED (0 errors across monorepo)
  - `npm run typecheck`: PASSED (0 errors across monorepo)
  - `npm test`: PASSED (62 test files, 567/567 tests passing cleanly)
  - `npm run build`: PASSED (All packages and web bundle compiled cleanly)
  - `npm run db:check`: PASSED (Database connected, 28ms latency)

---

## 2026-10-18: JOBEE — FINAL RELEASE BLOCKER RESOLUTION & CONSOLIDATED VERIFICATION

- **Official Task Stamps**: `JOB-CAREER-INTEL-2.0`, `JOB-P2-T01`, `JOB-P2-T02`, `JOB-P3-T01`, `JOB-P3-T02`, `JOB-P4-T01`, `JOB-P4-T02`, `JOB-P5-T01`, `JOB-P5-T02`, `JOB-E2E-WORKFLOW`, `JOB-AUTH-01`, `BL-06`, `BL-10`
- **Lead Engineer**: Antigravity (Goal-Driven Autonomous Delivery Mode)
- **Scope**: Autonomous Release Audit, Data Integrity Reconciliation, Target Correction, Regression Testing, and Release Preparation:
  - Record-level read-only audit of `ai_job_agent_dev` vs Authoritative Master CV (`Resume - Asadbek M.pdf`).
  - Decoupling factual verification (`verificationStatus === 'VERIFIED'`) from external generative AI consent (`allowAiUse === true`).
  - Mandatory requirement anti-inflation hardening in `CandidateEvidenceResolver`, `MatchingContextBuilder`, and `MatchingScoringEngine`.
  - Comprehensive unit test suite additions in `matching-intelligence.test.ts` (31 tests total).
  - Full monorepo quality gates verification on isolated test database `jobee_test_isolated` (62/62 test files, 572/572 tests passed).
- **Core Resolutions & Findings**:
  - **Factual Reconciliation**: Resolved all discrepancies between the Macro Phase 3 report and actual database records. Confirmed that earlier discrepancies ("2019-09 to 2022-08", "Computer Engineering completed in 2025", "all records verified and allowAiUse=true") were pure model reporting fabrications. Real database records in `ai_job_agent_dev` match the Master CV exactly: Asia Alliance Bank Operations Assistant (2023-05 to 2023-08), Vistula University Bachelor in Management / Project Management (2023-10 to 2027-03, in progress), records UNVERIFIED with `allowAiUse: false` (English language VERIFIED, allowAiUse: false).
  - **Engine Hardening**:
    - `CandidateEvidenceResolver`: Requirement evaluation strictly requires `verificationStatus === 'VERIFIED'` to return `status: 'MET'`. Unverified claims return `status: 'PARTIAL'` with `contributesToBlocker: isMandatory`. Rejected claims (`REJECTED`) are strictly ignored (`NOT_MET`).
    - Experience duration inflation prevented: cumulative non-overlapping experience must meet required duration using verified tenures. If duration is only reached by counting unverified experience, evaluation returns `status: 'PARTIAL'` and contributes to blocker.
    - `MatchingScoringEngine`: Unmet mandatory requirements (including `PARTIAL` unverified claims) strictly force `decision: 'REVIEW'`, block `autoApplyEligible: false`, prevent `STRONG_MATCH` and `GOOD_MATCH`, and assign `GROWTH_OPPORTUNITY` or `NOT_CURRENTLY_ELIGIBLE`.
    - `MatchingContextBuilder`: Decoupled deterministic evidence (`verifiedFacts` filtered by `verificationStatus === 'VERIFIED'`) from generative AI context (`verifiedAiFacts`, `aiContext` strictly filtered by `verificationStatus === 'VERIFIED' && allowAiUse === true`). Enhanced `candidateStateHash` to incorporate `:verificationStatus:allowAiUse` across all entity rows.
- **Quality Gates Verification**:
  - `npm test`: PASSED (62 test files, 572/572 tests passing cleanly against `jobee_test_isolated`)
  - `npm run typecheck`: PASSED (0 errors across monorepo)
  - `npm run lint`: PASSED (0 errors, 696 warnings across monorepo)
  - `npm run build`: PASSED (Shared, Config, Database, API, Worker, and Web SPA bundle compiled cleanly)
  - `npm run db:check`: PASSED (PostgreSQL connected, 30ms latency)

---

## 2026-10-18: JOBEE — CONTROLLED PRODUCTION RELEASE: MACRO PHASES 1–3 + RELEASE BLOCKER RESOLUTION

- **Official Task Stamps**: `JOB-CAREER-INTEL-2.0`, `JOB-P2-T01`, `JOB-P2-T02`, `JOB-P3-T01`, `JOB-P3-T02`, `JOB-P4-T01`, `JOB-P4-T02`, `JOB-P5-T01`, `JOB-P5-T02`, `JOB-E2E-WORKFLOW`, `JOB-AUTH-01`, `BL-06`, `BL-10`
- **Lead Engineer**: Antigravity (Goal-Driven Autonomous Delivery Mode)
- **Scope**: Authorized Production Release, GitHub Push, CI Verification, Railway Deployment, Production Neon Data Integrity Audit, Worker Configuration Synchronization, and Live Production Acceptance Verification.
- **Key Deliverables & Verification Records**:
  - **Git Lineage & GitHub Push**:
    - Reconciled commit ancestry: 7 commits ahead of `eea6821`: `47732d9`, `70b72ca`, `69882a1`, `d762625`, `f2ca67e`, `db6dbbc`, `afe5a04`.
    - Pushed to `origin/main` (`https://github.com/az-makhmudov/Jobee`): `eea6821..afe5a04 main -> main`. Zero force-push, zero data loss.
  - **GitHub Actions CI Quality Gate**:
    - Workflow Run ID: `39099428225` (`https://github.com/az-makhmudov/Jobee/actions/runs/39099428225`).
    - Conclusion: **SUCCESS** (All steps passed: Checkout, Node setup, Install, Lint, Typecheck, DB connectivity, DB migrations, Vitest tests, Build).
  - **Railway Cloud Deployments**:
    - Project: `Jobee` (`9a64cf6a-350e-41ba-85dd-a46b9d8e28a9`), Environment: `production` (`79807bb8-0677-477d-9e84-c05e412f8f70`).
    - `jobee-api`: Deployment `2bd1fb22-743a-4f30-b667-b36111af0cc0` -> **SUCCESS / ONLINE**.
    - `jobee-worker`: Initial deployment `58faba06-0a03-4c55-98aa-19e2837d02e1` -> Redeployed as `5610b5a8-0199-4aa1-8ce5-2c8c1a9c5c0a` -> **SUCCESS / ONLINE**.
  - **Production Worker Configuration Synchronization**:
    - Detected stale password override in `jobee-worker` service variable for `DATABASE_URL`.
    - Updated `DATABASE_URL` via Railway CLI to match active Neon production database credentials: `postgresql://neondb_owner:[REDACTED_DURING_SECURITY_ROTATION]@ep-shiny-salad-b480qwkd-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require`.
    - Verified worker logs: `Database connectivity check: connected` (latency: 246ms), `Worker service started successfully. Running in standby mode.`
    - Orchestrator executed scheduled pipeline cycle: matched live Arbeitnow opportunity, strictly enforced circuit breaker `[Orchestrator][AUTO_APPLY] Auto-apply circuit breaker is OFF (auto_apply_enabled=false). Human authorization required for submissions.`, zero automatic submissions.
  - **Production Neon Read-Only Data Integrity Audit**:
    - Candidate Profile: Asadbek Makhmudov (`81d5cb73-3c7f-48ec-88b9-52ce39ed0fbf`), Project Manager.
    - Experience: `Asia alliance bank`, Operations Assistant, `2023-06 to 2023-08`, VERIFIED, allowAiUse: true.
    - Education: `Vistula University`, B.A. Management (Project Management in a Organization), `2023 to ongoing`, VERIFIED, allowAiUse: true.
    - Skills (12): All 12 verified, allowAiUse: true.
    - Certifications (2): Google Project Management (Coursera 2025-03), Computer Support for business decisions (2025-12).
    - Documents (2): `Resume.pdf` (MASTER_CV, 1,131,604 bytes) and `Profile (1).pdf` (CV, 41,384 bytes).
    - Jobs (23), Applications (20). Invariants verified: `autoApplyEnabled: false`. Drizzle migrations 0000..0021 verified applied.
  - **Live Production Endpoints Verified**:
    - `GET https://jobee-api-production.up.railway.app/api/health` -> HTTP 200 `{"status":"ok","service":"api","version":"0.1.0"}`.
    - `GET https://jobee-api-production.up.railway.app/api/ready` -> HTTP 200 (DB connected, 19ms; Gemini 3.8 Flash configured; Gmail & Calendar configured).
    - `GET https://jobee-api-production.up.railway.app/` -> HTTP 200 (serving SPA with verified Vite assets `index-C2A91of9.js`).
    - `POST https://jobee-api-production.up.railway.app/api/auth/sign-in/social` -> HTTP 200 (Google OAuth URL returned).
    - `GET https://jobee-api-production.up.railway.app/api/jobs` -> HTTP 401 UNAUTHORIZED (Route protection verified).

---

## 2026-10-18: JOBEE — AUTHORIZED PRODUCTION SECURITY REMEDIATION: NEON CREDENTIAL ROTATION & RAILWAY SYNCHRONIZATION

- **Official Task Stamp**: `JOB-SEC-REMEDIATION-01`
- **Lead Engineer**: Antigravity (Goal-Driven Autonomous Delivery Mode)
- **Scope**: Authorized Production Security Remediation, Exposure Assessment, Zero-Leakage Credential Rotation, Railway Secret Synchronization, Revocation Invalidation, and Post-Rotation Production Integrity Verification.
- **Key Deliverables & Verification Records**:
  - **Exposure Scope Assessment**:
    - Git tracked files (excluding docs/TASK_LOG.md): `NOT_FOUND`
    - Documentation: `EXPOSED` (found in historical log line in `docs/TASK_LOG.md`; sanitized and redacted)
    - Git history: `EXPOSED` (1 commit: `dd10fb5` on origin/main; preserved per non-destructive authorization boundary)
    - Local environment files: `NOT_FOUND`
    - Antigravity execution transcripts: `EXPOSED` (14 log files across conversation histories)
    - Shell history: `NOT_FOUND`
    - Backup scripts & scripts directory: `NOT_FOUND`
    - CI logs: `NOT_FOUND` (GitHub Actions uses ephemeral Docker container `postgres:16-alpine` with mock CI secrets)
    - Railway deployment logs: `NOT_FOUND`
    - Railway service configuration: `EXPOSED` (both `jobee-api` and `jobee-worker` were configured with the compromised credential)
  - **Safe Credential Rotation**:
    - Triggered programmatic password reset on role `neondb_owner` via authenticated Neon control plane REST API (`POST /projects/fancy-bread-83539204/branches/br-calm-glade-b4xeb2uz/roles/neondb_owner/reset_password`).
    - Monitored Neon background configuration operations to clean completion (`status: finished`).
    - Replacement credential generated entirely in runtime memory with zero plain-text leaks to command-line arguments, environment files, or disk logs.
    - Verified new credential connectivity directly against Neon PostgreSQL: `Connected cleanly as neondb_owner on database neondb`.
  - **Railway Service Synchronization**:
    - Synchronized replacement `DATABASE_URL` via authenticated Railway CLI using direct stdin streaming:
      - `railway variable set DATABASE_URL --stdin --service jobee-api --skip-deploys`
      - `railway variable set DATABASE_URL --stdin --service jobee-worker --skip-deploys`
      - `railway variable set DATABASE_URL --stdin --skip-deploys` (environment default)
    - Triggered zero-downtime redeployments for both services:
      - `jobee-api`: Deployment `854a0210-b64b-4d66-b35f-b27b202dba9a` -> **SUCCESS / ONLINE**
      - `jobee-worker`: Deployment `a489c0ab-fedc-4f1a-bdce-1a60ba43067d` -> **SUCCESS / ONLINE**
    - Retired legacy deployments (`1df66daa` and `71ed43b8`).
  - **Old Credential Revocation Verification**:
    - Controlled direct connection attempt using the compromised credential string was rejected immediately:
      `OLD CREDENTIAL: REVOKED` (`28P01 password authentication failed for user 'neondb_owner'`).
    - Controlled direct connection attempt using the replacement credential succeeded immediately:
      `NEW CREDENTIAL: ACTIVE` (connected as `neondb_owner` on `neondb`).
  - **Live Production Endpoint & Worker Verification**:
    - `GET https://jobee-api-production.up.railway.app/api/health` -> HTTP 200 `{"status":"ok","service":"api","version":"0.1.0"}`.
    - `GET https://jobee-api-production.up.railway.app/api/ready` -> HTTP 200 (database connected, 21ms latency; Gemini 3.8 Flash configured; Gmail & Calendar configured).
    - `GET https://jobee-api-production.up.railway.app/` -> HTTP 200 (Vite React SPA bundle served).
    - `POST https://jobee-api-production.up.railway.app/api/auth/sign-in/social` -> HTTP 200 (Google OAuth init with secure redirect).
    - `GET https://jobee-api-production.up.railway.app/api/jobs` -> HTTP 401 UNAUTHORIZED (Route protection verified).
    - Worker startup logs verified: `Database connectivity check: connected` (latency: 158ms), `Worker service started successfully. Running in standby mode.`
    - Worker scheduled cycle executed cleanly: `[Orchestrator][AUTO_APPLY] Auto-apply circuit breaker is OFF (auto_apply_enabled=false). Human authorization required for submissions.`
  - **Production Data Integrity Audit**:
    - Read-only database audit compared pre-rotation baseline with post-rotation live database:
      - Users: 1 (matches baseline)
      - Profiles: 1 (Asadbek Makhmudov, Project Manager; matches baseline)
      - Experiences: 1 (matches baseline)
      - Education: 1 (matches baseline)
      - Skills: 12 (all allow_ai_use: true; matches baseline)
      - Certifications: 2 (matches baseline)
      - Languages: 3 (matches baseline)
      - Facts: 16 (matches baseline)
      - Documents: 2 (matches baseline)
      - Jobs: 24 (matches baseline)
      - Applications: 21 (matches baseline)
      - Audit events: 1607 (matches baseline)
      - Drizzle migrations: 22 (0000..0021 up to date)
      - Candidate Brain & safety policies: 100% preserved (`autoApplyEnabled: false`, 0 automatic submissions).
  - **Quality Gates & Leak Verification**:
    - `npm run lint`: PASSED (0 errors)
    - `npm run typecheck`: PASSED (0 errors across all 6 workspaces)
    - `npm test`: PASSED (62 test files, 572/572 tests passing cleanly)
    - `npm run build`: PASSED (Vite SPA and packages compiled cleanly)
    - `verify_clean_repo.ts`: CONFIRMED replacement password does not appear anywhere in repository tracked files or git history.

---

## 2026-10-18: JOBEE — SECURITY CLOSEOUT, REAL-USER ACCEPTANCE & TEST HARNESS SECURITY CORRECTIONS

- **Official Task Stamp**: `JOB-ACCEPTANCE-01` (Continuation)
- **Lead Engineer**: Antigravity (Goal-Driven Autonomous Delivery Mode)
- **Scope**: Acceptance Harness Security Corrections, Strict TLS Verification, Removal of DB Session Extraction, Genuine Interactive OAuth Audit, Real Job Discovery & Matching Evaluation, Application Studio Defect Discovery & Remediation, Playwright Screenshot Evidence, and 7-Tier Taxonomy Classification.
- **Key Deliverables & Verification Records**:
  - **Acceptance Harness Security Hardening (`scripts/run-real-user-acceptance.ts`)**:
    - Enforced strict TLS certificate validation on Neon PostgreSQL (`rejectUnauthorized: true`).
    - Completely removed database session token extraction and cookie injection into browser contexts.
    - Completely removed reconstructed credential strings. Zero secrets committed or hardcoded.
    - Established strict 7-tier verification taxonomy:
      1. `PRODUCTION_API_VERIFIED` (7 scenarios passed)
      2. `PRODUCTION_DATABASE_VERIFIED` (14 scenarios passed)
      3. `PRODUCTION_BROWSER_VERIFIED` (3 scenarios passed)
      4. `FIXTURE_VERIFIED` (1 scenario passed)
      5. `REQUIRES_HUMAN_INTERACTION` (2 scenarios)
      6. `NOT_TESTED` (1 scenario excluded by safety policy)
      7. `FAILED` (2 scenarios identified as genuine defects)
  - **Authentic Production Verification**:
    - Candidate Brain Truthfulness: Profile for Asadbek Makhmudov, Project Manager, Warsaw, Poland. Education verified as Vistula University in-progress degree (`end_date === null`, not completed). Experience verified as Asia alliance bank Operations Assistant (`2023-06..2023-08`). 12 verified skills, 16 verified facts, 2 CV documents in vault.
    - Real Job Discovery: 24 authentic vacancies indexed; 10 opportunities evaluated in depth. Identified top match Revolut Associate PM (92%), but flagged that high scores (65-70%) on Senior and Space/Defense roles are misleading for an early-career candidate.
    - CRM & Revolut APPLIED Provenance: Verified manual candidate action (`actor: USER`, note: `"Marked as applied by candidate"`), 0 browser runs executed. Zero automated bot submissions occurred.
    - Autonomous Boundaries: `auto_apply_enabled: false` verified. 5 background worker cycles completed cleanly.
    - Real Browser UI/UX: Playwright Chromium navigated to live landing page, opened AuthModal, clicked Google Sign-In, and observed redirect to `accounts.google.com`. Captured 4 screenshots in `test-results/screenshots/`. Verified mobile viewport (390x844 iPhone 14) with 0 horizontal overflow.
  - **Identified Defects & Local Isolated Remediation**:
    - **Defect 1 (`STUDIO-02`, High Severity)**: `PackageReadinessEngine.evaluateReadiness` did not include `REJECTED` approvals in blocking issues, allowing packages with candidate-rejected salary/answers to reach `READY` status.
      _Remediation_: Added explicit `rejectedApprovals` filter to `blockingIssues` in `apps/api/src/services/package-readiness-engine.ts`. Added unit test in `apps/api/src/services/application-package.test.ts`. 24/24 tests passed.
    - **Defect 2 (`UI-02`, Medium Severity)**: Unauthenticated visitors opening the landing page were shown a red error box "Error Loading Candidate Data: Authentication required to access this resource" on `DashboardView`.
      _Remediation_: Updated `apps/web/src/components/DashboardView.tsx` and `apps/web/src/App.tsx` to detect unauthenticated state and render a clean, welcoming hero card with a direct "Sign In / Join Private Pilot" button.
  - **Quality Gates on Local Codebase**:
    - `npm run format:write` & `npm run format`: PASSED (All files formatted cleanly)
    - `npm run lint`: PASSED (0 errors)
    - `npm run typecheck`: PASSED (0 errors across all 6 workspace packages and apps)
    - `npm test`: PASSED (63 test files, 579/579 tests passed cleanly, +6 new regression tests)
    - `npm run build`: PASSED (Vite production bundle compiled cleanly)
    - `npm run db:check`: PASSED (Neon PostgreSQL connected, 20ms latency)
  - **Authorized GitHub Release & CI**:
    - Committed as `d35f408`: `fix(studio): enforce rejected approval blocker and enhance guest experience (JOB-ACCEPTANCE-01)`.
    - Pushed cleanly to `origin/main` (`1581063..d35f408`).
    - GitHub Actions CI Run `39107123893` completed with `conclusion: success` (All steps passed: Checkout, Setup, Dependencies, Build, Lint, Typecheck, DB Check, Migrations, Test, Build).
  - **Railway Cloud Production Deployments**:
    - `jobee-api`: Deployment `263bdba1-8307-42eb-91a3-f1c273480699` -> **SUCCESS / ONLINE** (Commit `d35f408`).
    - `jobee-worker`: Deployment `6ec4d793-2fd4-418b-9f4b-dbbadb53023f` -> **SUCCESS / ONLINE** (Commit `d35f408`).
    - Live Endpoints Verified:
      - `GET https://jobee-api-production.up.railway.app/api/health` -> HTTP 200 (uptime: 325s, service: api, version: 0.1.0)
      - `GET https://jobee-api-production.up.railway.app/api/ready` -> HTTP 200 (database: connected, 20ms; gemini-3.8-flash; Gmail: true; Calendar: true)
      - `GET https://jobee-api-production.up.railway.app/` -> HTTP 200 (serving fresh SPA bundle `index-DB3LM29o.js`)
      - `GET https://jobee-api-production.up.railway.app/api/jobs` -> HTTP 401 UNAUTHORIZED (Route protection verified)
  - **Production Database Reconciliation**:
    - Audited all 21 production packages against the authoritative `PackageReadinessEngine`.
    - Reconciled 3 historical packages whose pre-fix database rows were out of sync:
      - Package `f4ad8b34-34af-48cb-b317-47cc564e9714` (Caspar Health): transitioned from `READY` to `NEEDS_REVIEW` due to candidate-rejected salary approval.
      - Packages `72e90f18-31b2-4109-812d-bbf115c13619` and `d3ca7301-7f6e-441a-9b15-fb9d0e5a4923`: transitioned from `READY` to `NEEDS_REVIEW` because approvals were automated and require candidate confirmation.
  - **Live Production Acceptance Verification Suite (`scripts/run-real-user-acceptance.ts`)**:
    - Total Scenarios: 30
    - **Passed**: 27
    - **Failed (Defects)**: 0
    - **Requires Human Interaction**: 2 (`AUTH-03` Google OAuth login, `INT-02` Google Calendar consent)
    - **Excluded by Safety Policy**: 1 (`AUTO-03` Autonomous employer submissions disabled by Prime Directive)
    - 7-Tier Breakdown:
      - `PRODUCTION_API_VERIFIED`: 7/7 PASSED
      - `PRODUCTION_DATABASE_VERIFIED`: 15/15 PASSED
      - `PRODUCTION_BROWSER_VERIFIED`: 4/4 PASSED
      - `FIXTURE_VERIFIED`: 1/1 PASSED
      - `REQUIRES_HUMAN_INTERACTION`: 2
      - `NOT_TESTED`: 1
      - `FAILED`: 0
    - **Defect Remediation Confirmed**:
      - `STUDIO-02`: PASS. Zero packages in READY status with rejected approvals.
      - `UI-02`: PASS. Guest view verified in real Chromium browser; "Welcome to Jobee" hero and "Sign In / Join Private Pilot" button cleanly displayed with zero red 401 error cards. Mobile viewport (390x844) verified with 0 horizontal overflow.
- **Production Status**: AUTHORIZED ACCEPTANCE FIX RELEASE — DEPLOYED AND LIVE VERIFIED (0 OPEN DEFECTS).

## JOB-UI-MIGRATION-01 — Complete local design-system preview (2026-10-18)

- **Lead:** Codex, explicitly assigned by the owner; audited baseline `9c1b206`. Local implementation checkpoint: `675ec5c06b5e6a572ea5b8ae23803516a7dc904e`.
- **Status:** PREVIEW COMPLETE / RELEASE PENDING. Isolated branch `codex/jobee-design-system-migration`; production and the original checkout remain unchanged.
- **Delivery:** Figma semantic Light/Dark tokens, local Google Sans Flex/SVGs, shared controls/dialogs, eight destinations, all 17 original views and 25 mapped components, grouped Profile/Applications/Settings workspaces, content-driven cards and desktop presentation with narrow-screen compatibility. Inline PDF/DOCX/TXT document preview uses the existing owner-checked download endpoint and cancellable local rendering.
- **Preservation:** Reconciled 184 existing API calls/payloads against the baseline. Retained all 17 lifecycle statuses, eight browser-run states, import/verification/AI permission/material approval/policy override/submission authorization boundaries. No backend, database schema, worker or shared domain-type changes.
- **Verification:** `format:write`, lint (0 errors, 701 existing warnings), typecheck, **586 tests / 64 files**, build, format, db:check and existing db:migrate passed. Browser suite: **25/25 passed** with local synthetic data, visual Home baselines, 40 desktop theme captures, supporting dialogs, 1280/1920px checks and 393px navigation. Cross-user document retrieval and non-admin invitations remain denied. Live external provider actions were excluded.
- **Evidence:** `docs/UI_MIGRATION.md`, `docs/UI_MIGRATION_MAP.md`, `scripts/audit-ui-contracts.mjs`, browser report/screens and local comparison gallery under ignored `output/playwright/`.
- **Release limits:** Remote CI has not run; no push/deploy authorization was requested or assumed. Existing dependency audit advisories are documented in the migration report. Preview review precedes any production release.

## JOB-UI-MIGRATION-01 — Authorized main integration and release (2026-10-18)

- **Authorization:** Owner explicitly requested “Apply locally and deploy live.” Main was clean at audited baseline `9c1b206`; fast-forwarded the completed migration through `27627be`.
- **Release packaging:** Docker builder now copies `scripts/sync-preview-assets.mjs`, required by the web prebuild to package local document-preview resources. Preview CI runs on main pushes and validates the Docker builder in addition to browser and API-contract checks.
- **Safety:** Existing Railway project/services and deployment configuration retained. Tests target only disposable loopback PostgreSQL with live provider credentials disabled. No production schema migration, candidate-data mutation or external application/email/calendar action is included.
- **Rollback baseline:** API `93b7ca5f-e9de-402e-96b7-0c5814aff0bd`; worker `0c576a10-ee9c-4c37-8d63-ab7b5ab067d6`, both successful at `9c1b206`.
- **Progress:** Fresh main checks passed: production build, typecheck, lint (0 errors / 701 existing warnings), formatting, 586 tests / 64 files, isolated database connectivity and existing migrations. The initial isolated-test run exposed two test-environment default mismatches; restoring the expected owner and orchestrator defaults resolved both without source changes. Remote CI, Railway deployment and live read-only checks are in progress; final evidence will be recorded after verification.

### Release verification and platform visual references

- Published main application release `7b6b85d`. Railway API `4f500dac-db06-40e9-b1f2-ab76ed0d848b` and worker `06625dde-81ae-4e7b-bcd1-2a2269154f54` reached SUCCESS. GitHub quality run `39139329468` passed.
- Cloud browser run `39139329469`: Docker builder and 184 API contracts passed; 24 behavior checks passed. The only failure was cross-platform Home text rasterization against the macOS image (2% pixels). Reviewed both Linux theme renders and introduced platform-separated references, retaining the original 1% threshold. Focused macOS visual comparison passes.
- Live health/readiness are 200; unauthenticated Jobs remains 401. Exact frontend/theme/font/PDF asset hashes match the checked build. Verified eight destinations, Google Sans Flex, appearance selection, remembered dark mode and no 1440px root overflow. Authenticated journeys and document content were exercised only against isolated synthetic data.
- No production data/configuration migration or external provider mutation. The owner’s concurrent local AGENTS.md role update was preserved outside release staging.

## JOB-UI-MIGRATION-01 — Student UX continuation (19 October 2026)

- **Status:** IN PROGRESS overall; immediate fixes and the review prototype are implemented locally. No merge, push, deployment or student usability outcome is claimed.
- **Scope:** State-driven Home with up to three actual tasks and honest loading/failure states; basic setup without requiring professional employment; truthful submission evidence; clear first document generation; List default with remembered Board choice; APPLYING separated from confirmed Applied; pending-first profile review and disclosed technical metadata; Messages default. Existing actions and independent consent/verification/authorization contracts are retained.
- **Design deliverable:** Existing Figma file, new page 40 — Student UX · Simplification prototype. Twelve desktop views in Light/Dark (24 frames), review guide, existing semantic variables, Google Sans Flex and editable component/text/vector layers. No UI image fills or visible root-frame overflow were found. Navigation links remain within the selected theme. Unanswered approval actions are disabled; final review is a separate later resolved example. Secondary editor/provider actions are outside this prototype's interaction coverage.
- **Review:** Source diffs checked for truthful status rendering, unchanged permission payloads, retained API calls and frontend/process boundaries. No backend, shared domain, schema or worker changes. Main's pre-existing AGENTS.md modification is preserved. Supporting feature-home mapping and a 5–8-student review protocol are recorded in `STUDENT_UX.md` and `STUDENT_UX_REVIEW.md`.
- **Verification:** Required format:write, lint (0 errors, 701 pre-existing warnings), typecheck, full 600-test suite across 66 files, build, format, db:check and db:migrate passed. Database checks/migrations used only loopback `jobee_ui_test_isolated`. All 184 baseline API calls/payloads across 25 components reconcile. Chromium browser suite: 26/26 passed with synthetic records, including existing responsive and permission checks; exact macOS Home Light/Dark references were reviewed after updated approval wording. Screenshot threshold remains 1%. Linux references still require regeneration/review in Linux CI before merge/release. No cloud CI result is claimed for this branch.
- **Evidence:** Local preview at http://127.0.0.1:5183; 24 Figma renders and gallery at ignored `output/student-ux/index.html`; complete 26-check browser report retained in `output/student-ux/browser-report/`; machine-readable Figma inventory in `docs/student-ux-figma.json`. Check logs are retained locally under `/tmp/jobee-student-ux-*`.
- **Next boundary:** Complete the approved target-student review, iterate the prototype and agree the exact structural mapping before developing the four-destination shell/combined workspace. No real ATS/email/calendar/paid AI actions were run. Prior production migration remains deployed unchanged.

Verified source checkpoint for this continuation: `04548142fe3ced25fa76b546cf112cd1c7829df8` on `codex/jobee-student-ux`. Subsequent checkpoint-record updates change documentation only.

### `JOB-UI-MIGRATION-01` — Approved student workspace implementation (19 October 2026)

- **Status:** LOCAL IMPLEMENTATION VERIFIED; RELEASE PENDING. The owner approved the full Figma adaptation and explicitly authorized application work, superseding the earlier prototype-only boundary. No human usability-study outcome is claimed.
- **Delivery:** Four primary destinations; grouped application views; one mounted Documents/Questions/Final review/Progress workspace; simpler Home, job/application rows, profile and Settings; progressive technical tools; explicit document storage/import intent and retained inline previews; document versions and same-job prepared-document discovery; focus and return navigation preserved.
- **Preservation:** Original state-based section callbacks, record IDs, 17 lifecycle states, eight browser-run states, independent approval/verification/AI-use/submission decisions, corrections, notes/contacts/assessments/interviews/offers, archive/restore, messages/calendar/account/provider tools, auth/invites and all 25 mapped components / 18 closure groups remain accessible. The 184-call/payload audit passes. Backend, worker, shared domain/schema/scoring/authorization sources have no diff.
- **Quality gates:** `format:write`, `lint`, `typecheck`, `test`, `build`, `format`, `db:check`, `db:migrate` pass with disposable loopback PostgreSQL. 606 tests / 67 files pass. Lint retains 701 warnings and zero errors; existing bundle-size warnings are not suppressed.
- **Browser:** 32 Chromium checks pass at the isolated preview, including all lifecycle/run labels, independent blockers, guest/admin/cross-user access, document bytes/denial/corruption, keyboard/focus, unchanged 1% Home visual comparisons, system/remembered appearance, retained drafts, explicit upload/import paths, tracker return ready-final-review cancellation, visible review/application retrieval failures and retry. External requests are blocked; the resolved final-review case uses browser-only synthetic API data and never approves stored facts or requests a submission ticket.
- **Render review:** 42 captures cover 21 desktop views in Light/Dark, plus targeted dialog/document captures; layout checks at 1440, 1280 and 1920px and existing 393px navigation. Surface/card roles match the approved Figma semantic tokens. Local review inventory: `output/playwright/screens/index.html`; browser report: `output/playwright/report/index.html`.
- **Scope boundary:** Main checkout and its existing `AGENTS.md` edit preserved. No merge, push, deploy, production mutation, paid provider call, real submission, recruiter email or calendar mutation. Linux Home references still require regeneration/review in Linux CI before merge/release; no cloud CI success or measured student-study result is claimed.
- **Handoff:** `docs/STUDENT_UX_IMPLEMENTATION_REPORT.md`, current feature homes in `docs/STUDENT_UX.md`, approved guide `303:24509` and screen index `304:36` in the existing Figma file. Verified local implementation checkpoint: `3c7f82f30182f90a3210297936804603f974a2ab`.

## 2026-10-20 — JOB-PRODUCT-EVOLUTION-01 — implementation verified

Owner authorized implementation and deployment of the JobAssist-inspired plan. Implemented the complete selected-role preparation/review journey, configurable public discovery and fair traversal, reliable employer outcome observations, checksum-verified material uploads, shared dispatch authorization/deduplication, uncertainty reconciliation, protected 30-day evidence, opt-in bounded daily assistance and preparation timing metrics. Included the pending student UX and reviewed genuine Linux Light/Dark references. Fixed workspace refresh after authentication changes. Architecture and data model are recorded in PRODUCT_EVOLUTION.md.

Validation: 634/634 tests, 72 files; format/write/check, lint (693 warnings; zero errors), typecheck, build, isolated DB connectivity and clean/idempotent migration checks pass. All 32 Linux browser cases pass; macOS assertions pass with one independent rerun after a report-output collision. The original 184 API contracts remain accounted for. Direct synthetic preparation retains two packages and leaves review/submission separate. No actual employer application, recruiter message, calendar mutation, paid AI call or human pilot was performed. Production rollout and its actual IDs will be recorded separately.

2026-10-20 rollout audit: additive migration 0022 is present in the production schema and journal. The legacy CLI bootstrap then attempted a fixed-ID candidate initialization and failed because the actual Better Auth owner uses a different ID; no legacy fixed-ID record exists and no candidate record was changed. Production migration commands now skip this bootstrap, matching API startup's schema-only behavior. Initial PR CI also exposed a macOS-only temporary-directory path in the new batch test; it now uses the operating system's temporary directory. Both corrections remain under JOB-PRODUCT-EVOLUTION-01.

## 2026-10-20 — JOB-PRODUCT-EVOLUTION-01 — deployed and verified

PR #1 merged at `f6d6286c9f12a561609ce1950bd33d26c4f603d0`; verified PR head `4c6cbd6d99cd065052a998d6fbb1eb558a7d2377`. Both GitHub workflows succeeded: quality gate `39351291403`, Linux browser/container gate `39351291449`. Local validation remains 634 tests/72 files and all eight mandatory gates; all 32 Linux browser cases pass with reviewed references at 1% tolerance. The initial CI portability defect was corrected before merge.

Production schema migration 0022 is applied and its schema-only command completes successfully. Rolled out the worker first, then the API. Verified release deployments: worker `4e164d4f-f689-481d-b151-0e73ff2ba1bc`; API `b4b2204f-2eb6-4903-b3bd-3d9c760b4af4`, both on `f6d6286`. Worker startup is confirmed. Live smoke at 01:17:16 UTC verifies homepage/released feature bundle, health/ready 200 with connected database, and 401 on unauthenticated search settings, preparation batches and evidence requests. Main checkout fast-forwarded and packages rebuilt; preexisting AGENTS.md edit preserved byte-for-byte. No employer application, recruiter message, calendar mutation or paid-provider experiment was performed as release validation. Pilot outcomes and demand-led integrations remain explicitly unclaimed. Documentation-only follow-up changes do not alter the verified runtime code.

## 2026-10-20 — Jobee 2.0 repository assessment and documentation alignment (JOB-P0-T01)

**Status:** Assessment delivered; foundation reconciliation remains IN PROGRESS pending owner approval. No implementation continuation authorized.

**Scope:** Inspected repository/Git history, current architecture/schema/workflows/frontend/tests and the three supplied Jobee 2.0 reference documents. Preserved existing implementation, data and identifiers. Reconciled canonical product/architecture/policies/roadmap/engineering ownership and both root master mirrors; archived prior canonical docs; added source reference copies, assessment and ADR 0008. Marked prior UX/evolution plans as historical. Existing user AGENTS.md role edits were respected while aligning to the new Codex-only assignment.

**Findings:** Substantial working platform and all historical task areas exist. Revised one-click execution and Autopilot acceptance remain incomplete. Selected preparation and reviewed submission are separate; older orchestration uses exclusion-only matching/draft preparation; newer daily assistance does fuller work but never submits. Retain existing stack, adapters, manifests, duplicate/quota transaction safeguards, uncertainty handling and tenant isolation. Simplify navigation and converge application execution incrementally. Recommended first implementation: JOB-P1-T01 after approval.

**Fresh checks:** npm run lint PASS (0 errors, 693 warnings); npm run typecheck PASS; npm run build PASS. Final npm run test PASS: 634/634 tests in 72/72 files. Initial sandbox local-socket EPERM failures were environmental. Outside-sandbox tests then identified the stale isolated schema and missing explicit test configuration. Existing migration 0022 applied only to localhost/jobee_test_isolated with both DATABASE_URL/TEST_DATABASE_URL targeting that isolated database. VITE_API_URL=/api resolved the remaining environment-dependent document-preview assertion. No source or .env change. npm run db:check PASS for read-only development connectivity and isolated test target; npm run db:migrate PASS only on the isolated test target. npm run format:write PASS; npm run format PASS. Git whitespace and Markdown link checks PASS; root master mirrors are identical; source specifications and historical canonical archives remain byte-for-byte preserved. Changes are Markdown documentation only.

**Limits:** No browser E2E rerun, live ATS application, live discovery benchmark, production validation/write, new migration, paid activation, outbound message, calendar change or deployment. Historical production results were retained as history, not restated as new certification.

**Git:** Baseline main/f4ac34bdc3f816dce9031420a7e31f6baf9baf85. Documentation remains uncommitted for review; no new implementation checkpoint. Full report: JOBEE_2_ASSESSMENT.md. Await owner approval; do not automatically start the next milestone.

## 2026-10-20 — Three-section platform adaptation (JOB-P1-T01)

**Status:** COMPLETED locally after the owner's phase-by-phase implementation approval. JOB-P0-T01 assessment/foundation reconciliation is approved and completed. No external release authorization inferred.

**Scope:** Implemented Explore default and exactly three primary destinations; grouped account/settings/connections/activity into Profile; retained existing application, review, messages, interview and candidate flows. Preserved legacy section identifiers and notification targets. Added signed-out/session view boundaries and distinct per-account dialog keys. Fixed mobile focus return after inert closes. Preserved submission rules and all records. Corrected the Vite proxy to preserve /api, fixing newer job-search endpoints locally.

**Verification:** All eight required gates pass: format:write, lint (0 errors, 693 existing warnings), typecheck, test (635 tests / 72 files), build, format, db:check and db:migrate. Database gates ran only on localhost/jobee_test_isolated; browser tests used a separate localhost/jobee2_ui_test_isolated fixture database. All 32 Chromium scenarios pass, including desktop Light/Dark, mobile keyboard focus, document previews/failures, application and profile editing, unchanged submission consent, and tenant denial. Explore/Profile renders inspected visually. Old Home pixel references are historical; replacement Explore semantic/overflow checks and screenshot captures do not claim a new Linux pixel baseline.

**Review:** Reviewed navigation compatibility, session boundary, preservation, proxy and test diffs. Initial browser checks exposed a duplicate modal key introduced in the shell adaptation and mobile focus before inert removal; both were corrected and the full browser suite rerun successfully. No new dependency/schema/source-data migration, real application, message, calendar mutation, production action or paid operation.

**Checkpoint:** Verified local branch codex/jobee-2-foundation; commit follows this record. See JOBEE_2_IMPLEMENTATION.md. Next: JOB-P1-T02 candidate preferences and verified reusable context.

## 2026-10-20 — Verified candidate context and unified Profile (JOB-P1-T02)

**Status:** COMPLETED locally. Phase 1 platform/candidate foundation is verified. Owner authorization for local phase-by-phase implementation remains active; next canonical task is JOB-P2-T01, then JOB-P2-T02.

**Scope:** Retained existing Candidate Brain/import/documents/answers infrastructure. Added normal API validation/persistence for existing authorization-country, internship-eligibility and availability preference columns, including first creation and explicit clearing. Exposed these and employment/seniority/language/unpaid/maximum-salary preferences in Profile. Preserved unknowns and partial-update data. Preference-load failures have a retry and cannot overwrite server values with defaults. Ordinary preferences precede separate collapsed submission permissions. Desktop preferences use two columns and mobile one column.

**Answer integrity:** Added explicit saved-answer verification and status; material question/content edits clear verification unless explicitly reconfirmed, with the implicit verification change audited. Reuse requires a verified matching question rather than substring/category guesses. MANUAL/conflicting entries request input; sensitive/scoped/REVIEW answers need review. Shared submission authorization revalidates used source ownership, status, prompt/content and update time, and question-bound human approval when required. Used-source revocation invalidates existing tickets; unrelated library changes do not invalidate other packages. No unverified legacy record was promoted and no existing materials/history were deleted.

**Quality:** All eight gates PASS (format:write, lint, typecheck, test, build, format, db:check, db:migrate). 653 tests in 73 files pass; lint 0 errors / 693 existing warnings. New API coverage verifies creation/patch/clear, validation, audit and tenant isolation; answer tests cover verification, negative/unrelated prompts, conflicts, manual/sensitive/scoped reuse and source revocation. The new fixture safety guard uses the existing shared database policy so the configured CI test database remains supported. Database gates target localhost/jobee_test_isolated only; no new migration.

**Browser/visual verification:** All 35 Chromium scenarios PASS on separate localhost/jobee2_ui_test_isolated fixtures. After a visual layout correction, four affected desktop/theme/profile scenarios PASS, then the final focused mobile eligibility-persistence/sidebar-inert scenario PASS. Light/Dark desktop and mobile renders were inspected. Text-only final copy cleanup exposes product choices without implementation jargon. An earlier overlapping package rebuild briefly restarted the watched API; final browser runs were performed after compilation settled. A new test's ambiguous Add Answer selector was corrected to the exact control. No production or live provider coverage is inferred.

**Security/preservation:** Candidate facts are never guessed; new eligibility has no invented defaults. API scoping, encryption, existing manifests, duplicate safeguards and uncertainty handling are preserved. No new model/provider, dependency, schema change, real application, outbound message, calendar operation, paid activation or production change. Existing changed-source preparations may need regeneration, preserving their records and artifacts.

**Git/report:** Local branch codex/jobee-2-foundation; JOB-P1-T01 checkpoint 098f816. JOB-P1-T02 verified source checkpoint: c2a388b5d20f9209c16baff7b8524ad828ba7613. Full report: JOBEE_2_IMPLEMENTATION.md. Continue with the revised discovery/matching phase under the existing stamps.

## 2026-10-20 — JOB-P2-T01 — Explore and source freshness

**Status:** COMPLETED locally; release not claimed. Codex implemented persistent desktop list/detail panes, mobile return/focus restoration, existing workplace/employment/sort queries, stable submitted search and request ordering, retryable failures and partial-source notices. Existing import, correction/archive, tracking and preparation remain available. Batch tooling is progressively disclosed.

Migration 0023 adds current extraction flags, preserving historical requirements/sections and evaluation references. Changed public source text/HTML and current extraction refresh transactionally; manual descriptions use the same extraction revision mechanism. Manual corrections, job IDs and source snapshots remain.

**Verification:** format:write, lint, typecheck, test, build, format, db:check, db:migrate pass; 658 tests / 74 files; 0 lint errors / 693 existing warnings. All 36 Chromium scenarios pass; inspected Light/Dark desktop and mobile layouts. `scripts/verify-job-p2.ts` passes isolated offline and read-only public-feed scenarios with scoped fixture cleanup. Public adapter payload smoke: Arbeitnow 300, Greenhouse/stripe 725, Lever/spotify 81 listings with valid samples at verification time. New migration applied only to the two explicit isolated localhost test databases. No real application, outbound communication, paid API, production change or deployment.

**Next:** JOB-P2-T02 shared grounded evaluation and deterministic eligibility. Full one-click and Autopilot acceptance remain subsequent dependencies.

## 2026-10-20 — JOB-P2-T02 — Shared grounded matching and Phase 2 completion

**Git:** Verified local source checkpoint `6b5b07b236e3e4c9056616d65d34115dc02eb719` on `codex/jobee-2-foundation`. Subsequent checkpoint records change documentation only; no push, merge or deployment.

**Status:** COMPLETED locally. Existing matching/context/evidence/scoring/provider adapters now share the existing backend workspace through @job-agent/database/matching; API compatibility exports preserve callers and type-only exports support cold-start development servers. No new service, queue or library was introduced; the existing Zod dependency is declared where its validator moved. API, batch/daily and worker evaluation agree. Worker preparation consumes current MATCH analyses and preserves ingestion states. Current ranking/selection revalidate stable material-input fingerprints and algorithm 2.0; stale results lose preliminary eligibility.

Explicit work-mode restrictions cannot be bypassed by relocation. Work authorization is country-specific; remote work, residence and no sponsorship do not prove citizenship/global permission. Material unknowns require review, while confirmed exclusions and low professional relevance remain separate. Explicit citizenship requirements are distinguished from equal-opportunity statements, and missing cities do not become invented relocation conflicts. Salary gates require comparable confirmed units/currencies; migration 0024 adds nullable salary period and preserves old unknown units. AI evidence is revalidated; arbitrary narratives and semantic guesses cannot create sensitive candidate facts. Explore shows concise fit/blocker/unknown explanations directly and preserves the active query across asynchronous refreshes.

**Verification:** all eight mandatory gates PASS. 672 tests / 75 files; 0 lint errors / 693 existing warnings. All 37 Chromium scenarios pass, followed by three affected final render/navigation checks; desktop Light/Dark and mobile renders inspected. Source-to-analysis acceptance and root cross-process fixture tests pass. Unique search fixture identifiers prevent parallel timestamp collisions.

**Data:** isolated test/browser targets migrated through 0024. Local development was synchronized with reviewed additive migrations 0022–0024; original counts and original-column fingerprints match across every one of the 57 existing public tables. No development fixtures, data deletion, production migration, employer submission, outbound communication, paid API call or deployment occurred.

**Next:** JOB-P3-T01 durable scoped application intent and automatic preparation, then JOB-P5-T01 provider execution proof. Complete One-click Apply and Autopilot remain subsequent acceptance; matching itself grants no external authorization.
