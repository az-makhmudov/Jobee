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

### `JOBEE-MACRO-PHASE-2 — Communication Intelligence, Autonomous Operations & Macro Phase 1 Release Closure`

- **Status**: COMPLETED
- **Scope**: Large-scope autonomous engineering, integration, repair, testing, and validation covering:
  - **Macro Phase 1 Release Closure & Safety Audit**: Performed read-only database reconciliation of primary development database `ai_job_agent_dev`. Verified 100% preservation of genuine candidate records for Asadbek Makhmudov (`00000000-0000-0000-0000-000000000001`): 1 user, 1 profile, 1 Master CV document, 1 experience, 1 education, 14 skills, 2 certifications, 3 languages, 6 candidate facts. Reconciled 1 Greenhouse vacancy ingestion with zero unverified fact contamination.
  - **Global Test Database Safety (`packages/database/src/safety.ts`)**: Made test database isolation globally mandatory across all mutation-capable verification scripts. Implemented `assertSafeTestUser`, `assertScopedCleanup`, and `assertDatabaseHasNoPrimaryCandidateData`, completely preventing primary candidate data mutation or unscoped teardowns.
  - **Live Job Discovery Acceptance (`JOB-P2-T01`, `JOB-P2-T02`)**: Executed comprehensive evaluation script (`scripts/evaluate-real-job-discovery.ts`) against 24 authentic live vacancies from Arbeitnow and Greenhouse boards. Verified 100% compliance with the Anti-Inflation Invariant (`unverifiedScore <= verifiedScore`) and generated `docs/REAL_JOB_DISCOVERY_ACCEPTANCE.md`.
  - **Gmail & Communication Intelligence (`JOB-P4-T01`)**: Validated token cryptographic encryption envelopes (`v1:primary:` AES-256-GCM), MIME parsing, deterministic classification across 11 email archetypes, entity resolution to CRM applications, automatic status synchronization, and human review queue escalation via `scripts/verify-job-p4-t01.ts`.
  - **Calendar & Interview Workspace (`JOB-P4-T02`)**: Validated Google Calendar OAuth token encryption, meeting availability, conflict detection, interview booking, grounded STAR preparation briefs, pre-interview checklists, and post-interview debriefs via `scripts/verify-job-p4-t02.ts`.
  - **Browser Worker & ATS Automation (`JOB-P5-T01`)**: Validated Greenhouse, Lever, and Ashby adapters in `DRY_RUN` mode, bot challenge/CAPTCHA halt triggers, missing facts halting, and Fastify worker endpoints via `scripts/verify-job-p5-t01.ts`.
  - **Autonomous Orchestration & Worker Scheduling (`JOB-P5-T02`)**: Validated full pipeline cycles, backoff calculations, daily submission quota enforcement, auto-apply circuit breaker protection, reminder dispatch, and observability endpoints via `scripts/verify-job-p5-t02.ts`.
  - **Application CRM Lifecycle (`JOB-P3-T02`)**: Verified complete 17-state machine, legal terminal transitions, correction overrides, sub-entities, and analytics via `scripts/verify-crm-lifecycle.ts`.
  - **Comprehensive Multi-System E2E Workflow (`JOB-E2E-WORKFLOW`)**: Validated Phases A through K across the entire stack on `jobee_test_isolated` via `scripts/verify-e2e-workflow.ts` with 100% clean teardown.

### `JOBEE-MACRO-PHASE-3 — Final Product Completion, Production Release & Real-World Acceptance Validation`

- **Status**: COMPLETED
- **Scope**: Autonomous multi-system engineering, security review, release hardening, acceptance testing, and product completion covering:
  - **Candidate Brain Discrepancy Reconciliation**: Audited and confirmed authentic candidate background in `ai_job_agent_dev` (`Asadbek Makhmudov`, `Asia Alliance Bank`, `Vistula University`, 14 verified skills, 2 certifications, 3 languages, 6 candidate facts). Verified that previous reference to `Universal Mobile Systems` was an isolated synthetic fixture in evaluation scripts on `jobee_test_isolated`. Replaced fixture with authentic profile mirror for realistic evaluation runs with zero test pollution.
  - **Deterministic Matching & Anti-Inflation Hardening (`JOB-P2-T02`)**: Hardened `CandidateEvidenceResolver` across all requirement types (skills, languages, education, certifications, and experience). Unverified candidate claims match as `PARTIAL` (with `confidence: 50` and `contributesToBlocker: isMandatory`), preventing unverified claims from clearing blockers or inflating scores. Rejected claims are strictly ignored.
  - **Interview Preparation Hardening (`JOB-P4-T02`)**: Hardened `InterviewPreparationService` to strictly filter candidate strengths and STAR frameworks to `verificationStatus === 'VERIFIED' && allowAiUse === true`. Unverified matching claims are routed to preparation gaps as requiring verification. Added cryptographic source fingerprinting (`computeSourceFingerprint`) and dynamic staleness invalidation (`CANDIDATE_UPDATED`, `JOB_UPDATED`, `INTERVIEW_UPDATED`).
  - **Comprehensive Verification Suite Execution**: Executed full battery of end-to-end integration scripts against `jobee_test_isolated`: `evaluate-real-job-discovery.ts` (24 authentic vacancies, 100% anti-inflation compliance), `verify-e2e-workflow.ts` (Phases A through K passed), `verify-crm-lifecycle.ts` (100% scenarios passed), `verify-job-p4-t01.ts`, `verify-job-p4-t02.ts`, `verify-job-p5-t01.ts`, `verify-job-p5-t02.ts`, and `verify-multi-user-e2e.ts`.
  - **Full Quality Gates Passed**: Verified `npm run format:write`, `npm run lint` (0 errors), `npm run typecheck` (0 errors), `npm test` (62/62 files, 567/567 tests passed), `npm run build` (clean Vite SPA compilation), and `npm run db:check` (connected). Product verified ready for controlled real-world private pilot.

### `JOBEE-RELEASE-BLOCKER-RESOLUTION — Release Blocker Resolution & Candidate Brain Reconciliation`

- **Status**: COMPLETED
- **Scope**: Autonomous release audit, data integrity reconciliation, and anti-inflation hardening. Resolved all discrepancies between model reports and authentic database records in `ai_job_agent_dev`. Decoupled factual verification from AI authorization. Hardened `CandidateEvidenceResolver`, `MatchingContextBuilder`, and `MatchingScoringEngine` against score inflation from unverified claims. Verified 62/62 test files and 572/572 tests passing cleanly on `jobee_test_isolated`.

### `JOBEE-CONTROLLED-PRODUCTION-RELEASE — Controlled Production Release & Real-World Live Verification`

- **Status**: COMPLETED
- **Scope**: Controlled, authorized release of Macro Phases 1–3 and blocker fixes to GitHub and Railway production. Pushed 7 verified commits (`eea6821..afe5a04`) to `origin/main`. GitHub Actions CI run `39099428225` passed 100% green. Railway services `jobee-api` (`2bd1fb22-743a-4f30-b667-b36111af0cc0`) and `jobee-worker` (`5610b5a8-0199-4aa1-8ce5-2c8c1a9c5c0a`) deployed and verified ONLINE. Synchronized `jobee-worker` `DATABASE_URL` with active Neon production credentials. Performed read-only audit of production Neon database confirming candidate Asadbek Makhmudov's profile, authentic experiences, verified skills, and strict invariants (`autoApplyEnabled: false`, 0 unauthorized submissions). Verified live endpoints (`/api/health`, `/api/ready`, `/`, social OAuth, 401 API guardrails).

### `JOBEE-SECURITY-REMEDIATION-01 — Neon Credential Rotation, Railway Synchronization & Zero-Leakage Production Verification`

- **Status**: COMPLETED
- **Scope**: Authorized production security remediation. Invalidate exposed Neon PostgreSQL database credential, safely rotate production password via Neon control plane REST API, synchronize replacement credential across Railway services (`jobee-api`, `jobee-worker`, and environment default) via secure authenticated stdin interfaces, confirm old credential rejection (`28P01 password authentication failed`), verify zero-downtime redeployments (`854a0210` and `a489c0ab`), confirm live endpoint health (`/api/health`, `/api/ready`), and perform read-only production audit confirming 100% data integrity preservation.

### `JOBEE-POST-DEPLOY-ACCEPTANCE-01 — Security Remediation Closeout, Real-User Acceptance & Production Validation`

- **Status**: COMPLETED
- **Scope**: Production post-deployment validation and acceptance testing. Pushed sanitized documentation commits (`ada47c6..db8de74`) cleanly to `origin/main`; verified GitHub Actions CI Run `39102103583` completed green; validated live production API and Worker deployment health on Railway; executed comprehensive automated and Playwright Chromium real-browser acceptance test suite across 27 operational scenarios:
  - Authentication guardrails & Google OAuth initiation (HTTP 401 on private routes, valid PKCE challenge).
  - Candidate Brain factual truthfulness (Asadbek Makhmudov, Project Manager, Warsaw; Vistula University in-progress degree; Asia alliance bank Operations Assistant; 12 verified skills; 16 verified facts; 2 CV documents).
  - Real job discovery (24 authentic production vacancies indexed; 15 Project Management / Operations roles identified).
  - Intelligent matching & anti-inflation invariants (92% top score at Revolut; unverified claims cannot satisfy mandatory requirements).
  - Application Studio & anti-hallucination safeguards (21 packages; tailored CV/cover letter dynamically grounded in actual profile).
  - Application CRM & Revolut APPLIED provenance trace (20 applications; Revolut application manually marked as applied by candidate with 0 automated bot runs).
  - Communication intelligence (Gmail connected and live verified; Calendar unconfigured and pending owner action).
  - Autonomous operations & circuit breakers (`auto_apply_enabled: false` verified; 5 worker orchestration runs completed cleanly).
  - Playwright Chromium real-browser UI/UX validation on desktop (1280x800) and mobile (390x844 iPhone 14) viewports with 0 horizontal overflow blowout.
- **Verdict**: 27/27 initial scenarios PASSED (0 failed, 0 blocked). Identified two critical defects (`STUDIO-02` package readiness bypass on rejected approvals and `UI-02` unauthenticated dashboard error banner) for controlled remediation.

### `JOB-ACCEPTANCE-01 (Continuation) — Authorized Acceptance Fix Release & Controlled Production Validation`

- **Status**: COMPLETED
- **Scope**: Product Owner authorized defect finalization, regression testing, GitHub release, Railway deployment, and production verification:
  - **STUDIO-02 Remediation**: Enforced that `REJECTED` approval requests deterministically prevent application packages from transitioning to `READY` status in `PackageReadinessEngine`. Decoupled automation-resolved checks and added comprehensive regression coverage for mixed approval states (`APPROVED + REJECTED`, `PENDING + REJECTED`, `RECONFIRMATION + REJECTED`).
  - **UI-02 Remediation**: Transformed unauthenticated dashboard experience in `DashboardView.tsx` from raw red error banner (`Error Loading Candidate Data: Authentication required`) into a welcoming guest landing hero with direct "Sign In / Join Private Pilot" action connecting to `AuthModal`.
  - **Acceptance Harness Security**: Removed all production session extraction, cookie injection, and reconstructed credentials in `scripts/run-real-user-acceptance.ts`. Enforced strict TLS validation (`rejectUnauthorized: true`) and wrapped all database queries in `try ... finally` blocks.
  - **Candidate Identity Reconciliation**: Verified genuine candidate identity (`81d5cb73-3c7f-48ec-88b9-52ce39ed0fbf`), confirming that references to `00000000-0000-0000-0000-000000000001` were artifacts of historical local development environments, not production anomalies.
  - **Work Authorization Audit**: Clarified distinction between candidate residence status (Warsaw, Poland), student status at Vistula University, generic jurisdiction answer library entry ('yes'), and unconfirmed work permits for foreign jurisdictions (e.g. Optics11 in Netherlands explicitly rejected by candidate).
  - **Quality Gates**: All local gates passed: `npm run format` (clean), `npm run lint` (0 errors), `npm run typecheck` (0 errors), `npm test` (63/63 test files, 579/579 tests passed), and `npm run build` (clean Vite SPA compilation).
  - **Release & Production Deployment**: Committed as `d35f408` and pushed to `origin/main`. GitHub Actions CI Run `39107123893` completed with `conclusion: success`. Railway services `jobee-api` (`263bdba1-8307-42eb-91a3-f1c273480699`) and `jobee-worker` (`6ec4d793-2fd4-418b-9f4b-dbbadb53023f`) auto-built and deployed to `SUCCESS / ONLINE`.
  - **Database Reconciliation**: Safely reconciled historical production packages with the new `PackageReadinessEngine`. Package `f4ad8b34-34af-48cb-b317-47cc564e9714` (Caspar Health) with candidate-rejected approval was transitioned from `READY` to `NEEDS_REVIEW`.
  - **Live Acceptance Suite Verification**: Executed `scripts/run-real-user-acceptance.ts` live against production: 30 scenarios executed (27 PASSED, 0 FAILED / DEFECTS, 2 REQUIRES_HUMAN for genuine OAuth consent, 1 EXCLUDED by safety invariant). Both `STUDIO-02` and `UI-02` verified completely resolved in live production!

## JOB-UI-MIGRATION-01 — Desktop design system migration

Status: **DEPLOYED / LIVE VERIFIED**. Codex completed the visual migration, eight-destination navigation and inline document preview. All 25 mapped components and 18 closure groups have implementation evidence. Quality gates passed: 586 tests, 25 browser checks, typecheck/build/lint/format and isolated database checks. Owner approved applying locally and deploying live. Main checkout is integrated; Railway API and worker successfully deployed `7b6b85d`. Live themes, exact assets, health/readiness and access protection verified. Platform-specific visual references address cloud font rendering differences without relaxing thresholds. See `docs/UI_MIGRATION.md`.
