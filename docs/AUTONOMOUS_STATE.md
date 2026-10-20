# Jobee 2.0 — Durable Engineering State

Updated: 2026-10-20. Engineering owner: Codex.

## Current authorization and next action

The owner approved the assessment and requested phase-by-phase implementation on 2026-10-20. **JOB-P0-T01 foundation reconciliation is COMPLETED. JOB-P1-T01 three-section platform adaptation is COMPLETED locally; JOB-P1-T02 is the next active dependency.** Continue verified local macro tasks in revised roadmap dependency order; do not require approval for routine local work. Real external applications, production/paid operations and outbound integrations remain separately gated.

Verified JOB-P1-T01: Explore default, three primary destinations, Profile-contained settings, legacy section compatibility, signed-out/session boundaries and 32 browser regression checks. Implementation branch: codex/jobee-2-foundation. No schema changes were required for the shell. Next dependency after verification: JOB-P1-T02 verified candidate context and unified Profile.

## Git checkpoint and scope

- Assessed checkout: main at f4ac34bdc3f816dce9031420a7e31f6baf9baf85.
- Latest historically released runtime code: f6d6286c9f12a561609ce1950bd33d26c4f603d0. Production verification in prior logs was not repeated.
- Current run: approved local implementation in progress; assessment docs and shell changes are uncommitted until all gates pass. Pre-existing AGENTS.md role edits were respected and updated to the owner's new Codex-only engineering assignment. Source changes are limited to the application shell, navigation, local proxy and regression checks. No schema changes, merge, push or deployment.
- Prior canonical docs, including old durable state and release details, are preserved in archive/jobee-1.0; history remains in TASK_LOG.md/Git. Owner source references are in specifications/jobee-2.0.

## Fresh baseline

Lint passes (693 existing warnings, zero errors), typecheck/build pass, final shell tests pass: **635 tests / 72 files**, plus all 32 Chromium scenarios. Initial sandbox socket errors and stale isolated-test schema/configuration were resolved without code changes. Explicit localhost/jobee_test_isolated plus TEST_DATABASE_URL and VITE_API_URL=/api were required for the final suite. Existing migration 0022 applied to that isolated target only; database checks passed. Formatting and documentation integrity checks pass; final records in TASK_LOG.md.

No active source defect was established by the final baseline. Main product gaps remain: three-section UX, shared durable application intent/consent, automatic routine preparation, consistent AI matching across schedulers, versioned full-scope Autopilot policy, safe interruption/resume, and end-to-end provider acceptance evidence. Browser/live provider and production readiness were not revalidated.

## Safety and preservation

Preserve candidate verification, documents, IDs, application/event histories, tenant isolation, encrypted tokens, manifest authorization, duplicate prevention and uncertain-result handling. No development/production migration or real external application/email/calendar action occurred. Product One-click/Autopilot design does not grant Codex operational permission for live side effects.
