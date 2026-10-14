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
- **Scope**: Formalization of Railway as the official cloud hosting platform for Jobee; dynamic `$PORT` environment variable preprocessing in Fastify; `trustProxy: true` configuration for Railway Cloudflare/Envoy SSL termination; Playwright container stability flags (`--no-sandbox`, `--disable-dev-shm-usage`, `--disable-gpu`); declarative multi-service Railway deployment configurations (`railway.json` for API service, `railway.worker.json` for autonomous background worker); Neon Free PostgreSQL and Cloudflare R2 integration; deployment runbooks and Hobby plan cost evaluation (~$5.00–$8.00/mo); and automated deployment verification suite (`scripts/verify-railway-deployment.ts`).
