# AI Job Agent

AI Job Agent is a single-user personal AI job-search and application platform designed to automate the discovery, evaluation, tailoring, tracking, and lifecycle management of job applications. Built around the core invariant—**"AI evaluates and prepares. Rules authorize. Humans handle uncertainty. Everything is auditable."**—the system uses AI to analyze requirements and draft tailored materials while enforcing strict deterministic authorization and zero tolerance for hallucinated candidate facts.

---

## Repository Structure

```text
ai-job-agent/
├── apps/
│   ├── web/              # React 19 + Vite 8 frontend application shell
│   ├── api/              # Fastify 5 REST API with Candidate Brain & health endpoints
│   └── worker/           # Background processing engine (isolated process)
├── packages/
│   ├── config/           # Centralized environment validation (Zod)
│   ├── database/         # PostgreSQL schema, Drizzle ORM & migration engine
│   └── shared/           # Core DTOs, completeness engine, storage, AppError, logger
├── docs/                 # Authoritative architecture, data model, and ADRs
└── .github/workflows/    # CI quality pipeline
```

---

## Prerequisites

- **Node.js**: v24 LTS or later (verified compatible with v24 / v25)
- **npm**: v10 or later
- **PostgreSQL**: v15 or later (local instance or hosted Neon PostgreSQL)

---

## Installation & Setup

1. **Clone the repository**:

   ```bash
   git clone <repo-url>
   cd "Job Agent"
   ```

2. **Install workspace dependencies**:

   ```bash
   npm install
   ```

3. **Configure Environment**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` to provide your PostgreSQL connection string (`DATABASE_URL`).

---

## Local Development

Run all services concurrently (API, Worker, Web):

```bash
npm run dev
```

Or run individual services:

```bash
npm run dev:api     # Backend API on http://127.0.0.1:3000
npm run dev:worker  # Background processing engine
npm run dev:web     # React frontend on http://localhost:5173
```

---

## Candidate Brain Architecture (`JOB-P1-T02`)

The Candidate Brain is the authoritative structured truth source that all future job matching and application generation will use:

- **Deterministic Single-User Identity**: Resolves primary candidate deterministically via `system_key: 'default_primary_candidate'` with UUID `00000000-0000-0000-0000-000000000001`.
- **Structured Profile Entities**: Normalized storage for Candidate Profile, Experience, Education, Projects, Skills, Languages, Certifications, and Professional Links.
- **Explicit Candidate Facts**: Discrete atomic assertions with verification status and `allowAiUse` boolean permission gate. AI models may never invent facts.
- **Document Vault**: Local file storage abstraction (`LocalStorageProvider`) supporting Master CV and role variants with strict MIME validation (PDF, DOCX, TXT), 10MB limit, SHA-256 checksums, and Git-excluded storage (`uploads/`).
- **Answer Library**: Curated responses with automation tiers:
  - `AUTO`: Safe for automated submission (sensitive answers require explicit `VERIFIED` status to qualify for `AUTO`).
  - `REVIEW`: Pre-fill but require human confirmation.
  - `MANUAL`: Never pre-fill; always prompt candidate.
  - `isSensitive`: Flags sensitive demographic/salary fields requiring manual sign-off.
- **Job Preferences & Safety Policy**: Structured target roles, locations, work modes (Remote/Hybrid/Onsite), salary ranges, and safety interlocks. Auto-apply is **disabled by default**.
- **Completeness Engine**: Deterministic 100-point algorithm across 7 weighted profile categories.
- **Candidate Audit Log**: Immutable, privacy-preserving record of all entity mutations tracking changed field names and safe operational metadata (zero PII snapshots).

---

## Job Ingestion, Normalization & Inbox (`JOB-P2-T01`)

The Job Ingestion subsystem provides safe, deterministic ingestion and canonical storage for all prospective job postings:

- **Safe HTTP Retrieval**: Defensive `HttpRetrievalService` with comprehensive SSRF protection (blocks loopback, RFC1918 private subnets, carrier-grade NAT, cloud metadata 169.254.169.254, validates all DNS IPs, manual redirect hop inspection, 8s timeout, 2MB size cap).
- **Specialized ATS Extractors**: Dedicated extractors for Greenhouse, Lever, Ashby, Schema.org `JobPosting` JSON-LD, and LinkedIn auth-wall recognition, plus unstructured manual text extraction.
- **Conservative Normalization**: Deterministic URL canonicalization (stripping tracking query tags), workplace mode classification, employment types, seniority levels, locations, and salary ranges.
- **Requirement Model Hardening**: Strict separation between requirement category (`SKILL`, `EXPERIENCE`, `EDUCATION`, etc.) and requirement strength (`MANDATORY`, `PREFERRED`, `UNKNOWN`). Responsibilities are preserved in structured sections and excluded from mandatory hiring requirements. Each requirement links to its provenance via `source_id` and `source_section`.
- **Tri-Level Deduplication**: SHA-256 content fingerprinting (`contentHash`), canonical URLs, and provider external IDs. Idempotent re-ingestion appends duplicate provenance records with zero duplicate job proliferation while safely preserving similar-but-distinct positions.
- **Raw HTML Discard Policy & Provenance**: Raw HTML payloads are discarded (`raw_payload = null`) on successful extraction to minimize attack surface and storage bloat. Normalized `raw_text`, source headers, and parsed sections are immutably archived. Manual corrections update normalized columns while keeping source truth auditable.
- **Job Inbox & UI**: Responsive Job Inbox with status and provider filters, search, metrics ribbon, Add Job modal (URL import and pasted text), and Job Detail view (with categorized requirements, strength badges, and source section pills).

---

## Requirement Analysis, Matching & Policy Decision Engine (`JOB-P2-T02`)

The matching engine provides the intelligence and authorization layer that evaluates job postings against the Candidate Brain:

- **Strict Prime Invariant**: AI evaluates and prepares. Rules authorize. Humans handle uncertainty. Everything is auditable. Zero hallucinated candidate facts are permitted.
- **Grounded Evidence Resolution**: Maps requirements deterministically to verified candidate skills, language CEFR rankings, cumulative experience durations, degrees, and certifications.
- **Deterministic Hard Policy Engine**: Enforces mandatory blockers (excluded companies, excluded keywords, prohibited workplace modes, unpaid roles, below-minimum compensation, sponsorship conflicts) with automated `SKIP` decisions, and flags missing sensitive policy data for human `REVIEW`.
- **Dimensional Scoring Engine (`v1.0.0`)**: Computes fit across 8 dimensions (`ROLE_FIT`, `SKILLS_FIT`, `EXPERIENCE_FIT`, `EDUCATION_FIT`, `LOCATION_FIT`, `LANGUAGE_FIT`, `COMPENSATION_FIT`, `WORK_AUTHORIZATION_FIT`) with dynamic re-weighting for unknown dimensions, mandatory requirement penalties, confidence scoring (0-100), and preliminary auto-apply eligibility (never auto-fires).
- **Anti-Hallucination AI Provider Abstraction**: Pluggable provider interface (`DisabledAiProvider`, `MockAiProvider`, `GeminiAiProvider`) with a strict validation guard that strips invented evidence IDs and demotes ungrounded claims to `UNKNOWN`.
- **Reactive Staleness Engine**: SHA-256 input fingerprinting invalidates match analyses whenever candidate credentials or job data change.
- **Bounded Batch Processing**: Bounded 1-50 batch execution with failure isolation.
- **User Interface**: Full Match Analysis inspector in `JobDetailView` (KPI ribbon, hard blocker alerts, strengths/gaps/unknowns, dimension cards, grounded requirement table with evidence pills), matching filters and quick analyze in `JobInboxView`, and matching metrics in `DashboardView`.

---

## Application Studio, Tailored Materials & Human Approval (`JOB-P3-T01`)

The Application Studio orchestrates the generation, tailoring, screening question resolution, and human sign-off for prospective job applications:

- **Versioned Application Packages**: Full lifecycle package management (`DRAFT`, `NEEDS_REVIEW`, `READY`) with immutable numbered versions (`application_package_versions`) tracking tailored CVs, cover letters, readiness scores, and validation issues.
- **ATS-Safe Single-Column DOCX Documents**: Programmatic generation of ATS-friendly `.docx` files using the `docx` engine, avoiding complex tables or columns that break applicant tracking parsers. Automatically produces companion plain `.txt` files with SHA-256 checksums.
- **Truthful CV Tailoring & Metric Safeguards**: Factual history (dates, employers, titles, degrees) is strictly immutable. Relevant bullet points are reordered and highlighted based on match evidence (`evidenceIds`). Quantitative figures and metrics are cross-checked against Candidate Brain achievements to prevent exaggeration.
- **Grounded Cover Letter Engine**: Concise, professional cover letters composed directly from candidate facts, articulating clear alignment to the job role without synthetic claims.
- **4-Level Question Resolution Hierarchy**: Application questions resolve through `AUTO` (exact Answer Library match), `REVIEW` (inferred/draft response), `MANUAL` (prompts candidate for input), or `UNRESOLVED` (blocking). Sensitive categories (`WORK_AUTHORIZATION`, `SPONSORSHIP`, `SALARY`) unconditionally require explicit human sign-off.
- **Human Approvals Queue**: Global approval queue (`/approvals`) allowing candidates to review, edit, or reject sensitive declarations and answers before any package reaches `READY`.
- **Dynamic Staleness & Version Carry-Forward**: Fingerprint-based staleness invalidates packages when candidate credentials or job data change. Regenerating into Version $N + 1$ carries forward previously approved answers to prevent duplicate human review.
- **User Interface**: Complete Application Studio (`ApplicationStudioView`) with readiness dashboard, live CV preview, cover letter editor, question manager, approvals tab, and evidence inspector; Global Approvals Inbox (`ApprovalsInboxView`); and Packages List (`ApplicationPackagesListView`).

---

## Database & Migrations

```bash
npm run db:generate # Generate SQL migrations from Drizzle schema
npm run db:migrate  # Apply pending migrations to PostgreSQL
npm run db:check    # Verify database connectivity and latency
```

---

## Code Quality & Verification

```bash
npm run lint        # Run ESLint across all workspaces
npm run typecheck   # Typecheck TypeScript across all packages and apps
npm run test        # Run Vitest test suites
npm run build       # Build all packages and applications
npm run format      # Check code formatting with Prettier
```

---

## Current Status

- **Macro-Task**: `JOB-P3-T01 — Application Studio, Tailored Materials & Human Approval` (COMPLETED).
- **Milestone Reached**: Phase 3 Application Studio fully implemented and verified against live PostgreSQL database. Tailored ATS-safe materials, 4-level question resolution, human approval queue, and package readiness state machine are operational.
- **Next Milestone**: `JOB-P3-T02 — Application CRM, Lifecycle, Audit Timeline & Analytics`.
