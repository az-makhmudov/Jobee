# Student UX — approved application implementation

Parent milestone: **JOB-UI-MIGRATION-01**, student UX continuation, 19 October 2026.

Status: **LOCAL IMPLEMENTATION VERIFIED; RELEASE PENDING**. The owner approved the simplified design and flow, requested adaptation across the existing Figma file, and then explicitly authorized application implementation. This supersedes the earlier prototype-only boundary. No human student usability sessions have been claimed. Production release remains separate from this local implementation.

Baseline: `a98ac9f073f4d2ed5247b28faa97d13d71477500`. Prior verified source checkpoint: `04548142fe3ced25fa76b546cf112cd1c7829df8`. Verified implementation checkpoint: `3c7f82f30182f90a3210297936804603f974a2ab`. Branch: `codex/jobee-student-ux`. Main checkout and its pre-existing `AGENTS.md` edit are preserved.

## Approved design

[Approved flow guide](https://www.figma.com/design/WistInjosE5NSGLCAnpznU/Untitled?node-id=303-24509) · [Screen and state index](https://www.figma.com/design/WistInjosE5NSGLCAnpznU/Untitled?node-id=304-36). These replace the earlier 24-frame proposal as the current reference. [Machine-readable source mapping](student-ux-figma.json) contains the Light/Dark defaults and supporting frames.

## Implemented experience

- Four primary destinations: Home, Find jobs, My applications and My profile. Settings remains a bottom utility. Existing section identifiers and state navigation remain compatible with notifications and record callbacks.
- Home leads with up to three genuine next steps, two recent opportunities and a compact profile summary. Detailed progress and the application summary remain accessible. Work history and CV upload are optional for basic setup presentation; completeness scoring is unchanged.
- Find jobs leads with keyword search, discovery, adding a job link and readable opportunity rows. Policy/source/freshness filters, sorting, per-job and batch analysis, metrics and refresh remain available through named tools and disclosures.
- My applications groups All applications, Needs review, Interviews and Messages. The default tracker is a short list; a remembered Board preference, detailed table, all filters, analytics, manual recording and prepared materials remain accessible.
- A selected application has Documents, Questions, Final review and Progress & details. The linked package/application IDs stay in one mounted workspace. Editors retain unsaved drafts across its tabs. Returning from a review queue returns to that queue.
- Documents exposes current CV/letter viewing and editing, downloads, regeneration and source information. Questions retains every individual approval, rejection and policy override. Final review is unavailable until server-provided readiness passes. This presentation gate supplements the unchanged server authorization checks.
- Progress starts with recorded status, submission evidence and the next step. Notes, contacts, assessments, interviews, offers, corrections, archive/restore and the audit timeline remain in the detailed record. Browser assistance is optional; pending/running/uncertain run states and explicit submission confirmation remain distinct. A failed history lookup cannot claim that a submission succeeded.
- My profile leads with suggestions and direct access to personal details, studies/projects, documents and preferences. Skills, languages, certifications, facts, links, optional employment, saved answers and separate AI-use permissions remain reachable.
- Add document asks whether the user wants storage/inline preview or CV extraction. Choosing a path alone does not upload, extract, accept facts or grant permission. Existing basic/external parser choices, conflicts, import acceptance and verification remain unchanged.
- Settings defaults to appearance, connections and privacy entry points. Connected accounts, Advanced settings and System activity retain their existing controls and authorization. Messages and interview workspaces keep sync, review, calendar, preparation and debrief controls.
- Shared M3 semantic colors, Google Sans Flex, local Material Symbols and content-driven card heights remain. Context navigation uses the approved pill style; legacy detailed-editor tabs retain their original interaction semantics. System/Light/Dark and existing narrow-screen access remain supported.

## Feature access and preservation

| Existing capability                                                   | Current home                                                                 |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Dashboard metrics, activity, notifications                            | Home / Progress & activity; notification utility; Settings / System activity |
| Discovery, import, search, job analysis/edit/archive/feedback         | Find jobs; More filters; Analysis & source details; selected job             |
| CRM, all 17 lifecycle statuses, corrections, archive/restore          | My applications / All applications; Board/List; detailed record              |
| Analytics, manual record, orphan/untracked prepared packages          | My applications / More tools; Prepared materials                             |
| CV/letter generation, editing, downloads and sources                  | Selected application / Documents / contextual tools                          |
| Questions, independent approvals, rejection/reconfirmation, overrides | My applications / Needs review; selected application / Questions             |
| Browser runs, authorization, cancellation, uncertainty resolution     | Selected application / detailed record / Browser assistance & run history    |
| Email review/classification/status/link, original messages, accounts  | My applications / Messages; Settings / Connected accounts / Email            |
| Calendar, conflicts, interview briefs/debriefs, scheduling            | My applications / Interviews; Settings / Connected accounts / Calendar       |
| Every profile record type, Career Intelligence and AI permissions     | My profile / overview; More profile details; Review suggestions              |
| Upload/preview/download/delete, Smart Import and comparisons          | My profile / CV & Documents / Add document                                   |
| Saved answers and all preference/policy fields                        | My profile / Saved answers and Preferences                                   |
| Providers/configuration, diagnostics and activity                     | Settings / Advanced settings and System activity                             |
| Guest/pilot/admin/session/invitation behavior                         | Existing shell and account dialogs                                           |

The [25-component / 18-closure-group inventory](UI_MIGRATION_MAP.md) remains the exhaustive behavior reference. The contract audit compares all 184 existing calls/payloads against `9c1b206`. Backend endpoints, shared domain types, schemas, worker logic, scoring formulas, processing-consent defaults and authorization rules are outside this presentation change.

## Validation and preview

Local preview: **http://127.0.0.1:5183**. Use synthetic account `alex.morgan@example.test` / `JobeePreview123!`. The API uses disposable loopback PostgreSQL, disabled external AI and no worker. No production account is used for mutation tests.

Run `UI_TEST_WEB_PORT=5183 JOBEE_UI_PREVIEW_FIXTURES=local-only npm run test:ui` with isolated API/web services. Existing tests now follow the contextual navigation; added regressions cover draft retention, blocked final review, manual applications without packages, retrieval errors, explicit document intent and keyboard navigation over disabled steps.

All eight required gates pass locally: 606 tests in 67 files, typecheck, lint (701 existing warnings, zero errors), build, format and isolated database checks/migrations. All 32 Chromium checks pass, including Light/Dark Home visual comparisons at the unchanged 1% tolerance. The 42-render inventory covers 21 desktop views in both themes; targeted dialogs and document previews have additional captures. See [the implementation report](STUDENT_UX_IMPLEMENTATION_REPORT.md) and task log. The Linux Home reference refresh remains a merge/release check; macOS images must not be copied over Linux references. Human usability sessions can use [the review protocol](STUDENT_UX_REVIEW.md); there are no measured student-study results yet.

No real ATS submission, recruiter email, calendar mutation, paid AI call, production database change, merge, push or deployment is part of this local continuation.
