# Jobee — status

Updated 2026-10-20. Durable continuation record; distinguish local source, test evidence and production observations.

## Current task and checkout

**JOB-P3-T01 — local implementation complete; JOB-P5-T01 — local engineering/fixture acceptance complete, external acceptance open.** Source checkpoint: `76789fee39ebacc4a61b15ee9c6bcc19147bd45c`, branch `codex/jobee-2-foundation`, clean starting tree. This checkpoint is identified by its canonical task stamps; the completion response/Git log supplies its final commit hash.

One authenticated **Apply with Jobee** action now persists an application and job-scoped permission before generation. Existing preparation batches generate grounded documents; the separate worker inspects actual employer questions, reuses authorized verified routine answers, pauses for material unknowns/consent, and binds signed material proof to still-valid intent. Permission expires after one hour; repeated clicks do not renew it. Explicit resume, cancellation before dispatch, expiry/source checks, atomic queue/quota controls, final dispatch reservation and uncertain-result reconciliation preserve history and prevent duplicate dispatch.

Explore and the application workspace expose persistent status/recovery controls. Existing reviewed preparation, per-question consent and manual application records remain supported. Recommendation score thresholds do not become hard eligibility blockers for a deliberately selected manual application. The shared question engine now lives in the database backend; the worker does not import API implementation.

Migration `0025_application_intents` adds permission records and references to existing applications, preparation batches and browser runs. It does not introduce another execution queue. The generated SQL was narrowed to this additive table, foreign keys and indexes because older snapshot metadata omitted previously installed schema. Only the positively identified isolated localhost test database was migrated.

## Verification

Fresh checks on 2026-10-20 use disabled external AI, local storage, disposable synthetic users and `localhost:5432/jobee_test_isolated`. No real employer application, recruiter message, calendar mutation, paid operation, production migration, deployment or push was performed.

| Check                              | Result                                                                                                                     |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Typecheck                          | PASS — all workspaces                                                                                                      |
| Unit/integration tests             | PASS — 708 tests, 77 files, no skips; 32 one-click API/worker scenarios and four new UI component scenarios                |
| Standalone JOB-P5-T01 verification | PASS — 10/10 deterministic sections; repaired synthetic CV byte storage and failure exit status                            |
| Lint                               | PASS — 0 errors, 693 warnings                                                                                              |
| Build                              | PASS — all workspaces                                                                                                      |
| Format                             | PASS; final documentation formatting checked before commit                                                                 |
| Isolated database                  | db:check and db:migrate PASS; 26 journal entries and matching SQL files; repeated migration run is idempotent              |
| Browser                            | PASS — 37/37 Chromium scenarios; new-flow Light/Dark and 390px visual checks, reload restoration and keyboard cancellation |

An additional network-blocked local form smoke passed through the API, durable preparation and a separate worker process using real Chromium: actual generated file upload/native validation, fixture confirmation and persisted PNG bytes. This is browser/worker evidence, not a real employer submission.

Preparation tests now claim work for their own disposable user so parallel suites cannot consume each other's queue items. The preceding Phase 2/audit checkpoint remains in Git; local foundation, candidate context, Explore and shared matching are preserved. Exactly nine core Markdown documents remain authoritative; all 86 retained local Markdown link targets exist.

## Limits and remaining owner dependencies

- JOB-P5-T01 cannot close its external acceptance until the owner names the provider, target vacancy and exact permitted live action, followed by an observed employer-confirmed result. Greenhouse fixture receipts and local screenshots are not real employer receipts or universal provider certification.
- Production health/deployed SHA, live AI/model quality/cost, usability/time savings and real-account scopes/health were not recertified. Historical JOB-PRODUCT-EVOLUTION-01 deployment is not evidence that this source is deployed.
- Public-launch retention/deletion/privacy review and complete public-history sensitive-content clearance remain open. Do not reproduce historical sensitive values or rewrite history.
- The known email synchronization 0.85 versus required 0.90 threshold gap remains under JOB-P4-T01. Legacy quota/scheduler differences and versioned-policy Autopilot remain under JOB-P5-T02; old flags do not gain new authority.
- Full Applications convergence, metrics and broader lifecycle presentation remain JOB-P3-T02. No unrelated feature expansion is included here.

## Continue from here

This scope is locally verified. Test servers are stopped, task-created UI fixture users/files were removed with explicit ownership/time/marker checks, and the final diff was reviewed before the local commit. The remaining roadmap is [ROADMAP.md](ROADMAP.md). Obtain separate named authorization before any real employer validation. The next local product scope after this request is JOB-P3-T02; broader Autopilot and integration expansion retain their dependency order. Inspect Git status and current database identity before continuing.
