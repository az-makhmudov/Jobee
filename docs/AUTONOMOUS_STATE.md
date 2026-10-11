# Jobee — Autonomous Execution State

**Document Status:** Canonical Durable Execution State  
**Updated At:** 2026-10-11 11:15:00 UTC  
**Active Lead Engineer:** Antigravity (Autonomous Execution Mode)

---

## 1. Roadmap Snapshot

- **Current Official Roadmap Milestone:** Production Readiness & Security Enforcement
- **Milestone Name:** Backend Authorization Enforcement & Safety Boundary Hardening
- **Milestone Status:** COMPLETED (LOCAL CHECKPOINT)
- **Previous Completed Milestone:** `JOB-P0-T01-STABILIZATION` (Autonomous Stabilization & Readiness Hardening)
- **Macro Roadmap Status:** **ALL ROADMAP MILESTONES COMPLETED (Phases 0 through 5) + STABILIZATION & BACKEND AUTHORIZATION HARDENING COMPLETE**
- **Active Git Checkpoint:** `904c19f` (`feat(security): enforce backend authorization for submissions and approvals (JOB-PROD-01)`)

---

## 2. Milestone Progress Tracker

| Milestone ID               | Description                                                       | Status        | Verification & Checkpoint                        |
| -------------------------- | ----------------------------------------------------------------- | ------------- | ------------------------------------------------ |
| `JOB-P0-T01`               | Project Foundation, Architecture, Policies                        | COMPLETED     | Verified in `docs/`                              |
| `JOB-P1-T01`               | Workspace, DB & Core Platform Foundation                          | COMPLETED     | `e4e4815`                                        |
| `JOB-P1-T02`               | Candidate Brain, Documents, Answer Library                        | COMPLETED     | `e4e4815`                                        |
| `JOB-P2-T01`               | Job Ingestion, Parsing, Normalization, Inbox                      | COMPLETED     | `b7e7e80`                                        |
| `JOB-P2-T02`               | Requirement Analysis, Matching & Policy Engine                    | COMPLETED     | `432cfa0`                                        |
| `JOB-P3-T01`               | Application Studio & Tailored Materials                           | COMPLETED     | `024c742`                                        |
| `JOB-P3-T02`               | Application CRM, Lifecycle & Analytics (MVP)                      | COMPLETED     | `6941d1f`                                        |
| `JOB-P4-T01`               | Email Intelligence & CRM Status Sync                              | COMPLETED     | `6591f44`                                        |
| `JOB-P4-T02`               | Calendar, Interview Scheduling & Prep Workspace                   | COMPLETED     | `2de982d`                                        |
| `JOB-P5-T01`               | Browser Application Worker & Initial ATS Adapters                 | COMPLETED     | `d9006e7`                                        |
| `JOB-P5-T02`               | Autonomous Orchestrator, Scheduling & Hardening                   | COMPLETED     | `9a1c56b`                                        |
| `REAL-ACT`                 | Real Functionality Activation & Truthful De-bias                  | PARTIAL       | Remediated in `REAL-ACT-REMEDIATION` (`c7537b4`) |
| `REAL-ACT-REMEDIATION`     | Candidate Data Integrity, Human Authorization & Safety Boundaries | COMPLETED     | `bd28ca8`                                        |
| `JOB-P0-T01`               | Jobee Foundation, Rebrand & Private GitHub Repo Setup             | COMPLETED     | `4f932fe`                                        |
| `JOB-P0-T01-REMEDIATION`   | Post-Migration Security & CI Remediation                          | COMPLETED     | `442fa23`                                        |
| `JOB-P0-T01-CLEANUP`       | Git History Security Cleanup & Sensitive SQL Purge                | COMPLETED     | `1b62e69`                                        |
| `JOB-P0-T01-STABILIZATION` | Autonomous Stabilization & Readiness Hardening                    | COMPLETED     | `696b1cc`                                        |
| `JOB-PROD-01`              | Backend Authorization, Submission Guardrails & Profile Sandbox    | **COMPLETED** | `904c19f`                                        |

---

## 3. Real Functionality Activation & Truthfulness Summary

1. **User Data Protection & Database Hygiene**:
   - Preserved all real user data for candidate Asadbek Makhmudov (`00000000-0000-0000-0000-000000000001`).
   - Purged historical database dump (`backups/ai_job_agent_dev_backup_20261010_145257.sql`) entirely from Git history across all branches using `git-filter-repo`.
   - Verified 0 reachable Git objects and 0 commits reference the sensitive backup; local recovery backup secured under `/Users/bek/.jobee-security-cleanup/` (mode 700).
   - Created and verified PostgreSQL dump backup: `backups/ai_job_agent_dev_backup_20261010_145257.sql`.
   - Extracted verified facts, certifications, and skills from candidate's authoritative Master CV (`Resume - Asadbek M.pdf`).
   - Purged 11 synthetic mock jobs and 3 fake test applications from test suites that polluted the UI dashboard.
   - Result: Profile completeness reached 100% with active Master CV, 14 verified skills, 2 certifications, and 6 verified facts.

2. **Cover Letter & Tailoring Anti-Hallucination Remediation**:
   - Fixed `CoverLetterEngine`: eliminated hardcoded software engineering claims ("production software systems", "engineering initiatives"). Dynamically grounded opening, achievements, skills, and closing in the candidate's actual record (Project Management / Operations Assistant).
   - Fixed `TailoringEngine`: replaced `Software Professional` fallback with `Professional` and domain-neutral dedication clause.
   - Added unit test in `application-package.test.ts` verifying Project Management candidate tailoring without software engineering hallucination.

3. **CRM Application Duplication Bug Resolved**:
   - Fixed `ApplicationCrmService.listApplications`: added `eq(jobMatchAnalyses.isStale, false)` to the left join and in-memory Set deduplication by `app.id` to prevent applications from duplicating when jobs are re-analyzed.

4. **Honest UI Presentation & Fixture Isolation**:
   - `EmailIntelligenceView.tsx`: Promoted real `+ Connect Gmail (OAuth)` to primary action. Labeled fixture account as `🧪 Offline Test Fixture (Simulated)` with explanatory notes.
   - `InterviewWorkspaceView.tsx`: Promoted real `+ Connect Google Calendar (OAuth)` to primary action. Labeled fixture calendar as `🧪 Offline Test Fixture (Simulated)`.
   - `SettingsView.tsx`: Registered `/api/health` and `/api/ready` route aliases in Fastify so settings probing succeeds.
   - `LocalStorageProvider`: Added fallback search across monorepo directory root and `apps/api` for robust document downloads.

5. **First Complete Real User Workflow Executed**:
   - Candidate: Asadbek Makhmudov (Project Manager, Warsaw, Poland)
   - Real Vacancy: Associate Project Manager at Revolut (Warsaw, Poland)
   - Match Score: 92% MATCH (Deterministic engine, 0 hard blockers, 100% role/skills overlap)
   - Studio Package: ATS-compliant Tailored CV DOCX (10,573 bytes) and Cover Letter DOCX (10,252 bytes) generated and verified.
   - Human Approvals: 3 sensitive/custom questions routed to human review inbox, human approval authorized via API, transitioning package to `READY`.
   - CRM Lifecycle: Tracked in CRM (`status: READY_TO_APPLY`).

6. **Backend Authorization & Verification Guardrails (`JOB-PROD-01`)**:
   - **Strict Pre-Creation Authorization in `BrowserWorkerService`**: In `SUBMIT` mode, requests require either `policy.autoApplyEnabled: true` or explicit `input.userConfirmed: true` (rejects with `403 Forbidden`). Enforced that the associated Application Package exists and is in `READY` status (rejects with `400 Bad Request`), matching policy blockers are overridden, and all package approvals are resolved by the candidate (`resolvedBy === 'USER'`).
   - **Autonomous Orchestrator Submission Guardrails**: In `runAutoApplyStage`, auto-application is blocked if the package is missing or not in `READY` status, if policy blockers are active, or if any package approval is unresolved or resolved by automation (`resolvedBy !== 'USER'`).
   - **CRM Status Auto-Synchronization**: `ApplicationPackageService.refreshPackageReadiness` automatically transitions linked CRM application to `NEEDS_REVIEW` whenever package readiness degrades to `NEEDS_REVIEW`.
   - **Test Profile Sandbox Preservation**: Hardened `scripts/verify-pilot-readiness.ts` and `scripts/verify-operational-acceptance.ts` to capture the candidate profile before testing and restore `Asadbek Makhmudov` faithfully during teardown, preventing test mutations from overwriting the candidate's real profile.

---

## 4. Current Quality & Build Status

- **Database Connectivity:** `npm run db:check` -> PASSED (PostgreSQL connected, 17ms latency)
- **Database Migrations:** `npm run db:migrate` -> PASSED (0000 through 0014 up to date)
- **Unit & Integration Tests:** `npm test` -> PASSED (35 test files, 268/268 tests passing)
- **TypeScript Typecheck:** `npm run typecheck` -> PASSED (0 errors across 6 workspaces)
- **ESLint:** `npm run lint` -> PASSED (0 errors across codebase)
- **Build:** `npm run build` -> PASSED (API, Worker, and Web bundle compile cleanly)
- **Prettier:** `npm run format` -> PASSED (All matched files conform)
- **Live Pilot Readiness Suite:** `scripts/verify-pilot-readiness.ts` -> PASSED (11/11 sections passed cleanly with 0 failures, 100% clean teardown)
- **Live Operational Acceptance Suite:** `scripts/verify-operational-acceptance.ts` -> PASSED (Real Playwright UI, ATS fixture submission, crash invariants, 100% clean teardown)

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
