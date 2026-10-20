# Jobee — architecture

Verified against local source on 2026-10-20 at `cb15f9ea1e171428564f8e7e88d95a19e80edd3d`. This describes the current implementation. Incomplete behavior is explicitly identified; conceptual product requirements do not imply new tables or services.

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

The journal has **25 entries, `0000`–`0024`**. Each journal tag has a matching SQL file. Important boundaries:

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

Journal presence is not proof a database is migrated. [Status](STATUS.md) records the inspected local target; [operations](OPERATIONS.md) explains comparison with applied migration records. Existing salary values remain unit-unknown until confirmed; no migration invents a yearly period. Production startup runs migrations; deployment is therefore a database-affecting action.

## Candidate context and documents

`CandidateService` owns CRUD, preferences, policy, explicit saved-answer verification and candidate audit metadata. Import services extract PDF/DOCX/text, classify suggestions, compare existing facts and preserve conflicts. Source content, extracted suggestions and verified candidate truth remain distinct. Candidate completeness guides onboarding; it cannot turn optional absence into invented facts.

Facts carry verification and AI-use permission. Material answer edits clear verification unless explicitly reconfirmed. Question generation reuses only verified exact-question routine AUTO answers without sensitivity or unevaluated scope conditions. MANUAL/conflicting answers request entry; sensitive/scoped/REVIEW answers retain bound human approval. Submission validates only the used answer sources, avoiding unnecessary invalidation from unrelated library edits.

Storage uses `FileStorageProvider` with shared local and S3-compatible implementations. API facades retain older imports. Upload/artifact records store keys and SHA-256 checksums, not public document URLs. Local storage needs a persistent shared location if both backend processes use it; R2/S3 is the deployed shared-storage option. Download/preview and evidence endpoints enforce ownership. PDF and DOCX preview libraries run in the web app; `scripts/sync-preview-assets.mjs` prepares browser assets during dev/build.

## Discovery and extraction

[JobDiscoveryService](../apps/api/src/services/job-discovery-service.ts) combines configured Arbeitnow, Greenhouse, Lever and Ashby feeds with user search settings. Company board identifiers are explicit configuration. Traversal uses durable cursors/leases, rotates boards and preserves source errors. Public sources are bounded rather than assumed exhaustive: up to five company boards, 200 examined rows and 50 newly imported jobs per discovery run; duplicate rows do not consume the new-job budget.

`JobService`, retrieval/normalizer services and extractors handle URL/text import, canonicalization, deduplication, source provenance, structured sections and requirements. Arbitrary URL retrieval uses SSRF controls and bounded responses. Unsupported/inaccessible pages can use manual text; supported parsing is not permission to automate an account.

Source refresh preserves job identity, manual corrections and source snapshots. Migration `0023` lets current extraction replace active sections/requirements while retaining old rows referenced by historical evaluations. Current detail, matching and interview preparation select the current extraction. Raw successful HTML payloads are discarded; normalized safe text and provenance remain.

## Shared matching and AI

The [matching backend](../packages/database/src/matching/) builds verified permitted evidence, evaluates requirements, applies deterministic hard gates, calculates fit and stores explanation/provenance. API, manual/batch/daily analysis and worker paths use the same engine. Worker preparation consumes fresh persisted MATCH analyses; it no longer fabricates MATCHED/SKIPPED ingestion states as a substitute for matching.

Material-input SHA-256 fingerprints include relevant candidate/job/preferences/policy context and algorithm version. Algorithm 2.0 invalidates old analyses; stable fingerprints ignore check-only timestamps and irrelevant row order. Stale recommendations lose preliminary automatic eligibility without deleting history. Ranking and selection must recheck freshness.

Explicit work modes bind even when relocation is allowed. Country authorization is explicit. Internship, citizenship/clearance and material jurisdiction unknowns require review; remote/residence/no-sponsorship cannot satisfy them. Salary comparisons require explicit matching currencies and pay periods. Low professional relevance has an explanation distinct from an exclusion or unknown eligibility.

Dynamic adapters support disabled, Gemini and OpenAI configuration; mocks provide deterministic tests. Per-policy provider settings can influence selection. The validator filters returned evidence IDs against the context whitelist and demotes unsupported positive judgments to UNKNOWN. Arbitrary model narratives cannot create sensitive candidate facts. Implemented adapter/model strings do not establish current vendor availability or quality; live paid model validation is outside this audit.

Material preparation currently uses deterministic grounded tailoring/letter engines and programmatic DOCX/TXT generation. A configured matching model does not mean every preparation calls an LLM. Model cost remains unknown without measured provider accounting.

## Preparation and current submission flow

[PreparationBatchService](../apps/api/src/services/preparation-batch-service.ts) persists selected jobs, base CV, item progress, failures, cancellation/retry and material cache identity. Existing package/version/artifact/question/approval and CRM services remain authoritative. The API performs one preparation at a time per instance using database claims, heartbeat/lease recovery and active-item uniqueness. This is API background work, distinct from worker browser execution.

Cache inputs include tenant, verified facts/permissions, documents, preferences, vacancy content, base CV and generation version. Unchanged completed inputs can reuse materials. Changed queued inputs stop for review; changes during generation mark results stale. An expired generation lease becomes a visible failed item; deliberate retry can repair incomplete materials without deleting prior history.

Current flow: select jobs -> persistent preparation -> resolve questions/documents -> enumerate eligible items in review -> issue separate short-lived authorization per application -> queue selected submissions. Grouping repeated questions is navigation only. The complete durable intent-before-generation entry point is still missing; this is not yet the full One-click contract.

## Submission boundary and worker execution

Shared [SubmissionAuthorizationService](../packages/database/src/submission/submission-authorization-service.ts) builds a manifest from owned application/package readiness, immutable version, artifact checksums, question answers/approvals, used answer-library sources and material-input fingerprint. A signed ticket expires after 15 minutes and is bound to a user/application and those materials.

Shared [BrowserWorkerService](../packages/database/src/submission/browser-worker-service.ts) defaults runs to DRY_RUN. SUBMIT requires a valid token or the existing opt-in POLICY path. It rejects unsupported providers, unavailable listings, changed destinations and already submitted/unready applications. In a transaction it locks user/application rows, checks prior SUBMIT attempts and counts today's UTC SUBMIT queue entries against `min(20, configured daily limit or 5)`.

The worker claims persisted runs, heartbeats and validates the manifest at claim and immediately before dispatch. POLICY runs recheck the current opt-in. It loads actual checksum-verified artifact bytes and maps only allowed answers. Hosted Greenhouse, Lever and Ashby adapters inspect runtime forms; generic forms do not get automatic submission coverage. Custom fields, unsupported layouts, login, CAPTCHA and identity challenges can stop for intervention.

The browser engine records dispatch before clicking and observes new provider confirmation, validation rejection or ambiguity. An internal run ID is never represented as an employer reference. A timeout/disconnection after dispatch becomes SUBMISSION_UNCERTAIN; orphaned SUBMIT runs recover conservatively into uncertainty. Reconciliation is explicit and tenant-scoped. Evidence screenshots are private, bounded by ownership/expiry and stored through the common provider.

## CRM and communications

Applications preserve one tracked record per user/job, manual applications, lifecycle correction history, frozen submitted artifact provenance, contacts, notes, assessments, interviews and offers. Execution status is not employer status. Package regeneration cannot rewrite what was submitted. Normal archiving preserves history; purge is distinct and destructive.

Email services implement Gmail read-only OAuth, token envelopes, persistent state, sync claims, MIME normalization, classification/entity resolution and review queues. Conservative state changes go through the CRM state machine. Offers and uncertain associations require review; no recruiter-send feature is implied. Authentication/reset email uses a separate transactional mailer (Resend/SMTP).

Calendar providers separate availability from event management scopes; interviews and preparation briefs remain linked to applications. Fixture providers establish local behavior only. Existing real-account configuration is not live verification or authorization for new writes.

## Background scheduling and deployment

`DailySearchService` in the API uses opt-in rolling 24-hour scheduling and recoverable leases for discovery/matching/preparation plus an optional in-app digest. It does not submit. `AutonomousOrchestrator` in the worker retains older discovery/draft preparation and auto-apply controls. These paths have not yet converged into the versioned-policy Autopilot engine.

[Railway configuration](../.railway/railway.ts) defines `jobee-api` and `jobee-worker`, sharing PostgreSQL and storage credentials. [Dockerfile](../Dockerfile) builds all workspaces on Node 24, installs Chromium, runs as the non-root node user and defaults to the API entry point. API boot serves the built web SPA and runs migrations. Worker start overrides the command to `node apps/worker/dist/index.js`. Neon and R2 are recorded infrastructure, not freshly certified service health.

## Decisions retained

- Keep one npm/TypeScript monorepo, Fastify composition, PostgreSQL/Drizzle SQL and existing storage abstraction.
- Keep browser execution in a separate process; process separation alone is not a claim of a comprehensive network sandbox.
- Preserve authenticated multi-user ownership, immutable historical versions/events and stable IDs.
- Extend current authorization and queues incrementally; do not add a broker, parallel data model or agent fleet without demonstrated need.
- Converge one-click and scheduled triggers only after one provider workflow is proven. Existing reviewed flows remain usable until replacement acceptance passes.

Operational procedures are in [operations](OPERATIONS.md); normative security constraints and known assurance gaps are in [policies](POLICIES.md).
