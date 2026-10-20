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
