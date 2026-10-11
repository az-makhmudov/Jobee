# Jobee — System Architecture

## 1. Overview & Monorepo Topology

**Jobee** (originally developed under the working name AI Job Agent) is built as a TypeScript-first monorepo using npm workspaces. The architecture establishes strict boundaries between user interface, HTTP API, background processing, data persistence, and shared primitives.

```text
Jobee/
├── apps/
│   ├── web/              # User Interface (React 19, Vite 8, pure modern CSS)
│   ├── api/              # HTTP API (Fastify, TypeScript, structured logging)
│   └── worker/           # Background Engine (Node.js daemon, isolated process)
├── packages/
│   ├── config/           # Environment validation (Zod, dotenv)
│   ├── database/         # Data layer (PostgreSQL, Drizzle ORM, migrations)
│   └── shared/           # Core primitives (AppError, logger, types, contracts)
└── docs/                 # Authoritative engineering documentation & ADRs
```

---

## 2. Component Responsibilities & Runtime Boundaries

### `apps/web` (Frontend Shell)

- **Tech Stack**: React 19, Vite 8, TypeScript.
- **Role**: Responsive personal dashboard presenting candidate profile management, document vault, answer library, job preferences, safety guardrails, audit timeline, and system health status.
- **Boundaries**: Communicates strictly with `apps/api` via REST. Does not connect directly to the database or external ATS services.

### `apps/api` (Backend Service)

- **Tech Stack**: Node.js 24+, Fastify 5, TypeScript.
- **Role**: Serves HTTP endpoints, processes commands, manages deterministic candidate identity, exposes candidate CRUD services, document upload/download streaming, health/readiness probes, and dispatches background work.
- **Health Probes**:
  - `GET /health`: Liveness probe indicating the HTTP process is responsive.
  - `GET /ready`: Readiness probe verifying connectivity to PostgreSQL.
- **Candidate Brain Endpoints**:
  - `/api/candidate/overview`, `/api/candidate/audit-events`
  - `/api/candidate/profile`, `/api/candidate/experiences`, `/api/candidate/education`
  - `/api/candidate/projects`, `/api/candidate/skills`, `/api/candidate/languages`
  - `/api/candidate/certifications`, `/api/candidate/links`, `/api/candidate/facts`
  - `/api/candidate/documents`, `/api/candidate/documents/:id/download`
  - `/api/candidate/answers`, `/api/candidate/preferences`, `/api/candidate/policy`
- **Boundaries**: Stateless HTTP layer. Does not run heavy long-lived browser automation sessions.

### `apps/worker` (Background Processing Daemon)

- **Tech Stack**: Node.js 24+, TypeScript.
- **Role**: Executes asynchronous and scheduled tasks (health heartbeat, future ingestion scrapers, batch scoring, email sync).
- **Boundaries**: Runs as an independent operating system process. Shares database and config packages, but failure or memory bloat in background processing cannot take down the interactive API.

### `packages/database` (Data Persistence)

- **Tech Stack**: PostgreSQL, Drizzle ORM, Drizzle Kit, `pg` (node-postgres connection pooling).
- **Role**: Encapsulates schema definitions (users, candidate profile, experiences, education, projects, skills, languages, certifications, links, facts, documents, answer library, job preferences, application policy, audit events), migration scripts, connection pooling, and low-level database health probes.
- **Deterministic Identity**: Exports `getOrCreatePrimaryUser(db)` resolving `00000000-0000-0000-0000-000000000001` with `system_key: default_primary_candidate`.

### `packages/config` (Runtime Environment)

- **Tech Stack**: Zod, dotenv.
- **Role**: Enforces strict schema validation for all environment variables at startup (`validateEnv`). Prevents silent failures or misconfigured ports/database URLs.

### `packages/shared` (Shared Primitives)

- **Tech Stack**: TypeScript, Zod.
- **Role**: Exports normalized domain error classes (`AppError`), structured JSON logging (`Logger`), redaction utilities (`redactSensitiveData`), storage interfaces (`FileStorageProvider`), candidate completeness engine (`calculateProfileCompleteness`), and API DTO contracts.
- **Boundaries**: Contains zero database dependencies or heavy third-party SDKs.

---

## 3. Dependency Direction

Dependencies flow strictly inward toward shared core packages:

```text
apps/web     ──> [HTTP / REST] ──> apps/api
apps/api     ──> packages/database ──> packages/config ──> packages/shared
apps/worker  ──> packages/database ──> packages/config ──> packages/shared
```

- `apps/*` never import from each other.
- `packages/*` never import from `apps/*`.
- `packages/shared` has zero internal workspace dependencies.

---

## 4. Candidate Brain Architecture (`JOB-P1-T02`)

The Candidate Brain is the authoritative structured truth repository for the candidate's professional profile, verified credentials, document vault, and application decision policy.

```text
┌────────────────────────────────────────────────────────┐
│                      Candidate Brain                   │
├──────────────────────────┬─────────────────────────────┤
│  Structured Facts & Bio  │      Document Vault         │
│  - Profile               │  - Master CV (Baseline)     │
│  - Experiences           │  - Role-specific CVs        │
│  - Education & Projects  │  - Cover Letter Templates   │
│  - Skills & Languages    │  - Certificates & Artifacts │
│  - Verified Facts        │  (LocalStorageProvider)     │
├──────────────────────────┼─────────────────────────────┤
│   Answer Library Rules   │     Application Policy      │
│  - AUTO / REVIEW / MANUAL│  - Auto-Apply (Default OFF) │
│  - Sensitive Safeguards  │  - Score Thresholds         │
│  - Deterministic Gates   │  - Daily Volume Limits      │
└──────────────────────────┴─────────────────────────────┘
```

### 4.1. The Prime Invariant: Never Invent Candidate Facts

- Generative AI models evaluate and prepare; deterministic rules authorize; humans handle uncertainty.
- In future phases (P2/P3), application generation may only reference explicitly stored candidate facts and verified records where `allowAiUse` is true.

### 4.2. Storage Provider Abstraction

- Defined in `@job-agent/shared` via `FileStorageProvider` (`saveFile`, `getFile`, `deleteFile`, `exists`).
- Implemented in `apps/api` via `LocalStorageProvider` targeting local `uploads/` (ignored in Git).
- Upload safety: 10MB file limit, strict MIME allowlist (`application/pdf`, `docx`, `text/plain`), path traversal normalization defenses, SHA-256 integrity checksumming.

### 4.3. Reusable Answer Library Automation Tiers

- `AUTO`: Safe for automated submission without candidate prompt. **Enforcement**: Sensitive questions (`isSensitive: true`) can **NEVER** be configured for `AUTO` unless their `verificationStatus` is explicitly `VERIFIED`.
- `REVIEW`: Pre-fill in application, but require human confirmation before submission.
- `MANUAL`: Never pre-fill; always prompt candidate manually.
- `isSensitive`: Flags sensitive demographic, compensation, or legal data.

### 4.4. Application Policy & Interlocks

- `autoApplyEnabled` defaults to `false`.
- Safety interlocks prevent auto-apply if:
  1. Any answer has unresolved review status (`blockOnUnresolvedReview`).
  2. Any answer requires manual entry (`blockOnManual`).
  3. Sensitive candidate fields are missing or unverified (`blockOnUnknownSensitive`).

### 4.5. Completeness Scoring Engine

- Deterministic 100-point algorithm across 7 categories:
  - Personal Information (15%)
  - Master CV Uploaded (25%)
  - Work Experience (20%)
  - Education (10%)
  - Skills (15%)
  - Languages (5%)
  - Verified Facts (10%)

### 4.6. Privacy-Preserving Audit Model

- Replaces full `before_state`/`after_state` PII dumps with field-level change tracking (`changed_fields: string[]`) and safe non-PII operational context (`metadata`).
- Protects historical personal data (salaries, phones, addresses, declarations) from redundant replication in system event tables.

---

## 5. Job Ingestion & Normalization Subsystem (`JOB-P2-T01`)

The Job Ingestion subsystem provides the entry point for all job postings into Jobee. It handles input from pasted text or public URLs, safely fetches web pages with comprehensive SSRF defenses, extracts structured data via ATS-specific and generic parsers, normalizes values into a canonical internal model, and enforces strict idempotency and deduplication without generative AI hallucinations.

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   Job Ingestion & Inbox Subsystem                      │
├──────────────────────────┬─────────────────────────────────────────────┤
│  Ingestion Sources       │  Safe HTTP Retrieval Service                │
│  - Pasted Job Text       │  - SSRF Defense (RFC1918, metadata, loopback│
│  - Public Job URL        │  - Manual Redirect Hop Validation           │
│  - Manual corrections    │  - 8s Timeout & 2MB Max Payload Cap         │
├──────────────────────────┼─────────────────────────────────────────────┤
│  Extractor Registry      │  Job Normalizer & Deduplication             │
│  - Greenhouse Extractor  │  - URL Canonicalization (strip tracking)    │
│  - Lever Extractor       │  - Canonical Workplace, Type, Seniority     │
│  - Ashby Extractor       │  - Deterministic SHA-256 contentHash        │
│  - LinkedIn (Auth Wall)  │  - Tri-Level Deduplication Engine           │
│  - Generic JSON-LD / HTML│  - Provenance & Job Event Audit Log         │
└──────────────────────────┴─────────────────────────────────────────────┘
```

### 5.1. Prime Invariants & Design Principles

- **No LLM Dependency**: Extraction, normalization, and deduplication operate deterministically using DOM parsers, regex heuristics, and JSON-LD schema models. Ingestion does not fail when external LLM APIs are offline.
- **Truthful Fact Extraction**: Ingestion never invents qualifications, salaries, or requirements. If a field is missing in the source, it remains `null` or `UNKNOWN`.
- **Requirement Type & Strength Separation**: The requirement model cleanly separates semantic category (`SKILL`, `EXPERIENCE`, `EDUCATION`, `LANGUAGE`, `CERTIFICATION`, `LOCATION`, `WORK_AUTHORIZATION`, `RESPONSIBILITY`, `OTHER`) from requirement strength (`MANDATORY`, `PREFERRED`, `UNKNOWN`).
- **Responsibility Isolation**: Day-to-day responsibilities and tasks are preserved in `job_sections` (under section type `RESPONSIBILITIES`) and are NOT falsely classified as mandatory hiring requirements. If any responsibility is captured in requirements, its strength is set to `UNKNOWN` (never `MANDATORY`).
- **Requirement Source Context**: Every extracted requirement links back to its provenance via `source_id` (foreign key to `job_sources.id`) and `source_section` (text indicating the source section, e.g. "Required Qualifications", "Minimum Requirements").
- **Raw HTML Discard Policy**: On successful extraction and normalization, raw HTML payloads (`raw_payload`) are set to `null` in PostgreSQL `job_sources` to reduce attack surface and storage bloat while keeping normalized `raw_text` and source URLs.
- **Full Provenance Preservation**: The original raw source text, retrieval metadata, and HTTP headers are immutably archived in `job_sources`. Manual corrections update the normalized presentation columns in `jobs` while keeping the original source data intact.
- **Strict Phase Boundary**: Job ingestion does NOT evaluate candidate fit or perform match scoring. Fit analysis and compatibility scoring are explicitly deferred to `JOB-P2-T02`.

### 5.2. SSRF Protection & Safe Web Fetching

The `HttpRetrievalService` implements defense-in-depth against Server-Side Request Forgery:

1. **Protocol Restriction**: Only `http:` and `https:` schemes are permitted. File, FTP, gopher, and data schemes are blocked.
2. **Host & IP Address Validation**: Blocks localhost, loopback addresses (`127.0.0.0/8`, `::1`), RFC1918 private IPv4 subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), Carrier-grade NAT (`100.64.0.0/10`), link-local / cloud metadata services (`169.254.169.254`, `metadata.google.internal`), and unique local / link-local IPv6 addresses (`fc00::/7`, `fe80::/10`).
3. **DNS Lookup Inspection**: Resolves hostnames via DNS lookup and evaluates _all_ returned IP addresses before initiating connections.
4. **Manual Redirect Inspection**: Disables automatic redirect following. Each redirect hop (`Location` header) is parsed and validated against the SSRF checker before following (maximum 3 redirects).
5. **Resource Limits**: Enforces an 8-second request timeout and a 2MB maximum payload limit to protect against slowloris attacks and memory exhaustion.

### 5.3. Extractor Hierarchy

The `ExtractorRegistry` matches target pages to specialized parsers:

- **`GreenhouseExtractor`**: Extracts job ID from URL (`gh_jid` or `/jobs/<id>`), company token, JSON-LD, or Greenhouse DOM selectors.
- **`LeverExtractor`**: Extracts posting ID, commitment, workplace type, and structured section wrapper lists (iterates all `.section-wrapper` elements to ensure full section and bullet extraction).
- **`AshbyExtractor`**: Extracts Ashby job UUID, schema.org `JobPosting`, or embedded `__NEXT_DATA__`.
- **`LinkedInExtractor`**: Detects public LinkedIn job URLs and extracts numeric job IDs. Detects login/auth-walls and gracefully flags `needsManualText: true` with explanatory guidance rather than crashing.
- **`GenericExtractor`**: Parses standard Schema.org `JobPosting` JSON-LD blocks, OpenGraph meta tags, and semantic HTML (`<main>`, `<article>`, `<h1>`).
- **`ManualTextExtractor`**: Parses unstructured pasted job postings using label heuristics, salary ranges, bullet point extractors, and section classifiers.

### 5.4. Normalization Engine & Deduplication

- **URL Canonicalization**: Strips UTM tracking queries, referral tags, and trailing slashes.
- **Deterministic Content Fingerprint**: Computes a SHA-256 `contentHash` across normalized title, company, location, and description snippet.
- **Tri-Level Deduplication**:
  1. Provider + External Job ID (`provider` + `source_external_id`)
  2. Canonical URL (`canonical_url`)
  3. Content Fingerprint (`content_hash`)
- **Idempotent Handling**: Ingesting a duplicate job returns the existing job record with `isDuplicate: true`, records an audit event (`JOB_DUPLICATE_DETECTED`), and appends a `job_sources` row with `ingestionStatus: 'DUPLICATE'`.
- **Preservation of Distinct Roles**: Similar-but-distinct positions (e.g. "Project Coordinator" vs "Senior Project Coordinator", or different cities) yield distinct content hashes and persist as separate jobs.

### 5.5. Job Inbox & Detail Views

- **Job Inbox (`apps/web`)**: Paginated table with search, status filters (NEW, INGESTED, NEEDS_REVIEW, ARCHIVED), provider filters, workplace badges, and direct detail navigation.
- **Add Job Modal**: Clean tabbed interface supporting SSRF-protected URL import and pasted text ingestion with duplicate notifications.
- **Job Detail View**: Comprehensive inspector displaying full job description, categorized extracted requirements (with category pills, strength badges, and source section attribution), structured sections, provenance timeline, and manual correction form.

---

## 6. Requirement Analysis, Matching & Policy Decision Engine (`JOB-P2-T02`)

The matching engine evaluates job suitability against the Candidate Brain using deterministic policy rules, grounded evidence resolution, and dimensional scoring, with optional AI semantic enrichment.

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        Candidate Brain & Job Data                      │
│   (Verified Facts only, allowAiUse=true, Preferences, Policy, Job)     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                       MatchingContextBuilder
                      (State Hashing & Evidence Map)
                                    │
                                    ├───> HardPolicyEngine (Deterministic Blockers)
                                    │     - Excluded Companies / Keywords
                                    │     - Work Mode / Location Mismatch
                                    │     - Unpaid Roles / Salary Thresholds
                                    │     - Sponsorship / Sensitive Policies
                                    │
                                    ├───> CandidateEvidenceResolver (Grounded Mapping)
                                    │     - Skills (exact, alias, fuzzy)
                                    │     - Languages (CEFR ranks A1-C2)
                                    │     - Experience duration aggregation
                                    │     - Education & Certifications
                                    │
                                    ├───> [Optional] AI Provider Abstraction
                                    │     - GeminiAiProvider / MockAiProvider
                                    │     - validator.ts: Strips hallucinated IDs
                                    │
                                    ▼
                        MatchingScoringEngine (v1.0.0)
     ┌──────────────────────────────────────────────────────────────┐
     │ - 8 Dimensions: Role, Skills, Exp, Edu, Loc, Lang, Comp, Auth│
     │ - Dynamic Re-weighting for UNKNOWN/N/A dimensions             │
     │ - Mandatory requirement penalties                            │
     │ - Composite Score (0-100) & Confidence Score (0-100)         │
     │ - Deterministic Decision: MATCH / REVIEW / SKIP              │
     │ - Preliminary Auto-Apply Eligibility Check (never auto-fires)│
     └──────────────────────────────┬───────────────────────────────┘
                                    │
                               MatchService
                (Transactional Persistence & Staleness Tracking)
                                    │
     ┌──────────────────────────────┴───────────────────────────────┐
     ▼                                                             ▼
job_match_analyses                              job_requirement_evaluations
(overallScore, confidence, decision,             (status: MET/PARTIAL/NOT_MET,
 autoApplyEligible, fingerprint, isStale)         grounded evidenceIds, reason)
```

### 6.1. Core Invariant & Grounded Evidence Resolution

- **Prime Invariant Enforced**: AI evaluates and prepares. Rules authorize. Humans handle uncertainty. Everything is auditable.
- **Zero Hallucinated Candidate Facts**: LLM responses cannot invent qualifications. The `validator.ts` module checks every evidence ID returned by the AI against the pre-compiled `candidateContext` evidence whitelist. Any invalid or invented evidence ID is stripped; if an AI claims `MET` with zero valid evidence, the evaluation is automatically demoted to `UNKNOWN`.
- **Deterministic Evidence Mapping**: Candidate evidence items (`candidate_skill:<id>`, `candidate_experience:<id>`, `candidate_language:<id>`, `candidate_education:<id>`, `candidate_certification:<id>`) are tracked with clear types and human-readable labels and displayed as evidence pills in the UI.

### 6.2. Deterministic Hard Policy Engine

- **Automated SKIP**: Evaluates deterministic rules that immediately disqualify a job from application:
  - `EXCLUDED_COMPANY`: Direct or substring match with candidate's excluded company list.
  - `EXCLUDED_KEYWORD`: Prohibited keywords found in title or description.
  - `WORK_MODE_NOT_ALLOWED`: Job workplace mode (e.g. ONSITE) not in candidate's allowed modes (when relocation is not accepted).
  - `UNPAID_ROLE_REJECTED`: Unpaid or volunteer roles rejected when `acceptUnpaid: false`.
  - `SALARY_BELOW_MINIMUM`: Maximum posted salary is below candidate's minimum required threshold.
  - `SPONSORSHIP_CONFLICT`: Job forbids sponsorship when candidate explicitly requires it.
- **Unknown-Sensitive Escalation**: When critical policy data is missing or ambiguous (e.g. unknown relocation willingness, unstated clearance, or unverified sensitive facts), the policy engine flags `POLICY_INFORMATION_MISSING` and forces a `REVIEW` decision rather than guessing.

### 6.3. Versioned Dimensional Scoring Engine (`1.0.0`)

- **8 Core Dimensions**:
  1. `ROLE_FIT` (default weight: 25)
  2. `SKILLS_FIT` (default weight: 25)
  3. `EXPERIENCE_FIT` (default weight: 20)
  4. `EDUCATION_FIT` (default weight: 10)
  5. `LOCATION_FIT` (default weight: 10)
  6. `LANGUAGE_FIT` (default weight: 10)
  7. `COMPENSATION_FIT` (default weight: 15)
  8. `WORK_AUTHORIZATION_FIT` (default weight: 20)
- **Dynamic Re-Weighting**: When a dimension is unstated or unknown (e.g. unlisted salary in `COMPENSATION_FIT`), its weight is omitted from the denominator so that known dimensions re-normalize to 100% without penalizing the candidate.
- **Mandatory Penalty**: If any mandatory job requirement is `NOT_MET`, a penalty (-20 points) is applied, capping the score and preventing false positives.
- **Confidence Scoring**: Computed (0-100) based on requirement evaluation completeness, scored dimension ratio, profile completeness, and job description depth.
- **Decision Thresholds**:
  - `SKIP`: Hard policy blocker present, or overall score < `minScoreForReview` with confidence >= 50.
  - `REVIEW`: Fit score between review and match threshold, low confidence (< 60), unmet mandatory requirements, or missing sensitive policy info.
  - `MATCH`: Overall score >= `autoApplyMinScore`, confidence >= 60, zero hard blockers, zero unmet mandatory requirements.
- **Preliminary Auto-Apply Eligibility**: Conservative check requiring `autoApplyEnabled = true`, `decision === 'MATCH'`, score >= threshold, confidence >= 70, zero blockers. Serves purely as a eligibility gate; auto-apply never submits automatically.

### 6.4. State Fingerprinting & Staleness Detection

- **SHA-256 Input Fingerprint**: Hashes candidate profile, preferences, policy, verified credentials, and job posting data.
- **Reactive Staleness Invalidation**: When candidate credentials or preferences are updated, or when job fields are corrected via `PUT /api/jobs/:id`, existing analyses are marked `isStale: true` and surfaced with a warning banner and re-analyze prompt in the UI.

### 6.5. AI Provider Abstraction

- **`AiProvider` Interface**: Defines `isAvailable(): boolean` and `analyzeMatch(context: AiMatchContext): Promise<AiMatchResult>`.
- **Implementations**:
  - `DisabledAiProvider`: Safe fallback when no provider is configured (`AI_PROVIDER=disabled`).
  - `MockAiProvider`: Deterministic provider for automated test suites.
  - `GeminiAiProvider`: Native REST integration with Gemini API, enforcing strict timeouts, error recovery, and Zod output parsing.
- **Privacy Boundary**: Only verified candidate facts with `allowAiUse: true` are shared with the AI provider.

---

## 7. Application Studio & Tailored Materials Architecture (`JOB-P3-T01`)

The Application Studio bridges the Candidate Brain, Job Ingestion, and Matching Intelligence subsystems into prepared, versioned, and auditable application packages.

```text
┌────────────────────────┐      ┌────────────────────────┐      ┌────────────────────────┐
│     Candidate Brain    │      │    Ingested Job &      │      │     Match Analysis     │
│   (Facts, Experiences, │      │      Requirements      │      │  (Dimension Scores,    │
│    Answer Library)     │      │   (jobs, requirements) │      │   Evaluated Evidence)  │
└───────────┬────────────┘      └───────────┬────────────┘      └───────────┬────────────┘
            │                               │                               │
            └───────────────────────┬───────┴───────────────────────────────┘
                                    │
                                    ▼
                      ApplicationPackageService
       ┌─────────────────────────────────────────────────────────────┐
       │ - Orchestrates package creation, versions, and regenerations │
       │ - Dynamic staleness detection on candidate/job mutations    │
       │ - Version carry-forward of approved answers                 │
       └────────────────────────────┬────────────────────────────────┘
                                    │
    ┌───────────────────────────────┼───────────────────────────────┐
    │                               │                               │
    ▼                               ▼                               ▼
CvBaseSelector &              CoverLetterEngine           ApplicationQuestionEngine
TailoringEngine               - Professional letter       - 4-Level Resolution Hierarchy
- Base CV Priority              grounded in facts           (AUTO / REVIEW / MANUAL /
- Truthful bullet ranking     - Links candidate gaps        UNRESOLVED)
- Metric Safeguard              to strengths              - Sensitive category interlock
- Immutable core history      - Zero synthetic claims       (WORK_AUTH, SPONSORSHIP,
                                                            SALARY -> Mandatory Approval)
    │                               │                               │
    └───────────────────────────────┼───────────────────────────────┘
                                    │
                                    ▼
                         DocxGeneratorService
       ┌─────────────────────────────────────────────────────────────┐
       │ - Clean ATS-safe single-column DOCX generation (`docx`)     │
       │ - Single-column layout (no parsing breakage in ATS tools)   │
       │ - Tailored CV (.docx, .txt) & Cover Letter (.docx, .txt)   │
       │ - Cryptographic SHA-256 artifact checksum verification       │
       └────────────────────────────┬────────────────────────────────┘
                                    │
                                    ▼
                       PackageReadinessEngine
       ┌─────────────────────────────────────────────────────────────┐
       │ - Evaluates blocking approval requests                      │
       │ - Evaluates unresolved questions and validation issues       │
       │ - Computes readiness score (0-100)                          │
       │ - Deterministic State: DRAFT -> NEEDS_REVIEW -> READY       │
       └────────────────────────────┬────────────────────────────────┘
                                    │
                                    ▼
       ┌─────────────────────────────────────────────────────────────┐
       │                   Human Approvals Queue                     │
       │ - Candidate signs off or modifies sensitive declarations    │
       │ - Package cannot reach READY until all approvals resolved   │
       └─────────────────────────────────────────────────────────────┘
```

### 7.1. Base CV Selection Priority Hierarchy (`CvBaseSelector`)

Selects the initial base document or structured source using a deterministic 4-stage fallback hierarchy:

1. **Manual Override Document**: Explicit candidate document ID provided at package generation time.
2. **Active Role-Specific CV**: Document in `candidate_documents` matching `roleFocus` of the target job (`isActive = true`).
3. **Active Master CV**: Active baseline document (`isMaster = true`, `isActive = true`).
4. **Candidate Brain Direct Compilation**: Fallback structured compilation directly from normalized candidate tables (`candidate_profiles`, `candidate_experiences`, `candidate_education`, `candidate_skills`).

### 7.2. Factual Truthfulness Invariant & Metric Safeguards (`TailoringEngine`)

- **Immutable Core History**: Organization names, job positions, employment dates, educational institutions, degrees, and certifications are immutable. The tailoring engine is strictly prohibited from altering chronological truth.
- **Bullet Prioritization & Grounding**: Bullet points are reordered and selected based on relevance to evaluated job requirements. Every tailored bullet retains provenance references in `evidenceIds`.
- **Metric Safeguards**: A deterministic scanner cross-checks all quantitative claims (percentages, dollar amounts, scale numbers) in tailored bullets against verified Candidate Brain achievements. If an unverified numeric claim is detected, it is flagged as a validation issue (`UNVERIFIED_METRIC`) to prevent exaggeration.

### 7.3. ATS-Safe Single-Column DOCX Generation (`DocxGeneratorService`)

- **Single-Column Standard**: Uses the `docx` library to construct single-column OpenXML documents with standardized typography, clear section headers, bullet lists, and standard margin hierarchy. Multi-column tables and complex text frames (which reliably break ATS parsers) are strictly avoided.
- **Artifact Pipeline**: Each package version generates companion `.docx` and plain `.txt` files for both Tailored CV and Cover Letter, stored via `FileStorageProvider` with SHA-256 cryptographic checksums.

### 7.4. 4-Level Application Question Resolution Hierarchy (`ApplicationQuestionEngine`)

Resolves job application questions through an auditable, conservative hierarchy:

1. **`AUTO`**: Exact or high-confidence keyword match against candidate's Answer Library (`automationLevel: AUTO`) for non-sensitive categories.
2. **`REVIEW`**: Medium-confidence inference from Candidate Brain or Answer Library marked `REVIEW`. Pre-fills the draft answer but requires candidate verification.
3. **`MANUAL`**: Prompts the candidate for direct manual input when no relevant Answer Library entry exists.
4. **`UNRESOLVED`**: Flagged question missing critical input, blocking package readiness.

- **Sensitive Category Interlock**: Questions in categories `WORK_AUTHORIZATION`, `SPONSORSHIP`, and `SALARY` can **never** be silently auto-approved. They automatically generate an `approval_requests` entry requiring explicit candidate sign-off, even if matching Answer Library items exist.

### 7.5. Human Approvals Queue & Package Readiness State Machine

- **Readiness State Machine**:
  - `DRAFT`: Package is being prepared; version 1 generation in progress.
  - `NEEDS_REVIEW`: Generated version has pending approval requests, unconfirmed `REVIEW` questions, or validation issues.
  - `READY`: All questions resolved, all approval requests approved, zero blockers, readiness score 100%. Package is ready for human download or future export.
- **Version Carry-Forward**: When regenerating a package into Version $N + 1$, the service carries forward previously approved answers and user modifications, preserving human work while generating updated materials.
- **Dynamic Staleness Tracking**: Detects mutations to candidate profile, experiences, answer library, or job details, marking packages as stale (`isStale: true`) and alerting the candidate in the UI.

---

## 8. Application CRM, Lifecycle & Personal ATS Architecture (`JOB-P3-T02`)

The Application CRM provides the persistent lifecycle orchestration, audit tracking, recruiter contact management, and funnel analytics that transform the platform into a complete personal Applicant Tracking System:

```text
┌─────────────────────────────────────────────────────────────┐
│                      Job Lifecycle Flow                     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              Preparation & Application Studio               │
│  - DISCOVERED / ANALYZED / MATCHED / SKIPPED               │
│  - READY_TO_APPLY / NEEDS_REVIEW                            │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼ [Manual / Assisted Apply]
┌─────────────────────────────────────────────────────────────┐
│                     Submission Handshake                    │
│  - Transition to APPLYING -> APPLIED -> CONFIRMATION_RECEIVED│
│  - Freezes: submitted_package_version_id                    │
│             submitted_cv_artifact_id                        │
│             submitted_cover_letter_artifact_id              │
│  - Appends to application_lifecycle_events                  │
└──────────────────────────────┬──────────────────────────────┘
                               │
        ┌──────────────────────┴──────────────────────┐
        ▼                                             ▼
┌───────────────────────────────┐       ┌─────────────────────────────┐
│      Active Pipeline          │       │      Terminal Outcomes      │
│  - SCREENING                  │       │  - REJECTED                 │
│  - ASSESSMENT                 │       │  - WITHDRAWN                │
│  - INTERVIEW                  │       │  - EXPIRED                  │
│  - FINAL_INTERVIEW            │       │                             │
│  - OFFER                      │       │  (Reopen requires explicit  │
│  (Contacts, Rounds, Notes)    │       │   correction override)      │
└───────────────────────────────┘       └─────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                Application Analytics Engine                 │
│  - Conversion rates across pipeline stages                  │
│  - 0-denominator safe calculation (rate: null)              │
│  - Time-to-stage average durations                          │
│  - Source attribution breakdown                             │
└─────────────────────────────────────────────────────────────┘
```

### 8.1. Deterministic State Machine (`ApplicationStateMachine`)

- **Exact 17 Canonical States**:
  - Discovery & Intelligence: `DISCOVERED`, `ANALYZED`, `MATCHED`, `SKIPPED`
  - Preparation & Readiness: `READY_TO_APPLY`, `NEEDS_REVIEW`
  - Submission Execution: `APPLYING`, `APPLIED`, `CONFIRMATION_RECEIVED`
  - Active Pipeline: `SCREENING`, `ASSESSMENT`, `INTERVIEW`, `FINAL_INTERVIEW`, `OFFER`
  - Terminal Outcomes: `REJECTED`, `WITHDRAWN`, `EXPIRED`
- **Soft Archiving vs Hard Purge**: Applications support soft archiving (`is_archived: true`, `archived_at: timestamp`) which hides opportunities from active Kanban/pipeline views without deleting historical audit timeline events or frozen submission provenance. Deliberate destruction is separated into explicit `DELETE /api/applications/:id/purge`.
- **Realistic Progression & Skipping**: The state machine allows realistic fast-track transitions (e.g. `APPLIED` skipping directly to `INTERVIEW` when screening is bypassed by the recruiter, or direct transition to `APPLIED` for manual submissions).
- **Terminal State Protection & Correction Overrides**: Once in a terminal state (`REJECTED`, `WITHDRAWN`, `EXPIRED`), normal forward transitions are blocked. If a recruiter follows up on a previously rejected role or an accidental status change was made, the state machine requires an explicit correction override (`isCorrection: true` and a non-empty `correctionReason`), which logs a `STATUS_CORRECTION` audit event.

### 8.2. Frozen Submission Provenance Model

- When marking an application as `APPLIED`, the system captures and freezes the exact package version ID and artifact IDs (`submitted_package_version_id`, `submitted_cv_artifact_id`, `submitted_cover_letter_artifact_id`).
- Even if the candidate later generates Version $N + 1$ in the Application Studio, the CRM record retains an immutable historical link to the exact documents that were actually sent to the employer.
- Supports direct, manual application recording without requiring an Application Studio package (package fields remain nullable).

### 8.3. Sub-Entities & Recruiter Management

- **Notes (`application_notes`)**: Chronological candidate notes, interview prep insights, and context logs.
- **Contacts (`application_contacts`)**: Recruiter, hiring manager, and interviewer profiles with titles, email, phone, and LinkedIn URLs.
- **Assessments (`application_assessments`)**: Online tests, take-home projects, status tracking, deadline monitoring, and result evaluations.
- **Interviews (`application_interviews`)**: Multi-round interview tracking with format, scheduled timestamps, interviewer names, and feedback notes.
- **Offers (`application_offers`)**: Compensation details (currency, base salary, bonus, equity), expiration deadlines, and candidate response tracking (`PENDING`, `ACCEPTED`, `DECLINED`, `NEGOTIATING`, `RESCINDED`).

### 8.4. Append-Only Lifecycle Event Timeline (`application_lifecycle_events`)

- Every status change, manual submission note, correction override, or package linkage appends an immutable event to `application_lifecycle_events`.
- Events capture `previous_status`, `new_status`, `trigger` (`MANUAL`, `AUTOMATED`, `EMAIL_SYNC`, `SYSTEM`), `actor` (`USER`, `AGENT`, `SYSTEM`), and reason details.

### 8.5. Funnel Analytics Engine (`ApplicationAnalyticsEngine`)

- Computes pipeline metrics across core funnel stages (`TOTAL`, `APPLIED`, `SCREENING`, `INTERVIEW`, `OFFER`).
- Implements zero-denominator division safeguards (`rate: null` when denominator is 0) to avoid `NaN` anomalies.
- Calculates average duration metrics (days from applied to screening, interview, and offer) and source attribution distribution.

---

## 9. Email Intelligence & Communication Layer Architecture (`JOB-P4-T01`)

The Email Intelligence subsystem forms the system's external sensory organ, connecting inbound email communications with the Application CRM, Candidate Brain, and Job Ingestion pipelines.

```text
┌──────────────────────────────────────────────────────────────┐
│                    Inbound Email Flow                        │
├──────────────────────────────────────────────────────────────┤
│ 1. OAuth Provider (GmailProvider / FixtureEmailProvider)     │
│    - Minimal read-only scope (gmail.readonly)                │
│    - AES-256-GCM token encryption with SHA-256 derived key   │
│    - HMAC-SHA256 CSRF state token with 15-minute TTL         │
├──────────────────────────────────────────────────────────────┤
│ 2. Safe MIME Parsing & Sanitization (MimeParser)             │
│    - Strips quote history & legal disclaimers                │
│    - Cheerio-based HTML to plain text extraction             │
│    - Computes SHA-256 message content hash                   │
├──────────────────────────────────────────────────────────────┤
│ 3. Dual Classification Engine                                │
│    - High-precision deterministic regex & heuristics         │
│    - Fallback: Structured Gemini AI prompt with Zod schema   │
│    - 13 canonical categories (CONFIRMATION, REJECTION, etc.) │
├──────────────────────────────────────────────────────────────┤
│ 4. Multi-Stage Entity Resolution (EmailEntityResolver)       │
│    - Stage 1: External Reference ID / ATS URLs               │
│    - Stage 2: Thread Memory (email_thread_links)             │
│    - Stage 3: Recruiter Contact Email (application_contacts) │
│    - Stage 4: Exact/Fuzzy Company & Job Title Matching       │
├──────────────────────────────────────────────────────────────┤
│ 5. Job Alert Ingestion (JobAlertParser)                      │
│    - Extracts structured listings (title, company, URL)      │
│    - Ingests into canonical JobService with deduplication    │
├──────────────────────────────────────────────────────────────┤
│ 6. Deterministic Policy & CRM Synchronization                │
│    - Conservative thresholds (CONFIRMATION >= 0.90,          │
│      ASSESSMENT >= 0.90, INTERVIEW >= 0.90)                  │
│    - Conservative Rejection Invariant (>= 0.95 + EXACT MATCH)│
│    - State mutations execute via ApplicationStateMachine     │
│    - Audit events appended to application_lifecycle_events   │
├──────────────────────────────────────────────────────────────┤
│ 7. Human Review Queue (EmailReviewService)                   │
│    - High-stakes events (OFFER_LETTER) route to human review │
│    - Ambiguous or low-confidence matches flagged             │
│    - Resolutions: APPROVE (updates CRM & thread link),       │
│      DISMISS, or REJECT                                      │
└──────────────────────────────────────────────────────────────┘
```

### 9.1. Provider Abstraction & Cryptographic Security

- **`EmailProvider` Contract**: Common interface (`getAuthorizationUrl`, `exchangeCodeForTokens`, `refreshTokens`, `fetchMessages`, `fetchMessageDetail`) implemented by `GmailProvider` and `FixtureEmailProvider`.
- **At-Rest Token Encryption (`TokenCryptoService`)**:
  - Encrypts access, refresh, and ID tokens using authenticated AES-256-GCM with a 96-bit random IV and 128-bit authentication tag.
  - Encryption key is validated on startup for minimum length (>= 32 chars) and entropy (>= 8 unique characters), derived deterministically via SHA-256 from `EMAIL_TOKEN_ENCRYPTION_KEY`.
  - Serialized as versioned envelope: `v1:primary:<ivBase64url>:<tagBase64url>:<ciphertextBase64url>`. Key rotation is supported via explicit key ID tags. Plaintext tokens are never stored in PostgreSQL or logged.
  - Decryptor validates version prefixes and rejects unsupported envelopes (`v2:`) while maintaining backwards-compatible support for legacy JSON envelopes.
- **Persistent CSRF State Defense (`OAuthStateService` & `oauth_states`)**:
  - Signs OAuth state parameters using HMAC-SHA256 (`{ userId, nonce, expiresAt, provider }`).
  - Enforces a 15-minute maximum time-to-live.
  - Nonce hashes are persisted in PostgreSQL table `oauth_states` and consumed atomically (`UPDATE ... WHERE consumed_at IS NULL ... RETURNING *`), defeating state replay and injection attacks even across API restarts.
- **Sync Concurrency Control & Mutex**:
  - Prevents race conditions during email polling via atomic lock on `email_accounts.is_syncing` and `sync_locked_at` with a 5-minute stale-lock threshold.
  - Rejects overlapping sync invocations with HTTP 409 Conflict (`AppError.conflict`).
- **Safe Account Disconnect**:
  - `DELETE /api/email/accounts/:id` neutralizes credentials and marks the account `DISCONNECTED` while preserving normalized message records (`email_messages`), sync runs (`email_sync_runs`), and review queue history. Hard deletion is reserved for explicit `?purge=true`.

### 9.2. Safe MIME Parsing & Ingestion Hygiene

- **MimeParser (`MimeParser`)**:
  - Decodes base64/quoted-printable MIME payloads.
  - Normalizes headers (`Subject`, `From`, `To`, `Date`, `Message-ID`, `In-Reply-To`, `References`).
  - Strips reply quotes (`On ... wrote:`, `> ...`) and corporate disclaimer footers.
  - Sanitizes HTML bodies via `cheerio` to extract clean textual content while neutralizing script tags, tracking pixels, and malicious markup.
  - Computes SHA-256 `content_hash` over body text for idempotent storage.

### 9.3. 13-Category Classification Engine

- Evaluates emails against an explicit 13-category taxonomy:
  `APPLICATION_CONFIRMATION`, `APPLICATION_REJECTION`, `INTERVIEW_INVITATION`, `ASSESSMENT_INVITATION`, `OFFER_LETTER`, `RECRUITER_OUTREACH`, `STATUS_UPDATE`, `ACTION_REQUIRED`, `JOB_ALERT`, `NEWSLETTER_OR_MARKETING`, `REJECTION_FOLLOWUP`, `WITHDRAWAL_CONFIRMATION`, `SPAM_OR_IRRELEVANT`.
- **Hybrid Pipeline (`EmailClassificationEngine`)**:
  - Deterministic classifier (`DeterministicEmailClassifier`) executes first using high-precision regular expressions and ATS headers.
  - When deterministic confidence is insufficient (< 0.85), falls back to structured LLM classification (`AiEmailClassifier`) powered by Gemini with Zod output validation.

### 9.4. Multi-Stage Entity Resolution & Thread Memory

- Resolves which application, job, or recruiter contact an inbound email belongs to via hierarchical matching stages (`EmailEntityResolver`):
  1. `EXTERNAL_REF`: ATS requisition IDs, portal application URLs, or reference numbers.
  2. `THREAD_LINK`: Matches existing `email_thread_links` created by previous messages or human approvals.
  3. `CONTACT_EMAIL`: Sender email matches a recorded `application_contacts` record.
  4. `COMPANY_AND_ROLE`: Normalized company and job title token matching against active applications.
  5. `COMPANY_ONLY` / `UNKNOWN`: Weaker matches flagged for review.

### 9.5. Conservative State Synchronization & Policy Guardrails

- Enforces the Prime Directive: **AI evaluates and prepares. Rules authorize. Humans handle uncertainty.**
- **Safe Auto-Sync**:
  - `APPLICATION_CONFIRMATION` (confidence >= 0.90) transitions `APPLIED` → `CONFIRMATION_RECEIVED`.
  - `ASSESSMENT_INVITATION` (confidence >= 0.90) transitions to `ASSESSMENT`.
  - `INTERVIEW_INVITATION` (confidence >= 0.90) transitions to `INTERVIEW`.
- **Conservative Rejection Invariant**:
  - Rejections require confidence >= 0.95 AND an exact match (`EXTERNAL_REF` or `COMPANY_AND_ROLE`).
  - Any rejection with lower confidence or fuzzy match is routed to `email_review_items` with `riskLevel: 'HIGH'`. Automatic rejection is never executed on ambiguous data.
- **High-Stakes Offers**:
  - `OFFER_LETTER` events are always routed to the review queue for human confirmation.
- **Audit Preservation**:
  - All status mutations execute through `ApplicationStateMachine` and append an immutable event to `application_lifecycle_events` with trigger `EMAIL_SYNC` and actor `SYSTEM`.

### 9.6. Job Alert Ingestion

- `JobAlertParser` parses job boards and aggregator digests (e.g. LinkedIn, Indeed, Otta, Arbeitnow).
- Ingests opportunities directly into canonical `JobService` with source attribution and deduplication against existing postings.

### 9.7. Review Queue & Thread Memory Linking

- Unresolved, low-confidence, or high-risk emails produce `email_review_items`.
- When a human user approves a review item (`POST /api/emails/review/:id/resolve` with action `APPROVE`):
  - The suggested status transition is applied to the application.
  - An entry in `email_thread_links` is created/updated so that all future emails in that thread automatically resolve to the application without manual intervention.

---

## 11. Authentication, Identity Management & Multi-Tenant Isolation (`JOB-AUTH-01`)

The identity management subsystem integrates **Better Auth** as the authoritative identity and session layer across the Jobee stack, transitioning the platform from a single-user prototype to a multi-user, tenant-isolated application supporting invite-only private pilot onboarding.

```text
┌─────────────────────────────────────────────────────────────┐
│                    Web Frontend (React 19)                  │
│  - Better Auth React Client (`@better-auth/react`)          │
│  - AuthModal: Google OAuth, Email/Password, Invite Code     │
│  - Session Status Pill & Pilot Invitations Admin Modal       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼ [HTTP with Session Cookies / Bearer]
┌─────────────────────────────────────────────────────────────┐
│                   Fastify API (`authPlugin`)                │
│  - Intercepts `/api/auth/*` -> Better Auth Node handler     │
│  - Extracts session from cookie or Bearer authorization     │
│  - Binds User Context to Node.js `AsyncLocalStorage`        │
│  - Provides `getCurrentUserId()` to all downstream services  │
│  - Enforces `requireAuth` (401) and `requireAdmin` (403)    │
└──────────────────────────────┬──────────────────────────────┘
                               │
        ┌──────────────────────┴──────────────────────┐
        ▼                                             ▼
┌───────────────────────────────┐       ┌─────────────────────────────┐
│     Better Auth Engine        │       │   Multi-Tenant Domain Core  │
│  - Drizzle ORM Adapter        │       │  - Candidate Brain CRUD     │
│  - Google Social Provider     │       │  - Job Ingestion & Matches  │
│  - Email & Password Provider  │       │  - Application Packages     │
│  - Transactional Email Service│       │  - Application CRM Pipeline │
│  - `databaseHooks.user.create`│       │  - Email & Calendar Sync    │
│    (Invite code verification  │       │  - Browser Worker Runs      │
│     & Workspace auto-seeding) │       │  (All scoped to tenant ID)  │
└───────────────────────────────┘       └─────────────────────────────┘
```

### 11.1. Core Identity & Session Model
- **Better Auth Framework**: Built on Better Auth (`better-auth`) with PostgreSQL persistence via Drizzle ORM adapter.
- **Dual Authentication**:
  1. **Google OAuth 2.0**: Native sign-in and account linking for modern browser workflows.
  2. **Email & Password**: Secure password hashing with scrypt, email verification tokens, and forgot-password flows.
- **Transactional Delivery (`TransactionalEmailService`)**: Integrated Resend email client (`RESEND_API_KEY`) for delivering verification codes and password reset links, with structured console fallback for local development.

### 11.2. Multi-Tenant Workspace Isolation
- **AsyncLocalStorage Context Propagation**: Node.js `AsyncLocalStorage` (`requestUserContext`) stores the authenticated user's ID during Fastify request lifecycle.
- **Tenant Scoping**: All database queries across candidate profiles, document vault, answer library, job inbox, match evaluations, application packages, CRM applications, email accounts, calendar accounts, and notifications are scoped to `getCurrentUserId()`.
- **Zero Cross-Tenant Leakage**: Users can only inspect and mutate their own workspace. Unauthenticated requests to protected endpoints receive HTTP 401 Unauthorized.

### 11.3. Invite-Only Private Pilot & Role-Based Access Control
- **Gated Registration**: When `INVITE_ONLY_REGISTRATION=true`, Better Auth's `user.create` hook requires a valid, pending invitation code from `pilot_invitations`.
- **Automatic Workspace Provisioning**: On successful registration, the user hook provisions the candidate's baseline profile, default job preferences, and application safety policy.
- **Admin Management (`PilotInvitationService`)**:
  - `POST /api/pilot/invitations`: Admins generate single-use invite codes with optional expiration and reserved email binding.
  - `GET /api/pilot/invitations`: Admins monitor active and redeemed invites.
  - `POST /api/pilot/invitations/:id/revoke`: Admins revoke pending invites.
- **Primary Candidate Preservation**: Legacy candidate `Asadbek Makhmudov` (`00000000-0000-0000-0000-000000000001`) retains 100% of historical data, verified facts, Master CV documents, and CRM records, and is assigned the `'admin'` role.

