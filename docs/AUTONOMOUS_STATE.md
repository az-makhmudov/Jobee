# AI Job Agent — Autonomous Execution State

**Document Status:** Canonical Durable Execution State  
**Updated At:** 2026-10-10 13:00:00 UTC  
**Active Lead Engineer:** Antigravity (Autonomous Execution Mode)

---

## 1. Roadmap Snapshot

- **Current Official Roadmap Milestone:** Post-Roadmap Product Validation & Stabilization
- **Milestone Name:** Private-Pilot Readiness Validation & Defect Remediation
- **Milestone Status:** READY_FOR_PRIVATE_PILOT
- **Previous Completed Milestone:** `JOB-P5-T02` (Autonomous Orchestrator, Scheduling, Notifications & Hardening)
- **Macro Roadmap Status:** **ALL ROADMAP MILESTONES COMPLETED (Phases 0 through 5) + STABILIZATION COMPLETE**
- **Last Successful Git Checkpoint:** Pending (`fix(pilot): resolve security and concurrency defects, harden schema, and verify pilot readiness`)

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
| `JOB-P5-T02` | Autonomous Orchestrator, Scheduling & Hardening   | COMPLETED     | `9a1c56b`                 |
| `PILOT-STAB` | Security Audit, Stabilization & Pilot Readiness   | **COMPLETED** | Verified via `scripts/verify-pilot-readiness.ts` |

---

## 3. Stabilization & Defect Remediation Summary

1. **DEF-01 (CRITICAL - Concurrency Race)**:
   - Atomic state claim (`PENDING` -> `RUNNING`) and `onConflictDoUpdate` claim in `browser-runner.ts` and `browser-application-engine.ts` preventing race conditions where multiple worker polling ticks double-launch and double-submit applications.
2. **DEF-02 (CRITICAL - Form Matching Bypassing Verification)**:
   - Hardened `base-ats-adapter.ts` with word-boundary matching (min 3 chars) and strict exclusion of `val.isSensitive` and unverified answers from automatic form prefill.
3. **DEF-03 (HIGH - Worker Crash on Missing Column)**:
   - Corrected email account query in `autonomous-orchestrator.ts` to filter by `status = 'CONNECTED'` instead of non-existent `is_active` column.
4. **DEF-04 (HIGH - OAuth Callback Route Mismatch)**:
   - Added route alias for `/email/accounts/gmail/callback` in `email-routes.ts` matching `GMAIL_REDIRECT_URI` configuration.
5. **DEF-05 (HIGH - Auto-Apply Loop on Halts)**:
   - Transitioned applications to `NEEDS_REVIEW` upon `STOPPED_CAPTCHA` or `STOPPED_MANUAL_REVIEW`, stopping repetitive retry loops.
6. **DEF-06 (MEDIUM - Crash Recovery)**:
   - Added `recoverOrphanedRuns()` at worker startup in `worker.ts` to reconcile stale `RUNNING` rows in `browser_application_runs` and `orchestration_runs` to `FAILED`.
7. **DEF-07 & DEF-09 (MEDIUM - Database Integrity Constraints)**:
   - Added compound unique constraint `(userId, jobId)` to `application_packages` and foreign key on `duplicateOfId` referencing `jobs.id` (`onDelete: 'set null'`). Authored and applied migration `0014_harden_pilot_schema.sql`.

---

## 4. Current Quality & Build Status

- **Database Connectivity:** `npm run db:check` -> PASSED (PostgreSQL connected, 29ms latency)
- **Database Migrations:** `npm run db:migrate` -> PASSED (0000 through 0014 up to date)
- **Unit & Integration Tests:** `npm test` -> PASSED (33 test files, 256/256 tests passing)
- **TypeScript Typecheck:** `npm run typecheck` -> PASSED (0 errors across 6 workspaces)
- **ESLint:** `npm run lint` -> PASSED (0 errors across codebase)
- **Build:** `npm run build` -> PASSED (API, Worker, and Web bundle compile cleanly)
- **Prettier:** `npm run format` -> PASSED (All matched files conform)
- **Live Pilot Readiness Suite:** `scripts/verify-pilot-readiness.ts` -> PASSED (11/11 sections passed cleanly with 0 failures, 100% clean teardown)

---

## 5. Private-Pilot Readiness & External Integration Boundaries

### Fully Verified Locally (Ready for Private Pilot):
- Candidate Brain: verified facts, documents, answer library, and privacy guardrails.
- Job Ingestion: pasted text, URL ingestion, deduplication, and requirement extraction.
- Match Intelligence: 8-dimension scoring, composite fit, and anti-hallucination validation.
- Application Studio: truthful CV tailoring, cover letter drafting, and human approval gates.
- Application CRM: 17-state machine lifecycle, audit timeline, and conversion analytics.
- Email Intelligence: fixture email connection, message classification, and application thread linking.
- Calendar Integration: fixture calendar connection, conflict detection, interview booking, and grounded STAR preparation briefs.
- Controlled Browser Worker: Greenhouse, Lever, and Ashby ATS adapters in `DRY_RUN` mode, bot challenge halting (`STOPPED_CAPTCHA`), and missing facts halting (`STOPPED_MANUAL_REVIEW`).
- Autonomous Orchestrator: background scheduling, daily quota enforcement, in-app notifications, and system health observability (`/health/live`, `/health/ready`).

### External Integrations Requiring Live Credentials for Production / Live Pilot:
1. **Google OAuth 2.0 Credentials**: `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET` for live Google account sync.
2. **Live External ATS Submissions**: Executing live submissions (instead of `DRY_RUN` / `PREFILL_ONLY`) requires explicit human approval and candidates enabling `auto_apply_enabled: true` in policy settings.
3. **Headless Browser Runtime**: Deployment container requires Playwright browser binaries (`npx playwright install --with-deps chromium`).
