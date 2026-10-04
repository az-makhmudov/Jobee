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

- **Macro-Task**: `JOB-P1-T02 — Candidate Brain, Documents, Answer Library & Preferences` (COMPLETED).
- **Milestone Reached**: Complete Phase 1 Platform & Candidate Brain foundation operational.
- **Next Milestone**: `JOB-P2-T01 — Job Ingestion, Parsing, Normalization & Job Inbox`.
