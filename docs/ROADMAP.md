# Jobee 2.0 — Canonical Roadmap

Updated 2026-10-20. Owner: Codex. This is a delta roadmap over a working implementation, not a greenfield restart. Legacy delivery claims remain in archive/jobee-1.0/ROADMAP.md and TASK_LOG.md. COMPLETED historically does not mean revised 2.0 acceptance has passed.

## Reconciled status and dependency order

PARTIAL means implemented capabilities exist but revised acceptance remains open. PENDING means no 2.0 delivery has begun. The owner approved the assessment and phase-by-phase implementation on 2026-10-20; JOB-P0-T01 is COMPLETED for foundation reconciliation. No new official task identifiers are introduced.

| Order | Task       | Historical checkpoint                     | 2.0 status                         | Required delta / exit evidence                                                                                                              |
| ----- | ---------- | ----------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | JOB-P0-T01 | 4f932fe; subsequent policy/rebrand work   | COMPLETED — approved 2026-10-20    | Approve reconciled product, architecture, policies and plan                                                                                 |
| 2     | JOB-P1-T01 | e4e4815; later auth/UI releases           | COMPLETED                          | Three primary sections; old links and private-user isolation preserved; navigation regression checks                                        |
| 3     | JOB-P1-T02 | e4e4815; import/intelligence follow-ups   | COMPLETED                          | Unified Profile, verified reusable routine facts/answers, country authorization and progressive onboarding; no fabricated defaults          |
| 4     | JOB-P2-T01 | b7e7e80; discovery release f6d6286        | PARTIAL                            | Explore with essential filters/two-pane detail; actual-source relevance/freshness verification; preserve manual import                      |
| 5     | JOB-P2-T02 | 432cfa0; career intelligence follow-ups   | PARTIAL                            | Same grounded AI evaluation and deterministic hard gates on every execution path; unknown versus blocker versus poor fit verified           |
| 6     | JOB-P3-T01 | 024c742; persistent batch release f6d6286 | PARTIAL                            | Single authorized background entry point, automatic routine materials, minimal intervention and safe resume; package UI no longer mandatory |
| 7     | JOB-P5-T01 | d9006e7; crash/evidence follow-ups        | PARTIAL                            | One provider proved through complete one-click workflow; uncertain/duplicate/cancel/recovery cases; owner-approved live validation          |
| 8     | JOB-P3-T02 | 6941d1f; contextual workspace follow-ups  | PARTIAL                            | Simple Applications with separate execution/employer state and attention queue; preserve manual history/documents                           |
| 9     | JOB-P5-T02 | 9a1c56b; daily assistant f6d6286          | PARTIAL                            | Shared proven pipeline, explicit versioned policy, atomic quotas, schedule/pause/revoke/recovery; policy boundary tests                     |
| 10    | JOB-P4-T01 | 6591f44; later OAuth hardening            | PARTIAL — preserve/defer expansion | Existing Gmail/classification/linking retained; validate real authorized enrichment in Applications                                         |
| 11    | JOB-P4-T02 | 2de982d; later UI/integration work        | PARTIAL — preserve/defer expansion | Existing calendar/prep retained; validate scoped interview flows in application context                                                     |

Historical checkpoints are implementation provenance, not fresh release certification. Full evidence is in JOBEE_2_ASSESSMENT.md. Prerequisites mean close the listed delta and verify reuse; do not rebuild already-working subsystems. Numeric phase order is superseded by the dependency order above: JOB-P5-T01 precedes completion of JOB-P3-T02 and JOB-P5-T02; email/calendar expansion does not block one-click.

## Implementation sequence

JOB-P1-T01 is implemented and verified locally (2026-10-20; see JOBEE_2_IMPLEMENTATION.md). Its delivered scope is a coherent three-section application-shell migration: Explore as default, Applications for execution and employer activity, Profile for candidate context, documents, answers, preferences, integrations and automation settings. Reuse existing views/tokens; redirect legacy section identifiers and notification targets. Remove Home and Settings as primary destinations, preserve useful functionality contextually, and keep the present reviewed submission controls until the new authorization contract is implemented and tested. No data migration is expected for this shell change. Verify responsive navigation, accessibility, old links, authentication and regression checks.

JOB-P1-T02 is also verified locally: existing candidate import/documents/facts were preserved, missing eligibility preferences are persisted and exposed, reusable answers require explicit verification, and used sources are revalidated at submission. See JOBEE_2_IMPLEMENTATION.md. Continue with JOB-P2-T01 and JOB-P2-T02 deltas using existing modules. The first core application-engine task is JOB-P3-T01, followed immediately by JOB-P5-T01. Minimal attempt persistence and audit events belong in that earlier workflow; do not wait for the full CRM task.

## Source roadmap and acceptance scenarios

The owner-supplied scope, release milestones and scenarios follow. Completion states are exclusively the reconciled matrix above.

# JOBEE 2.0 — ROADMAP.md

**Version:** 2.0\
**Date:** 2026-10-20\
**Engineering owner:** Codex\
**Repository target:** az-makhmudov/Jobee\
**Status:** Revised execution plan; completion states require repository verification

## 1. Development Operating Model

Codex is the single engineering agent responsible for:

- Repository inspection.
- Architecture and implementation planning.
- Technical decisions.
- Frontend and backend development.
- AI integration.
- Browser automation.
- Database migrations.
- Testing and verification.
- Documentation.
- Engineering completion reports.

ChatGPT-to-Antigravity handoffs are discontinued.

The user approves consequential product changes, credentials, external integrations and application-autonomy policies.

## 2. Task Management Rules

Preserve all existing official task identifiers from JOB-P0-T01 through JOB-P5-T02.

Do not rename historical IDs or fabricate completed tasks.

Continue using macro tasks representing meaningful end-to-end deliverables.

Minor UI components, API endpoints, database tables and fixes are implementation details inside these tasks and should not receive separate official task stamps.

A task is complete only after relevant code, data changes, UI flows, tests and documentation are verified.

## 3. First Action — Repository Reality Audit

Before executing the revised roadmap, Codex must:

1. Inspect the current repository and Git state.
2. Read AGENTS.md and relevant documentation.
3. Establish which canonical tasks have already been implemented.
4. Identify reusable frontend and backend modules.
5. Inspect existing schemas, migrations, agent workflows and application state.
6. Identify obsolete or unnecessary screens.
7. Determine the safest migration path toward Jobee 2.0.
8. Produce a gap analysis and revised task-status matrix.

This audit is part of foundation reconciliation, not a newly stamped microtask.

The old master document's unconfirmed implementation status must not be treated as proof that the codebase is empty.

## 4. Revised Macro-Task Scope

### JOB-P0-T01 — Project Foundation, Architecture, Policies & Documentation

Finalize Jobee 2.0 product scope, three-section UX, One-click + Autopilot modes, permission policies, technical boundaries, canonical documentation and decision records.

Acceptance: All canonical documents describe the same product, architecture and development workflow.

### JOB-P1-T01 — Workspace, Database & Core Platform Foundation

Establish or adapt the application shell, core API, database tooling, reusable UI components, shared models, error handling, background execution foundations, test setup and development standards.

Acceptance: Stable foundation and functional navigation for Explore, Applications and Profile.

### JOB-P1-T02 — Candidate Brain, Documents, Answer Library & Preferences

Deliver an end-to-end verified candidate information system, CV management, reusable application answers, job preferences, authorization facts, automation settings and unified Profile interface.

Acceptance: The agent has reliable candidate context and sufficient approved information to prepare routine applications without repeated user input.

### JOB-P2-T01 — Job Ingestion, Parsing, Normalization & Job Inbox

Build job discovery and import capabilities, normalization, duplicate detection, source tracking, essential search/filtering and the Explore interface.

Acceptance: Users can discover or import actual jobs and open consistent job details.

### JOB-P2-T02 — Requirement Analysis, Matching & Policy Decision Engine

Build AI-based job evaluation, semantic matching, requirement extraction, eligibility checks, clear match explanations, ranking and submission eligibility decisions.

Acceptance: Jobee distinguishes professionally relevant jobs, hard blockers and unknown requirements without fabricated certainty.

### JOB-P3-T01 — Application Studio, Tailored Materials & Human Approval

Preserve the task stamp, but redefine the user-facing experience.

The Application Studio becomes an internal application preparation capability, not a required standalone page.

Implement truthful CV selection/tailoring, application document generation, question interpretation, reusable-answer retrieval, approval handling, material versioning and the single-action preparation entry point.

Acceptance: One user action creates an authorized, resumable application workflow that can prepare all routine materials automatically.

### JOB-P5-T01 — Browser Application Worker & Initial ATS Adapters

Move this existing task earlier in the implementation order.

Implement isolated browser execution, provider adapters, form understanding and completion, document upload, validation, submission, result verification, retries, idempotency, and manual fallback.

Acceptance: Jobee can complete and verify real, authorized applications through at least one supported provider without mandatory intermediate user steps.

This task is a core dependency of the revised MVP.

### JOB-P3-T02 — Application CRM, Lifecycle, Audit Timeline & Analytics

Implement the simplified Applications interface, persistent records, execution histories, employer pipeline states, linked documents, manual application tracking, actions requiring user attention, and basic progress metrics.

Minimal attempt persistence and audit events needed by earlier one-click execution must be introduced when that workflow is built. This task completes the full user-facing tracking experience.

Acceptance: Every attempted application has a reliable, auditable status and can be inspected without exposing unnecessary internal complexity.

### JOB-P5-T02 — Autonomous Orchestrator, Scheduling, Notifications & Production Hardening

Implement Autopilot using the proven one-click application pipeline.

Add scheduled discovery, job selection, automatic authorization evaluation, application limits, background scheduling, pause/resume controls, notifications, failure recovery, observability and production safeguards.

Acceptance: Jobee can discover and apply for eligible jobs without individual clicks, strictly within explicit user permissions and supported execution capabilities.

### JOB-P4-T01 — Email Intelligence, Job Alerts & Application Status Synchronization

Connect authorized email accounts, ingest alerts and recruiter communications, classify messages, link conversations to applications, identify employer responses and flag ambiguous matches.

Display relevant communication within Applications rather than introducing a required Inbox navigation page.

Acceptance: Real, relevant employment messages enrich the correct application records.

### JOB-P4-T02 — Calendar, Interview Scheduling & Interview Preparation

Add interview invitation interpretation, availability checks, scheduling suggestions, authorized calendar updates, interview briefs and reminders.

Acceptance: Interview-related activities remain connected to the relevant application and require appropriate authorization.

## 5. Revised Implementation Order

Original task identifiers remain canonical, but tasks are executed according to dependencies and product value.

| Order | Task       | Product milestone                              |
| ----- | ---------- | ---------------------------------------------- |
| 1     | JOB-P0-T01 | Approved architecture and repository alignment |
| 2     | JOB-P1-T01 | Functional platform and simplified interface   |
| 3     | JOB-P1-T02 | Verified candidate intelligence                |
| 4     | JOB-P2-T01 | Working job discovery                          |
| 5     | JOB-P2-T02 | Reliable AI job matching                       |
| 6     | JOB-P3-T01 | Automatic application preparation              |
| 7     | JOB-P5-T01 | Real one-click application execution           |
| 8     | JOB-P3-T02 | Complete MVP application tracking              |
| 9     | JOB-P5-T02 | Autopilot                                      |
| 10    | JOB-P4-T01 | Email and recruiter integration                |
| 11    | JOB-P4-T02 | Interview and calendar integration             |

If repository inspection reveals implemented work or a dependency mismatch, Codex should adjust execution order without renaming tasks or discarding completed functionality.

## 6. Release Milestones

### Release A — Functional Jobee Foundation

Verified candidate profile, simple application shell, real jobs, job details, filters and explainable matching.

### Release B — One-click Apply MVP

A user can select a supported vacancy, click once, allow the agent to complete the authorized application, verify submission and track the result.

This is the first revised MVP release.

### Release C — Jobee Autopilot

Scheduled discovery and authorized automatic applications using the same tested engine.

### Release D — Connected Jobee

Real employer correspondence, interview handling, calendar assistance and intelligent follow-up workflows.

## 7. Quality Gates

Each macro task must be evaluated through:

- Working functionality, not screenshots alone.
- Relevant unit, integration and end-to-end tests.
- Validated schema changes.
- Typecheck, lint and build checks.
- Proper failure and recovery states.
- Data privacy and authorization review.
- Documentation changes.
- Accurate completion reports.
- A clean, traceable Git checkpoint.

For browser submission tasks, tests must include safe fixtures or approved test targets and carefully controlled live validation.

No unauthorized real application should be submitted as part of automated testing.

## 8. One-click Acceptance Scenarios

The application system must demonstrate:

**Success:** Candidate and job are eligible; application is prepared, submitted and verified.

**Missing information:** Agent pauses, requests only the missing material information and resumes appropriately.

**Unsupported provider:** User receives an accurate explanation and manual handoff.

**Execution failure:** Attempt is recorded as failed or unresolved, not applied.

**Ambiguous submission:** System avoids duplicate retry until the result is resolved.

**Duplicate vacancy:** Existing application is recognized and unintended resubmission is prevented.

**User interruption:** Background workflow handles cancellation or pause according to its current safe execution point.

## 9. Autopilot Acceptance Scenarios

Autopilot must:

- Require explicit enablement.
- Apply only within stored authorized preferences.
- Reject hard-disqualified jobs.
- Avoid repeated applications.
- Respect volume and scheduling limits.
- Pause for material uncertainty.
- Produce verifiable outcome records.
- Support pause, resume and disable actions.
- Never silently override user rules.

## 10. Codex Task Completion Report

After each macro task, Codex must report:

1. Canonical task stamp and status.
2. Functionality completed.
3. Architectural decisions.
4. Frontend changes.
5. Backend and database changes.
6. AI and integration changes.
7. Tests executed and results.
8. Known limitations.
9. Security and privacy implications.
10. Documentation updated.
11. Git state and checkpoint.
12. Remaining gaps and recommended next task.

The report must distinguish verified functionality from planned or partially completed work.
