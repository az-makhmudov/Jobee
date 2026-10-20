# Jobee — remaining roadmap

Updated 2026-10-20. This is a delta roadmap over the current implementation, not a rebuild. Scope and acceptance live here; current verification/checkpoints live in [status](STATUS.md). Product vision lives in [master context](MASTER_CONTEXT.md).

## Completed foundation

JOB-PRODUCT-EVOLUTION-01 is the historical deployed preparation/discovery/student-interface release. Local Jobee 2.0 work completed JOB-P0-T01, JOB-P1-T01, JOB-P1-T02, JOB-P2-T01 and JOB-P2-T02: reconciled foundation, three-section shell, verified candidate preferences/answers, persistent Explore/source extraction and shared grounded matching. Local completion does not establish deployment or the full revised MVP.

JOB-DOC-CONSOLIDATION-01 consolidates current documentation; it is not a feature release. Historical detailed reports and retired specifications remain in Git rather than an archive of competing guidance.

## Dependency order

All milestones below are **PARTIAL**: useful implementations exist, but listed acceptance remains. Work in this order. JOB-P5-T01 intentionally precedes full CRM/Autopilot convergence; email/calendar expansion does not block One-click Apply.

| Priority | Canonical task | Remaining meaningful outcome                                                | Required foundation                              |
| -------- | -------------- | --------------------------------------------------------------------------- | ------------------------------------------------ |
| 1        | JOB-P3-T01     | Durable job-scoped intent and automatic routine preparation                 | Existing candidate/discovery/matching foundation |
| 2        | JOB-P5-T01     | One provider proven through authorized execution, verification and recovery | Durable intent/preparation                       |
| 3        | JOB-P3-T02     | Unified execution/employer tracking and actionable safe resume              | Proven provider workflow                         |
| 4        | JOB-P5-T02     | Versioned-policy Autopilot on that same engine                              | Proven manual engine and lifecycle               |
| 5        | JOB-P4-T01     | Contextual verified communications enrichment                               | Existing Gmail/read-only integration retained    |
| 6        | JOB-P4-T02     | Contextual authorized calendar/interview workflow                           | Existing calendar/preparation retained           |

### JOB-P3-T01 — durable Apply with Jobee

Reuse existing applications, preparation batches/items, package versions, artifact generation and authorization. Persist scoped intent before asynchronous generation, select valid existing candidate materials, prepare routine answers/documents automatically and pause only for material unknowns/consent or unsupported execution. Retain reviewed flows until replacement acceptance passes.

Acceptance:

- One deliberate job action creates a durable owned intent that survives reload/restart; repeated/concurrent clicks do not duplicate attempts.
- Candidate, selected CV, saved-answer verification/permission and current job inputs are validated before use. Missing material answers produce a focused intervention, not fabricated defaults.
- Routine supported preparation does not require a mandatory Studio/package navigation sequence.
- Cancellation, interruption and safe resume preserve checkpoints/history and do not recall already dispatched actions.
- Bind the current material manifest after preparation to valid intent; reject revoked/changed sources, expired permission, cross-tenant IDs and materially changed inputs.
- Isolated integration tests prove these behaviors and existing manual/reviewed workflows remain usable.

### JOB-P5-T01 — provider execution proof

Reuse existing Greenhouse/Lever/Ashby adapters, worker claims, checksum-verified uploads, manifest revalidation, observation/evidence and reconciliation. Prioritize one realistically supportable provider before expanding coverage.

Acceptance:

- Complete the one-action prepare/fill/validate/submit/verify/record journey through the actual API/worker boundary in deterministic fixtures.
- Correctly handle provider rejection, delayed/missing confirmation, changed form, unsupported fields, CAPTCHA/identity challenge, network interruption and stale authorization.
- Concurrent clicks/workers and duplicate vacancies cannot produce duplicate submissions. Revocation is checked at the last safe boundary.
- Post-dispatch crashes/timeouts remain uncertain until reconciled. Retry cannot convert ambiguity into a second employer submission.
- Persist real artifact/evidence bytes and truthful employer references; prefill/dry-run cannot become Applied.
- Owner-approved live validation names the provider, target vacancy and exact action. A real employer-confirmed result is required for revised MVP external acceptance; fixture success alone cannot close that requirement. Local engineering can proceed without live permission.

### JOB-P3-T02 — Applications convergence

Keep manual records, immutable submitted provenance, employer lifecycle, notes, contacts, offers, assessments, messages and interviews. Simplify their presentation around application context and an attention queue.

Acceptance: execution attempts are distinct from employer pipeline; the next required action is visible; failure/unknown/manual handoff and safe resume retain previous attempts; terminal corrections require reasons; manual records without packages work; old record links survive. No employer activity is inferred from elapsed time. Verify responsive themes, ownership, restoration and accessibility.

### JOB-P5-T02 — bounded Autopilot

Converge daily assistance and the legacy orchestrator onto the proven pipeline with two triggers. Preserve useful scheduling/notifications without introducing a service fleet or a second authorization model.

Acceptance:

- Explicit versioned/snapshotted opt-in; default off; effective policy covers roles, locations, work mode/type, eligibility, salary, exclusions, schedule, volume and review conditions.
- Policy/candidate changes and revocation stop affected pending actions at safe checkpoints. Old flags do not grant expanded permissions.
- Atomic volume controls hold under concurrency and recovery; clarify reservation/counted-attempt semantics across scheduler, queue and metrics.
- Pause/disable/resume, restart, lease expiry and partial failure preserve auditability without duplicate dispatch.
- Actionable in-app notifications explain blocked/uncertain work; daily preparation does not silently enable submissions.
- Isolated tests prove policy boundaries end to end. Production enablement and any live side effects remain separately authorized.

### JOB-P4-T01 — communications

Retain Gmail OAuth/read-only sync, deterministic/AI classification, entity linking, review queues and conservative lifecycle events. Resolve the documented 0.85 implementation versus 0.90 security-baseline threshold gap before expanded/live communications validation. Validate contextual application enrichment on an explicitly authorized account; fuzzy association, offers and uncertain events stay in review. Do not add outbound recruiter authority or expand scopes implicitly. Email/account disconnect and recovery must retain appropriate history and revoke credentials.

### JOB-P4-T02 — interviews

Retain calendar scope separation, interview records and preparation briefs. Validate contextual event association, timezone presentation, availability versus event-management permission, reconnect/recovery and scoped user-confirmed actions. Calendar writes/acceptance require explicit permission; fixture events are not real-account certification.

## Cross-cutting release acceptance

These are remaining outcomes within the milestones above, not extra micro-task stamps:

| Area                     | Remaining validation or decision                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| External execution       | Named, owner-authorized employer-confirmed application and uncertainty/reconciliation observation                                                             |
| Recommendation quality   | Human relevance benchmark on approximately 30 representative vacancies, including student roles, unknown eligibility, hard exclusions and transferable skills |
| Human UX                 | 5–8 student sessions; test consent/outcome comprehension and unnecessary intervention, following [UX](UX.md)                                                  |
| AI quality/cost          | Validate configured model availability, grounding behavior, actual provider usage/cost and latency; no unsupported cost/savings claims                        |
| Privacy/public readiness | Review candidate/account/evidence retention, deletion/export, public-history exposure and jurisdictional obligations; no implied compliance certification     |
| Operations               | Owner-approved same-commit API/worker promotion, backup/restore rehearsal, migration compatibility, monitoring and safe rollback                              |
| Source coverage          | Improve feeds/company coverage only from evidence/demand; unsupported LinkedIn automation and universal ATS support remain non-goals                          |
| Accessibility            | Keyboard/focus, narrow viewport/zoom, themes, status/error semantics and formal audit as appropriate                                                          |

Current deployed health, credentials, scopes and account configuration require fresh operational verification before release; historical setup is not an open request to recreate services. Additional university/local feeds or dedicated Indeed support remain research conditioned on demand and permitted access, not committed launch requirements.

## Release outcomes

| Outcome         | Exit criterion                                                                                            |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| Foundation      | Existing locally verified Profile/Explore/matching foundation; not a new production release               |
| One-click MVP   | JOB-P3-T01 + JOB-P5-T01, truthful Applications essentials and separately authorized external confirmation |
| Autopilot       | Proven same engine plus JOB-P3-T02/JOB-P5-T02 policy, lifecycle and recovery acceptance                   |
| Connected Jobee | Verified contextual email/calendar enrichment under explicit grants                                       |

Quality gates and agent procedure are defined once in [AGENTS.md](../AGENTS.md). Record new evidence in status and the completion response; do not reopen completed work solely because old reports used different navigation or task ordering.
