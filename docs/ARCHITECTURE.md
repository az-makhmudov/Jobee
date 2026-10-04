# AI Job Agent — System Architecture

## 1. Overview & Monorepo Topology

AI Job Agent is built as a TypeScript-first monorepo using npm workspaces. The architecture establishes strict boundaries between user interface, HTTP API, background processing, data persistence, and shared primitives.

```text
ai-job-agent/
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

## 5. Future Architecture Isolation (Playwright Browser Worker)

When browser automation (JOB-P5-T01 / JOB-P5-T02) is implemented:

- Automation will run in a dedicated, sandboxed worker process (`apps/browser-worker`).
- Headless Chromium/Firefox instances and Playwright binaries will remain completely segregated from the primary API runtime to prevent resource exhaustion, zombie browser leaks, and memory bloat.
