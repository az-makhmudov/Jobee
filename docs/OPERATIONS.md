# Jobee — operations

Updated 2026-10-21 from current source/configuration. These are procedures for the existing deployment topology, not a claim that live accounts or production health were freshly certified. Production changes, live external actions and charges require explicit owner authorization under [AGENTS.md](../AGENTS.md).

## Local requirements and configuration

Use Node.js 24/npm, PostgreSQL (CI uses version 16), and Chromium installed through Playwright when browser execution is required. Root npm scripts build shared packages before apps. `npm ci` follows the committed lockfile; do not install a second workspace manager or broker.

[.env.example](../.env.example) lists configuration names and placeholders; [env.ts](../packages/config/src/env.ts) defines actual validation/defaults. The loader searches from the process working directory upward, so workspace commands can pick up the root ignored `.env`. Do not print the environment or connection strings in diagnostic reports.

1. Install dependencies and copy `.env.example` to ignored `.env`.
2. Configure a dedicated development database and a different disposable test database. Verify host/database identity without exposing user/password.
3. Generate distinct random auth/encryption secrets, such as `openssl rand -hex 32`, and set the actual operator's `OWNER_EMAIL`; production startup rejects the synthetic default `owner@example.test`.
4. For offline work leave external keys/accounts absent, disable the orchestrator and use local storage. Existing real account grants can cause sync side effects when services run; use an isolated database for tests.
5. Build packages, check connectivity and review migrations before explicitly migrating the intended local database.
6. Start API/web; start worker only when its configured side effects are understood.

### Configuration reference

- **Database:** `DATABASE_URL`, `TEST_DATABASE_URL`, `DATABASE_SSL`; production requires a database URL
- **HTTP:** `API_HOST` default loopback, `API_PORT` default 3000, fallback from platform `PORT`; production binds `0.0.0.0`
- **Web/auth origins:** `WEB_ORIGIN`, `BETTER_AUTH_URL`, `BETTER_AUTH_TRUSTED_ORIGINS`; use exact browser origins and HTTPS production URLs
- **Authentication:** `BETTER_AUTH_SECRET`, optional Google identity credentials, `OWNER_EMAIL`, `INVITE_ONLY_REGISTRATION` default true
- **Recruitment token protection:** `EMAIL_TOKEN_ENCRYPTION_KEY`; must remain consistent where stored integration envelopes are decrypted
- **AI:** operator-managed Gemini via `GEMINI_API_KEY` (or `AI_API_KEY`) and `AI_MODEL`; `AI_PROVIDER=gemini` is the default, with explicit `disabled` for offline verification. OpenAI is not an accepted runtime configuration.
- **Gmail:** `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REDIRECT_URI`
- **Calendar:** `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `GOOGLE_CALENDAR_REDIRECT_URI`
- **Transactional email:** `RESEND_API_KEY`, `EMAIL_FROM`/`SMTP_FROM`, or `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- **Storage:** `STORAGE_BACKEND`, `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
- **Worker:** `WORKER_POLL_INTERVAL_MS` default 5000; `ORCHESTRATOR_ENABLED` default true; orchestrator poll default 15000
- **Schedules:** discovery/email/reminder interval settings; candidate daily-search settings are independently persisted
- **Rollout:** `BATCH_PREPARATION_ENABLED`, `SELECTED_SUBMISSIONS_ENABLED` default true; both gate new one-click preparation, and the worker rechecks selected-submission availability for INTENT runs before dispatch. Job-scoped intent expires after one hour; signed material proofs retain their 15-minute validity.
- **Logging:** `LOG_LEVEL`; do not use verbose logs to dump candidate content or tokens

Configuration normalization matters:

- Railway public-domain variables can populate Better Auth URL, web/trusted origins and recruitment OAuth callback URLs. Check effective values before a release rather than relying on local defaults.
- Google identity credentials can fill absent Gmail/Calendar credentials. This is configuration reuse, not consent to the additional scopes.
- Supplying S3 bucket/key credentials can auto-select `s3` even when the raw storage backend says `local`.
- Explicit `AI_PROVIDER=disabled` remains disabled even if keys exist. Offline verification must still remove external provider keys; candidate policy provider/model fields are ignored by runtime selection.
- Some older Gemini model strings are normalized to the current configured default. The string in source is not evidence the vendor offers that model; verify availability before authorized live use.
- Test mode redirects only known development database names unless an explicit test URL is supplied. Set `TEST_DATABASE_URL` deliberately; never rely on accidental URL rewriting for safety.
- Production validates non-default auth/encryption secrets and required database configuration. Passing config validation does not certify credentials, scopes, storage access or provider health.

Remove obsolete free-tier/cost assumptions from operating decisions. Check provider consoles and current terms only when the owner authorizes the relevant service work; do not incur charges as verification.

Calendar OAuth returns to `WEB_ORIGIN`; configure that origin to the actual frontend, not an unrelated callback host. Availability defaults to the primary-calendar alias without requesting calendar-list permissions. Read-only operator AI diagnostics are admin-only; users cannot trigger model switching or paid connectivity checks.

Admins can issue `tester` invitations explicitly. Ordinary invitations remain `user`; acceptance atomically claims the invite and assigns its role. Existing ordinary users are not auto-promoted. Platform attempts reset at UTC midnight; admins/testers still obey all non-volume submission checks. Candidate-document cap is 10 regardless of role; no existing files are auto-deleted.

## Development processes

```bash
npm ci
npm run build:packages
npm run dev:api
# In a second terminal:
npm run dev:web
# Only when needed and with understood account/provider configuration:
npm run dev:worker
```

`npm run dev` launches all three. Vite's `/api` proxy retains the prefix. Prefer a single browser hostname consistently for cookies/origins. API defaults to `127.0.0.1:3000`; Vite normally uses 5173. `VITE_API_URL` is a build/test-time frontend value, not a secret and not a substitute for backend origin settings.

Local file storage is process/filesystem dependent. Ensure API and worker see the same root when sharing artifacts, or use the S3-compatible provider. Do not place user files under tracked source paths. Development mail behavior can expose verification/reset links to local logs; treat those logs as sensitive.

## Safe database verification and migration

Migration source: [journal](../packages/database/drizzle/meta/_journal.json), [SQL directory](../packages/database/drizzle/), [migrator](../packages/database/src/migrator.ts). There are 27 entries through `0026_autopilot_policy`. Compare applied `drizzle.__drizzle_migrations` counts/timestamps/hashes with committed SQL/journal, not just a table count.

`npm run db:check` performs a connectivity probe, not migration or data-integrity certification. `npm run db:migrate` applies pending SQL and, outside production, may seed the legacy primary user. It is a write action even if no new schema is expected. Never run it against an unverified URL as a documentation check.

For a known isolated local test database, use an environment scoped to the command, with both `DATABASE_URL` and `TEST_DATABASE_URL` set to that same target. Do not paste credential-bearing URLs into shared logs. Validate the parsed hostname and database name first; the project safety helper rejects primary development and unknown remote targets.

Before any authorized schema change:

1. Inspect schema, SQL, journal and current applied records. Confirm the intended target and a recovery point.
2. Prefer additive, backward-compatible changes; preserve existing IDs, history and source references.
3. Run required checks and migrations in isolated local/CI fixtures first.
4. Review production migration effects, table locks, old/new process compatibility and restore procedure before an authorized release.
5. Confirm applied journal and readiness after migration, without logging candidate data.

Never routinely migrate production for a quality gate. Do not down-migrate or drop tables to roll back a documentation/feature switch. Use a forward compatibility fix or restore plan only under explicit production authority.

### Neon

The recorded production database is Neon PostgreSQL accessed through node-postgres. Keep the connection string in platform secrets, configure SSL appropriately for the actual endpoint and confirm API/worker use the same intended environment. Do not infer an isolated test branch from a remote hostname alone. Production credentials and primary development data are forbidden test targets.

Before release, the owner must confirm backup/PITR availability and a tested restore path in an isolated environment. The local-only [recovery verifier](../scripts/verify-isolated-recovery.ts) requires an explicit localhost `DATABASE_URL` ending in `_isolated`, test mode and the configured encryption key. Run with `npx tsx scripts/verify-isolated-recovery.ts` after building workspace packages. It copies public schema only into a newly created fixture database, seeds synthetic rows, backs up/restores into a second fresh database, verifies IDs/checksums/encrypted token decryptability, then removes its databases and archives. PostgreSQL CLI tools and local database-creation privileges are required. This does not validate production PITR, object-store recovery or a release rollback. Never publish SQL backups or restore production snapshots into unprotected public fixtures. Provider retention, account health and billing were not revalidated by documentation consolidation.

## Tests and local evidence

Unit/integration tests use Vitest. Some tests mutate PostgreSQL and need a fully migrated explicitly isolated database. `packages/database/src/safety.ts` is the shared guard; do not set bypass flags to silence a safety failure. Use disposable test users and scoped cleanup.

For reproducibility, set `VITE_API_URL=/api` for the unit-test process. The root test configuration and config loader can rewrite recognized development URLs; explicitly supplying both test/database variables is safer. Verify no production environment marker is present.

Browser tests use [playwright.config.ts](../playwright.config.ts), [setup](../apps/web/e2e/setup.ts) and an isolated loopback `UI_TEST_DATABASE_URL`. The default database targets port 55439 and an isolated test name; start the corresponding local PostgreSQL service or provide your own verified isolated loopback database. Do not point UI tests at the ordinary development database. Global setup mutates fixtures.

```bash
npm run build:packages
npx playwright install chromium
npm run test:ui
```

Build shared packages before browser servers start; avoid package rebuilds during watched API execution. Inspect existing servers before enabling reuse. Keep Linux/macOS snapshots distinct and visually review changed references. Browser tests and container builds are not live employer certification.

Inspect standalone verification scripts before use. Some perform public network requests, connect production health endpoints, generate AI requests or create fixture data. A script's name is not proof it is offline. `scripts/evaluate-real-job-discovery.ts` writes transient evidence to ignored `output/acceptance/real-job-discovery.md`; it must not regenerate a canonical document. Review generated content before sharing. `scripts/run-real-user-acceptance.ts` includes historical attestation and production/public checks and is not an offline unit gate.

Autopilot requires additive migration `0026_autopilot_policy` before API/worker rollout. `AUTOPILOT_ENABLED=false` is the default; keep both processes consistent. Enabling the environment switch does not accept a candidate policy, and this local task does not authorize production enablement. The API owns policy checks and durable preparation; the separate worker owns browser execution. Monitor stale scheduling leases (15 minutes), partial runs, pending preparation requests and attention notifications. Manual/scheduled retries must retain prior attempts; do not reset dispatch markers to recover uncertainty. Queue reservations count every SUBMIT run created in the current UTC day, including failures; previews/preparation use their own budgets. Orchestration metrics report those same submission reservations.

### Main-feature testing checkpoint

Prioritize Profile → Explore → job details → Apply → Applications. On an explicitly isolated local database, use disabled AI, local storage and synthetic candidates. Run the existing one-click API/worker fixtures and browser suite before promoting a build. Public-feed retrieval, paid Gemini generation and employer submission are separate live checks; offline success does not certify those services.

For human testing, set target roles, preferred locations and junior/internship levels in Profile, then Find more jobs in Explore. Known location/seniority conflicts are filtered before spending the discovery result limit. Compare the descriptions and unknowns, open a supported Greenhouse/Lever/Ashby hosted form and inspect the job-scoped Apply permission. Other destinations, including Oracle, show Apply on employer website; no automatic submission is promised. Confirm application progress in Applications and resolve any missing verified facts. An uncertain result requires reconciliation before another attempt.

The browser smoke scenario covers supported-action availability and unsupported handoff without clicking any external link or submitting to an employer. The separate deterministic API/worker fixture verifies preparation, submission and confirmation. For real submission testing, obtain the exact named vacancy/action approval first. Source coverage remains the configured public feeds/company boards; empty relevant results do not establish broad Poland-market coverage.

The 2026-10-25 testing release applies `0023_current_job_extraction` through `0026_autopilot_policy`, bringing production to 27 applied entries. Freshly compare applied hashes before each authorized promotion, preserve backup/recovery, and promote API/worker together. The search/handoff correction itself adds no migration. Account deletion remains scheduled engineering work with the owner's seven-day cancellation specification; it does not block synthetic main-flow testing.

## Storage and R2

The shared storage abstraction supports local disk and S3-compatible object storage. R2 uses `S3_ENDPOINT`, bucket, `auto` region and scoped access credentials. Both backend services need compatible access to the same artifact namespace. Scope credentials to required bucket/object actions and keep public bucket access disabled.

Generated artifacts and browser screenshots have database references and checksums. Verify save/get/existence with synthetic bytes in an isolated prefix before an authorized promotion; do not upload a real CV as a smoke test. Ownership-protected API endpoints serve candidate documents/evidence rather than public URLs.

Evidence access expires after 30 days; bounded pruning deletes recognized expired run files. An independent API hourly retention task runs on startup and outside test mode regardless of preparation/discovery flags. Failed deletions and unrecognized keys retain their references for investigation/retry; compare-and-set updates preserve concurrent evidence. Monitor failed deletions and orphaned objects. This does not implement retention for every candidate document, account, message or backup. Retention and deletion/export requirements remain an owner/privacy review item.

Local disk on an ephemeral container is not durable shared storage. Do not solve missing artifacts by re-generating unknown submitted files: preserve exact submission provenance and restore the referenced object if possible.

## Railway deployment

The [IaC configuration](../.railway/railway.ts) defines `jobee-api` and `jobee-worker` using [Dockerfile](../Dockerfile). API serves REST/auth plus built SPA on one port. Worker runs a separate entry point against shared database/storage. The Node 24 image installs Chromium and runs as non-root.

Production API startup runs database migrations before accepting traffic. The rotated runtime account is not the owner of existing tables: pre-apply reviewed ALTER migrations through the protected migration account, then grant runtime DML access to newly created tables. Keep the migration credential out of API/worker configuration. A restart or image promotion may change schema; treat it as a production action. The checked-in topology does not prove current platform dashboard values or deployed SHA.

The testing release sets the public `WEB_ORIGIN` and `BETTER_AUTH_URL`, keeps deliberate preparation/submission available, and sets `ORCHESTRATOR_ENABLED=false` and `AUTOPILOT_ENABLED=false` on both services. This prevents the worker’s periodic pipeline from invoking AI while human testing is being established. Existing secrets and integration grants are preserved. The release is pinned to `f3202ea` from `codex/jobee-2-foundation`; that branch was pushed without merging `main`. Future promotions must select the intended commit explicitly until a separately authorized integration into `main`. Daily discovery/preparation additionally depend on saved candidate opt-ins; none were enabled at this release preflight.

For an explicitly authorized release:

1. Select one verified commit and run required quality checks, isolated migrations, relevant browser/integration acceptance and policy review.
2. Confirm backup/recovery, additive schema compatibility, rollout flags and effective API/worker environment. Keep candidate auto-apply disabled during controlled validation.
3. Confirm database/SSL, shared storage, auth secrets/origins, trusted proxy/public URL, mail sender and OAuth callback configuration. Preserve the encryption key for existing tokens.
4. Build the Docker image and review the tested artifact. Default API command is `node apps/api/dist/index.js`; worker override is `node apps/worker/dist/index.js`.
5. Promote API and worker from the same tested commit. Prevent an older worker from consuming newer authorized runs while upgrading or rolling back.
6. Verify readiness, deployed commit/artifact identity, sign-in, tenant denial, synthetic document retrieval and worker heartbeat/queue handling. Check outcomes without real employer/email/calendar actions unless separately approved.
7. Record exactly what was deployed and observed in status. Distinguish smoke health from complete product/provider acceptance.

Do not run deployment/linked Railway CLI commands merely to document them. No push, merge, service update or production migration is authorized by this consolidation task.

## External account setup

| Service         | Required owner configuration                                                                    | Boundary                                                               |
| --------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Google identity | Client credentials, authorized origins and Better Auth callback                                 | Identity sign-in only; separate from recruitment grants                |
| Gmail           | Client credentials, exact `/api/email/accounts/gmail/callback`, candidate OAuth read-only grant | No recruiter send permission                                           |
| Calendar        | Exact `/api/calendar/google/callback`, explicit AVAILABILITY or EVENT_MANAGEMENT grant          | Scope upgrade and writes need deliberate permission                    |
| Resend/SMTP     | Verified sender/domain or an approved test sender; credentials in secrets                       | Transactional account mail is distinct from recruiter correspondence   |
| AI              | Approved provider/key/model and spending boundaries                                             | Availability/cost/quality require fresh validation                     |
| R2/Neon         | Correct environment, scoped credentials, recovery and retention settings                        | No account recreation or paid activation inferred from old setup notes |
| ATS validation  | Named provider, vacancy/test destination and exact approved action                              | Fixture success is not live submission permission                      |

Google credentials may be reused by normalization, but candidates must still grant each integration's scopes. Reconnection can be needed after token revocation or key changes; do not automatically request broader scopes. Verify redirect URIs against the actual current HTTPS host, not a historical URL in a document.

## Health and monitoring

| Endpoint                                                         | Meaning                                                                   |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `GET /api/health`, `/health`                                     | Process metadata/uptime; can be healthy without a database                |
| `GET /api/health/live`, `/health/live`                           | Liveness aliases                                                          |
| `GET /api/ready`, `/ready`, `/api/health/ready`, `/health/ready` | Database/dependency readiness; inspect body and status                    |
| `GET /api/orchestrator/metrics`                                  | Authenticated tenant metrics/quotas, not global production certification  |
| `GET /api/job-search/metrics`                                    | Authenticated tenant preparation counts, queue age and duration estimates |

Readiness can report configured AI/integrations without testing vendor credentials. A configured provider is not a successful live request. Worker has no separate HTTP readiness promise: observe process health, heartbeats, lease/claim updates and structured logs.

Monitor queue age, stale PENDING/RUNNING runs, preparation lease expiry, repeated provider stops, manifest/source invalidations, quota rejection, uncertain outcomes, orphan recovery and storage retrieval/prune failures. Metrics that count successful applications differ from queue admission counts; interpret the [policy semantics](POLICIES.md) before diagnosing apparent quota disagreement. AI cost and candidate time savings must remain unknown if unmeasured.

## Emergency controls

For a suspected unsafe execution, stop the relevant worker service/process through the approved local or production control plane and pause new selected submissions (`SELECTED_SUBMISSIONS_ENABLED=false`). Pause batch preparation independently (`BATCH_PREPARATION_ENABLED=false`) if generation is implicated. These flags are workflow controls, not guaranteed cancellation of already queued/dispatched work.

For a candidate's POLICY path, authenticated `PUT /api/candidate/policy` with `autoApplyEnabled: false` revokes that opt-in. Use the intended user's session; do not publish session tokens in shell examples. `ORCHESTRATOR_ENABLED=false` disables scheduling capability but does not necessarily stop already queued browser work. A policy switch does not revoke all existing TOKEN-mode permissions; stopping consumption is the stronger containment step.

Determine whether dispatch occurred before any retry/restart. Preserve run IDs, timestamps, logs, manifest checksums and private evidence. Already dispatched work may remain uncertain; never bulk-mark runs FAILED or promise recall. Reconcile affected attempts through the current application workflow after checking the employer result. Production containment still requires the appropriate owner authority.

Do not use unscoped SQL updates across all tenants, broad `pkill` commands, arbitrary deletion or state fabrication as emergency shortcuts. Limit operational intervention to the affected service/account/run and retain an audit trail.

## Troubleshooting and recovery

### Database/readiness failure

Check process configuration and the intended local/provider service status without printing the URL. Use `db:check` only after confirming the target; inspect sanitized PostgreSQL error codes, SSL/network settings and applied journal. Connectivity failure does not mean migrations should be run. Investigate permissions, service availability and environment mismatch first. Apply migrations only through the approved target-specific procedure.

### Preparation stuck or artifacts missing

Inspect item claim/heartbeat/lease, input fingerprint and selected CV. Lost generation should become visible failure; use scoped retry after checking current inputs. Compare database artifact keys with storage existence/checksums and confirm API/worker backend alignment. Do not delete old versions to force regeneration. Changed input or revoked source requires renewed preparation/review.

### Worker crash, browser hang or unknown outcome

Identify the specific process/run and last durable checkpoint. Worker recovery considers stale browser runs older than 15 minutes; orphaned SUBMIT work remains uncertain even when a visible receipt is absent. Keep dispatch logs and evidence. Stop only the affected process if necessary; do not globally kill unrelated browsers. Restart with current compatible code and inspect recovery results before authorizing more work. Never overwrite uncertain status to make automated retry succeed.

### CAPTCHA, login or missing question

The worker stops for challenge/manual review. Present a direct employer-site handoff or candidate question action. A CAPTCHA stop is not success. Do not bypass bot defenses or invent answers. If a candidate completes externally, record the actual result with appropriate provenance; do not fabricate a worker receipt.

### OAuth failures and token key changes

Check exact callback, grant scope, account owner, provider error and encryption key consistency. Do not dump tokens or reconstruct historical revoked credentials. Disconnect/reconnect the affected integration through the product after appropriate owner action.

The envelope includes a key ID but the implementation does not provide a multi-key migration utility. Safe rotation requires pausing dependent work, retaining a protected old-key recovery path, decrypting/re-encrypting existing envelopes in a deliberately reviewed migration, verifying representative reads, and then retiring the old key. Alternatively, explicitly revoke/disconnect and obtain fresh grants if preserving tokens is unnecessary. Replacing `EMAIL_TOKEN_ENCRYPTION_KEY` alone does not safely rotate stored records. Auth-secret rotation is a separate operation and can invalidate sessions/authorization.

### Sensitive exposure

Contain access, revoke exposed credentials with the owner, preserve minimized evidence and identify affected paths/categories. Review storage/public history/caches and candidate notification obligations with the owner. Do not copy the secret into tickets/reports or run history rewrite/force push without separate authority. Historical rotation and current public-history concerns are summarized safely in [policies](POLICIES.md).

### Safe rollback

Pause new work first, record current runs and determine post-dispatch uncertainty. Revert to a previously tested compatible application artifact only after confirming schema and worker/manifest compatibility. Preserve new rows, versions and evidence. Do not automatically down-migrate additive schema or start an old worker against unfamiliar queue records. If database restore is needed, use a separately approved recovery plan and isolated rehearsal; never overwrite production data to validate documentation.

## Remaining owner dependencies

No repeated approval is needed for ordinary authorized local development. Owner input is needed for missing candidate facts, accepted one-click/Autopilot terms and scope before expanded runtime permissions, a named live ATS test, real integration grants/actions, production release/migration, paid usage and public-launch privacy/retention decisions. Existing Railway/Neon/R2 accounts need fresh inspection before use, not presumed recreation. Student usability, relevance benchmarks and measured provider outcomes remain validation work recorded in [roadmap](ROADMAP.md).
