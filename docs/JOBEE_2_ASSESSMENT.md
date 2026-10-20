> Assessment approved on 2026-10-20: the owner instructed Codex to start phase-by-phase implementation. This report preserves the pre-implementation findings and original review request; current progress is in AUTONOMOUS_STATE.md and ROADMAP.md.

# Jobee 2.0 — Repository Assessment and Gap Analysis

Date: 2026-10-20. Engineering owner: Codex. Canonical task: **JOB-P0-T01**. Status: assessment/documentation delivered for review; implementation awaiting owner approval. No application source or schema changes were made.

## Executive finding

Jobee has a substantial implemented 1.x platform. Reuse it. The main 2.0 work is connecting existing intelligence, preparation and browser execution into one durable, explicitly authorized workflow, then running Autopilot through that same workflow. Simplifying the UI alone will not deliver One-click Apply, and the historical existence of an AUTO_APPLY stage does not prove autonomous application quality.

The repository is not empty, and historical tasks should not be erased or fabricated as new work. None of the complete revised One-click/Autopilot journeys has been freshly demonstrated against an employer provider in this assessment. Old “all milestones complete” labels establish historical engineering delivery only.

## Scope and evidence method

Inspected Git status, chronological macro-task history and recent releases; root instructions/package scripts; canonical product/architecture/data/policy/security/operating docs; the three owner reference files; frontend navigation and contextual views; candidate import/verification and AI contracts; discovery, matching, package/batch services and submission authorization; Drizzle schemas and migration journal; worker/orchestrator/browser execution and provider adapters; associated tests, CI and verification scripts. Health/typecheck/test/lint/build commands were run. This is a repository-level architectural audit, not a claim of line-by-line review of every file or a new production/security certification.

Reference copies: specifications/jobee-2.0. Prior canonical documents: archive/jobee-1.0. Attached documents define desired behavior; they do not override the explicit request to stop before implementation or authorize live side effects.

## Git and delivery provenance

- Audited branch: main, HEAD `f4ac34bdc3f816dce9031420a7e31f6baf9baf85`.
- At entry, the only working-tree edit was AGENTS.md: two role bullets already assigned primary engineering to Codex and reduced Antigravity's role. Its intent was retained and superseded by the owner's new all-engineering Codex assignment; no unrelated changes were discarded.
- History contains platform/Candidate Brain `e4e4815`, ingestion `b7e7e80`, matching `432cfa0`, preparation `024c742`, CRM `6941d1f`, email `6591f44`, calendar `2de982d`, worker `d9006e7`, orchestration `9a1c56b`.
- Later commits added truthfulness remediation, manifest-bound submission, Better Auth/tenant isolation, provider switching, storage/deployment, candidate import/intelligence and contextual UI. Latest runtime release `f6d6286` adds source-aware discovery, persistent batches, controlled selected submissions, evidence and daily assistance. HEAD is a later release-record documentation commit.
- Historical release docs report production verification and 634 passing tests. Those claims are preserved as historical evidence, distinct from this run's checks. No remote deployment, provider-account state or live ATS completion was revalidated.
- This assessment is intentionally uncommitted pending review; no merge, push or deployment is part of this run. Git does not have a new verified implementation checkpoint.

## Built / reuse / modify / retire matrix

| Area                | Existing evidence                                                                                                                                             | Reuse                                                                                                                                       | Required 2.0 changes                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Platform/security   | apps/api/src/app.ts, shared/config/database packages, Better Auth and multi-tenant tests                                                                      | Existing stack, errors/validation, auth, storage and isolation                                                                              | Three-section shell; verify compatibility rather than replacing platform                                                                        |
| Candidate Brain     | candidate-service.ts, import/smart-profile-import-service.ts, candidate-facts.ts, answer-library.ts, Profile/Document/Answer views                            | Verified facts, provenance, guarded imports, document versions and answer tiers                                                             | Unified Profile; routine reusable context; progressive onboarding; clear country-specific eligibility and missing-information handling          |
| Discovery           | job-discovery-service.ts, job-search-settings-service.ts, job-service.ts, job-normalizer-service.ts, http-retrieval-service.ts                                | Manual URL/text import, Arbeitnow/Greenhouse/Lever public discovery, settings/cursors/leases, source snapshots, deduplication and freshness | Explore list/detail composition and essential filters; relevance/source-coverage benchmarks; source errors remain visible                       |
| AI fit/policy       | match-service.ts, matching-context-builder.ts, hard-policy-engine.ts, matching-scoring-engine.ts, candidate-evidence-resolver.ts, ai/dynamic-ai-provider.ts   | Grounded structured AI results, hard exclusions, missing-information reporting and cached/fingerprinted analyses                            | Make every application/scheduled path use these results; do not label exclusion-only checks as semantic matching                                |
| Materials/questions | application-package-service.ts, cv-base-selector.ts, tailoring-engine.ts, cover-letter-engine.ts, application-question-engine.ts, package-readiness-engine.ts | Truthful generation, reusable answers, readiness, artifacts, approvals and versions                                                         | Prepare internally from one application intent; pause only for material uncertainty; safe resume and changed-context revalidation               |
| Durable preparation | preparation-batch-service.ts; preparation_batches/items with active-job uniqueness and fingerprints                                                           | Claims/retry/cancellation, selected-CV intent, partial results, duplicate dispatch protection                                               | End-to-end identity/consent across generation and dispatch; remove mandatory separate review-ticket/submit journey for routine authorized cases |
| Submission          | packages/database/src/submission, worker engine, Playwright controller, Greenhouse/Lever/Ashby adapters                                                       | Real browser abstraction, form mapping/upload, manifest revalidation, observation/evidence and challenge stops                              | Prove one provider end to end; question interpretation where deterministic mapping is insufficient; verify variant coverage and resume behavior |
| Tracking            | applications schema, application-state-machine.ts, application-crm-service.ts, ApplicationWorkspaceView                                                       | Unique user/job records, manual tracking, frozen submitted artifacts, event history, notes/contacts and interviews                          | Clear independent execution/employer states, attention/resume actions and concise metrics                                                       |
| Scheduling          | worker.ts, AutonomousOrchestrator, DailySearchService, notification services                                                                                  | Persistent runs, background polling, recovery, daily leases and notifications                                                               | Consolidate duplicate paths; snapshot policy/consent, shared engine, atomic limits, pause/revoke controls and recovery                          |
| Email/calendar      | Gmail/Google Calendar providers, token crypto, MIME/classification/linking/review, interview preparation                                                      | Retain functioning modules and fixtures                                                                                                     | Contextual Applications/Profile access; verify scoped live flows later; no new Inbox required                                                   |

Provider adapter presence is evidence of implementation, not universal or current live provider support. Public discovery support and application-form support are different capabilities. No LinkedIn automation or CAPTCHA bypass is proposed.

## Critical architectural gaps

1. **No shared end-to-end application intent.** Selected preparation and submission are separate operations. Persist job-scoped user consent and workflow identity before generation, then bind final materials/answers into the existing execution manifest. A one-button label or automatically issued blanket token is insufficient.
2. **Parallel orchestration paths have different semantics.** AutonomousOrchestrator.runMatchingStage checks excluded companies/title keywords before marking MATCHED. Its preparation stage initializes application/package records requiring later tailoring and review. DailySearchService calls fuller analysis/preparation but explicitly never submits. Reuse the stronger services behind one pipeline; retire the duplicate shortcuts only after parity is proven.
3. **Autopilot policy is incomplete as a 2.0 contract.** Existing autoApplyEnabled, score thresholds, limits and job preferences are useful pieces. They do not alone establish versioned consent covering every rule, revocation and scheduling boundary. Preserve current checks, snapshot effective policy and verify all entry points at dispatch. BrowserWorkerService already locks the user and application rows in its enqueue transaction and counts daily queued submissions. Validate that atomic behavior across concurrent manual and scheduled requests rather than assuming absence or correctness.
4. **Attempts and employer lifecycle need a coherent projection.** Applications and browser runs are already separate records, but application lifecycle values include preparation/execution stages and preparation records are separate again. Map existing states without destructive rewriting; decide whether extending current records suffices before adding an ApplicationAttempt table. Keep SUBMISSION_UNCERTAIN as UNKNOWN_RESULT and never retry blindly.
5. **Supported execution needs acceptance evidence.** Adapters use concrete form extraction/mapping and employer observations, but cannot promise all versions/custom questions. First prove a narrow provider/form capability with safe fixtures and owner-approved live validation. Unfamiliar required questions need grounded resolution or intervention, never arbitrary filling.
6. **UI still exposes too many primary destinations/steps.** navigation.ts declares Home, Find jobs, My applications, My profile and Settings. Older “four destinations” prose is stale. App.tsx defaults to dashboard and retains nested packages, preparation/review tools and settings. Target: Explore default, Applications, Profile; bring useful settings and activity into context and preserve legacy record/notification targets.
7. **Verification baseline needs accurate handling.** Historical green records are not current test results. The first fresh run was sandbox-blocked; a subsequent run revealed stale isolated schema/configuration and one environment-dependent frontend assertion, all resolved by using the existing migration and explicit test configuration without source changes. See verification below. Do not change implementation or declare 2.0 acceptance to hide baseline failures.

## Simplification and preservation decisions

Keep React/TypeScript/Vite, Fastify, PostgreSQL/Drizzle, R2-compatible storage, dynamic AI providers and isolated Playwright process. No framework rewrite, new broker, agent fleet, blanket schema renaming or universal integration layer is warranted. Preserve Better Auth/tenant isolation even though adding SaaS administration is a non-goal.

Retire Home/Settings as primary navigation, standalone studio/package navigation and duplicated orchestration shortcuts incrementally. Retain useful components behind context, internal package/versioning capabilities, existing email/calendar functionality, deep links and all historical records. Do not delete screens/services until dependent behavior has an equivalent tested home. Advanced analytics and agent administration should not block the revised MVP.

No candidate facts were inferred or reclassified. No production or development data migration was run. Existing migration 0022 was applied only to the isolated local test database to establish the baseline. Future migrations must be additive, retain IDs and unknown values, preserve prior consent scope and avoid destructive cleanup.

## Execution plan and acceptance

The complete eleven-task status matrix is in ROADMAP.md. Execution order:

`JOB-P0-T01 → JOB-P1-T01 → JOB-P1-T02 → JOB-P2-T01 → JOB-P2-T02 → JOB-P3-T01 → JOB-P5-T01 → JOB-P3-T02 → JOB-P5-T02 → JOB-P4-T01 → JOB-P4-T02`.

This is delta work: verify and close gaps in existing implementations. Communications/calendar expansion is deferred while existing functionality remains usable. Minimal tracking, audit, intent and attempt persistence needed for one-click execution ships with preparation/execution, ahead of the full CRM experience.

- **Release A:** three-section foundation, verified profile/context, real discovery/import and explainable fit.
- **Release B:** one-click preparation/submission/verification through at least one provider; this is the revised MVP.
- **Release C:** explicit-policy Autopilot using the proven same engine.
- **Release D:** connected employer correspondence and interviews.

Release B tests must cover successful verified submission, missing information/resume, unsupported provider/manual handoff, CAPTCHA, execution failure, ambiguous post-submit outcome, duplicate vacancy/concurrent click, changed inputs/expired permission, process crash and safe cancellation. Release C adds opt-in/off defaults, exclusion/eligibility rules, atomic volume limits, scheduling, policy changes/revocation, pause/resume/disable, recovery and actionable notifications. Use deterministic fixtures; live submissions require separate owner approval.

## Recommended first implementation task

**JOB-P1-T01 — Three-section platform adaptation**, after owner approval of JOB-P0-T01 findings. Deliver the entire responsive shell migration using existing components: Explore as default, Applications for tracking and attention, Profile for candidate data, documents, answers, preferences, connections and automation controls. Preserve legacy navigation/notification links, current working reviewed submissions, authentication, data access boundaries and both themes. Verify primary navigation, mobile keyboard/focus behavior, regression tests and existing application/profile functionality. No data migration or infrastructure addition is expected.

Use the explicit isolated-database and `/api` test configuration recorded below for reproducible verification; the final baseline suite passes without code changes. Then close profile/discovery/matching deltas and implement the main engine under JOB-P3-T01 followed by JOB-P5-T01; do not expand ancillary product surfaces first.

## Documentation alignment

Updated MASTER_CONTEXT and both identical root mirrors, ARCHITECTURE, ROADMAP, DATA_MODEL, SECURITY, APPLICATION_POLICY, AGENT_POLICY, completion directive, operating plan, durable state, backlog, owner actions, README and AGENTS. Added ADR 0008, preserved source specifications and previous canonical docs, and marked old UX/evolution/acceptance plans as historical. TASK_LOG remains append-only. Conflicting claims of perpetual autonomous continuation, Antigravity ownership, mandatory studio review and all-roadmap 2.0 completion no longer govern new work.

## Verification and limitations

| Gate                    | Fresh result                                   | Evidence / interpretation                                                                                                                     |
| ----------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| npm run lint            | PASS                                           | 0 errors; 693 existing warnings                                                                                                               |
| npm run typecheck       | PASS                                           | All workspace packages/apps                                                                                                                   |
| npm run test            | PASS with explicit isolated test configuration | 72 files, 634 tests passed; no skips in final run                                                                                             |
| npm run build           | PASS                                           | All packages, API, worker and web                                                                                                             |
| npm run db:check        | PASS outside restricted sandbox                | Development connectivity checked read-only; isolated test database also connected                                                             |
| npm run db:migrate      | PASS on isolated local test target only        | Applied existing migration 0022; initial isolated journal had 22 entries; no new migration authored                                           |
| Formatting              | PASS                                           | Scoped changed-doc formatting and npm run format; final format:write/check recorded in TASK_LOG.md                                            |
| Documentation integrity | PASS                                           | Root mirrors equal canonical master; reference copies and archived docs match their source content; Markdown links and Git whitespace checked |

Initial sandbox run: 449 passed, 50 failed and 135 skipped because local sockets were denied (EPERM). Retrying outside the sandbox exposed an isolated test schema missing 0022 and tests needing an explicit TEST_DATABASE_URL. Applying existing migrations only to localhost/jobee_test_isolated and setting both DATABASE_URL and TEST_DATABASE_URL to that target produced 633 passes and one document-preview assertion failure. The local VITE_API_URL supplied http://localhost:3000 while the test expected /api. Setting VITE_API_URL=/api for the test process produced **634/634 passing**. No credentials or environment files were changed. No source fix is indicated by this final baseline.

Browser E2E, live discovery benchmarks, production readiness and live employer submissions were not re-executed. Existing fixture/unit/integration coverage is strong evidence for reuse, but does not certify the revised journeys. No new feature tests were added for a documentation-only change. No real applications, outbound communications, calendar updates, paid services or production operations were performed.

## Approval requested

Approve the reconciled plan and **JOB-P1-T01** as the first implementation task. This approval would authorize local implementation and verification within that task; it would not authorize production deployment, paid operations or live employer submissions. Codex will wait before starting implementation.
