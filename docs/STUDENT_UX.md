# Student UX — implementation and prototype checkpoint

Parent milestone: **JOB-UI-MIGRATION-01**, owner-authorized student UX continuation, 19 October 2026.

Status: **IN PROGRESS**. Immediate presentation fixes are implemented and tested locally. The larger navigation/workspace proposal is an editable Figma review prototype. Student usability sessions, final structural scope approval, Linux visual-reference refresh and release remain pending. This checkpoint is not a production release or a claim that the complete simplification is implemented.

Baseline: `a98ac9f073f4d2ed5247b28faa97d13d71477500`. Implementation checkpoint: `04548142fe3ced25fa76b546cf112cd1c7829df8`. Isolated branch: `codex/jobee-student-ux`. Main checkout and its pre-existing `AGENTS.md` edit are untouched.

## Implemented locally

- Home derives up to three next steps from actual pending approvals, interview metrics, pending profile suggestions and unverified facts. Empty queues no longer create approval/interview tasks. Loading and failed checks cannot claim that everything is clear.
- Basic profile setup uses the existing profile/CV/preferences categories. Completed basic setup offers View profile/View CV; missing professional experience does not force Continue setup. The unchanged completeness score is secondary and explicitly separate from accuracy, AI permission and submission authorization.
- Application detail describes recorded submission evidence. A missing frozen package no longer implies that a draft was submitted externally. Running and uncertain submissions keep distinct explanations.
- Studio says Not created yet and Create application documents when no version exists. Existing documents retain generation/version history. Actions use View application and Add to my applications; the CV tab no longer emphasizes the number of employment entries.
- Applications initially uses List, remembers an explicit Board choice and exposes its selected view accessibly. APPLYING appears in Preparing, outside the confirmed Applied column; all canonical statuses remain unchanged.
- Profile review leads with suggestions and defaults to records needing verification. All/category views retain existing record management. Processing hashes/context metadata sit in a disclosure. Verification, AI-use permission and suggestion acceptance remain separate operations.
- Messages opens on Messages instead of an empty review queue. Review remains available.

No backend, shared domain model, database schema, worker, scoring formula, consent default or authorization rule changed. The new Home lookup reads the existing pending-suggestions endpoint. No feature was removed based on presumed lack of use.

## Editable Figma proposal

Existing file only: [Start here — student UX review](https://www.figma.com/design/WistInjosE5NSGLCAnpznU/Untitled?node-id=277-1270). New page: **40 — Student UX · Simplification prototype**. Existing design-system pages and original screen pages were preserved.

Twelve desktop views, each in Light and Dark, use Google Sans Flex, existing semantic variables/components and content-driven cards. They contain editable text, component instances and vectors; no flattened UI images. The proposed sidebar has Home, Find jobs, My applications and My profile, with Settings as a utility.

| View                                          | Light                                                                                 | Dark                                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Home                                          | [Open](https://www.figma.com/design/WistInjosE5NSGLCAnpznU/Untitled?node-id=269-34)   | [Open](https://www.figma.com/design/WistInjosE5NSGLCAnpznU/Untitled?node-id=273-649)  |
| Find jobs                                     | [Open](https://www.figma.com/design/WistInjosE5NSGLCAnpznU/Untitled?node-id=269-117)  | [Open](https://www.figma.com/design/WistInjosE5NSGLCAnpznU/Untitled?node-id=273-668)  |
| Job details                                   | [Open](https://www.figma.com/design/WistInjosE5NSGLCAnpznU/Untitled?node-id=270-479)  | [Open](https://www.figma.com/design/WistInjosE5NSGLCAnpznU/Untitled?node-id=274-1002) |
| Application documents                         | [Open](https://www.figma.com/design/WistInjosE5NSGLCAnpznU/Untitled?node-id=271-691)  | [Open](https://www.figma.com/design/WistInjosE5NSGLCAnpznU/Untitled?node-id=274-1100) |
| Application questions                         | [Open](https://www.figma.com/design/WistInjosE5NSGLCAnpznU/Untitled?node-id=269-203)  | [Open](https://www.figma.com/design/WistInjosE5NSGLCAnpznU/Untitled?node-id=273-690)  |
| Later final-review example                    | [Open](https://www.figma.com/design/WistInjosE5NSGLCAnpznU/Untitled?node-id=271-432)  | [Open](https://www.figma.com/design/WistInjosE5NSGLCAnpznU/Untitled?node-id=274-1026) |
| My applications                               | [Open](https://www.figma.com/design/WistInjosE5NSGLCAnpznU/Untitled?node-id=270-205)  | [Open](https://www.figma.com/design/WistInjosE5NSGLCAnpznU/Untitled?node-id=273-715)  |
| My profile                                    | [Open](https://www.figma.com/design/WistInjosE5NSGLCAnpznU/Untitled?node-id=270-299)  | [Open](https://www.figma.com/design/WistInjosE5NSGLCAnpznU/Untitled?node-id=273-740)  |
| Messages                                      | [Open](https://www.figma.com/design/WistInjosE5NSGLCAnpznU/Untitled?node-id=271-517)  | [Open](https://www.figma.com/design/WistInjosE5NSGLCAnpznU/Untitled?node-id=274-1049) |
| Interviews                                    | [Open](https://www.figma.com/design/WistInjosE5NSGLCAnpznU/Untitled?node-id=271-608)  | [Open](https://www.figma.com/design/WistInjosE5NSGLCAnpznU/Untitled?node-id=274-1075) |
| Settings                                      | [Open](https://www.figma.com/design/WistInjosE5NSGLCAnpznU/Untitled?node-id=270-390)  | [Open](https://www.figma.com/design/WistInjosE5NSGLCAnpznU/Untitled?node-id=273-763)  |
| Getting started, including no CV/work history | [Open](https://www.figma.com/design/WistInjosE5NSGLCAnpznU/Untitled?node-id=278-1276) | [Open](https://www.figma.com/design/WistInjosE5NSGLCAnpznU/Untitled?node-id=278-1363) |

Navigation links connect the major review journey and remain within the chosen theme. The prototype is a navigation/layout proposal, not a functional replacement for editors, generation, OAuth, downloads or submission. Not every secondary control is interactive. Unanswered questions keep save/approve and final-review continuation disabled. The review guide opens a separate later resolved final-review example for inspection; no click silently resolves other blockers. All example people/companies/records are synthetic.

Machine-readable IDs and structural checks: [student-ux-figma.json](student-ux-figma.json).

## Planned feature homes before structural development

These are proposed destinations, not claims that the new structure is already implemented or fully represented by the prototype. The current eight-destination application keeps every existing feature accessible until reconciliation and review are complete. The [existing 25-component / 18-group inventory](UI_MIGRATION_MAP.md) remains the exhaustive behavior checklist.

| Existing capability                                                         | Proposed reachable home                                                                    | Preservation contract                                                                                                                                                           |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard, progress, notifications                                          | Home; notification utility; Settings / System activity                                     | Retain record-specific destinations, unread controls and refresh behavior.                                                                                                      |
| Job discovery, search, import, add/edit/archive, match details, feedback    | Find jobs; job detail; More filters/tools                                                  | Distinguish feedback from recording an application; retain stale/eligibility warnings.                                                                                          |
| CRM, Board/List, analytics, manual recording and status correction          | My applications / All; More tools; application detail                                      | All 17 lifecycle states, reasons, archive/restore and recorded submission provenance remain.                                                                                    |
| Prepared materials, Studio CV/letter/questions, version history and editors | Selected application / Documents and Questions                                             | Preserve current package IDs, generation, edit, regeneration and independent readiness blockers. Keep an accessible materials index for orphan/untracked packages until linked. |
| Approvals, policy overrides, browser run/history/authorization              | My applications / Needs review; selected application review; named advanced apply controls | Each decision remains explicit; one approval/override cannot clear other blockers. Eight browser-run statuses and uncertain-submission resolution remain visible.               |
| Interview scheduling/preparation/debrief/calendar                           | My applications / Interviews; selected interview                                           | Stable view even when empty; retain scheduling, confirmation, conflict and calendar controls.                                                                                   |
| Messages, classification/link/status review, sync/accounts                  | My applications / Messages; Needs review; Settings / Connected accounts                    | Default to messages; retain review/dismiss decisions and integration errors.                                                                                                    |
| Profile editors, Career Intelligence, verification and AI permission        | My profile; directly editable sections; Suggestions; Manage saved details                  | Preserve all record types, source evidence and separate verification/permission actions.                                                                                        |
| Documents, inline preview, Smart Import and comparison/editors              | My profile / CV & Documents; Add CV                                                        | Separate storage from extraction; retain basic parser, external-processing choice, acceptance, conflicts and original download.                                                 |
| Saved answers and preferences                                               | My profile / Saved answers and Job preferences; contextual answer entry                    | Retain filters/edit/delete, consequential questions, all policy settings and unresolved unknowns.                                                                               |
| Configuration, providers, diagnostics, activity                             | Settings / account basics; Advanced settings; System activity                              | Reuse existing authorization. Do not hide failures or change who can access settings as part of a visual regrouping.                                                            |
| Authentication, invitations, account and dialogs                            | Shell/account utilities and their existing authorized flows                                | Preserve guest/session/pilot/admin boundaries and invitation deep links.                                                                                                        |

Before moving these views, add restoration/focus tests for selected records, drafts, cancellation, notification targets and back navigation. Do not introduce a router or new authorization model incidentally.

## Local preview and verification

Preview: **http://127.0.0.1:5183**. Synthetic account: `alex.morgan@example.test` / `JobeePreview123!`. The preview uses disposable loopback PostgreSQL, disabled external AI, no worker and no production credentials. The authenticated live-account audit informed the findings; production records are not test fixtures.

Use the existing guarded browser harness with `UI_TEST_WEB_PORT=5183 JOBEE_UI_PREVIEW_FIXTURES=local-only npm run test:ui`. The optional port only isolates local previews; the default remains 5179. Ensure reused API/web servers belong to the isolated test environment. See [UI_MIGRATION.md](UI_MIGRATION.md) for setup.

Verification evidence for this checkpoint:

- Full unit/integration suite: 600 tests across 66 files, including five state-driven Home tests and status/default-view regressions.
- Browser suite: 26 checks, including PDFs/DOCX/TXT, denied access, selection recovery, Studio, independent blockers, all lifecycle/run states, authentication, grouped views, new defaults and remembered Board selection.
- Both macOS Home visual references were intentionally updated and reviewed. The comparison threshold is unchanged. Linux references still represent the previous Home and must be regenerated/reviewed in Linux CI before a merge/release; do not copy macOS images over them or claim cloud CI is green.
- All 184 baseline API calls/payloads across 25 components reconcile. Source changes stay in frontend presentation and local test configuration.
- Figma structural checks found no visible content outside any of the 24 desktop frames, no UI image fills and only Google Sans Flex. Render review covers composition and both themes; it is not a measured accessibility certification or proof of human usability.
- Required format, lint, typecheck, tests, build and isolated database checks are recorded in the task log. Lint retains the baseline 701 warnings and has zero errors.

No real application submission, outbound email, calendar mutation, paid AI call, production database change, push or deployment was performed for this continuation.

## Next acceptance boundary

Use [the student review protocol](STUDENT_UX_REVIEW.md) with 5–8 target students and comparable baseline tasks. Record observed results; none have been collected yet. Resolve prototype gaps and agree the final feature-access mapping before implementing the four-destination navigation and combined application workspace. This follows the approved plan's test-before-structural-development sequence.
