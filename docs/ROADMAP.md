# AI Job Agent — Canonical Macro-Task Roadmap

This document defines the authoritative macro-task roadmap for AI Job Agent, directly aligned with Section 16 of the master context. All engineering tasks must remain under these official task stamps.

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

- **Status**: PENDING
- **Scope**: Calendar integration abstraction, interview invitation extraction, proposed-time parsing, availability checks, scheduling policy modes (manual / suggest / auto), calendar event creation, interview records, company/role preparation briefs, and follow-up reminders.

---

## Phase 5 — Controlled Automation

### `JOB-P5-T01 — Browser Application Worker & Initial ATS Adapters`

- **Status**: PENDING
- **Scope**: Isolated Playwright worker, secure job execution contract, provider/adapter interface (Greenhouse, Lever, Ashby), form field mapping, document uploads, validation, idempotency, screenshots/logs, manual handoff, CAPTCHA stop behavior, and submission audit events.

### `JOB-P5-T02 — Autonomous Orchestrator, Scheduling, Notifications & Production Hardening`

- **Status**: PENDING
- **Scope**: Scheduled discovery/analysis runs, background queues, retry/backoff, concurrency controls, auto-apply authorization evaluation, rate limiting, notification/approval reminders, end-to-end observability, security hardening, activity dashboard, and runbooks.
