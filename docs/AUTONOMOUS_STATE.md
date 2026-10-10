# AI Job Agent — Autonomous Execution State

**Document Status:** Canonical Durable Execution State  
**Updated At:** 2026-10-10 13:00:00 UTC  
**Active Lead Engineer:** Antigravity (Autonomous Execution Mode)

---

## 1. Roadmap Snapshot

- **Current Official Roadmap Milestone:** `JOB-P5-T02`
- **Milestone Name:** Autonomous Orchestrator, Scheduling, Notifications & Production Hardening
- **Milestone Status:** COMPLETED
- **Previous Completed Milestone:** `JOB-P5-T01` (Browser Application Worker & Initial ATS Adapters)
- **Macro Roadmap Status:** **ALL ROADMAP MILESTONES COMPLETED (Phases 0 through 5)**
- **Last Successful Git Checkpoint:** Pending Commit for `JOB-P5-T02`

---

## 2. Milestone Progress Tracker

| Milestone ID | Description                                       | Status        | Verification & Checkpoint |
| ------------ | ------------------------------------------------- | ------------- | ------------------------- |
| `JOB-P0-T01` | Project Foundation, Architecture, Policies        | COMPLETED     | Verified in `docs/`       |
| `JOB-P1-T01` | Workspace, DB & Core Platform Foundation          | COMPLETED     | `e4e4815`                 |
| `JOB-P1-T02` | Candidate Brain, Documents, Answer Library        | COMPLETED     | `e4e4815`                 |
| `JOB-P2-T01` | Job Ingestion, Parsing, Normalization, Inbox      | COMPLETED     | `b7e7e80`                 |
| `JOB-P2-T02` | Requirement Analysis, Matching & Policy Engine    | COMPLETED     | `432cfa0`                 |
| `JOB-P3-T01` | Application Studio & Tailored Materials           | COMPLETED     | `024c742`                 |
| `JOB-P3-T02` | Application CRM, Lifecycle & Analytics (MVP)      | COMPLETED     | `6941d1f`                 |
| `JOB-P4-T01` | Email Intelligence & CRM Status Sync              | COMPLETED     | `6591f44`                 |
| `JOB-P4-T02` | Calendar, Interview Scheduling & Prep Workspace   | COMPLETED     | `2de982d`                 |
| `JOB-P5-T01` | Browser Application Worker & Initial ATS Adapters | COMPLETED     | `d9006e7`                 |
| `JOB-P5-T02` | Autonomous Orchestrator, Scheduling & Hardening   | **COMPLETED** | Verified (256/256 tests)  |

---

## 3. Milestone Delivery Summary (`JOB-P5-T02`)

### Delivered Subsystems:

1. **Schema & Persistence (`packages/database`):**
   - `orchestration_runs`: execution tracking table (`id`, `user_id`, `task_type` [PIPELINE_CYCLE, DISCOVERY, MATCHING, PREPARATION, AUTO_APPLY, EMAIL_SYNC, REMINDERS], `trigger` [SCHEDULED, MANUAL, EVENT], `status` [PENDING, RUNNING, COMPLETED, PARTIAL, FAILED], `step_logs` JSONB audit trail, `summary` JSONB metrics, `retry_count`, `max_retries`, `backoff_until`, `error_message`, timestamps).
   - `system_notifications`: in-app notification center table (`id`, `user_id`, `type` [APPROVAL_REMINDER, CAPTCHA_HALT, MANUAL_REVIEW_REQUIRED, AUTO_APPLY_SUCCESS, AUTO_APPLY_FAILED, RATE_LIMIT_EXCEEDED, EMAIL_SYNC_ALERT, INTERVIEW_UPCOMING, SYSTEM_ALERT], `severity` [INFO, WARNING, CRITICAL], `title`, `message`, `data` JSONB, `status` [UNREAD, READ, DISMISSED], `action_url`, `read_at`, timestamps).
   - `notification_preferences`: user notification channels and toggles table (`id`, `user_id`, `email_notifications_enabled`, `in_app_notifications_enabled`, `notify_on_captcha_halt`, `notify_on_manual_review`, `notify_on_auto_apply`, `notify_on_upcoming_interview`, `daily_digest_enabled`, timestamps).
   - Migration `0013_orchestrator_scheduling_notifications.sql` generated and applied to PostgreSQL `ai_job_agent_dev`.
2. **Contracts & DTOs (`packages/shared`):**
   - Full domain typing in `packages/shared/src/types/orchestrator.ts`: `OrchestrationTaskType`, `OrchestrationTrigger`, `OrchestrationRunStatus`, `SystemNotificationType`, `SystemNotificationSeverity`, `SystemNotificationStatus`, `OrchestrationStepLog`, `OrchestrationRunSummary`, `OrchestrationRunDto`, `CreateOrchestrationRunDto`, `SystemNotificationDto`, `NotificationPreferencesDto`, `SystemMetricsDto`.
3. **Configuration & Hardening (`packages/config`):**
   - Added environment configuration with Zod validation in `packages/config/src/env.ts` and `.env.example`: `ORCHESTRATOR_ENABLED`, `ORCHESTRATOR_POLL_INTERVAL_MS`, `DISCOVERY_INTERVAL_MINUTES`, `EMAIL_SYNC_INTERVAL_MINUTES`, `REMINDERS_INTERVAL_MINUTES`, `RATE_LIMIT_DAILY_APPLICATIONS_DEFAULT`.
4. **Autonomous Orchestration Engine & Worker Runner (`apps/worker`):**
   - `AutonomousOrchestrator`: multi-stage background scheduler handling discovery, matching, preparation, auto-apply, email sync, and reminders.
   - Deterministic exponential backoff calculation (`calculateBackoff`) with bounded jitter and retry tracking.
   - Circuit breaker invariant: strictly prevents automated submissions when `auto_apply_enabled: false`, requiring explicit human authorization.
   - Daily rate limit & quota enforcement (`max_applications_per_day`) preventing submission bursts and protecting candidate reputation.
   - Bot challenge (`STOPPED_CAPTCHA`) and missing fact (`STOPPED_MANUAL_REVIEW`) notification dispatchers alerting the candidate for review.
   - Notification dispatcher (`NotificationDispatcher`) validating user preferences before creating in-app alerts.
   - Heartbeat polling loop in `WorkerService` processing scheduled pipeline cycles and on-demand orchestration runs.
5. **Fastify REST API (`apps/api`):**
   - 8 notification endpoints: `GET /api/notifications`, `GET /api/notifications/unread-count`, `POST /api/notifications`, `PATCH /api/notifications/:id/read`, `POST /api/notifications/mark-all-read`, `DELETE /api/notifications/:id`, `GET /api/notifications/preferences`, `PUT /api/notifications/preferences`.
   - 5 orchestrator endpoints: `GET /api/orchestrator/runs`, `GET /api/orchestrator/runs/:id`, `POST /api/orchestrator/runs`, `GET /api/orchestrator/status`, `GET /api/orchestrator/metrics`.
   - System observability: lightweight `/health/live` liveness probe and deep dependency `/health/ready` probe checking database connectivity and schema readiness.
6. **React 19 Frontend Web UI (`apps/web`):**
   - Interactive `NotificationCenterModal.tsx` with unread filtering, direct navigation actions, and preferences configuration.
   - Header notification bell with live unread badge counter in `App.tsx`.
   - Enhanced `ActivityView.tsx` (Activity & Autonomous Operations Hub) with metric cards, on-demand trigger controls, live trace inspector modal, and candidate brain audit log tab.
   - Typed API clients: `notification-client.ts`, `orchestrator-client.ts`.
7. **Production Operations Documentation:**
   - Authored `docs/RUNBOOKS.md`: comprehensive operations guide covering architecture, health probes, emergency halt procedures, CAPTCHA recovery, rate limiting, and incident playbooks.
8. **Quality & End-to-End Verification:**
   - 33 test files, 256/256 tests passing (0 failures).
   - Live script: `scripts/verify-job-p5-t02.ts` verified 10/10 sections against PostgreSQL `ai_job_agent_dev` with 100% clean teardown.

---

## 4. Current Quality & Build Status

- **Database Connectivity:** `npm run db:check` -> PASSED (18ms latency)
- **Database Migrations:** `npm run db:migrate` -> PASSED (0000 through 0013 up to date)
- **Unit & Integration Tests:** `npm test` -> PASSED (33 test files, 256/256 tests passing)
- **TypeScript Typecheck:** `npm run typecheck` -> PASSED (0 errors across 6 workspaces)
- **ESLint:** `npm run lint` -> PASSED (0 errors)
- **Build:** `npm run build` -> PASSED (API, Worker, Web bundle compile cleanly)
- **Prettier:** `npm run format` -> PASSED (All files formatted)

---

## 5. Next Steps & Operating Posture

With the full completion of Phase 0 through Phase 5, the core engineering requirements of the AI Job Agent roadmap are satisfied:
1. Candidate Brain, verified facts, documents, answer library, and preferences.
2. Job ingestion, parsing, normalization, and deduplication.
3. Grounded match intelligence, 8-dimension scoring, and policy evaluation.
4. Application studio, truthful CV tailoring, cover letter drafting, and human approval queue.
5. Personal ATS CRM, 17-state lifecycle machine, audit timeline, and conversion analytics.
6. Email intelligence, OAuth token handling, recruiter-thread matching, and CRM status sync.
7. Calendar integration, conflict detection, interview booking, and grounded STAR preparation briefs.
8. Controlled browser worker with Greenhouse, Lever, and Ashby ATS adapters, bot challenge halt, and zero-hallucination form filling.
9. Autonomous orchestrator, background scheduling, in-app notification center, and production runbooks.

Recommended next steps:
- Create Git checkpoint commit for `JOB-P5-T02`.
- Production deployment verification and end-to-end integration readiness assessment.
