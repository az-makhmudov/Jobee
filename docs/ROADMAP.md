# Jobee — remaining roadmap

Updated 2026-10-26. This is a delta roadmap over the current implementation, not a rebuild. Scope and acceptance live here; current verification/checkpoints live in [status](STATUS.md). Product vision lives in [master context](MASTER_CONTEXT.md).

## Completed foundation

JOB-PRODUCT-EVOLUTION-01 is the historical deployed preparation/discovery/student-interface release. Local Jobee 2.0 work completed JOB-P0-T01, JOB-P1-T01, JOB-P1-T02, JOB-P2-T01 and JOB-P2-T02: reconciled foundation, three-section shell, verified candidate preferences/answers, persistent Explore/source extraction and shared grounded matching. JOB-P3-T01 now adds durable job-scoped permission and automatic preparation through the existing queues, with actual employer questions and safe pause/resume. JOB-P3-T02 and JOB-P5-T02 add the local Applications attention/recovery projection and versioned-policy Autopilot on that same pipeline. Local completion does not establish deployment or the full revised MVP.

JOB-DOC-CONSOLIDATION-01 consolidates current documentation; it is not a feature release. Historical detailed reports and retired specifications remain in Git rather than an archive of competing guidance.

## Owner feedback and launch decisions

The owner confirms a simple Profile → relevant Explore → job details → one-click Apply → Applications path, managed Gemini only, a 10/day platform application cap (admin-designated tester/admin exemptions), 10 saved documents per account, private repository and initial Poland launch for all job seekers with emphasis on international students. Autopilot remains default-off. The owner approved the Railway testing release of `f3202ea` and the recommendation correction `7723620`, now deployed to API and worker; broader rollout remains undecided. These are product decisions, not live account-action authority.

JOB-P2-T02 / JOB-P3-T02 / JOB-P4-T02 local corrections address profile-compatible Explore, seniority blockers, progressive tools, managed AI, quotas/document admission and Calendar OAuth return. The owner additionally requires automatic analysis before publication and only fresh MATCH jobs in Explore; JOB-P2-T02 now covers the dedicated background queue, strict target geography and explicit saved-library access. A separately approved single synthetic-job production check confirmed Gemini fallback availability and correct withholding of REVIEW; human relevance/usability, broader grounding quality and measured cost remain open. **JOB-P1-T02 remaining engineering:** self-service account deletion with scoped storage cleanup and session/token revocation. The owner selected a seven-day cancellation window followed by deletion of all Jobee-held account data; export is optional. External employer/Google records are outside that deletion. Implementation follows the prioritized search/Quick Apply testing checkpoint; the document cap is not an account-deletion feature.

The owner supplied Honeywell vacancy 159335 (Oracle Recruiting), publicly inspected read-only on 2026-10-25: project-management internship in Warsaw, hybrid. Oracle submission is outside the three current adapters; preserve truthful manual handoff. No application was started/submitted. The owner reports Gmail/Calendar connected on the Railway production app; local database records are separate and cannot prove those live grants. The approved release verified deployment identity and scoped synthetic account behavior; real-account enrichment/event acceptance remains separate.

## Dependency order

JOB-P3-T01, JOB-P3-T02 and JOB-P5-T02 are complete locally. JOB-P5-T01 has local API/worker fixture proof; its external acceptance remains open. JOB-P4-T01 and JOB-P4-T02 engineering is complete locally; their real-account acceptance remains **PARTIAL**. Work in this order. JOB-P5-T01 intentionally precedes full CRM/Autopilot convergence; email/calendar expansion does not block One-click Apply.

| Priority | Canonical task | Remaining meaningful outcome                            | Required foundation                           |
| -------- | -------------- | ------------------------------------------------------- | --------------------------------------------- |
| 1        | JOB-P5-T01     | Owner-approved employer-confirmed provider validation   | Locally verified one-click pipeline           |
| 2        | JOB-P4-T01     | Owner-authorized real-account communications validation | Existing Gmail/read-only integration retained |
| 3        | JOB-P4-T02     | Owner-authorized real-account calendar validation       | Existing calendar/preparation retained        |

### JOB-P5-T01 — provider execution proof

Local engineering now connects the authenticated one-action entry point, durable permission, automatic preparation, signed material binding and the separate browser worker. Deterministic Greenhouse fixtures prove confirmation, routine answers, material questions/consent, rejection, delayed/missing confirmation, unsupported/changed forms, challenges, concurrent clicks/workers, revocation, connection loss and crash recovery. Existing reviewed workflows and all three adapters remain covered. Fixture receipts are not real employer receipts.

Remaining external acceptance:

- Obtain a named owner-approved provider, target vacancy and exact action before any real submission validation.
- Observe an actual authorized prepare/fill/validate/submit/verify/record journey and employer-confirmed result through at least one provider. Retain real artifact/evidence bytes and truthful references under the existing privacy controls.
- Validate available failure/recovery behavior on that approved target without intentionally creating duplicate or uncertain real applications. Any uncertainty requires reconciliation before retry.
- Record observed coverage and limitations rather than certifying all forms on that provider. Fixture success alone cannot close the revised MVP external requirement. No live action is authorized by the local implementation request.

### JOB-P4-T01 — communications

Local engineering is complete: .90 enrichment/.95 rejection policy, conservative entity/thread linking, atomic message/lifecycle/review persistence, owned review overrides, disconnect fencing and application-scoped messages/review. Existing Gmail read-only scopes remain unchanged. Remaining acceptance: validate contextual enrichment and disconnect/reconnect on an explicitly authorized real account. Fuzzy associations, offers and uncertain events remain review items; no outbound recruiter authority is implied.

### JOB-P4-T02 — interviews

Local engineering is complete: signed scope selection, availability default, actual-grant and parent ownership checks, explicit write confirmation, saved-timezone presentation, contextual preparation, token-refresh fencing and durable uncertain booking/reconciliation. Remaining acceptance: inspect account grants and validate permitted real-account availability/event behavior with named action authorization. Fixture events are not real-account certification.

## Cross-cutting release acceptance

These are remaining outcomes within the milestones above, not extra micro-task stamps:

| Area                     | Remaining validation or decision                                                                                                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| External execution       | Named, owner-authorized employer-confirmed application and uncertainty/reconciliation observation                                                                                                        |
| Recommendation quality   | Human relevance benchmark on approximately 30 representative vacancies (30 synthetic matching scenarios now pass), including student roles, unknown eligibility, hard exclusions and transferable skills |
| Human UX                 | 5–8 student sessions; test consent/outcome comprehension and unnecessary intervention, following [UX](UX.md)                                                                                             |
| AI quality/cost          | Validate configured model availability, grounding behavior, actual provider usage/cost and latency; no unsupported cost/savings claims                                                                   |
| Privacy/public readiness | Review candidate/account/evidence retention, deletion/export, public-history exposure and jurisdictional obligations; no implied compliance certification                                                |
| Operations               | Production backup/PITR/object-store recovery, same-commit API/worker promotion, monitoring and rollback under owner approval; synthetic PostgreSQL restore and local migration replay now pass           |
| Source coverage          | Improve feeds/company coverage only from evidence/demand; unsupported LinkedIn automation and universal ATS support remain non-goals                                                                     |
| Accessibility            | Keyboard/focus, narrow viewport/zoom, themes, status/error semantics and formal audit as appropriate                                                                                                     |

Current deployed health, credentials, scopes and account configuration require fresh operational verification before release; historical setup is not an open request to recreate services. Additional university/local feeds or dedicated Indeed support remain research conditioned on demand and permitted access, not committed launch requirements.

## Release outcomes

| Outcome         | Exit criterion                                                                                            |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| Foundation      | Existing locally verified Profile/Explore/matching foundation; not a new production release               |
| One-click MVP   | JOB-P3-T01 + JOB-P5-T01, truthful Applications essentials and separately authorized external confirmation |
| Autopilot       | Proven same engine plus JOB-P3-T02/JOB-P5-T02 policy, lifecycle and recovery acceptance                   |
| Connected Jobee | Verified contextual email/calendar enrichment under explicit grants                                       |

Quality gates and agent procedure are defined once in [AGENTS.md](../AGENTS.md). Record new evidence in status and the completion response; do not reopen completed work solely because old reports used different navigation or task ordering.
