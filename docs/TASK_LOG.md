# AI Job Agent — Engineering Task Log

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
