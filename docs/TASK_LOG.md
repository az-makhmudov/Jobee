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
