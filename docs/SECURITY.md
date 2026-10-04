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

## 7. Network and Process Security

- **CORS Restriction**: The Fastify API configures strict CORS origins restricting browser access to configured frontend hosts (`WEB_ORIGIN`).
- **Worker Isolation**: Scrapers and future headless browser automation (Playwright) will execute in separate processes with isolated network sandbox configurations.
