# Jobee — current status

Updated 2026-10-21. Active checkpoint: **JOB-P4-T01 / JOB-P4-T02 and remaining local release readiness**. Preceding source HEAD: `e54cd0a995d429cc168897aa25677ff386f3e590` on `codex/jobee-2-foundation`. Local connected-flow engineering is complete; external/human release acceptance remains open. No push or deployment is authorized by this checkpoint.

## Current scope

Application workspaces now contain server-filtered messages, pending email review and interviews/preparation. Gmail remains read-only. Automatic enrichment requires .90 classification/entity certainty; rejection requires .95 plus an exact reference or company-and-role association. Fuzzy/contact-only hints, offers and terminal conflicts stay in review. Owned review overrides, serialized resolution, transactional message/lifecycle persistence and fenced account leases prevent partial replay and disconnect resurrection.

Calendar OAuth defaults to availability and binds requested scope into signed one-time state. Contextual routes validate owned application/interview pairs; writes require explicit confirmation and actual event-management grants. Refresh cannot restore a disconnected account. Booking reserves a durable pending state; uncertain outcomes block recreation until recorded human reconciliation. Private notes/conference creation are opt-in, employer URLs are preserved, and saved IANA timezones drive presentation. Provider changes reset incompatible calendar selections; no new Google scope is requested. Load failures and recovery dialogs retain honest state and keyboard focus.

Evidence pruning now runs independently of discovery/preparation flags and retains failed/unrecognized references for retry/investigation. Fresh local candidate/operator defaults are synthetic; production requires an explicit operator email. Existing candidate records/IDs are preserved. The local recovery verifier backs up/restores newly created synthetic databases and local document bytes, checking IDs, checksums and encrypted-token decryptability before removing its resources. Thirty synthetic matching cases cover ready/unknown/excluded student roles; these are not human relevance results.

Earlier one-click preparation, Applications recovery and bounded Autopilot remain implemented. Autopilot rollout defaults off. No new migration is needed: isolated journal and SQL files remain at 27 entries (`0000`–`0026`).

## Verification

Checks on 2026-10-21 use disabled external AI, local storage and synthetic records on explicitly identified `localhost:5432/jobee_test_isolated`. No real employer, email or calendar actions were performed.

| Check                 | Result                                                                                                                                                                                                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit/integration      | PASS — 807 tests, 82 files, no skips; includes 32 connected-flow integration cases, evidence-retention failure/retry and 30 synthetic matching scenarios                                                                                                   |
| Browser               | PASS — final 37/37 Chromium scenarios after a watched-server restart interrupted one earlier rerun. Contextual Light desktop/Dark 390px inspected; no root overflow, timezone, failed loads, uncertain retry blocking and dialog focus/restoration checked |
| Standalone verifiers  | PASS — JOB-P4-T01 email and JOB-P4-T02 calendar/preparation fixture suites; isolated backup/restore rehearsal and cleanup                                                                                                                                  |
| Typecheck / build     | PASS — all workspaces                                                                                                                                                                                                                                      |
| Lint                  | PASS — 0 errors, 692 warnings                                                                                                                                                                                                                              |
| Format / final review | PASS — scoped formatter diff, all-file format check and independent final diff review                                                                                                                                                                      |
| Isolated database     | db:check and db:migrate PASS; 27 journal entries/SQL files, no new migration                                                                                                                                                                               |
| Documentation         | Exactly nine core Markdown files; 89 local link targets resolve                                                                                                                                                                                            |

Integration fixtures use scoped teardown. Task-owned browsers/servers are stopped. Four synthetic preview users and five owned storage objects were removed with marker/time/ownership checks. Synthetic recovery databases and archives were removed. The checkpoint is committed under the task stamps above; the completion response supplies its commit hash.

## Remaining acceptance and owner dependencies

- JOB-P5-T01 needs a named provider, vacancy and exact owner-approved live action, followed by actual employer-confirmed evidence and safe recovery observation. Fixtures do not satisfy that requirement.
- JOB-P4-T01/P4-T02 real-account acceptance needs a named authorized account and permitted read/write action. No outbound recruiter communication or invitation acceptance is authorized by local implementation.
- Approximately 30 vacancies need human relevance labels; 5–8 students need to validate consent/outcome comprehension. Real model availability, grounding, latency and cost remain unmeasured.
- Public-launch privacy/legal and Git-history clearance, complete account/message/document/backup retention/deletion/export review, formal accessibility assessment and production monitoring/PITR/object-store recovery remain open. Synthetic restore does not certify production recovery.
- Production rollout, paid usage, migrations/deployment and GitHub push/merge require separate owner authorization. Current deployed health/SHA and provider configuration were not inspected.

## Continue from here

The remaining [roadmap](ROADMAP.md) consists of named live-account validation, human evaluations and owner release/privacy decisions. Preserve this local checkpoint; do not recreate completed phases or infer external authority from product settings.
