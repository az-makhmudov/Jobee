# Jobee — Application & Submission Policy Framework

## 1. Purpose & Scope

This document specifies the rule-engine framework for job filtering, candidate representation, and application dispatching.

**CRITICAL INVARIANT**:

> **AI evaluates and prepares. Rules authorize. Humans handle uncertainty. Everything is auditable.**

The system never assumes candidate qualifications, citizenship, visa status, compensation requirements, or application answers. All criteria are explicitly configured by the candidate in the **Candidate Brain** (`JOB-P1-T02`) and stored in PostgreSQL.

---

## 2. Policy Evaluation Dimensions (Operationalized in `JOB-P1-T02`)

### A. Legal & Work Authorization Policy (`job_preferences.needs_sponsorship`, `candidate_facts`)

- **Sponsorship Status**: Explicitly declared by candidate (`needs_sponsorship: true | false | null`).
- **Disqualification Rule**: If a posting explicitly requires citizenship or non-sponsorship that conflicts with candidate facts, immediately disqualify without scoring.
- **Sensitive Guard**: Legal authorization questions are classified under `WORK_AUTHORIZATION` and require explicit candidate verification before submission.

### B. Compensation & Seniority Policy (`job_preferences.min_salary`, `currency`, `seniority_levels`)

- **Minimum Base Salary & Currency**: Enforced via relational `min_salary` and `currency` attributes in `job_preferences`.
- **Target Role Seniority**: Filtered against `seniority_levels` (e.g., Senior, Lead, Staff, Principal).
- **Disqualification Rule**: Exclude roles offering below minimum acceptable compensation unless compensation is unlisted (which triggers salary question escalation).

### C. Location & Work Style Policy (`job_preferences.work_modes`, `preferred_locations`, `willing_to_relocate`)

- **Work Modes**: Multi-select options (`REMOTE`, `HYBRID`, `ONSITE`).
- **Relocation Preference**: Explicitly declared (`willing_to_relocate: true | false | null`).
- **Exclusions**: Blacklisted companies (`excluded_companies`) and negative keywords (`excluded_keywords`) automatically reject matching postings.

---

## 3. Automation Tiers & Answer Library Policy (`answer_library`)

When generating application responses:

1. **`AUTO` (Pre-authorized)**:
   - Permitted for automatic submission ONLY if the question is an exact or unambiguous semantic match and `auto_apply_enabled` is active.
   - **Strict Sensitive Verification Rule**: Screening answers flagged `isSensitive: true` can **NEVER** be configured with `automationLevel: 'AUTO'` unless their `verificationStatus` is explicitly `VERIFIED`. Unverified sensitive answers attempting `AUTO` mode are rejected at both API and service layers.
2. **`REVIEW` (Pre-fill with Human Confirmation)**:
   - System pre-fills the candidate's canonical answer in the application studio draft, but requires human approval before dispatch.
3. **`MANUAL` (Candidate Prompt)**:
   - The system never submits or guesses; it alerts the candidate to input their response directly.

---

## 4. Application Safety Interlocks (`application_policy`)

The `application_policy` table enforces runtime boundaries:

| Parameter                    | Default | Purpose                                                      |
| :--------------------------- | :------ | :----------------------------------------------------------- |
| `auto_apply_enabled`         | `false` | Master circuit-breaker. Disabled by default.                 |
| `min_score_for_review`       | `70`    | Threshold to queue a discovered job for human consideration. |
| `auto_apply_min_score`       | `85`    | Required threshold to qualify for autonomous submission.     |
| `max_applications_per_day`   | `10`    | Rate limiter protecting against application spam.            |
| `block_on_unresolved_review` | `true`  | Halts auto-apply if any screening question is unconfirmed.   |
| `block_on_manual`            | `true`  | Halts auto-apply if any question requires manual input.      |
| `block_on_unknown_sensitive` | `true`  | Halts auto-apply if sensitive personal facts are unknown.    |

---

## 5. Audit Logging Policy (`candidate_audit_events`)

Every write operation (creation, update, deletion) on Candidate Brain profiles, experiences, education, projects, skills, documents, facts, answers, preferences, and policies generates an immutable, privacy-minimized audit record containing:

- Action (`CREATE`, `UPDATE`, `DELETE`)
- Entity Type & Entity ID
- Timestamp (UTC)
- Changed field names (`changed_fields`)
- Safe non-PII operational context (`metadata`)

To prevent accidental accumulation or leakage of historical sensitive data (such as phone numbers, personal addresses, salary expectations, or legal declarations), full state diff snapshots are strictly excluded from audit persistence.

---

## 6. Application CRM Lifecycle, Transitions & Submission Provenance (`JOB-P3-T02`)

The Application CRM enforces strict deterministic lifecycle progression, terminal protection, and submission provenance:

### A. Exact 17 Canonical Lifecycle States & Deterministic Transitions

1. **Discovery & Intelligence**:
   - `DISCOVERED`: Discovered opportunity queued for consideration or analysis.
   - `ANALYZED`: Role parsed, structured, and requirement-analyzed.
   - `MATCHED`: Candidate profile and preferences match the position.
   - `SKIPPED`: Candidate or hard policy decided not to pursue (non-terminal, can be reopened).

2. **Preparation & Readiness**:
   - `READY_TO_APPLY`: Application materials generated, questions resolved, and fully ready.
   - `NEEDS_REVIEW`: Application package has unresolved questions or pending human approvals.

3. **Submission Execution**:
   - `APPLYING`: Human or assistant currently submitting application materials.
   - `APPLIED`: Application submitted to employer.
   - `CONFIRMATION_RECEIVED`: Formal acknowledgement of application receipt from employer.

4. **Active Pipeline**:
   - `SCREENING`: Recruiter phone screen or initial review in progress.
   - `ASSESSMENT`: Take-home project, coding challenge, or test in progress.
   - `INTERVIEW`: Technical or team interview round underway.
   - `FINAL_INTERVIEW`: Executive, hiring manager, or final decision loop underway.
   - `OFFER`: Formal job offer received.

5. **Terminal States**:
   - `REJECTED`: Employer declined the candidacy.
   - `WITHDRAWN`: Candidate voluntarily withdrew application.
   - `EXPIRED`: Posting closed, cancelled, or ghosted past reasonable response window.

6. **Soft Archiving Protection**:
   - Deleting applications from active board views sets `is_archived: true` and `archived_at: timestamp`.
   - All historical lifecycle events, notes, recruiter contacts, and frozen submission provenance remain intact.
   - Restoring via unarchive re-enables active pipeline tracking. Deliberate GDPR erasure uses explicit hard purge.

7. **Realistic Stage Skipping**:
   - The state machine permits realistic stage skipping (e.g. `APPLIED` → `INTERVIEW` when screening is bypassed) without requiring artificial intermediate transitions.

### B. Submission Provenance Invariant

- Transitioning to `APPLIED` requires capturing the submission timestamp (`applied_at`).
- When submitted via Application Studio, the exact package version and artifact IDs (`submitted_package_version_id`, `submitted_cv_artifact_id`, `submitted_cover_letter_artifact_id`) are permanently frozen onto the application record.
- Historical submissions remain immutable reference points even if subsequent package versions are regenerated.
- Manual package-less submissions are permitted, leaving artifact IDs null without creating synthetic associations.

### C. Terminal State Protection & Correction Overrides

- Applications in terminal states (`REJECTED`, `WITHDRAWN`, `EXPIRED`) cannot be transitioned casually.
- Any transition out of a terminal state or backwards in the pipeline requires an explicit correction override:
  - `isCorrection: true`
  - Non-empty `correctionReason` explaining why the correction was necessary (e.g. "Recruiter reopened role after budget approval").
- Every state transition appends an immutable record to `application_lifecycle_events`.

---

## 7. Inbound Communication Intelligence & Status Synchronization Policy (`JOB-P4-T01`)

The email synchronization subsystem operates under the Prime Invariant:

> **AI evaluates and prepares. Rules authorize. Humans handle uncertainty. Everything is auditable.**
>
> _An email classifier may suggest what happened. Deterministic rules authorize whether CRM state changes automatically._

### A. Autonomy Boundaries & Confidence Thresholds

1. **`APPLICATION_CONFIRMATION` (Threshold: >= 0.90)**:
   - Authorized automatic transition: `APPLIED` -> `CONFIRMATION_RECEIVED`.
   - Captures confirmation timestamp and updates application record.
2. **`SCREENING_REQUEST` (Threshold: >= 0.90)**:
   - Authorized automatic transition: Active application status -> `SCREENING`.
   - Idempotent: Does not re-transition if application is already at or past `SCREENING`.
3. **`ASSESSMENT_INVITATION` (Threshold: >= 0.90)**:
   - Authorized automatic transition: Active application status -> `ASSESSMENT`.
   - Creates or updates assessment tracking item. Idempotent against repeat notifications.
4. **`INTERVIEW_INVITATION` & `INTERVIEW_CONFIRMATION` (Threshold: >= 0.90)**:
   - Authorized automatic transition: Active application status -> `INTERVIEW`.
   - Flags application for interview preparation and scheduling. Idempotent against repeat confirmations.
5. **`APPLICATION_REJECTION` (Conservative Rejection Guardrail: Threshold: >= 0.95 + Exact Match)**:
   - High-consequence negative transition: Active application status -> `REJECTED`.
   - **Mandatory Interlock**: Auto-rejection is authorized ONLY when confidence is >= 0.95 AND entity resolution is exact (`EXTERNAL_REF` or `COMPANY_AND_ROLE`).
   - If confidence is < 0.95 or matching was fuzzy/thread-only, the system MUST route the rejection to `email_review_items` with `riskLevel: 'HIGH'` and `suggestedAction: 'REVIEW_REJECTION'`.
   - The system must never automatically discard a candidate's active application on ambiguous or speculative evidence.
6. **`OFFER_LETTER` (High-Stakes Gate: Human Review Always Required)**:
   - Job offers carry critical legal and career implications.
   - The engine **never** auto-transitions to `OFFER` autonomously.
   - Always creates an `email_review_items` entry with `riskLevel: 'HIGH'` and `suggestedAction: 'REVIEW_OFFER'`, alerting the candidate to verify terms, compensation, and deadlines.
7. **`APPLICATION_UPDATE` & `UNKNOWN` (Safe Non-Destructive Review Routing)**:
   - Ambiguous portal updates or unknown message types route safely to `email_review_items` with `riskLevel: 'LOW'`, `proposedAction: 'NONE'`, and zero destructive CRM mutations.
8. **Token Invalidation & Reauthentication (`REAUTH_REQUIRED`)**:
   - If provider tokens are revoked or encounter `invalid_grant`, the account transitions to `REAUTH_REQUIRED`.
   - Historical normalized messages, sync runs, and CRM links are strictly preserved.

### B. Job Alert Ingestion Policy

- Job alerts and aggregator digests (e.g. LinkedIn, Otta) are parsed to extract discrete listings.
- Extracted opportunities are ingested via canonical `JobService`, running URL/company/title deduplication.
- Ingestion is purely additive to the job catalog; it never modifies candidate preferences, profile, or active applications.

### C. Human Review Queue & Escalation Rules

Any inbound message exhibiting the following conditions is quarantined into `email_review_items`:

1. Low classification confidence (< 0.85 or < 0.90 for state-mutating events).
2. Ambiguous entity resolution (multiple candidate applications for the same company, or fuzzy company-only match).
3. High-stakes outcomes (`OFFER_LETTER`, or rejection below strict threshold).
4. Unknown senders or unlinked threads.

**Resolution Outcomes**:

- `APPROVE`: Deterministic rules execute the proposed state transition through `ApplicationStateMachine`, append an audit lifecycle event, and establish a permanent thread link in `email_thread_links`.
- `DISMISS`: Marks the review item as dismissed without altering application state.
- `REJECT`: Rejects the proposed action; application state remains untouched.
