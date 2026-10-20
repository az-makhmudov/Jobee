# Jobee 2.0 — Security Direction and Evidence Boundary

JOB-P1-T02 strengthens saved-answer trust: material edits clear verification unless explicitly reconfirmed; automatic reuse cannot rely on unverified, category-only or substring matches. Submission authorization rechecks the used source owner, verification, content/prompt, update time and required question-specific human approval. Unrelated library edits do not invalidate other packages. Preferences remain user-scoped and unknown eligibility is preserved. No new external permission is granted.

Updated 2026-10-20 under JOB-P0-T01. Existing technical controls and incident history below are retained; historical completion, account-health and release claims are not fresh security certification. Current authorization semantics are defined in APPLICATION_POLICY.md; engineering authority is limited by AUTONOMOUS_STATE.md and the current owner request.

Preserve encrypted OAuth tokens, least-privilege integration scopes, tenant-scoped access, protected documents/evidence, SSRF protections, fact verification, manifest-bound dispatch, duplicate protection and uncertain-result recovery. Existing multi-user isolation stays even though SaaS administration is outside the revised MVP.

Before enabling revised submission behavior, verify job-scoped consent across asynchronous generation, effective policy snapshots, revocation immediately before dispatch, atomic quotas, concurrent workers, candidate/material changes and safe interruption. Never bypass readiness or treat AI scores as consent. Retention/deletion and EU data-protection readiness remain explicit pre-public-launch review items; this assessment does not establish compliance. Record prompt/context provenance with data minimization and redaction, not unrestricted personal-data dumps.

No production writes, new credentials, real submissions, outbound messages, calendar actions or paid services are authorized by this transition assessment.

---

# Jobee — Security Baseline & Secrets Policy

## 1. Secrets Management

- **Zero Committed Secrets**: `.env` and all files containing credentials or sensitive parameters are strictly ignored via `.gitignore`. Only `.env.example` with non-confidential placeholder keys is committed.
- **Fail-Fast Validation**: The configuration layer (`packages/config`) parses and validates environment variables at service bootstrap. In production (`NODE_ENV=production`), missing required secrets like `DATABASE_URL` trigger immediate process failure (`ConfigurationError`) before accepting traffic.
- **Client Sanitization**: The backend API strips internal error messages, database credentials, and stack traces before returning responses to clients.

---

## 2. PII (Personally Identifiable Information) Protection

Candidate data represents highly sensitive personal information, including:

- Legal names, personal addresses, phone numbers, and private emails.
- Work history, educational records, salary expectations, and current employment status.
- Immigration and work authorization status (citizenship, visa requirements).

### Logging Rules

1. **Never Log Sensitive Keys**: The structured logger (`packages/shared/src/logger/logger.ts`) runs an automatic recursive redaction filter over all contextual metadata. Any key matching `/pass(word)?/i`, `/secret/i`, `/token/i`, `/auth(orization)?/i`, `/database_url/i`, `/api[_-]?key/i`, or `/private[_-]?key/i` is replaced with `[REDACTED]`.
2. **Never Log Credentials in URLs**: Connection strings containing usernames and passwords (e.g., `postgresql://user:pass@host/db`) are automatically masked.
3. **Never Log Raw Application Submissions**: Raw CV content, cover letter drafts with sensitive personal background, or candidate answers must not be dumped into application stdout/stderr streams.

---

## 3. Document Vault & File Upload Security (`JOB-P1-T02`)

Candidate document uploads (CVs, cover letters, portfolios) are handled through strict defensive safeguards:

1. **Size Limit**: Maximum file size is hard-capped at 10 MB (`MAX_DOCUMENT_FILE_SIZE_BYTES = 10 * 1024 * 1024`).
2. **Strict MIME Type Allowlist**: Only explicit whitelisted document MIME types are permitted:
   - `application/pdf` (.pdf)
   - `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (.docx)
   - `text/plain` (.txt)
     All executable scripts, binaries, structured code formats (JSON, YAML), markdown files, or unexpected MIME types are rejected immediately with `400 Bad Request`.
3. **Path Traversal Defense**: The `LocalStorageProvider` normalizes storage paths using `path.resolve` and verifies that target paths reside strictly within the designated storage directory (`uploads/`). Any key containing `..` or attempting escape triggers a security validation error.
4. **Integrity Checksums**: Uploaded documents compute a SHA-256 cryptographic checksum at ingestion time. This checksum is persisted in `candidate_documents.sha256_checksum` for tamper detection and deduplication.
5. **Git Exclusion**: The `uploads/` directory is explicitly excluded in `.gitignore` to prevent confidential resume PDFs and certificates from leaking into source control.

---

## 4. Candidate Brain Audit Privacy Model (`JOB-P1-T02`)

To prevent accidental accumulation and leakage of historical PII, the audit subsystem enforces a metadata-only audit architecture:

1. **Zero PII Snapshots**: Audit logs (`candidate_audit_events`) do NOT store full before/after state snapshots (`before_state`, `after_state`) containing personal text, phone numbers, addresses, salary preferences, or legal declarations.
2. **Changed Field Tracking**: Audits record the list of field names modified (`changed_fields: string[]`), providing complete change traceability without duplicating candidate data.
3. **Safe Operational Metadata**: When operational context is required (e.g. document type, file size in bytes, fact key, answer category), it is recorded in a safe `metadata` JSON object that never duplicates candidate personal values.

---

## 5. Guardrails Against AI Fact Invention & Sensitive Automation

The system strictly enforces the Prime Invariant:

> **AI evaluates and prepares. Rules authorize. Humans handle uncertainty. Everything is auditable.**

- **No Fact Hallucination**: AI engines may only construct application materials using verified candidate facts explicitly stored in the Candidate Brain.
- **AI Permission Gate (`allowAiUse`)**: Each stored fact contains an explicit `allowAiUse` boolean flag. If `allowAiUse` is `false`, downstream AI prompts and application generators are strictly prohibited from referencing it. Query filters (`GET /api/candidate/facts?allowAiUseOnly=true`) isolate AI-authorized truth facts.
- **Sensitive Answer Enforcement**: Screening answers marked `isSensitive` (diversity, compensation, health, immigration, citizenship) can **NEVER** be configured for `AUTO` automation mode unless their `verificationStatus` is explicitly `VERIFIED`. Unverified sensitive answers are rejected at both schema validation and service logic with `400 Bad Request`.

---

## 6. External Action Authorization & Auto-Apply Safety

The system must never submit an application or contact an external party autonomously unless explicitly authorized:

- **Auto-Apply Disabled by Default**: The `auto_apply_enabled` policy flag is `false` on initial setup. Auto-applying cannot run without conscious, intentional candidate enablement.
- **Mandatory Interlocks**: Even if auto-apply is enabled, submissions are deterministically blocked if:
  1. The job match score is below `auto_apply_min_score` (default 85%).
  2. Any question is classified under `REVIEW` status without human confirmation.
  3. Any question requires `MANUAL` candidate entry.
  4. Any sensitive candidate field is unknown or ambiguous.
- **Rate Limiting**: Daily submission volume is capped by `max_applications_per_day` (default 10) to prevent denial-of-service or portal spamming.

---

---

## 7. Network and Process Security

- **CORS Restriction**: The Fastify API configures strict CORS origins restricting browser access to configured frontend hosts (`WEB_ORIGIN`).
- **Worker Isolation**: Scrapers and future headless browser automation (Playwright) will execute in separate processes with isolated network sandbox configurations.

---

## 8. Server-Side Request Forgery (SSRF) Defense (`JOB-P2-T01`)

Fetching arbitrary external URLs provided by users or parsed from listings poses significant SSRF risks (e.g. hitting internal microservices, AWS/GCP/Azure instance metadata APIs, local database ports). The `HttpRetrievalService` implements deterministic defense-in-depth:

1. **Protocol Strictness**: Only standard `http:` and `https:` schemes are allowed. Schemes such as `file:`, `ftp:`, `gopher:`, `data:`, and `javascript:` are rejected immediately.
2. **IP & Hostname Blacklisting**:
   - Loopback addresses (`127.0.0.0/8`, `::1`).
   - RFC1918 private IPv4 subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
   - Carrier-grade NAT (`100.64.0.0/10`).
   - Cloud metadata endpoints (`169.254.169.254`, `metadata.google.internal`, `instance-data`).
   - Link-local and Unique Local IPv6 subnets (`fe80::/10`, `fc00::/7`).
   - Hostnames matching `localhost`, `*.localhost`.
3. **Pre-Flight DNS Resolution Check**: Hostnames are resolved through DNS _before_ making HTTP requests. If any returned IP address falls within a restricted or private range, the request is blocked with `400 Bad Request`.
4. **Manual Redirect Inspection**: Standard automated redirect following is disabled (`redirect: 'manual'`). Each intermediate redirect hop (`Location` header) is parsed and validated against the SSRF checker before proceeding, capping redirects at 3 hops.
5. **Denial-of-Service Defense**:
   - Request timeout: 8,000 ms.
   - Max response size: 2 MB (`2 * 1024 * 1024` bytes).
   - Content-type validation: Only HTML and text MIME types are permitted; binary downloads are halted before buffering.

---

## 9. Stored XSS Prevention & HTML Sanitization (`JOB-P2-T01`)

Job descriptions from external job boards contain HTML formatting. To prevent Stored Cross-Site Scripting (XSS) when rendering job details in the browser:

1. **Defensive Tag Allowlist**: The sanitizer (`sanitizeJobHtml` in `@job-agent/shared`) allows only safe typographical markup (`<p>`, `<h1>`-`<h6>`, `<ul>`, `<ol>`, `<li>`, `<strong>`, `<em>`, `<b>`, `<i>`, `<br>`, `<span>`, `<div>`, `<blockquote>`).
2. **Strict Attribute Stripping**: All event handler attributes (`onclick`, `onload`, `onerror`), script tags, iframe elements, embed tags, object tags, and inline style blocks are stripped out.
3. **Safe Link Attributes**: Any anchor tag must have safe protocols (`http`, `https`) and automatically gains `rel="noopener noreferrer"`. All `javascript:` links are removed.

---

## 10. Raw HTML Discard Policy & Attack Surface Reduction (`JOB-P2-T01`)

To protect against persistent secondary injection, data leakage, and database bloat:

1. **Discard on Success**: The raw downloaded HTML payload (`raw_payload`) is set to `null` in PostgreSQL `job_sources` upon successful extraction and normalization.
2. **Preservation of Safe Text & URLs**: The normalized `raw_text`, parsed job sections, categorized requirements, and canonical URL are preserved for auditing and manual corrections, but untrusted raw DOM payloads are never permanently retained in the database.
3. **Audit Log Hygiene**: Job audit events (`job_events`) log operational metadata without storing raw HTML payloads.

---

## 11. Matching Intelligence & Grounded Evidence Security (`JOB-P2-T02`)

The requirement analysis and matching engine introduces strict security and anti-hallucination controls:

1. **Anti-Hallucination Ground-Truth Verification**:
   - The AI provider response validator (`validator.ts`) compiles an immutable whitelist of verified candidate evidence IDs (`candidate_skill:<id>`, `candidate_experience:<id>`, `candidate_education:<id>`, `candidate_language:<id>`, `candidate_certification:<id>`, `candidate_fact:<id>`).
   - Any evidence ID returned by an AI provider that does not exist in this whitelist is immediately stripped.
   - If an AI provider marks a requirement as `MET` or `PARTIAL` based entirely on hallucinated or unverifiable evidence IDs, the evaluation status is automatically demoted to `UNKNOWN`, and an audit note is appended.
2. **Privacy-Minimized Context Extraction**:
   - Before compiling the AI context, `MatchingContextBuilder` filters candidate facts strictly gating on `verificationStatus = 'VERIFIED'` and `allowAiUse = true`. Unverified or non-consented candidate facts are completely excluded from AI prompts.
3. **Deterministic Authorization Gate**:
   - Under no circumstances does an LLM authorize a job decision or submission. The hard policy engine and versioned scoring engine govern decisions (`MATCH`, `REVIEW`, `SKIP`).
   - Preliminary auto-apply eligibility requires strict deterministic rule satisfaction (`autoApplyEnabled = true`, `decision === 'MATCH'`, score >= threshold, confidence >= 70, zero hard blockers, zero unmet mandatory requirements) and serves only as an eligibility gate. It never triggers automated submission without human confirmation.
4. **Bounded Batch Resource Defense**:
   - Batch analysis requests (`POST /api/jobs/analyze`) enforce a bounded limit (default 10, maximum 50) and per-job error isolation, preventing process denial-of-service, memory spikes, or cascading failures across job postings.
5. **Deterministic State Fingerprinting**:
   - Computes SHA-256 `inputFingerprint` over candidate profile state + job data. Any modification to candidate facts, preferences, or job fields reactively flags stored analyses as `isStale: true` to prevent decision-making on out-of-date intelligence.

---

## 12. Application Studio, Tailored Materials & Approval Safeguards (`JOB-P3-T01`)

The Application Studio operationalizes material generation while enforcing rigid factual and authorization guardrails:

1. **Truthfulness Invariant & Immutable Employment History**:
   - Tailored CVs and cover letters are strictly derived from verified candidate records.
   - Core factual history—organization names, job titles, start/end dates, degrees, institutions, and certifications—is strictly immutable. The generation engines are prohibited from modifying or omitting chronologically binding historical records.
   - Bullet points retain explicit provenance IDs (`evidenceIds`) mapping each claim directly to Candidate Brain achievements or verified facts.

2. **Quantitative Metric Safeguards**:
   - Exaggeration of achievements (e.g. inventing "\$10M ARR" or "10x throughput") is mitigated through a deterministic metric scanner.
   - All quantitative figures (percentages, currencies, multipliers, scale metrics) extracted from tailored bullet points are cross-referenced against the candidate's verified achievements.
   - Any quantitative figure lacking ground-truth verification is flagged with a validation warning (`UNVERIFIED_METRIC`), requiring explicit candidate confirmation before reaching `READY`.

3. **Mandatory Sensitive Screening Approval Interlocks**:
   - Questions falling under `WORK_AUTHORIZATION`, `SPONSORSHIP`, and `SALARY` categories **never** silently auto-fill or auto-approve, even if matching Answer Library items exist.
   - The engine automatically routes these declarations into `approval_requests` with appropriate risk levels (`HIGH` or `MEDIUM`).
   - A package cannot transition from `NEEDS_REVIEW` to `READY` until all pending approval requests have been explicitly signed off or edited by the human candidate.

4. **Safe ATS-Safe OpenXML Document Generation**:
   - Document artifacts are generated programmatically using the pure JavaScript `docx` engine, constructing standard OpenXML markup from structured data.
   - No external templates, Word macros (`.docm`), embedded scripts, or dynamic external object linking are utilized.
   - Formatting strictly conforms to single-column layouts with standard margins and typographic hierarchy, preventing document corruption and ensuring clean text extraction by applicant tracking systems.

5. **Cryptographic Artifact Integrity**:
   - Generated DOCX and TXT artifacts compute SHA-256 cryptographic hashes immediately upon creation, persisted in `application_artifacts.sha256_checksum`.
   - File storage paths are validated via `path.resolve` inside `uploads/`, preventing directory traversal attempts.

6. **Immutable Historical Versions & Audit Logging**:
   - Package iterations are persisted as immutable numbered versions (`application_package_versions`).
   - Regenerating a package into Version $N + 1$ never overwrites Version $N$; previous documents and questions remain preserved for auditability.
   - Version carry-forward preserves human-approved answers and custom edits into subsequent iterations.
   - Every creation, approval, resolution, regeneration, and export is recorded in `application_package_events`.

---

## 13. Application CRM, Frozen Provenance & Compensation Privacy Boundaries (`JOB-P3-T02`)

The Application CRM manages downstream hiring pipeline records, submission histories, recruiter contacts, and compensation offers while enforcing privacy and immutability controls:

1. **Frozen Submission Provenance**:
   - Marking an application as `APPLIED` captures and locks `submitted_package_version_id`, `submitted_cv_artifact_id`, and `submitted_cover_letter_artifact_id`.
   - Even if the candidate later regenerates or modifies the package in the Application Studio, the CRM record retains an immutable historical link to the exact artifacts submitted to the employer.
   - Direct manual applications without an Application Studio package leave submission artifact references as null without failing or forcing synthetic associations.

2. **Terminal State Protection & Controlled Correction Overrides**:
   - Terminal outcomes (`REJECTED`, `WITHDRAWN`, `EXPIRED`) cannot be bypassed casually.
   - Reopening an application or transitioning backwards requires an explicit correction override with `isCorrection: true` and a mandatory `correctionReason`.
   - Every status mutation is permanently recorded in the append-only `application_lifecycle_events` audit table, capturing previous and new statuses, actor, trigger source, and rationale.

3. **Compensation & Offer Privacy Isolation**:
   - Sensitive financial compensation details (base salary, bonus, equity, benefits) in `application_offers` are strictly scoped to the primary candidate context.
   - Compensation offers are never exposed to external crawlers or third-party tracking scripts.
   - Recruiter and interviewer contact details (`application_contacts`) reside strictly within the local database boundaries.

4. **Multi-Tab & Concurrency Idempotency**:
   - The database enforces a unique constraint on `(user_id, job_id)` in the `applications` table.
   - Concurrent requests to track a job return the existing application record (`isExisting: true`), preventing race conditions, orphaned CRM entries, or duplicate tracking rows.

5. **Soft Archiving Protection vs Hard Purge Security Boundary**:
   - Standard application removals execute soft archiving (`is_archived: true, archived_at: timestamp`), ensuring timeline events, interview notes, and submission provenance remain historically intact and auditable.
   - Hard deletion (`DELETE /api/applications/:id/purge`) is guarded as a distinct, deliberate operational action reserved exclusively for GDPR/right-to-be-forgotten erasure.

---

## 14. Email Intelligence, Cryptography & OAuth Security (`JOB-P4-T01`)

The Email Intelligence subsystem integrates with external email providers (e.g. Gmail) while maintaining rigorous cryptographic protection, minimal privileges, and strict safety guardrails:

1. **At-Rest Token Encryption (AES-256-GCM) with Versioned Envelopes**:
   - Access tokens, refresh tokens, and ID tokens are **never** stored in plaintext within the database.
   - Tokens are encrypted using authenticated AES-256-GCM with a 96-bit (12-byte) random initialization vector (IV) and a 128-bit (16-byte) authentication tag.
   - The encryption key is validated on startup for minimum length (>= 32 chars) and entropy (>= 8 unique characters), derived deterministically via SHA-256 from `EMAIL_TOKEN_ENCRYPTION_KEY`.
   - Serialized format: `v1:primary:<ivBase64url>:<tagBase64url>:<ciphertextBase64url>`. Key rotation is supported via explicit key ID tags. Any modification, bit flipping, or invalid key immediately triggers an authentication error, preventing tampered ciphertext from being processed.
   - Decryptor strictly validates version prefixes and rejects unsupported future envelopes (`v2:`) while maintaining backwards-compatible decryption for legacy JSON envelopes.

2. **Strictly Read-Only OAuth Scope Isolation**:
   - OAuth permission scopes are permanently restricted to `https://www.googleapis.com/auth/gmail.readonly`.
   - The application does not request, hold, or utilize write, send, delete, or mailbox management permissions.
   - Outbound email sending and automated replies are strictly prohibited in this phase.

3. **Persistent OAuth CSRF State Protection (`OAuthStateService` & `oauth_states`)**:
   - State tokens prevent cross-site request forgery during OAuth callback handoffs.
   - Signed with HMAC-SHA256 over `{ userId, nonce, expiresAt, provider }`.
   - 15-minute validity window is enforced.
   - State hashes are stored in the PostgreSQL `oauth_states` table and consumed atomically via `UPDATE oauth_states SET consumed_at = NOW() WHERE state_hash = $1 AND provider = $2 AND consumed_at IS NULL AND expires_at > NOW() RETURNING *`.
   - Replay protection survives application restarts and multi-instance restarts.

4. **Sync Concurrency Control & Atomic Mutex**:
   - Concurrent sync requests on the same account are prevented via atomic database claim on `email_accounts.is_syncing` and `sync_locked_at`.
   - Competing requests are rejected immediately with HTTP 409 Conflict (`AppError.conflict`).
   - Stale locks expire automatically after 5 minutes to prevent deadlock on unhandled process aborts.
   - Bounded sync lookback is capped between 30 (default) and 60 (maximum) days to avoid unbounded API ingestion loads.

5. **Safe Account Disconnection vs. Hard Purge**:
   - Disconnecting an account (`DELETE /api/email/accounts/:id`) sets `status = 'DISCONNECTED'` and overwrites token material with neutralized revoked data.
   - Historical normalized messages (`email_messages`), audit runs (`email_sync_runs`), and review items (`email_review_items`) are preserved for candidate record integrity.
   - Hard deletion (`?purge=true`) is a deliberate administrative action that cascades to erase historical data for compliance (e.g., GDPR).

6. **Inbound Content Sanitization & Safe MIME Parsing**:
   - MIME payloads are normalized to strip reply histories (`On ... wrote:`, `> ...`) and legal disclaimers.
   - Raw HTML bodies are converted to plain text using `cheerio` parser; all `<script>`, `<iframe>`, `style`, and tracking pixels are completely discarded before storage.
   - Normalized text bodies compute SHA-256 cryptographic hashes (`content_hash`) to ensure tamper detection, deduplication, and forensic audit integrity.

7. **Conservative CRM State Synchronization Rules**:
   - Follows the Prime Directive: **AI evaluates and prepares. Rules authorize. Humans handle uncertainty.**
   - Auto-transitions require high deterministic confidence (>= 0.90 for confirmations, assessments, and interviews).
   - Conservative Rejection Invariant: Automatic rejection transitions require confidence >= 0.95 AND exact entity resolution (`EXTERNAL_REF` or `COMPANY_AND_ROLE`). Fuzzy matches or lower confidence rejections must route to `email_review_items` with `riskLevel: 'HIGH'`.
   - High-stakes events (`OFFER_LETTER`) never auto-transition CRM state; they are flagged for human sign-off in the review queue.
   - All state transitions execute through `ApplicationStateMachine` and append an immutable event to `application_lifecycle_events` with trigger `EMAIL_SYNC` and actor `SYSTEM`.

---

## 15. Repository History Security & Sensitive Backup Removal (`JOB-P0-T01`)

### 15.1 Context & Incident Rationale

During repository initialization and security auditing for the private GitHub migration (`az-makhmudov/Jobee`), a sensitive development database backup dump file was detected in historical commits:

- **File Name:** `backups/ai_job_agent_dev_backup_20261010_145257.sql`
- **Introduction Commit:** `57001c95` (`feat(truthfulness): activate real candidate functionality and eliminate software hallucinations`)
- **Working-Tree Removal Commit:** `91c17652` (`fix(safety): quarantine unverified facts, invalidate untrusted approvals, and enforce human authorization boundaries`)
- **Sensitive Content Assessment:** The SQL dump contained real candidate personally identifiable information (profile records, educational history, work experience). The audit confirmed **zero** live external API keys, OAuth tokens, or production passwords were present in the dump (`email_accounts` and `calendar_accounts` had 0 rows).
- **Security Requirement:** Although removed from HEAD, Git objects representing the file remained accessible in reachable Git history. To eliminate data leakage risks, the project owner authorized a controlled history rewrite to permanently expunge the file from Git history.

### 15.2 Authorized Scope & Invariants

The owner authorization strictly applied to:

1. Permanently purging `backups/ai_job_agent_dev_backup_20261010_145257.sql` from Git history across all branches and tags.
2. Preserving 100% of application source code, database migrations (0000–0014), documentation, architectural decision records, and feature implementations.
3. Operating strictly inside an isolated clone outside the primary repository and active Antigravity worktrees.
4. Securing a durable local recovery backup before rewriting.
5. Reconciling all local worktrees and preventing old history reintroduction.

### 15.3 Execution Procedure

1. **Isolated Workspace & Secure Recovery Backup:**
   - Secure backup directory created at `/Users/bek/.jobee-security-cleanup/` with permissions restricted to `chmod 700` (`drwx------`).
   - Created full Git mirror backup (`jobee-backup.git`) and complete Git bundle (`jobee-backup.bundle`).
   - Fresh clone initialized at `/Users/bek/.jobee-security-cleanup/jobee-clean` for the rewrite operation.
2. **Deterministic History Filtering via `git-filter-repo`:**
   - Filter executed with `--invert-paths --path backups/ai_job_agent_dev_backup_20261010_145257.sql --force`.
   - Verified that neither commit became empty; code changes and test additions were fully preserved.
3. **Pre-Push Quality & Tree Invariant Verification:**
   - Tree SHA comparison between original `main` (`e1ad4ba`) and rewritten `main` (`442fa23`) confirmed identical tree hash: `f729bfdd512ab9b2fe955f4b1ef9c0cbc0c66ca9` (100% bit-for-bit identical).
   - Rebrand tree SHA (`6b4a3a9`) confirmed identical to original (`bdc70fb`): `5e8a202bb9a71719dc1907f1e80ed63d54e5f43d`.
   - Full history log scan verified 0 reachable objects and 0 commits reference the sensitive backup.
4. **Controlled Force-Push:**
   - GitHub repository privacy reconfirmed (`private: true`, `visibility: private`).
   - Controlled push of only authorized rewritten branches: `main` and `security_and_ci_remediation`.
   - Zero unrestricted mirror pushes executed.
5. **Local Workspace Reconciliation:**
   - Primary repository (`/Users/bek/Job Agent`) fetched updated origin refs.
   - Branch refs safely advanced without destructive commands.
   - Reflogs expired and unreachable objects pruned (`git reflog expire --expire=now --all`, `git gc --prune=now`).
   - Active Antigravity worktrees (`rebrand_to_jobee`, `security_and_ci_remediation`) cleanly reconciled to rewritten heads.

### 15.4 Rewritten Commit Hash Map

| Logical Stage             | Original SHA | Rewritten SHA | Commit Description                                                                                                      |
| :------------------------ | :----------- | :------------ | :---------------------------------------------------------------------------------------------------------------------- |
| `REAL-ACT`                | `57001c95`   | `c7537b4e`    | `feat(truthfulness): activate real candidate functionality and eliminate software hallucinations`                       |
| `REAL-ACT-REMEDIATION`    | `91c17652`   | `bd28ca8f`    | `fix(safety): quarantine unverified facts, invalidate untrusted approvals, and enforce human authorization boundaries`  |
| State Checkpoint          | `e49faf3a`   | `01a25f48`    | `docs(state): update checkpoint hash to bd28ca8 after remediation`                                                      |
| `JOB-P0-T01`              | `78f6b409`   | `4f932fec`    | `chore: initialize Jobee project foundation (JOB-P0-T01)`                                                               |
| `JOB-P0-T01-REMEDIATION`  | `bdc70fbc`   | `6b4a3a9d`    | `docs(security): remediate gitignore migration rules, update context status, and prepare history audit`                 |
| `JOB-P0-T01` CI Hardening | `e1ad4ba7`   | `442fa23b`    | `fix(ci): remediate GitGuardian credentials false positive, isolate test fixtures, and configure PostgreSQL CI service` |

### 15.5 GitHub Server-Side Cache & Support Remediation

- **Investigation Finding:** When a repository history is rewritten and force-pushed, GitHub updates branch heads immediately. However, GitHub's server-side object database may retain unreferenced historical commit SHAs in cache and backend storage until internal garbage collection runs.
- **Repository Visibility Safeguard:** Because `az-makhmudov/Jobee` is strictly private, these cached objects are only accessible to authenticated repository owners/collaborators who possess the exact commit SHA.
- **Permanent Purge via GitHub Support:** To ensure total compliance and purge historical commit SHAs from GitHub's internal cache immediately, the repository owner can submit a ticket to GitHub Support.
- **Support Ticket Request Template:**
  ```text
  Subject: Request repository cache clear and garbage collection for private repo az-makhmudov/Jobee

  Hello GitHub Support,

  I am the owner of the private repository https://github.com/az-makhmudov/Jobee.
  I have recently rewritten git history using git-filter-repo to permanently remove
  a development database backup containing personal information from all branches
  and tags, and force-pushed the cleaned branches.

  Please purge all cached views, unreferenced commit objects, and run garbage collection
  (git gc) on the backend for az-makhmudov/Jobee so that unreachable commit SHAs
  (specifically 57001c95bc60b7cfe9deac3836c26112ac0223cf and e1ad4ba7b120a17e35802ae2ad27af03d274a4c8)
  can no longer be retrieved via the web interface or API.

  Thank you!
  ```

---

## 16. Authentication Security, Session Integrity & Multi-Tenant Isolation (`JOB-AUTH-01`)

The identity management subsystem integrates Better Auth to establish production-grade authentication and multi-user tenant boundary defenses:

1. **Secure Session Cookie Management**:
   - Better Auth issues cryptographically signed session tokens stored in PostgreSQL table `sessions`.
   - Browser cookies enforce `httpOnly: true` (preventing XSS session extraction) and `sameSite: 'lax'`.
   - In production environments, cookies strictly enforce `secure: true` (HTTPS-only transmission).
   - Trusted origins (`BETTER_AUTH_TRUSTED_ORIGINS`) and secret salts (`BETTER_AUTH_SECRET`) are validated at startup via Zod.

2. **Credential Security & Email Verification**:
   - Password authentication uses state-of-the-art `scrypt` hashing with unique per-user salts.
   - Email verification codes and password reset tokens are persisted in `verifications` table with strict expiration timestamps.
   - Transactional email dispatch uses Resend (`RESEND_API_KEY`) over TLS; development mode safely outputs formatted tokens to structured server logs.

3. **OAuth Privilege & Scope Separation**:
   - Better Auth Google Sign-In strictly requests OpenID Connect identity scopes (`openid`, `profile`, `email`) for authentication and account linking.
   - Identity tokens are stored in Better Auth `accounts` table and **never** conflated with recruitment integrations.
   - Gmail read-only tokens (`email_accounts`) and Google Calendar tokens (`calendar_accounts`) remain completely separate subsystems governed by dedicated versioned AES-256-GCM token encryption envelopes (`TokenCryptoService`).

4. **Multi-Tenant Workspace Isolation**:
   - Authenticated sessions resolve user identity into Node.js `AsyncLocalStorage` (`requestUserContext`).
   - All backend domain endpoints (`/api/candidate/*`, `/api/jobs/*`, `/api/applications/*`, `/api/email/*`, `/api/calendar/*`, `/api/notifications/*`) resolve user context via `getCurrentUserId()` rather than trusting client-supplied user parameters.
   - Unauthenticated requests are rejected with `401 Unauthorized` (`AppError.unauthorized`).
   - Cross-tenant data access attempts return `404 Not Found` or `403 Forbidden`.

5. **Private Pilot Gated Registration**:
   - Public self-registration is strictly blocked when `INVITE_ONLY_REGISTRATION=true`.
   - Registration requires a single-use code from `pilot_invitations`.
   - Verification and redemption occur atomically inside the `databaseHooks.user.create` transaction.
   - Admin routes (`/api/pilot/invitations`) enforce role checks (`user.role === 'admin'`), preventing privilege escalation.
