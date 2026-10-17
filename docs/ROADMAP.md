# Jobee — Canonical Macro-Task Roadmap

This document defines the authoritative macro-task roadmap for **Jobee** (formerly AI Job Agent), directly aligned with Section 16 of the master context. All engineering tasks remain under these official task stamps.

---

## Phase 0 — Foundation

### `JOB-P0-T01 — Project Foundation, Architecture, Policies & Documentation`

- **Status**: COMPLETED
- **Purpose**: Establish product scope, MVP boundary, system architecture, agent operating rules, deterministic/AI boundaries, security baseline, application policy framework, and canonical master context.

---

## Phase 1 — Core Platform and Candidate Intelligence

### `JOB-P1-T01 — Workspace, Database & Core Platform Foundation`

- **Status**: COMPLETED
- **Scope**: TypeScript monorepo bootstrap, web/API/worker boundaries, PostgreSQL/Drizzle ORM setup, migration workflow, environment configuration, shared types, structured logging, error handling, app shell, health/readiness endpoints, test suite, and CI quality gates.

### `JOB-P1-T02 — Candidate Brain, Documents, Answer Library & Preferences`

- **Status**: COMPLETED
- **Scope**: Candidate data model (experience, education, projects, skills, languages, certifications, verified facts), CV/document metadata, master profile and role-oriented CV variants, answer library, job preferences, application policy configuration, profile UI, and audit-aware updates.

---

## Phase 2 — Job Intelligence

### `JOB-P2-T01 — Job Ingestion, Parsing, Normalization & Job Inbox`

- **Status**: COMPLETED
- **Scope**: Canonical Job model, manual URL/text ingestion, source/provider detection, job content extraction, normalized fields, requirement storage, deduplication, ingestion retry/error states, and Job Inbox UI.

### `JOB-P2-T02 — Requirement Analysis, Matching & Policy Decision Engine`

- **Status**: COMPLETED
- **Scope**: Mandatory vs. preferred requirement analysis, grounded evidence resolution, 8-dimension scoring with dynamic re-weighting, hard policy engine (blockers vs. soft gaps), AI semantic provider abstraction with anti-hallucination validation guard, deterministic policy decisions (MATCH, REVIEW, SKIP, AUTO_APPLY preliminary eligibility), state fingerprinting staleness invalidation, bounded batch analysis, and ranked Job Inbox & Detail UI.

---

## Phase 3 — Application Workflow

### `JOB-P3-T01 — Application Studio, Tailored Materials & Human Approval`

- **Status**: COMPLETED
- **Scope**: Application package model, CV base selection, truthful CV tailoring, cover letter drafting, question interpretation, answer library matching, approval request generation, safe handling of legal/salary unknowns, Application Review UI, and document versioning.

### `JOB-P3-T02 — Application CRM, Lifecycle, Audit Timeline & Analytics`

- **Status**: COMPLETED
- **Scope**: Application entity, state machine lifecycle with 17 canonical states, frozen submission provenance, event timeline, recruiter linkage, manual submission logging, outcome tracking, sub-entities (notes, contacts, assessments, interviews, offers), funnel metrics, conversion analytics, and Personal ATS Kanban & Table Dashboard.
- **Milestone**: **MVP Milestone** — Completion of `JOB-P3-T02` achieves the first complete **Personal ATS MVP milestone**.

---

## Phase 4 — Communication and Interviews

### `JOB-P4-T01 — Email Intelligence, Job Alerts & Application Status Synchronization`

- **Status**: COMPLETED
- **Scope**: Email integration abstraction, OAuth/token handling, job-alert ingestion, confirmation/rejection/offer detection, recruiter-thread matching, automatic CRM status updates where permitted by policy, and ambiguous-email review queue.

### `JOB-P4-T02 — Calendar, Interview Scheduling & Interview Preparation`

- **Status**: COMPLETED
- **Scope**: Calendar integration abstraction, Google Calendar & Fixture providers, token encryption, availability aggregation, conflict detection with severity & alternatives, interview calendar event booking, grounded preparation briefs (zero-hallucination candidate strengths & STAR frameworks, 6-step checklist), post-interview debriefs with CRM lifecycle audit logging, and Interview Workspace Web UI.

---

## Phase 5 — Controlled Automation

### `JOB-P5-T01 — Browser Application Worker & Initial ATS Adapters`

- **Status**: COMPLETED
- **Scope**: Isolated Playwright worker, secure job execution contract, provider/adapter interface (Greenhouse, Lever, Ashby), form field mapping, document uploads, validation, idempotency, screenshots/logs, manual handoff, CAPTCHA stop behavior, and submission audit events.

### `JOB-P5-T02 — Autonomous Orchestrator, Scheduling, Notifications & Production Hardening`

- **Status**: COMPLETED
- **Scope**: Scheduled discovery/analysis runs, background queues, retry/backoff, concurrency controls, auto-apply authorization evaluation, rate limiting, notification/approval reminders, end-to-end observability, security hardening, activity dashboard, and runbooks.

---

## Phase 6 — Production Readiness & Autonomous Completion

### `JOB-PROD-01 — Backend Authorization, Submission Guardrails & Profile Sandbox`

- **Status**: COMPLETED
- **Scope**: Backend authorization for candidate actions, auto-apply circuit breakers, submission approval guards, and test profile preservation sandbox.

### `JOB-PROD-02 — Cryptographic Manifest-Bound Submission Authorization`

- **Status**: COMPLETED
- **Scope**: SHA-256 submission manifest binding, tamper-evident answers, and replay prevention.

### `JOB-AUTH-01 — Better Auth Identity, Multi-Tenant Isolation & Private Pilot`

- **Status**: COMPLETED
- **Scope**: Better Auth integration, Google OAuth & Email/Password, invitation-only onboarding, and session management.

### `JOB-PROD-03 — Public Job Discovery, Ingestion & Containerized Cloud Deployment`

- **Status**: COMPLETED
- **Scope**: Public job feeds (Arbeitnow & Greenhouse API), single-port production serving via Fastify static, and Docker multi-stage containerization.

### `JOB-PROD-04 — Multi-Tenant Auth Hardening, Open AI Architecture & Mobile Responsiveness`

- **Status**: COMPLETED
- **Scope**: Strict multi-tenant route protection (`requireCurrentUserId`), pluggable AI providers (`GeminiAiProvider`, `OpenAiAiProvider`, `DisabledAiProvider`), settings UI with live connectivity diagnostics, and certified responsive mobile layouts.

### `JOB-PROD-05 — Multi-Tenant Isolation, Dynamic AI Configuration, Cloud Storage & Deep-Link Onboarding`

- **Status**: COMPLETED
- **Scope**: Multi-tenant cross-user penetration testing suite (`multi-tenant-isolation.test.ts`), dynamic database-persisted AI provider selection with UI switching (`DynamicAiProvider`), transactional invitation email dispatch with deep-link URL onboarding (`?invite=...`), pluggable cloud document storage abstraction (`S3StorageProvider` with AWS4-HMAC-SHA256 signing), single-port production static asset serving verification, and full multi-user end-to-end workflow validation (`verify-multi-user-e2e.ts`).

### `JOB-HOST-01 — Free-First Hosting Policy (Oracle Cloud ARM64, Neon & Cloudflare R2)`

- **Status**: COMPLETED
- **Scope**: Formalization of Free-First hosting policy across permanent directives; evaluation of Oracle Cloud Always Free Ampere A1 (ARM64), multi-arch Docker, Playwright headless Chromium on ARM, 24/7 background worker execution, Neon Free PostgreSQL with auto-SSL detection and cold start pooling, Cloudflare R2 zero-egress document storage, paid fallback contingency (Hetzner CAX11 at ~€3.79/mo), and automated infrastructure verification suite (`scripts/verify-free-first-infrastructure.ts`).

### `JOB-HOST-02 — Official Railway Hosting Architecture & Production Multi-Service Deployment`

- **Status**: COMPLETED
- **Scope**: Formalization of Railway as the official cloud hosting platform for Jobee; Infrastructure as Code (`.railway/railway.ts`) migration eliminating deprecated `railway.json` configurations; dynamic `$PORT` environment variable preprocessing in Fastify; `trustProxy: true` configuration for Railway Cloudflare/Envoy SSL termination; Playwright container stability and defense-in-depth non-root execution (`USER node`, UID 1000); actual container build and dual-service execution verification; Neon Free PostgreSQL and Cloudflare R2 integration; deployment runbooks and Hobby plan cost evaluation (~$5.00–$8.00/mo); and automated deployment verification suite (`scripts/verify-railway-deployment.ts`).

### `JOB-PROD-DEPLOY — Production Multi-Service Launch & Topological Build Fix`

- **Status**: COMPLETED
- **Scope**: Solved monorepo workspace topological build order for clean container and CI environments; deployed dual services (`jobee-api` and `jobee-worker`) on Railway; wired shared variables and verified single-port SPA serving with Neon PostgreSQL connectivity.

### `JOB-POST-DEPLOY — UI Layout Stabilization & Google Integrations Audit`

- **Status**: COMPLETED
- **Scope**: Fixed pilot invitation modal CSS styling and layout; configured dynamic fallback for Google Calendar/Gmail credentials via shared OAuth variables; stabilized production container execution and verified live health probes.

### `JOB-PROD-MIGRATION — Production Data Migration & Cloudflare R2 Document Vault Sync`

- **Status**: COMPLETED
- **Scope**: Connection pool isolation and cross-database safety checks (`createDatabaseClient`); secured pre-migration backups; mapped single-tenant local candidate data (`00000000-0000-0000-0000-000000000001`) to authenticated Google OAuth owner (`asadbek.mzw@gmail.com`); migrated all profile tables, candidate facts, jobs, applications, and audit history to Neon PostgreSQL; trimmed trailing whitespace from Railway S3 credentials; uploaded and verified 11/11 documents to private Cloudflare R2; and verified live authenticated downloads.

### `JOB-AI-MGMT — AI Integration Repair, Gemini 3.8/3.5 Models & Resilient Failover`

- **Status**: COMPLETED
- **Scope**: Audited live Google Generative Language models via API; detected deprecation of `gemini-2.5-flash` (HTTP 404); preferred modern `gemini-3.8-flash` with high-availability fallback to `gemini-3.5-flash-lite` on 503 high-demand spikes; added safe model validation in settings and UI dropdowns; repaired persisted database settings referencing obsolete models; and verified truthfulness invariants and structured output validation.

### `JOB-E2E-WORKFLOW — End-to-End Job Search & Application Workflow Verification & Stabilization`

- **Status**: COMPLETED
- **Scope**: Comprehensive 11-phase end-to-end functional verification across the complete stack: public feed discovery (Arbeitnow & Greenhouse), deterministic 8-dimension matching, tailored CV & grounded cover letter generation with metric safeguard, Application Package studio with human approval gating, controlled ATS automation with bot challenge detection and cryptographic manifest checksums, 17-state CRM lifecycle and timeline audit, Gmail MIME parsing, deterministic classification, entity resolution and status synchronization, all 13 production UI routes responding 200, autonomous background worker pipeline cycles with circuit breaker safety, and 100% clean teardown.

### `JOB-STUDIO-REPAIR — Production Application Studio Repair: DOCX Generation, Cloudflare R2 Upload & Package Recovery`

- **Status**: COMPLETED
- **Scope**: Resolved production "fetch failed" bug in Application Studio. Identified root cause in Linux container IPv6 DNS socket routing and keep-alive socket closures with Cloudflare R2 edge. Added bounded retries with exponential backoff and jitter, transient socket error classifier, 15-second per-request timeouts, explicit error cause preservation, and `dns.setDefaultResultOrder('ipv4first')`. Re-engineered ApplicationPackageService to use a 2-phase commit pattern with safe compensation (storage upload before DB commit, rollback on failure, zero orphaned storage objects). Implemented self-healing idempotency to resume and repair broken or incomplete draft packages. Polished frontend with Jobee dark-theme inline notification banner, retry button, loading progress, and double-click prevention. Verified 11/11 phases live against production Neon database and Cloudflare R2, healed historical broken packages, and achieved 100% test coverage with zero regressions.

### `JOB-SMART-PROFILE-IMPORT — Smart Candidate Profile Creation & Enrichment via AI Document Extraction`

- **Status**: COMPLETED
- **Scope**: Implemented intelligent Candidate Profile creation and enrichment using uploaded CVs (PDF & DOCX) and LinkedIn profile exports. DocumentTextExtractor with format auto-detection and control-character stripping. SmartProfileExtractor powered by Google Gemini AI with strict zero-hallucination guardrails and sourceReference citations, complemented by a deterministic heuristic fallback parser for users declining AI consent. ProfileComparisonEngine featuring 6-way classification (MATCHED, DUPLICATE, NEW, CONFLICT, INCOMPLETE, LOW_CONFIDENCE). SmartProfileImportService providing transactional session management, human-in-the-loop review, conflict resolution, selective commit into Candidate Brain (isVerified: false initially per Prime Directive, separate AI authorization toggle), full audit trail (candidate_audit_events), and automatic profile completeness recalculation. Multi-step interactive SmartProfileImportModal in frontend, integrated into Dashboard, Profile, and Documents views.

### `JOB-CAREER-INTEL-2.0 — Candidate Brain & AI Career Intelligence 2.0 Platform`

- **Status**: COMPLETED
- **Scope**: Transformed Jobee from a CV-based job matching system into an AI-powered personal career intelligence platform. Implemented Phase A–I across all layers:
  - Extended Candidate Brain with rich intelligence (transferable capabilities, verification provenance, AI permission flags, source references, last confirmed dates, contradiction tracking).
  - Migration `0021_career_intelligence_2.sql` with new tables `candidate_job_feedback` and `candidate_intelligence_suggestions`.
  - `CareerIntelligenceEnrichmentService` proposing transferable skills, career paths, and missing details gated behind human approval.
  - `CandidateIntelligenceContextBuilder` with deterministic SHA-256 state hashing and privacy-minimized context selection strictly gating on verified and authorized claims.
  - `MatchingScoringEngine` evaluating 6 Career Fit Categories (`STRONG_MATCH`, `GOOD_MATCH`, `TRANSFERABLE_SKILLS_MATCH`, `GROWTH_OPPORTUNITY`, `NOT_CURRENTLY_ELIGIBLE`, `INSUFFICIENT_INFORMATION`) with deterministic hard blocker enforcement and dynamic learned preference adjustments.
  - `CandidateJobFeedbackService` supporting 7 user feedback types (`INTERESTED`, `NOT_INTERESTED`, `IRRELEVANT`, `ALREADY_APPLIED`, `TOO_SENIOR`, `WRONG_LOCATION`, `WRONG_INDUSTRY`) with inspectable and reset-able preference weights.
  - Dedicated React 19 UI: `CareerIntelligenceView.tsx`, `CareerFitBadge.tsx`, `JobFeedbackBar.tsx`, integrated into Job Inbox, Job Detail, and navigation.
  - Multi-tenant isolated test suite `career-intelligence.test.ts` (12 integration tests) and 100% clean quality gates (59 test suites, 527 tests, 0 lint/typecheck errors, clean Vite production build, authentic seed candidate data verified with 0 synthetic records).

### `JOBEE-MACRO-PHASE-1 — Core Job Intelligence & Application Workflow Stabilization & E2E Validation`

- **Status**: COMPLETED
- **Scope**: Autonomous multi-system implementation, repair, integration, and validation covering:
  - Critical test safety & database isolation: Hardened global safety guard in `packages/database/src/safety.ts`, rejecting primary development databases (`ai_job_agent_dev`, `jobee_dev`, `postgres`) on localhost, requiring explicitly isolated test databases (`jobee_test_isolated`).
  - Job Discovery (`JOB-P2-T01`): Verified Arbeitnow and Greenhouse public job boards; fixed Greenhouse job title boilerplate in `greenhouse-extractor.ts`; verified URL and content-hash deduplication and multi-source provenance.
  - Requirement Analysis & Matching (`JOB-P2-T02` & `JOB-CAREER-INTEL-2.0`): Enforced verified `projects` inclusion under `verificationStatus === 'VERIFIED' && allowAiUse === true`; extended generalizable transferable capability families in `candidate-evidence-resolver.ts` without candidate-specific hardcoding; validated 6 Career Fit categories.
  - Career Feedback Learning (`JOB-CAREER-INTEL-2.0`): Validated 7 user feedback types, deterministic ranking penalties, and reversible preference weights without candidate fact mutation.
  - Application Studio (`JOB-P3-T01`): Verified ATS-readable Tailored CV DOCX and grounded Cover Letter generation with metric safeguards; verified Question/Answer Library matching with human approval gating.
  - Application CRM (`JOB-P3-T02`): Verified 17-state CRM lifecycle, human-in-the-loop transition to `READY_TO_APPLY`, and audit history.
  - End-to-End Workflow (`JOB-E2E-WORKFLOW`): Validated all 11 phases (Phase A–K) cleanly on `jobee_test_isolated` with 0 failures, 0 database orphans, and 100% clean quality gates (format, lint, typecheck, 560/560 vitest tests, build). Verified pristine preservation of real candidate data in `ai_job_agent_dev`.
