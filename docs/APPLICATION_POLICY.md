# Jobee 2.0 — Application Authorization Policy

Implemented in JOB-P1-T02: routine library reuse requires verified exact-question AUTO answers without sensitivity or unevaluated scope conditions. Material answer edits clear verification unless explicitly reconfirmed. Sensitive/scoped/REVIEW answers retain question-bound human approval, and MANUAL/conflicting answers request input. Before issuing or using submission permission, validate used source ownership, verification, prompt/content and update time; unrelated library edits do not invalidate other packages.

Updated 2026-10-20. Target contract; implementation differences are recorded below. Never invent candidate facts. AI recommends and prepares; deterministic rules authorize; humans resolve material uncertainty.

## Grounded eligibility (JOB-P2-T02)

All discovery/manual/daily/worker matching paths use the shared backend engine. Explicit work modes stay binding even when relocation is allowed. Country authorization comes from the candidate’s explicit country list; residence, remote work and no sponsorship do not imply global work rights or citizenship/clearance. Missing jurisdiction or material eligibility requires review, and AI cannot resolve sensitive requirements by guessing. Internship eligibility distinguishes false from unknown. Salary gates require explicitly supplied matching currencies and pay periods; old unitless values remain unknown. Low professional relevance, explicit policy blockers and missing information have separate explanations. A current MATCH is a recommendation, never submission consent. Stale results lose preliminary eligibility, and future execution must still satisfy the existing signed authorization boundary.

## Product authorization

Apply with Jobee authorizes an attempt for one selected job under explicitly accepted terms and application rules. It should prepare and execute without a mandatory package-review screen when verified facts, approved reusable answers and provider capability suffice. Material unknowns, sensitive answers needing consent, legal/background declarations and challenges pause for minimal user input.

Autopilot is off by default and requires explicit opt-in to a versioned or snapshotted policy: roles, locations, work modes, employment types, eligibility/work authorization, salary where applicable, exclusions, volume/schedule limits and review conditions. Match score alone never authorizes. Pause/disable must prevent new dispatches and revoke pending permission at the last safe pre-submit boundary. Already dispatched submissions require evidence reconciliation, not fictional cancellation.

Existing policy flags must not silently grant expanded 2.0 powers. Snapshot effective policy and candidate/package context per attempt; recheck revocation, eligibility, freshness, duplicates, quotas and material changes immediately before dispatch. Use atomic quota reservations/concurrency guards. Reauthorize material changes; do not invalidate unrelated applications unnecessarily.

## Existing safeguards to preserve

SubmissionAuthorizationService builds and verifies a package/artifact/answer/input-bound cryptographic manifest. BrowserWorkerService accepts TOKEN or existing POLICY authorization, checks supported providers, stale listings, duplicate/past submissions and package readiness. Worker revalidation and submission observations protect dispatch and outcomes. Current selected batches prepare, request review tickets, then submit; this does not yet implement the target one-click intent contract.

Implement durable job-scoped consent before asynchronous preparation, then bind the execution manifest after preparation and check the consent scope again before submit. Do not issue blanket tickets or remove readiness/verification checks to achieve a one-button UI. Existing answer tiers AUTO/REVIEW/MANUAL and verification/provenance continue to govern reuse. Broader policy coverage and snapshots remain gaps to close, not guarantees of the existing autoApplyEnabled flag.

## Truthful state and recovery

Persist application identity, attempt/run identity, authorized context and events. Keep execution status distinct from employer pipeline status. DRY_RUN/PREFILL_ONLY success is not APPLIED. Record confirmed submission only from acceptable employer evidence. Preserve SUBMISSION_UNCERTAIN as the existing representation of UNKNOWN_RESULT; no blind retry, automatic success or duplicate resubmission. Never infer employer review from elapsed time.

Unsupported forms, CAPTCHA, identity challenges and unresolved required questions produce clear intervention/manual handoff. Resume only after checking the current policy, answers, job and submission history. Keep retries bounded; preserve failure/uncertainty evidence and prior attempts. Cancellation must respect safe checkpoints.

## Engineering boundary

This target product policy is not approval for Codex to submit real applications, send emails, accept invites, grant consent, incur costs or modify production. Automated tests use local fixtures; controlled live validation requires explicit owner approval. Phase-by-phase local implementation was approved on 2026-10-20; live side effects remain separately gated.
