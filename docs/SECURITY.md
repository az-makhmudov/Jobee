# AI Job Agent — Security Baseline & Secrets Policy

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
