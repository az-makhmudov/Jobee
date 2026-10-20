# Jobee 2.0 — Durable Engineering State

Updated: 2026-10-20. Engineering owner: Codex. Branch: codex/jobee-2-foundation.

## Current authorization and next action

The owner approved the assessment and requested phase-by-phase implementation on 2026-10-20. JOB-P0-T01 foundation reconciliation, JOB-P1-T01 platform adaptation and JOB-P1-T02 candidate context are **COMPLETED locally**. Phase 1 is verified; no release is claimed.

**Next canonical task: JOB-P2-T01 — Explore/discovery adaptation**, followed by JOB-P2-T02 grounded matching convergence. Those tasks have substantial historical implementations and remain PARTIAL against 2.0 acceptance. Continue from their actual code/deltas; do not restart completed subsystems. No further owner approval is needed for routine local roadmap work. Real applications, outbound communication/calendar actions, paid services and production operations require separate explicit authorization.

## Verified functionality

- Explore opens by default; three primary destinations: Explore, Applications and Profile. Profile contains candidate editors/documents/answers/preferences and account/connections/activity. Legacy callbacks and notification targets retain record access. Session gating, per-user dialogs, mobile focus and /api local proxy are verified.
- Existing candidate imports, verification/provenance, documents and professional editors remain. Missing authorization-country, internship-eligibility and availability preferences now persist through the normal validated API; partial updates and unknowns are preserved.
- Saved Answers has explicit verification; material edits clear it unless reconfirmed. Automatic reuse requires a verified, matching routine AUTO answer. Unverified, unrelated, conflicting, manual, sensitive and scoped cases cannot silently receive automatic permission. Submission authorization rechecks used source verification, question/content, update time and required bound human approval; unrelated source edits do not globally stale packages.
- No new dependency, schema migration, identity change, data deletion or AI provider was introduced. Existing real records/IDs and external integration encryption remain preserved.

## Verification

Final code gates: format:write, lint, typecheck, test, build, format, db:check and db:migrate PASS. Lint: 0 errors, 693 existing warnings. **653 tests / 73 files pass. 35 Chromium scenarios pass**, with four additional affected-flow/render checks after the preferences layout adjustment and a final mobile drawer-inert/persistence check. Desktop Light/Dark and mobile renders were inspected. Final text-only wording cleanup does not change behavior.

Test configuration: explicit localhost/jobee_test_isolated as DATABASE_URL and TEST_DATABASE_URL, VITE_API_URL=/api. Browser fixtures use a separate localhost/jobee2_ui_test_isolated database, disabled AI and local storage. Compile/build packages before browser runs to avoid watched-package server restarts. No development/production migration or real employer action was performed. Existing migration 0022 had already been applied to the isolated test target during assessment; no new migration was authored.

## Git checkpoints and records

- Audit baseline: main at f4ac34bdc3f816dce9031420a7e31f6baf9baf85. Historically released runtime: f6d6286c9f12a561609ce1950bd33d26c4f603d0; production was not revalidated.
- Verified JOB-P1-T01 checkpoint: 098f816. Includes approved canonical reconciliation and the three-section shell.
- JOB-P1-T02 verified source checkpoint: c2a388b5d20f9209c16baff7b8524ad828ba7613. Documentation-only checkpoint records follow without changing runtime code. No push, merge or deployment.
- Reports: JOBEE_2_IMPLEMENTATION.md and TASK_LOG.md. Audit evidence: JOBEE_2_ASSESSMENT.md. Historical docs and original owner references remain in archive/jobee-1.0 and specifications/jobee-2.0.

## Remaining product gaps

Explore still needs the revised discovery/detail experience. Matching must consistently consume verified candidate context and distinguish relevance, blockers and unknowns across execution paths. One shared durable application-intent/consent pipeline, automatic routine preparation, end-to-end provider acceptance, safe interruption/resume and versioned Autopilot policy remain later work. Existing reviewed submissions remain protected; neither full One-click Apply nor Autopilot is claimed complete. Complex saved-answer conditions still require human review rather than a new rules language. Public-launch privacy/retention review, live ATS validation and production release remain separately scoped.
