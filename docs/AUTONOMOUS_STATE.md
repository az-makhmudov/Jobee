# Jobee 2.0 — Durable Engineering State

Updated: 2026-10-20. Engineering owner: Codex. Branch: codex/jobee-2-foundation.

## Current authorization and next action

The owner approved the assessment and requested phase-by-phase local implementation. JOB-P0-T01, JOB-P1-T01, JOB-P1-T02, JOB-P2-T01 and JOB-P2-T02 are **COMPLETED locally**. Phases 1 and 2 are verified; no release is claimed.

**Next canonical task: JOB-P3-T01 — durable One-click Apply intent and automatic preparation.** Reuse existing application/preparation/package/version services, persist scoped intent before asynchronous work, handle routine materials automatically and pause only for material unknowns. Verify idempotency, cancellation, safe resume, source revocation and tenant isolation. Then JOB-P5-T01 proves provider execution before full CRM/Autopilot convergence. Do not restart completed subsystems or invent new task stamps.

Routine local roadmap work remains authorized. Real applications, outbound communication/calendar actions, paid services, production operations and live ATS validation require separate explicit authorization. The current delivery closes Phase 2; neither full One-click Apply nor Autopilot is claimed complete.

## Verified functionality

- Three primary sections: Explore, Applications and Profile. Legacy record links, candidate imports, documents, saved answers, preferences, integrations, employer tracking and reviewed preparation/submission remain. Session gating, user isolation, mobile focus and local /api proxy are verified.
- Candidate eligibility/preferences persist without invented defaults. Reusable answers require explicit verification; material edits clear it unless reconfirmed. Sensitive/scoped/REVIEW answers retain bound human approval, and submission rechecks used source ownership, verification, prompt/content and update time.
- Explore keeps filters, submitted search, pagination and selection while detail opens beside the list on desktop or replaces it on mobile. Essential filters, fit ranking/explanations, retryable failures and honest partial-source notices use existing services. Async discovery refreshes the current query rather than a captured old filter.
- Public source refresh preserves job IDs, manual corrections and source snapshots. Migration 0023 versions extracted requirements/sections without deleting rows referenced by historical evaluations; current detail/matching/interview preparation use current extraction.
- API, batch, daily search and worker matching use the shared backend engine. The worker no longer fabricates MATCHED/SKIPPED ingestion states and prepares only fresh MATCH records. Stable material-input fingerprints, algorithm 2.0 and freshness checks invalidate stale recommendations without deleting history.
- Explicit work modes remain binding. Country authorization is not inferred from remote work, residence or no sponsorship. Material unknowns require review; confirmed blockers and low professional relevance have distinct explanations. Migration 0024 adds nullable salary pay period: comparisons require matching explicit currencies/units; no annual default or exchange rate is invented. AI receives verified permitted evidence and cannot resolve sensitive uncertainty by guessing. A MATCH is never submission consent.

## Verification and data preservation

All eight gates PASS: format:write, lint, typecheck, test, build, format, db:check, db:migrate. **672 tests / 75 files pass; 0 lint errors / 693 pre-existing warnings. 37 Chromium scenarios pass**, followed by three affected render/navigation checks after final pagination/capture polish. Cold-start source imports, desktop Light/Dark and 390px mobile rendering were verified and visually inspected. Offline source-to-analysis acceptance and point-in-time read-only public feed acceptance pass; no paid/live AI model certification is claimed.

Tests use explicit localhost/jobee_test_isolated and separate localhost/jobee2_ui_test_isolated browser fixtures, disabled AI and local storage. Build shared packages before browser runs; do not rebuild watched packages while browser servers run. Disposable users and scoped cleanup protect real records.

The known development target localhost/ai_job_agent_dev is migrated through 0024. Only reviewed additive migrations 0022–0024 were applied. Original row counts and original-column fingerprints are unchanged across all 57 pre-existing public tables; existing salary units remain null. No development test fixtures, data deletion, production migration, deployment, paid API action or real employer operation occurred. Existing encrypted integration records and document references remain intact.

## Git checkpoints and records

- Audit baseline: main at f4ac34bdc3f816dce9031420a7e31f6baf9baf85. Historical release f6d6286c9f12a561609ce1950bd33d26c4f603d0 was not re-certified in production.
- JOB-P1-T01: 098f816. JOB-P1-T02: c2a388b5d20f9209c16baff7b8524ad828ba7613.
- JOB-P2-T01: 616b990. The verified JOB-P2-T02 source checkpoint is recorded after its local commit. Documentation-only checkpoint records do not change runtime verification. No push, merge or deployment.
- Current delivery report: JOBEE_2_IMPLEMENTATION.md. Status/dependencies: ROADMAP.md. Audit: TASK_LOG.md and JOBEE_2_ASSESSMENT.md. Owner references and historical evidence remain in specifications/jobee-2.0 and archive/jobee-1.0.

## Remaining product gaps

Durable job-scoped consent before preparation, automatic routine materials, end-to-end provider execution proof, safe attempt interruption/resume and versioned Autopilot policy remain later tasks. Legacy worker discovery and draft-only preparation must converge into that proven pipeline; existing reviewed submission controls remain protected. Complex answer conditions still require human review. Public-launch privacy/retention review, owner-approved live ATS validation and production release remain separately scoped.
