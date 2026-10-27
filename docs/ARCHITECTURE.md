# Jobee — architecture

Updated against local source on 2026-10-20 for JOB-P3-T01/JOB-P5-T01 over checkpoint `76789fee39ebacc4a61b15ee9c6bcc19147bd45c`. This describes the current implementation. Incomplete behavior is explicitly identified; conceptual product requirements do not imply new tables or services.

## Processes and dependencies

```text
Browser: React/Vite
        | authenticated REST (/api)
        v
API: Fastify + Better Auth + preparation/integration services
        |                              |
        v                              v
PostgreSQL                         Document/evidence storage
        ^                              ^
        |                              |
Worker: database claims + Playwright + scheduled orchestration
```

Development uses separate Vite, API and worker processes. Production uses the API process to serve the built SPA on the same port and a separate worker service built from the same container. PostgreSQL holds business records, durable queues, leases and audit events. There is no Redis/broker dependency.

| Workspace           | Boundary and key sources                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`          | React UI and API client; [App.tsx](../apps/web/src/App.tsx), [navigation](../apps/web/src/ui/navigation.ts)                           |
| `apps/api`          | [Composition root](../apps/api/src/app.ts), route schemas, domain services, document generation, integrations and preparation runners |
| `apps/worker`       | [WorkerService](../apps/worker/src/worker.ts), browser-run claims, isolated browser controller, ATS adapters and orchestration        |
| `packages/shared`   | DTOs, lifecycle/run enums, logging, errors, sanitization, storage interfaces/providers and candidate completeness utilities           |
| `packages/config`   | [Environment schema](../packages/config/src/env.ts), startup validation and normalization                                             |
| `packages/database` | Drizzle schema/migrations, connection pools, test safety, shared backend matching and submission authorization/queue services         |

The browser consumes shared contracts, not database credentials or server services. Both backend processes depend on shared/config/database workspaces. Backend matching is exported as `@job-agent/database/matching`; the worker does not import API implementation. API matching and submission compatibility exports preserve existing callers. npm build order compiles packages before apps.

## Authentication and ownership

[Better Auth configuration](../apps/api/src/auth/better-auth-instance.ts) uses the Drizzle adapter with users, sessions, accounts and verifications. Email/password authentication, optional Google sign-in, reset/verification delivery and admin invitation management exist. Invite-only registration defaults on. `OWNER_EMAIL` determines owner/admin bootstrap behavior and must be configured deliberately.

The [auth plugin](../apps/api/src/plugins/auth-plugin.ts) resolves sessions, supports a database token lookup fallback and places authenticated user identity in AsyncLocalStorage. Private routes/services resolve that identity and scope reads and writes by owner; caller-supplied IDs alone are not authority. Test-mode identity headers and the deterministic seed-user fallback are test/development compatibility mechanisms, not production authentication.

Authentication, integration authorization and candidate verification are separate. Better Auth identity-account records are distinct from Gmail/Calendar encrypted integration accounts. Do not infer that all Better Auth account fields use `TokenCryptoService`: the dedicated envelope is implemented for recruitment integration tokens. Tenant isolation is service/query based; this documentation does not claim database row-level security or formal security certification.

Public health/auth/static/settings surfaces are intentionally different from private domain routes. Inspect actual route handlers for permission checks rather than assuming every `/api` URL is private. With no configured database the API can expose health/configuration surfaces while domain services are unavailable; health alone is not a functioning authenticated workspace.

## Persistence and relationships

[Schema modules](../packages/database/src/schema/) and [SQL migrations](../packages/database/drizzle/) are authoritative for columns, defaults, foreign keys and indexes. This overview deliberately avoids copying every table definition.

- **Identity:** `users` owns private domain records; `sessions`, `accounts`, `verifications`, `pilot_invitations` support access
- **Candidate:** profile plus experiences, education, projects, skills, languages, certifications, links, facts and documents; answer library, job preferences and application policy are user-scoped
- **Import/intelligence:** import sessions/items and intelligence suggestions hold proposals/conflicts before acceptance; job feedback records candidate decisions
- **Jobs:** `jobs` owns sources, sections, requirements and events; jobs are private to their user context
- **Matching:** analyses bind a candidate/job input fingerprint; dimensions and requirement evaluations reference analysis and grounded requirement/evidence context
- **Preparation:** batches own items; each item links a job/application/package; versions own artifacts, questions and approvals; package events retain changes
- **CRM:** one application per `(user_id, job_id)`; lifecycle events, notes, contacts, interviews, assessments and offers enrich that record
- **Intent:** `application_intents` stores job-scoped permission before generation, selected CV, input/source fingerprints, accepted terms, expiry/revocation, batch/run references, material binding and safe audit events; it reuses existing preparation/execution queues
- **Browser:** browser runs link owner/application/package version, mode, manifest, logs, observations and evidence references
- **Email:** accounts own messages and sync runs; thread links/review items associate communications with applications; OAuth state is persisted separately
- **Calendar:** accounts link interview events, calendar references and preparation briefs
- **Operations:** orchestration runs, notifications/preferences, search settings/cursors/leases and preparation metrics support background work

```text
user -> candidate context / preferences / policy
user -> job -> sources + current/history requirements + analyses
(user, job) -> application -> lifecycle + contacts + interviews + offers
application -> package -> immutable versions -> artifacts + questions + approvals
application + package version -> browser run -> observations + evidence
user -> preparation batch -> item -> job/application/package
user -> integration account -> messages/events -> application context
```

These are logical relationships; consult schema for actual foreign keys and cascade behavior. Do not add a parallel `ApplicationAttempt` table just because the product uses that conceptual term: browser runs and preparation items already represent parts of that lifecycle.

### Migrations

The journal has **27 entries, `0000`–`0026`**. Each journal tag has a matching SQL file. Important boundaries:

- `0000`–`0002`: Candidate foundation and metadata-only audit
- `0003`–`0005`: Job ingestion/requirements and matching
- `0006`–`0008`: Packages, CRM and lifecycle canonicalization
- `0009`–`0011`: Email, persistent OAuth state, calendar/interview preparation
- `0012`–`0014`: Browser runs, scheduling/notifications and hardening
- `0015`–`0017`: Better Auth, AI settings and verification identifiers
- `0018`–`0021`: Smart profile import, optional language proficiency, conflict resolution and career intelligence
- `0022`: Search traversal/leases, persistent preparation and submission/evidence evolution
- `0023`: Current extraction flags preserving historical requirement/section rows
- `0024`: Nullable salary pay period with allowed-value constraint
- `0025`: Job-scoped application permission, preparation/run references and audit history
- `0026`: Versioned Autopilot policy snapshot/schedule and per-intent policy binding

Journal presence is not proof a database is migrated. [Status](STATUS.md) records the inspected local target; [operations](OPERATIONS.md) explains comparison with applied migration records. Existing salary values remain unit-unknown until confirmed; no migration invents a yearly period. Production startup runs migrations; deployment is therefore a database-affecting action.

## Candidate context and documents

`CandidateService` owns CRUD, preferences, policy, explicit saved-answer verification and candidate audit metadata. Import services extract PDF/DOCX/text, classify suggestions, compare existing facts and preserve conflicts. Source content, extracted suggestions and verified candidate truth remain distinct. Candidate completeness guides onboarding; it cannot turn optional absence into invented facts.

Facts carry verification and AI-use permission. Material answer edits clear verification unless explicitly reconfirmed. Question generation reuses only verified exact-question routine AUTO answers without sensitivity or unevaluated scope conditions. MANUAL/conflicting answers request entry; sensitive/scoped/REVIEW answers retain bound human approval. Submission validates only the used answer sources, avoiding unnecessary invalidation from unrelated library edits.

Storage uses `FileStorageProvider` with shared local and S3-compatible implementations. API facades retain older imports. Upload/artifact records store keys and SHA-256 checksums, not public document URLs. Local storage needs a persistent shared location if both backend processes use it; R2/S3 is the deployed shared-storage option. Download/preview and evidence endpoints enforce ownership. PDF and DOCX preview libraries run in the web app; `scripts/sync-preview-assets.mjs` prepares browser assets during dev/build.

## Discovery and extraction

[JobDiscoveryService](../apps/api/src/services/job-discovery-service.ts) combines configured Arbeitnow, Greenhouse, Lever, Ashby and SmartRecruiters feeds. The built-in catalog includes public BoschGroup/NielsenIQ Poland postings and upgrades only the exact retired default catalog; custom boards and workflow opt-ins remain intact. This is bounded employer coverage, not a global catalog. Related role tokens improve retrieval recall; current matching still decides publication. Explicit geography, seniority, exclusions and experienced metadata conflicts are checked before ingestion. SmartRecruiters uses its [public Posting API](https://developers.smartrecruiters.com/docs/endpoints), validates listing/details payloads and fetches full descriptions only for compatible candidates; it adds no submission adapter.

Durable cursors/leases rotate up to five boards plus Arbeitnow; partial pages retain row positions. A run examines at most 200 rows, imports at most 50 new jobs and reads at most 15 SmartRecruiters details within a 20-second processing budget after parallel bounded feed reads. Duplicate rows do not consume the new-job budget. API/UI distinguish available listings from examined rows. Incomplete generic page shells request pasted text; owned completion keeps the same identifier/source URL/history, preserves manual corrections, rebuilds extraction and invalidates analyses. Blocked retrieval targets do not become placeholders.

`JobService`, retrieval/normalizer services and extractors handle URL/text import, canonicalization, deduplication, source provenance, structured sections and requirements. Arbitrary URL retrieval uses SSRF controls and bounded responses. Unsupported/inaccessible pages can use manual text; supported parsing is not permission to automate an account.

Source refresh preserves job identity, manual corrections and source snapshots. Migration `0023` lets current extraction replace active sections/requirements while retaining old rows referenced by historical evaluations. Current detail, matching and interview preparation select the current extraction. Raw successful HTML payloads are discarded; normalized safe text and provenance remain.

## Shared matching and AI

The [matching backend](../packages/database/src/matching/) builds verified permitted evidence, evaluates requirements, applies deterministic hard gates, calculates fit and stores explanation/provenance. API, manual/batch/daily analysis and worker paths use the same engine. Worker preparation consumes fresh persisted MATCH analyses; it no longer fabricates MATCHED/SKIPPED ingestion states as a substitute for matching.

Material-input SHA-256 fingerprints include relevant candidate/job/preferences/policy context and algorithm version. Algorithm 2.0 invalidates old analyses; stable fingerprints ignore check-only timestamps and irrelevant row order. Stale recommendations lose preliminary automatic eligibility without deleting history. Ranking and selection must recheck freshness.

Explicit work modes bind even when relocation is allowed. Country authorization is explicit. Internship, citizenship/clearance and material jurisdiction unknowns require review; remote/residence/no-sponsorship cannot satisfy them. Salary comparisons require explicit matching currencies and pay periods. Low professional relevance has an explanation distinct from an exclusion or unknown eligibility.

Production matching uses operator-managed Gemini. Disabled mode remains for offline verification; legacy OpenAI code/policy fields cannot select a runtime provider. Candidate provider/model settings are ignored, mutation/connectivity endpoints reject requests, and operator diagnostics require admin access. The validator filters returned evidence IDs against the context whitelist and demotes unsupported positive judgments to UNKNOWN. Arbitrary model narratives cannot create sensitive candidate facts. Implemented adapter/model strings do not establish current vendor availability or quality; live paid model validation is outside this audit.

Material preparation currently uses deterministic grounded tailoring/letter engines and programmatic DOCX/TXT generation. A configured matching model does not mean every preparation calls an LLM. Model cost remains unknown without measured provider accounting.

## Preparation and current submission flow

[PreparationBatchService](../apps/api/src/services/preparation-batch-service.ts) persists selected jobs, base CV, item progress, failures, cancellation/retry and material cache identity. Existing package/version/artifact/question/approval and CRM services remain authoritative. The API performs one preparation at a time per instance using database claims, heartbeat/lease recovery and active-item uniqueness. This is API background work, distinct from worker browser execution.

Cache inputs include tenant, verified facts/permissions, documents, preferences, vacancy content, base CV and generation version. Unchanged completed inputs can reuse materials. Changed queued inputs stop for review; changes during generation mark results stale. An expired generation lease becomes a visible failed item; deliberate retry can repair incomplete materials without deleting prior history.

The reviewed flow remains: select jobs -> persistent preparation -> resolve questions/documents -> review -> issue separate short-lived authorization per application -> queue selected submissions. Grouping repeated questions is navigation only.

The one-click flow uses [ApplicationIntentService](../apps/api/src/services/application-intent-service.ts): authenticated job action -> owned application/permission persisted transactionally -> current matching/eligibility -> existing preparation batch -> signed manifest bound to intent -> existing browser queue. Terms `jobee-apply-v1` authorize one job for up to one hour. Repeated clicks return the same intent without extending permission. Only deliberate resume renews it; cancellation and dispatch serialize on the same owner lock. Failed generation requires deliberate retry. Professional score thresholds do not become hard eligibility blockers for a manually selected job.

The worker inspects actual provider questions rather than synthesizing mandatory legal questions for one-click packages. The shared backend question engine resolves exact verified routine answers from the authorization-time source snapshot, persists unknown/sensitive questions and their approvals, and binds an updated signed manifest only when documents/version/inputs remain unchanged. Only used answer sources are rechecked; unrelated edits do not invalidate the intent. Existing reviewed packages retain their questions/consent. Browser runs and preparation items remain authoritative execution records; the new table stores permission, not a second engine.

## Submission boundary and worker execution

Shared [SubmissionAuthorizationService](../packages/database/src/submission/submission-authorization-service.ts) builds a manifest from owned application/package readiness, immutable version, artifact checksums, question answers/approvals, used answer-library sources and material-input fingerprint. A signed ticket expires after 15 minutes and is bound to a user/application and those materials.

Shared [BrowserWorkerService](../packages/database/src/submission/browser-worker-service.ts) defaults runs to DRY_RUN. SUBMIT requires a valid reviewed token, an intent-bound signed proof from an accepted job-specific or versioned Autopilot permission. It rejects unsupported providers, unavailable listings, changed destinations and already submitted/unready applications. In a transaction it locks user/application rows, checks prior SUBMIT attempts and counts today's UTC SUBMIT queue entries against `min(20, configured daily limit or 5)`.

The worker claims persisted runs, heartbeats and validates the manifest at claim and immediately before dispatch. Legacy POLICY runs are rejected; the old boolean cannot authorize a new submission. INTENT runs recheck feature availability, signed proof, owner/job/destination, expiry, revocation, used answer sources and material fingerprints. The final transaction reserves dispatch; cancellation after reservation reports that the action cannot be recalled. It loads actual checksum-verified artifact bytes and maps only allowed answers. Hosted Greenhouse, Lever and Ashby adapters inspect runtime forms; generic forms do not get automatic submission coverage. Unmapped required controls, unsupported layouts, password/one-time-code forms, CAPTCHA and identity challenges stop for intervention.

The browser engine records dispatch before clicking and observes new provider confirmation, validation rejection or ambiguity. An internal run ID is never represented as an employer reference. A timeout/disconnection after dispatch becomes SUBMISSION_UNCERTAIN; orphaned SUBMIT runs recover conservatively into uncertainty. Reconciliation is explicit and tenant-scoped. Evidence screenshots are private, bounded by ownership/expiry and stored through the common provider.

Explore requests profile-compatible jobs by default. The shared relevance predicate normalizes junior/entry and internship labels, honors explicit location/level preferences and excludes current SKIP results before pagination. Known seniority conflicts are deterministic blockers; relocation uncertainty remains reviewable. Matching algorithm 2.1.0 invalidates older results. The full saved-job API library remains available for explicit tools/history; unknown metadata is not invented as a match.

Platform quota admission locks the persisted user row and counts every same-UTC-day SUBMIT reservation, including failures. The platform limit is 10 for users; exact persisted admin/tester roles are exempt. Accepted Autopilot scope/limits remain independently enforced. Tester invitation redemption and role assignment share a row-locked transaction. Document uploads serialize on the same owner row, cap all saved candidate documents at 10 and remove newly stored bytes if admission fails. No schema change is needed for these text-role and existing-record controls.

## CRM and communications

Applications preserve one tracked record per user/job, manual applications, lifecycle correction history, frozen submitted artifact provenance, contacts, notes, assessments, interviews and offers. The API projects the most relevant execution attempt separately from employer status, prioritizing unresolved uncertainty over newer previews. A shared attention projection covers reconciliation, handoff, review, due follow-ups and saved next steps; active preparation is not a request for human action. Attention filtering precedes pagination and scopes every evidence query to the owner. Package regeneration cannot rewrite what was submitted. Normal archiving preserves history; purge is distinct and destructive.

Email services implement Gmail read-only OAuth, token envelopes, persistent state, sync claims, MIME normalization, classification/entity resolution and review queues. The shared confidence policy enforces .90 automatic enrichment and .95 high-certainty rejection. Account-lease fencing, transactionally persisted messages/lifecycle/reviews and locked review resolution prevent partial replay or disconnect resurrection. Conservative state changes go through the CRM state machine with transaction/row locking. Offers and uncertain associations require review; no recruiter-send feature is implied. Authentication/reset email uses a separate transactional mailer (Resend/SMTP).

Calendar consent redirects to the configured web origin with a recoverable success/failure status rather than rendering account JSON. Calendar providers bind availability/event-management scope to signed OAuth state and recheck actual grants and owned parent applications on contextual routes. Token refresh uses compare-and-set fencing. Event creation durably reserves pending/uncertain execution before provider dispatch and requires explicit user confirmation; interviews and preparation briefs remain linked to applications. Fixture providers establish local behavior only. Existing real-account configuration is not live verification or authorization for new writes.

## Background scheduling and deployment

`DailySearchService` in the API uses opt-in rolling 24-hour scheduling and recoverable leases for discovery/matching/preparation plus an optional in-app digest. It does not submit. `AutonomousOrchestrator` retains discovery/matching and reminders, but preparation now records a durable request consumed by the same API `PreparationBatchService`. The batch and acknowledgement commit together; preparation creates no submission grant. Legacy auto-apply only triggers the API-owned policy scheduler, preserving accepted scheduled intervals.

[AutopilotService](../apps/api/src/services/autopilot-service.ts) accepts explicit `jobee-autopilot-v1` policy snapshots behind default-off `AUTOPILOT_ENABLED`. Scheduled and manual checks use the same intent/preparation/browser pipeline. Policy versions and accepted scope are retained in orchestration history and intent events, including after a deliberate manual resume. Candidate-only fingerprints, current policy/version, role/location/work/type/salary/exclusions and pending human reviews are rechecked through the shared [authorization boundary](../packages/database/src/submission/autopilot-authorization.ts). A 15-minute scheduling lease, transactional fencing, idempotent existing intents and atomic queue reservations prevent replay from duplicating dispatch. Expired leases become partial history; stale policy inputs require explicit reauthorization. Worker failures/uncertainty and preparation blocks create private in-app recovery notifications. No additional process or API-to-worker import is introduced.

[Railway configuration](../.railway/railway.ts) defines `jobee-api` and `jobee-worker`, sharing PostgreSQL and storage credentials. [Dockerfile](../Dockerfile) builds all workspaces on Node 24, installs Chromium, runs as the non-root node user and defaults to the API entry point. API boot serves the built web SPA and runs migrations. Worker start overrides the command to `node apps/worker/dist/index.js`. Neon and R2 are recorded infrastructure, not freshly certified service health.

## Decisions retained

- Keep one npm/TypeScript monorepo, Fastify composition, PostgreSQL/Drizzle SQL and existing storage abstraction.
- Keep browser execution in a separate process; process separation alone is not a claim of a comprehensive network sandbox.
- Preserve authenticated multi-user ownership, immutable historical versions/events and stable IDs.
- Extend current authorization and queues incrementally; do not add a broker, parallel data model or agent fleet without demonstrated need.
- Converge one-click and scheduled triggers only after one provider workflow is proven. Existing reviewed flows remain usable until replacement acceptance passes.

Operational procedures are in [operations](OPERATIONS.md); normative security constraints and known assurance gaps are in [policies](POLICIES.md).

### Automatic Explore recommendations

`RecommendationService` in the shared database matching library uses existing `orchestration_runs` rows with the reserved `EXPLORE_MATCHING` task type. The API requests work on Explore entry/discovery; the independent worker consumes it even when the periodic orchestrator and application Autopilot are disabled. No API implementation is imported by the worker and no new schema is required.

A user-row lock coalesces requests. Each run snapshots the candidate/posting fingerprint and up to ten pending compatible jobs; the worker claims one job with skip-locked row locking, checks input freshness and fences completion to its claim timestamp. Completed chunks continue automatically while pending jobs remain. Current analyses are reused; unchanged failed work waits for deliberate retry. Stale queued work is cancelled and new inputs can be queued. This task cannot prepare materials, create application permission or dispatch an employer form.

The recommendation selector applies location/seniority and hard restrictions before pagination, then requires a current MATCH result. City targets remain binding when relocation is allowed; country qualifiers cannot broaden a city target. An explicit Remote target is separate from work authorization. The client additionally withholds missing/stale/non-MATCH cards. The raw library retains existing ingestion/history access behind explicit disclosure. UI-only match fixtures are isolated synthetic records with fixture provenance, not provider evaluations.
