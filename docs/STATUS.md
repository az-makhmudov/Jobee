# Jobee — current status

Updated 2026-10-21. Active scope: **JOB-P3-T02 / JOB-P5-T02**. Source checkpoint: `705bc6a63e93df817070a097148cb4ed7ced395a` on `codex/jobee-2-foundation`. Both tasks are complete and verified locally. No push or deployment is authorized by this checkpoint.

## Current scope

Applications projects execution/preparation separately from employer lifecycle and exposes owner-scoped attention/recovery in the tracker and Needs review. Uncertain submission outranks newer previews; active preparation does not request human intervention. Manual records, immutable submitted provenance, detailed CRM editors, explicit terminal corrections, existing links and deliberate resume remain intact.

Autopilot has explicit `jobee-autopilot-v1` acceptance, versioned scope/history, candidate fingerprints, schedule, score/review conditions and bounded daily attempt limits. Its rollout flag defaults off. Manual and scheduled triggers create the same durable intents used by Apply with Jobee. Preparation, worker claim and final dispatch revalidate authority; legacy booleans/POLICY manifests cannot submit. Policy pause/input changes stop pending authority; stopped applications are never silently renewed. Daily assistance and legacy preparation use the shared preparation queue without submission permission. Scheduling leases, acknowledgements, attempt history and in-app recovery notifications remain durable.

Additive migration `0026_autopilot_policy` adds four columns to existing policy/intent tables. Only `localhost:5432/jobee_test_isolated` was migrated; the journal has 27 entries (`0000`–`0026`).

## Verification

Fresh checks on 2026-10-21 use disabled external AI, local storage and disposable synthetic users. No live employer, email or calendar actions were performed.

| Check                  | Result                                                                                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit/integration tests | PASS — 744 tests, 80 files, no skips; includes 14 new application/Autopilot integration scenarios, 14 policy-scope cases, five attention cases and three policy UI cases |
| Browser                | PASS — 37/37 Chromium scenarios; new policy panel inspected in desktop Light and 390px Dark, with no horizontal overflow                                                 |
| Standalone verifiers   | PASS — CRM lifecycle, JOB-P5-T01 and JOB-P5-T02 deterministic suites                                                                                                     |
| Typecheck / build      | PASS — all workspaces                                                                                                                                                    |
| Lint                   | PASS — 0 errors, 692 warnings                                                                                                                                            |
| Format / diff          | PASS — formatter changes scoped to this work; final diff reviewed                                                                                                        |
| Isolated database      | db:check and db:migrate PASS, including idempotent replay; 27 journal entries/SQL files and valid snapshot chain                                                         |
| Documentation          | Exactly nine core Markdown files; all 88 local link targets resolve                                                                                                      |

The orchestration verifier now checks persisted matching evidence and durable preparation handoff rather than obsolete job-state mutation. Fixture receipts remain local evidence. Task-owned preview servers are stopped; four task-created synthetic UI/verifier users and five owned storage objects were removed with explicit marker/time/ownership checks. Integration test users use scoped teardown.

## Limits and owner dependencies

- JOB-P5-T01 external acceptance remains open: the owner must name the provider, vacancy and exact permitted live action before employer-confirmed validation. Fixture confirmation is not a real employer receipt or universal provider certification.
- Autopilot production enablement, migration/deployment, pushes/merges, real email/calendar actions and paid operations remain separately authorized. This task performs none of them.
- Production health/deployed SHA, real model quality/cost, relevance benchmarks, student usability, accessibility certification and public-launch privacy/history clearance remain unverified.
- The email synchronization 0.85 versus required 0.90 confidence gap remains under JOB-P4-T01; it is not changed in this scope.

## Continue from here

This checkpoint is locally complete. Follow [remaining roadmap](ROADMAP.md): the next local phase is JOB-P4-T01, followed by JOB-P4-T02. Separate named authorization remains necessary for external execution acceptance.
