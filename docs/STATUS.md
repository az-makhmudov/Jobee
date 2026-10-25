# Jobee — current status

Updated 2026-10-25. Active checkpoint: **JOB-P2-T02 / JOB-P3-T02 / JOB-P4-T02 / JOB-P5-T01 owner feedback**. Preceding source HEAD: `d929f3d` on `codex/jobee-2-foundation`. This checkpoint corrects local matching/UI, platform limits, managed AI and Calendar return behavior. Production rollout remains undecided; no push/deployment is authorized.

## Current behavior

Explore sends `relevantOnly` through the actual HTTP client and applies profile compatibility, deterministic blockers and current SKIP decisions before pagination. Junior/Entry and Intern/Internship labels are normalized; known seniority conflicts cannot be rescued by a skills score. Unknown eligibility remains unknown. Algorithm 2.1.0 makes earlier analyses stale. Explicit library tools/history remain available; no owner candidate data was changed.

The main path is Profile → Explore → job details → Apply → Applications. Bulk/source tools, feedback buttons, job corrections and detailed fit/source tabs are progressive disclosures; technical unknown/state/provider labels are removed from the default job header. Existing applications use an exact owned job lookup, including older records, and retain a primary View application action. Application tracker/review remain visible; global communication tools are contextual. Material, consent, duplicate and uncertain-outcome checks remain intact.

Gemini is server-managed. Users cannot switch provider/model or trigger connectivity charges; legacy per-user overrides are ignored. Explicit disabled mode remains for offline verification. Ordinary accounts have 10 SUBMIT reservations per UTC day, including queued/failed attempts; admins and explicitly designated testers are exempt from that platform cap. Accepted Autopilot bounds remain independent. Tester invitation redemption/role assignment are atomic, and submitted role escalation is rejected.

All users may save up to 10 candidate documents. Upload admission serializes before storage; concurrent uploads cannot exceed the cap. Existing excess documents are preserved, with further uploads blocked until reduced. Preview/deletion and submitted-artifact provenance remain available. **Self-service account deletion is not implemented**; its storage/session/token cleanup and retention/export semantics remain under JOB-P1-T02.

Calendar OAuth consumes signed scope-bound state once and returns to configured `WEB_ORIGIN`, with success/refusal/failure feedback instead of account JSON. Availability/event-management separation and explicit write confirmation remain. Earlier read-only email, transactional enrichment/review and uncertain calendar-booking safeguards are retained.

## Verification

Local checks use disabled external AI, fixture providers, synthetic users and explicitly identified `localhost:5432/jobee_test_isolated`.

| Check                 | Result                                                                                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit/integration      | PASS — 822 tests, 84 files, no skips; includes relevance query serialization, exact-job ownership lookup, real tester signup/role rejection, concurrent invitation redemption and document/quota boundaries         |
| Typecheck / build     | PASS — all workspaces, including final exact-job lookup and presentation changes                                                                                                                                    |
| Browser               | PASS — final 37/37 Chromium scenarios against rebuilt API. Desktop Light and 390px Dark inspected, no root overflow; actual relevance requests, existing-application action and recoverable Calendar return checked |
| Lint                  | PASS — 0 errors, 677 warnings                                                                                                                                                                                       |
| Standalone fixtures   | PASS — discovery/matching, calendar/preparation and submission-safety verifiers                                                                                                                                     |
| Isolated database     | db:check / db:migrate PASS; 27 SQL/journal entries with all applied hashes verified, nine-snapshot chain valid; no new migration                                                                                    |
| Format / final review | PASS — all-file format check, formatter scope and independent final diff review                                                                                                                                     |
| Documentation         | Exactly nine core Markdown files; 90 local link targets resolve                                                                                                                                                     |

An earlier browser fixture selected only Entry while expecting internships; its explicit synthetic preferences now include Internship. One queued-preparation assertion failed in an earlier parallel test run; isolated verification and the subsequent full suite passed. Preview browsers/servers are stopped. Five task-created synthetic preview users and five owned storage objects were removed with marker/time/ownership checks. This local checkpoint is committed under the task stamps above; the completion response supplies its commit hash.

## Live evidence and remaining scope

- The owner uses the Railway production app and reports Gmail/Calendar connected. The separate local database has no such connections. No mailbox content, real calendar events or production records were changed; this checkout does not establish deployed identity or live integration health.
- Honeywell vacancy 159335 was read publicly on 2026-10-25: project-management internship in Warsaw, hybrid, on Oracle Recruiting. Oracle is outside current submission adapters; retain manual handoff. No application was started/submitted, and supplying a URL does not authorize submission.
- Owner decisions: Poland-first launch for all job seekers, emphasis on international students; private, non-open-source repository; Autopilot defaults off. Current repository visibility is owner-declared, not independently revalidated by the unsigned-in GitHub CLI. Historical privacy/security review remains relevant.
- Remaining engineering/acceptance: self-service account deletion; owner review of the simplified UI; human relevance/student usability; measured Gemini quality/cost under an approved budget; real provider acceptance; retention/privacy and operational recovery review. Do not claim these from fixtures.
- Push/merge, deployment/production migration, paid usage, real employer submissions and calendar mutations still require separate explicit authorization under [AGENTS.md](../AGENTS.md).

Continue from the reviewed local checkpoint and [remaining roadmap](ROADMAP.md); preserve the owner's candidate data and connected accounts.
