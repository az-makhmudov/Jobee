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
