# Jobee — remaining roadmap

Updated 2026-10-21. This is a delta roadmap over the current implementation, not a rebuild. Scope and acceptance live here; current verification/checkpoints live in [status](STATUS.md). Product vision lives in [master context](MASTER_CONTEXT.md).

## Completed foundation

JOB-PRODUCT-EVOLUTION-01 is the historical deployed preparation/discovery/student-interface release. Local Jobee 2.0 work completed JOB-P0-T01, JOB-P1-T01, JOB-P1-T02, JOB-P2-T01 and JOB-P2-T02: reconciled foundation, three-section shell, verified candidate preferences/answers, persistent Explore/source extraction and shared grounded matching. JOB-P3-T01 now adds durable job-scoped permission and automatic preparation through the existing queues, with actual employer questions and safe pause/resume. JOB-P3-T02 and JOB-P5-T02 add the local Applications attention/recovery projection and versioned-policy Autopilot on that same pipeline. Local completion does not establish deployment or the full revised MVP.

JOB-DOC-CONSOLIDATION-01 consolidates current documentation; it is not a feature release. Historical detailed reports and retired specifications remain in Git rather than an archive of competing guidance.

## Dependency order

JOB-P3-T01, JOB-P3-T02 and JOB-P5-T02 are complete locally. JOB-P5-T01 has local API/worker fixture proof; its external acceptance remains open. The integration milestones below remain **PARTIAL**. Work in this order. JOB-P5-T01 intentionally precedes full CRM/Autopilot convergence; email/calendar expansion does not block One-click Apply.

| Priority | Canonical task | Remaining meaningful outcome                                            | Required foundation                           |
| -------- | -------------- | ----------------------------------------------------------------------- | --------------------------------------------- |
| 1        | JOB-P5-T01     | Owner-approved employer-confirmed provider validation                   | Locally verified one-click pipeline           |
| 2        | JOB-P4-T01     | Contextual verified communications enrichment and confidence-policy fix | Existing Gmail/read-only integration retained |
| 3        | JOB-P4-T02     | Contextual authorized calendar/interview workflow                       | Existing calendar/preparation retained        |

### JOB-P5-T01 — provider execution proof

Local engineering now connects the authenticated one-action entry point, durable permission, automatic preparation, signed material binding and the separate browser worker. Deterministic Greenhouse fixtures prove confirmation, routine answers, material questions/consent, rejection, delayed/missing confirmation, unsupported/changed forms, challenges, concurrent clicks/workers, revocation, connection loss and crash recovery. Existing reviewed workflows and all three adapters remain covered. Fixture receipts are not real employer receipts.

Remaining external acceptance:

- Obtain a named owner-approved provider, target vacancy and exact action before any real submission validation.
- Observe an actual authorized prepare/fill/validate/submit/verify/record journey and employer-confirmed result through at least one provider. Retain real artifact/evidence bytes and truthful references under the existing privacy controls.
- Validate available failure/recovery behavior on that approved target without intentionally creating duplicate or uncertain real applications. Any uncertainty requires reconciliation before retry.
- Record observed coverage and limitations rather than certifying all forms on that provider. Fixture success alone cannot close the revised MVP external requirement. No live action is authorized by the local implementation request.

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
