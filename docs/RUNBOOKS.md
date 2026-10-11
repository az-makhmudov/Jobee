# Jobee — Production Operations & Runbooks

**Document Status:** Canonical Operational Guidelines & Runbooks  
**Task Association:** `JOB-P5-T02 — Autonomous Orchestrator, Scheduling, Notifications & Production Hardening`  
**Core Invariant:** _"AI evaluates and prepares. Rules authorize. Humans handle uncertainty. Everything is auditable."_

---

## 1. System Overview & Process Boundaries

The production architecture consists of three strictly isolated processes sharing PostgreSQL:

```text
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│    apps/web     │       │    apps/api     │       │   apps/worker   │
│  React 19 / SPA │──────>│   Fastify REST  │<─────>│  Background Svc │
│  (Port 5173)    │       │   (Port 3000)   │       │   Playwright    │
└─────────────────┘       └────────┬────────┘       └────────┬────────┘
                                   │                         │
                                   ▼                         ▼
                        ┌──────────────────────────────────────┐
                        │        PostgreSQL Database           │
                        │    (Tables, Queues & Audit Logs)     │
                        └──────────────────────────────────────┘
```

- **API Process (`apps/api`)**: Serves authenticated REST endpoints, executes validation via Zod, manages database state, and evaluates policy queries.
- **Worker Process (`apps/worker`)**: Runs background heartbeat loops, executes scheduled and on-demand orchestration runs, and performs isolated Playwright browser automation.
- **Web Client (`apps/web`)**: Single-page application rendering the Candidate Brain, Job Inbox, CRM Kanban, Interview Workspace, and Activity & Autonomous Operations Hub.

---

## 2. Health Probes & Observability

### 2.1. Liveness & Readiness Endpoints

| Endpoint        | Method | Probe Type | Description                                                         | Expected Status                                            |
| :-------------- | :----- | :--------- | :------------------------------------------------------------------ | :--------------------------------------------------------- |
| `/health`       | `GET`  | General    | Basic service metadata, version, and uptime                         | `200 OK`                                                   |
| `/health/live`  | `GET`  | Liveness   | Container/process liveness check for orchestrators (k8s/docker)     | `200 OK`                                                   |
| `/health/ready` | `GET`  | Readiness  | Deep dependency readiness check (PostgreSQL connectivity & latency) | `200 OK` (or `503 Service Unavailable` if DB disconnected) |
| `/ready`        | `GET`  | Readiness  | Standard readiness alias for backward compatibility                 | `200 OK`                                                   |

### 2.2. System Metrics & Quotas

- **Metrics Endpoint**: `GET /api/orchestrator/metrics`
- **Reported Dimensions**:
  - `totalJobsDiscovered` / `totalJobsMatched`: Opportunity funnel status.
  - `totalApplicationsSubmitted`: Total lifetime submissions.
  - `applicationsToday`: Submissions completed today (UTC).
  - `maxApplicationsPerDay`: Configured daily submission limit.
  - `dailyQuotaRemaining`: Remaining submission slots before automatic pause.
  - `autoApplyEnabled`: Master circuit-breaker state (`true` / `false`).
  - `pendingApprovalsCount`: Number of human review items requiring sign-off.
  - `unreadNotificationsCount`: Active unread alert count.
  - `orchestratorRunning`: Scheduler process status.
  - `lastPipelineRunAt`: Timestamp of last completed pipeline cycle.

---

## 3. Autonomous Orchestration & Scheduling

### 3.1. Scheduler Architecture

The worker process heartbeat ticks periodically (configured via `WORKER_POLL_INTERVAL_MS`, default 5000ms):

1. Polls pending browser application runs (`browser_application_runs` where `status = 'PENDING'`).
2. Polls pending on-demand orchestration runs (`orchestration_runs` where `status = 'PENDING'`).
3. Executes scheduled periodic autonomous pipeline cycles for active users when `ORCHESTRATOR_ENABLED=true`.

### 3.2. Autonomous Pipeline Stages

Every autonomous pipeline cycle executes through six deterministic stages:

1. **`DISCOVERY`**: Inspects ingestion queues and active job sources.
2. **`MATCHING`**: Evaluates `DISCOVERED` jobs against candidate facts and hard policy constraints (`excludedCompanies`, `excludedKeywords`). Unpursued jobs are transitioned to `SKIPPED`; qualifying opportunities transition to `MATCHED`.
3. **`PREPARATION`**: Automatically initializes CRM application records (`READY_TO_APPLY`) for newly matched opportunities.
4. **`AUTO_APPLY`**:
   - Checks **Circuit Breaker**: If `autoApplyEnabled` is false, halts immediately with audit log.
   - Checks **Daily Quota**: If submissions today >= `maxApplicationsPerDay`, pauses submissions and dispatches `RATE_LIMIT_EXCEEDED` notification.
   - Checks **Human Approvals**: If unresolved approvals exist and `blockOnUnresolvedReview` is true, halts submission.
   - Queues browser application execution in safe dry-run or authorized submission mode.
5. **`EMAIL_SYNC`**: Synchronizes messages across active email accounts and flags recruiter interactions.
6. **`REMINDERS`**: Detects pending approvals and upcoming interviews within 48 hours, dispatching in-app notifications.

---

## 4. Safety Controls & Emergency Procedures

### 4.1. Emergency Stop: Disabling Auto-Apply

If unexpected behavior occurs, disable the auto-apply circuit breaker immediately:

```bash
# Via Database CLI:
psql $DATABASE_URL -c "UPDATE application_policy SET auto_apply_enabled = false;"
```

Or via REST API:

```bash
curl -X PUT http://127.0.0.1:3000/api/preferences \
  -H "Content-Type: application/json" \
  -d '{"autoApplyEnabled": false}'
```

The worker immediately respects this invariant on the next tick, skipping all automated submissions.

### 4.2. Handling Bot Challenges (`STOPPED_CAPTCHA`)

When an ATS presents a bot challenge (Cloudflare Turnstile, reCAPTCHA v2/v3, hCaptcha, Arkose):

1. The browser engine immediately halts execution without guessing or attempting bypass.
2. The run status is set to `STOPPED_CAPTCHA`.
3. A `CRITICAL` severity system notification (`CAPTCHA_HALT`) is dispatched to the candidate with direct application link.
4. **Candidate Action**: Open the application URL in a regular browser, complete the submission manually, and mark as `APPLIED` in CRM.

### 4.3. Handling Missing Candidate Facts (`STOPPED_MANUAL_REVIEW`)

When an ATS requires a custom question that cannot be mapped to verified candidate facts:

1. The engine halts with `STOPPED_MANUAL_REVIEW`.
2. A `WARNING` severity notification (`MANUAL_REVIEW_REQUIRED`) is dispatched with unmatched field identifiers.
3. **Candidate Action**: Navigate to Answer Library or Application Studio, add or verify the canonical answer, and re-run.

---

## 5. Incident Response & Troubleshooting Playbooks

### Playbook A: PostgreSQL Connection Failure

**Symptoms**: `/health/ready` returns `503 Service Unavailable`, logs report `connection refused`.

**Steps**:

1. Check PostgreSQL service status:
   ```bash
   brew services list | grep postgresql
   # Or systemctl status postgresql
   ```
2. Verify connectivity:
   ```bash
   npm run db:check
   ```
3. Check connection string in `.env` (`DATABASE_URL`).
4. Apply pending migrations if needed:
   ```bash
   npm run db:migrate
   ```

### Playbook B: Worker Process Memory or Browser Hang

**Symptoms**: Browser run status stays `RUNNING` for > 5 minutes without log progression.

**Steps**:

1. Inspect running background tasks:
   ```bash
   ps aux | grep -E "playwright|worker"
   ```
2. Kill zombie Chromium processes if necessary:
   ```bash
   pkill -f "chromium.*headless"
   ```
3. Mark timed-out browser runs in the database:
   ```sql
   UPDATE browser_application_runs
   SET status = 'FAILED', error_message = 'Process terminated due to execution timeout'
   WHERE status = 'RUNNING' AND updated_at < NOW() - INTERVAL '10 minutes';
   ```

### Playbook C: Encryption Key Rotation

**Procedure**:

1. Generate a new high-entropy 32-byte key:
   ```bash
   openssl rand -hex 32
   ```
2. Update `EMAIL_TOKEN_ENCRYPTION_KEY` in deployment environment / secret manager.
3. Connected OAuth accounts will re-authenticate on next token refresh cycle.

---

## 6. Deployment Readiness Checklist

Before promoting to production:

- [x] Environment variable validation passes (`packages/config/src/env.ts`).
- [x] High-entropy `EMAIL_TOKEN_ENCRYPTION_KEY` configured (>= 32 chars, >= 8 unique chars).
- [x] Database migrations up to date (`0000` through `0013`).
- [x] `npm run build` succeeds across all workspaces without bundling errors.
- [x] Full quality gates pass (`lint`, `typecheck`, `test`, `format`, `db:check`).
- [x] Auto-apply circuit breaker disabled by default (`auto_apply_enabled: false`).
- [x] Liveness and readiness endpoints monitored (`/health/live`, `/health/ready`).
