# Jobee — policies

Updated 2026-10-20. This document owns product safety and security requirements. [Architecture](ARCHITECTURE.md) describes current mechanisms; [roadmap](ROADMAP.md) identifies guarantees still being completed. A requirement is not a claim of formal certification or live provider coverage.

> **AI evaluates and prepares. Rules authorize. Humans handle uncertainty. Everything is auditable.**

## Candidate truth and permission

Never invent candidate qualifications, employers, degrees, dates, skills, citizenship, work authorization, salary expectations, metrics or answers. Do not infer a missing answer from a plausible biography. Unknown information stays unknown until the candidate provides or verifies it. Extracted suggestions are proposals, not verified truth.

Facts supplied to AI must be VERIFIED and permitted by `allowAiUse`. Verification and processing consent are independent: a document upload, an import-processing choice, acceptance of extracted suggestions and permission for later AI use are separate decisions. No downstream generator may promote an unverified fact or use a fact whose permission was withheld.

Tailored materials preserve factual employment/education history, institutions, organizations, titles, dates and certifications. Statements retain evidence provenance. Quantitative claims must be checked against verified evidence; unverified metrics require review rather than silent embellishment. User edits and regenerated versions must preserve the same truthfulness rules.

The matching provider validator maintains an allowlist of verified permitted evidence IDs. Unsupported IDs are stripped, and MET/PARTIAL judgments lacking valid evidence are demoted to UNKNOWN. A fluent narrative, high confidence or semantic similarity cannot establish citizenship, clearance, eligibility or any other candidate fact.

### Saved answers

| Tier or condition           | Reuse rule                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Routine AUTO                | Only verified exact-question matches without sensitive or unevaluated scope conditions may be reused automatically |
| REVIEW                      | Requires question-bound human approval                                                                             |
| MANUAL                      | Requests candidate entry; do not choose an answer on their behalf                                                  |
| Sensitive or scoped         | Requires verification plus the applicable question-specific approval; verification alone is insufficient           |
| Conflicting library entries | Requests input instead of silently choosing one                                                                    |

Material question/content edits clear verification unless explicitly reconfirmed. Used saved-answer sources are checked again before authorization and execution: ownership, verification, question/content, source update time and bound approval. Revocation or changes to a used source invalidate stale permission. Unrelated library edits should not invalidate other applications.

Work authorization, sponsorship and salary declarations retain human review requirements. A sensitive answer being technically valid for AUTO storage does not authorize its unrestricted reuse on arbitrary employer forms. Never generalize one reviewed legal/sensitive answer across differently worded questions.

## Eligibility and recommendations

Professional relevance, hard restrictions and material unknowns must be distinguishable. Explicit work-mode restrictions remain binding even if relocation is allowed. Country-specific work permission comes from explicit candidate information; residence, remote work or no sponsorship does not prove worldwide rights or citizenship. Unknown internship eligibility differs from an explicit false value.

Salary gates require comparable, explicit currencies and pay periods. Do not invent annual units, exchange rates, salaries or blockers from incomparable values. Existing amounts without a period remain unknown. Distinguish actual citizenship/clearance requirements from equal-opportunity boilerplate.

Shared matching across API, batches, daily search and worker must use current material inputs. Changed candidate/job/policy data invalidates old preliminary eligibility. Preserve historical analysis and its provenance. A current MATCH, score or AI recommendation is **never submission consent**.

## Current defaults and limits

Code, not older prose, determines current effective behavior. The following was checked against the policy schema/service, request schemas, configuration and submission transaction.

| Setting or path                                                       | Current implementation                                             | Implication                                                                                           |
| --------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `autoApplyEnabled`                                                    | Defaults false                                                     | Explicit candidate opt-in is necessary for the existing POLICY path                                   |
| `minScoreForReview`                                                   | Defaults 70                                                        | Review/scoring configuration, not permission                                                          |
| `autoApplyMinScore`                                                   | Defaults 90                                                        | Preliminary gate; not an employer-submission guarantee                                                |
| `maxApplicationsPerDay`                                               | Stored/service default 5; update API permits 1–100                 | Persisted preferences can differ from defaults                                                        |
| Submission queue                                                      | Effective daily limit `min(20, policy.maxApplicationsPerDay ?? 5)` | Counts UTC-day SUBMIT run creation, including pending/failed attempts, not only confirmed submissions |
| Worker orchestrator                                                   | Uses policy limit with fallback 5                                  | Scheduler metrics/checks do not replace queue transaction checks                                      |
| `RATE_LIMIT_DAILY_APPLICATIONS_DEFAULT`                               | Environment schema default 10                                      | Not the authoritative stored candidate policy or queue limit                                          |
| `blockOnUnresolvedReview`, `blockOnManual`, `blockOnUnknownSensitive` | Default true                                                       | Keep readiness and human-review interlocks                                                            |
| Browser run mode                                                      | Defaults DRY_RUN                                                   | Success in DRY_RUN/PREFILL_ONLY is not Applied                                                        |
| Batch preparation / selected submission flags                         | Default true                                                       | Workflow availability does not grant user authorization                                               |
| `ORCHESTRATOR_ENABLED`                                                | Environment default true                                           | Starts scheduling capability, not blanket submission permission                                       |
| Daily discovery/preparation                                           | Candidate opt-in; preparation budget configured separately         | Assistance does not submit or share submission quota semantics                                        |

The queue transaction locks user/application records and rejects conflicting previous PENDING, RUNNING, SUCCESS or SUBMISSION_UNCERTAIN SUBMIT runs. This provides present concurrency/duplicate protection. Revised Autopilot still needs an explicit effective-policy snapshot and end-to-end policy/dispatch/recovery proof; do not claim the existing boolean implements that whole contract.

Source references: [policy schema](../packages/database/src/schema/application-policy.ts), [candidate request validation](../apps/api/src/routes/candidate-schemas.ts), [queue service](../packages/database/src/submission/browser-worker-service.ts), [environment schema](../packages/config/src/env.ts).

## Authorization boundaries

### Current reviewed submissions

Current selected batches prepare materials, expose review and issue an independent short-lived signed authorization for each enumerated ready application. Browser submission requires a signed reviewed TOKEN, intent-bound signed proof or the existing enabled POLICY path. Raw `userConfirmed=true` is insufficient. Unsupported destinations use a manual employer-site handoff.

Preparation, preview, downloading, matching, saved-answer approval, daily discovery and authorizing another application do not grant submission permission for this application. Per-question approval resolves that question; it does not remove unrelated blockers. The signed final material manifest does not authorize arbitrary future document versions.

### One-click Apply

Current local behavior persists an owned application and intent before generation. Visible terms `jobee-apply-v1` authorize one job/destination for at most one hour; a repeated click cannot renew the permission or duplicate an attempt. Resume is a new deliberate grant using current inputs, and never bypasses required per-question consent. Material preparation uses the existing immutable artifacts and signed manifest service. The worker validates the intent and signed proof at claim and immediately before dispatch; only unchanged verified routine answer sources may expand the form manifest automatically. Unused answer-library edits do not invalidate another application.

Cancellation and final dispatch reservation share an owner lock. Before reservation, revocation blocks submission even if filling has begun. Status and cancellation remain available when rollout switches pause new preparation/submissions. After reservation, the interface reports that dispatch cannot be recalled; interruption remains uncertain until provider observation or explicit reconciliation. Failed generation is not silently retried. Fixture provider confirmation establishes local behavior only.

A deliberate Apply with Jobee action authorizes an attempt for the selected job under accepted terms and rules. Persist that intent before asynchronous preparation. After routine verified materials exist, bind the current execution manifest to the valid intent and recheck scope immediately before submission.

Do not require a mandatory package-review screen merely to represent consent when verified facts and accepted rules suffice. Equally, do not achieve a one-button UI by bypassing readiness, answer verification or cryptographic authorization. Existing reviewed and policy permissions must not silently expand into job-scoped one-click authority.

### Autopilot target

Explicit opt-in must reference a versioned or snapshotted effective policy covering roles, locations, work modes, employment types, work authorization/eligibility, salary constraints, exclusions, volume, schedule and review conditions. Scheduled and manual triggers must share the proven execution engine.

Recheck revocation, current eligibility, freshness, duplicate history, quotas, supported provider and material changes at the last safe pre-dispatch boundary. Reserve quota atomically across concurrent workers. Pause/disable prevents new dispatches; an already dispatched submission cannot be fictionally cancelled. Reauthorize material changes while avoiding invalidation by unrelated edits.

These target requirements are not all established by the present legacy orchestrator. Existing candidate flags must not confer broader powers without explicit accepted policy.

### Human intervention

Missing material information, legal/background consent, unsupported required fields, identity challenges and CAPTCHA produce a clear stop or manual handoff. Do not evade protective challenges. Request the smallest sufficient candidate action. Availability of credentials or a provider adapter does not authorize an external action.

Coding-agent permissions are separately governed by [AGENTS.md](../AGENTS.md). Product authorization must never be used as an excuse for an unapproved live test, recruiter message, calendar write, charge or production change.

## Signed manifests and dispatch

[SubmissionAuthorizationService](../packages/database/src/submission/submission-authorization-service.ts) checks application ownership, READY package state, unresolved/invalid approvals, version, artifact checksums, question answers, used library provenance and material-input fingerprint. Cryptographic HMAC-SHA256 tickets bind user, application and package context and expire after 15 minutes. Signature/expiry checks and current manifest reconstruction are required; a stale or altered ticket must fail.

The queued authorization snapshot records mode and target. SUBMIT rejects arbitrary changed target URLs, stale/unavailable listings, unsupported providers and already applied records. The worker revalidates at claim and directly before dispatch, including current POLICY opt-in. Actual artifact bytes must match recorded SHA-256 checksums; file existence or a database reference alone is insufficient.

Persist dispatch intent before clicking. Preserve run/application identities and observations. Provider coverage is runtime-form dependent even on a known hostname. Generic forms do not gain submission support merely because a submit button exists. Provider-confirmed evidence, not a click return or internal run ID, establishes success.

The current queue and manifest mechanisms must survive future workflow simplification. A global authorization flag, score threshold or reusable ticket covering unrelated jobs is unacceptable.

## Outcomes, retries and reconciliation

Keep job state, application execution and employer pipeline state separate. DRY_RUN/PREFILL_ONLY completion, prepared documents, email guesses and elapsed time do not establish employer receipt. Never invent an employer reference or a review event.

`SUBMISSION_UNCERTAIN` is the current representation of an unknown result: dispatch may have occurred but confirmation is insufficient. It must block blind retries and duplicate attempts. A timeout after clicking or an orphaned in-flight SUBMIT run cannot be relabeled definitively FAILED simply to permit retry. Worker recovery treats stale SUBMIT runs conservatively.

The current reconciliation endpoint requires ownership, explicit confirmation that the employer website was checked and a meaningful note. Reconciliation retains history; it is not a hidden retry switch. A candidate must verify the external result before declaring not sent. Resume/retry rechecks current data, authorization, job availability and previous attempts. Keep retries bounded and preserve failure/uncertainty evidence.

Confirmed submission freezes the submitted package version and CV/letter artifact references. Later regeneration must not rewrite that provenance. Manual applications can legitimately have no package/artifact link. Terminal employer outcomes require explicit correction with a reason to reopen; lifecycle changes remain append-only events.

## Authentication, tenancy and access

Require authenticated identity on private resources and enforce ownership for nested IDs, documents, artifacts, approvals, evidence, integrations, jobs and application records. Cross-tenant IDs must never expose another candidate's content. Admin operations require admin role checks. Test-only identity headers and seed fallbacks must remain restricted to test environments.

Better Auth identity and Gmail/Calendar grants are separate systems. Configure trusted origins, HTTPS production URLs and strong auth secrets; keep server credentials outside the frontend. Do not describe database row-level security or encryption of all candidate fields as implemented when service/query scoping and ordinary PostgreSQL storage are the actual mechanisms.

Public source visibility does not make candidate data public. Keep resumes, offers, messages, interview notes, screening answers, screenshots and account data behind ownership-controlled access. Avoid public object URLs and broad storage grants. Source code being public is not product registration approval.

## Tokens, OAuth and cryptography

Recruitment integration tokens are stored using authenticated AES-256-GCM envelopes. [TokenCryptoService](../apps/api/src/services/email/token-crypto-service.ts) derives a 256-bit key with SHA-256 from the configured secret, uses a random 12-byte IV and a 16-byte authentication tag, and emits `v1:<keyId>:<ivBase64url>:<tagBase64url>:<ciphertextBase64url>`. Tampered ciphertext, unsupported versions or key IDs fail closed. Legacy JSON and older v1 envelopes can be decoded as supported by code.

Minimum configuration checks are not a substitute for random secret generation. Production rejects default auth/encryption secrets and missing database configuration. Never store plaintext third-party passwords or tokens. Prefer scoped OAuth. An envelope key ID does **not** implement automatic multi-key rotation: the decryptor accepts its configured key ID/key. Replacing the key alone strands existing ciphertext; [operations](OPERATIONS.md) describes safe rotation requirements.

Gmail requests read-only mail plus user email identity scopes; it does not grant recruiter send/delete/management powers. Calendar separates AVAILABILITY (free/busy and identity) from EVENT_MANAGEMENT (adds calendar.events). Increased scopes and actual writes require deliberate authorization. Better Auth Google sign-in is identity access, not Gmail/Calendar consent.

Persistent OAuth state binds owner, provider, nonce and expiry, with HMAC integrity, a 15-minute validity window and atomic consume-once database records. Replay prevention must survive process restarts. Email sync uses account claims and expiring locks to avoid concurrent ingestion. Disconnect neutralizes integration credentials while preserving allowed historical records; purge is a separate destructive choice. No provider token, OAuth state, auth ticket or email reset URL belongs in ordinary logs.

## Documents, untrusted content and network boundaries

Uploads are limited to 10 MiB and the PDF, DOCX and plain-text allowlist. Reject executables, unexpected MIME types and traversal keys. Normalize storage paths inside the intended root and record SHA-256 integrity checksums. Programmatic DOCX output must not introduce macros or untrusted external templates.

Job retrieval permits HTTP(S) only, rejects loopback/private/link-local/metadata addresses and restricted DNS results, and validates each manual redirect. Existing arbitrary-page retrieval uses a maximum of three redirects, an 8-second timeout and a 2 MiB response cap. Do not generalize those limits to every public-provider API without checking that adapter. Sanitize normalized job HTML and links before display; strip scripts, event handlers and dangerous protocols. Successful extraction discards raw DOM payloads while retaining safe text/provenance.

Normalize inbound MIME to safe text and strip scripts/tracking content. Treat job descriptions, email and model outputs as untrusted data, never agent instructions. Browser workers require least-privilege access and process isolation; do not claim a comprehensive network sandbox solely from using a separate Node process.

## Audit, logging and retention

Record timestamped generative context/provenance, evaluations, approvals, dispatch, observations, corrections and reconciliation. Auditability does not mean storing unrestricted prompt/PII snapshots. Candidate audits use changed field names and safe metadata instead of complete before/after personal values. Package versions and lifecycle events preserve relevant provenance without dumping resumes into stdout.

The shared logger redacts sensitive key patterns and credential-bearing URLs. Redaction is defense in depth, not permission to log arbitrary free text, email content, reset links, CVs or answers. Use safe record IDs, event types and minimized metadata. Protect evidence/log access and review errors for accidental secrets.

Browser screenshot access expires after 30 days and returns private/no-store responses. A bounded pruning task selects up to 100 expired runs and deletes recognized run-prefixed objects before clearing references. This is a specific browser-evidence control, not a universal candidate-data retention policy. Verify pruning actually runs and handles storage failures; endpoint expiry alone does not delete bytes.

Normal application archiving preserves history. Hard purge and integration purge can cascade and must be intentional, scoped and verified. Candidate documents, messages, backups, audit evidence and account deletion still require a coherent retention/deletion review before public launch. Do not claim GDPR compliance from encryption, soft archive or one purge endpoint.

Inbound email can propose or deterministically synchronize CRM events only under conservative confidence/entity rules. Automatic rejection requires confidence at least **0.95** plus `EXTERNAL_REF` or `COMPANY_AND_ROLE` entity resolution; fuzzy/lower-confidence rejection goes to high-risk review. Offers and recruiter outreach always require review. Accepted transitions use the lifecycle state machine and retain actor/source. These capabilities do not authorize outbound recruiter messages.

**Policy assurance gap:** the retained security baseline requires at least **0.90** confidence for automatic confirmations, assessments and interviews. Current `EmailSyncService` uses **0.85** for those linked-event branches. Documenting actual code does not lower the required baseline or certify compliance. Reconcile that discrepancy under JOB-P4-T01 before expanded/live communications validation; this documentation task does not change runtime thresholds.

## Public repository and historical security evidence

GitHub's public metadata on 2026-10-20 reports `visibility: public` and `private: false` for `az-makhmudov/Jobee`. npm package privacy is unrelated. Keep candidate exports, database dumps, uploads, screenshots, secrets and local evidence out of tracked files. `.gitignore` cannot remove already tracked history.

Historical security work records both a candidate backup removal and later credential rotation. Stable historical evidence for the latter is Git checkpoint `cb15f9ea1e171428564f8e7e88d95a19e80edd3d`, historical task-log section `AUTHORIZED PRODUCTION SECURITY REMEDIATION: NEON CREDENTIAL ROTATION & RAILWAY SYNCHRONIZATION` (JOB-SEC-REMEDIATION-01). It records a controlled rejection with PostgreSQL code **28P01** after rotation. This is retained provenance, **not a fresh connection test or proof of complete historical erasure**. Never reconstruct or retest an old credential from Git.

The pre-consolidation documentation recorded a historical exposed object still reachable after credential rotation. Current source also contains owner-specific defaults and candidate-shaped fixtures. This task removes unnecessary personal/recovery details from core prose but does not certify the complete public history or authorize rewriting it. The owner should review remaining public personal-data references, provider-console revocation and any cached historical artifacts. Report paths/categories safely; never reproduce sensitive values. No visibility change, force push or history rewrite is authorized by documentation cleanup.
