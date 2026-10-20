# Jobee 2.0 — Implementation Backlog

Updated 2026-10-20. Owner: Codex. Phase-by-phase local implementation approved 2026-10-20; JOB-P1-T01 is in progress. ROADMAP.md owns statuses and dependencies. Older BL identifiers and completion records are archived, not reopened as separate official tasks.

| Canonical task | Substantial deliverable                                                             | Preserve / simplify                                                                                               |
| -------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| JOB-P0-T01     | Assessment and plan approved; keep canonical guidance aligned during implementation | Keep historical evidence separate from 2.0 acceptance                                                             |
| JOB-P1-T01     | Three-section responsive shell and compatibility navigation                         | Reuse App.tsx, navigation.ts, tokens and contextual workspace                                                     |
| JOB-P1-T02     | Unified candidate context, verified routine answers and preferences                 | Reuse import verification, facts, documents, answer library; clarify material unknowns                            |
| JOB-P2-T01     | Explore, source-aware real jobs and concise search                                  | Reuse discovery, deduplication, cursors, freshness and import                                                     |
| JOB-P2-T02     | One shared grounded AI fit/eligibility evaluation                                   | Replace exclusion-only scheduler shortcut; keep deterministic policy                                              |
| JOB-P3-T01     | Durable Apply with Jobee entry point through automatic preparation                  | Reuse batch/package/version/fingerprint services; persist intent before generation; pause only when needed        |
| JOB-P5-T01     | Complete provider execution and reliable evidence                                   | Preserve manifest revalidation, challenge stops, duplicate locks and uncertain outcomes; prove one provider first |
| JOB-P3-T02     | Unified execution/employer tracking, attention and safe resume                      | Preserve manual applications, notes, contacts, artifacts and immutable events                                     |
| JOB-P5-T02     | Autopilot on the same engine                                                        | Versioned opt-in, transactional quotas, policy revocation, scheduling, notifications and recovery                 |
| JOB-P4-T01     | Contextual authorized employer communications                                       | Keep Gmail/OAuth/classification/linking; defer provider expansion                                                 |
| JOB-P4-T02     | Contextual interviews/calendar assistance                                           | Keep calendar/preparation; no unnecessary new destination                                                         |

Detailed risk priorities, entity mapping, acceptance cases and evidence: JOBEE_2_ASSESSMENT.md. Do not delete old screens/services until their replacement covers used functions and old links; hiding navigation is independent of dropping data.
