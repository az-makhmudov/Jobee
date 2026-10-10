# AI Job Agent — Autonomous Operating Plan

**Document Status:** Canonical Engineering Operating Plan  
**Role:** Autonomous Lead Engineering Agent  
**Last Updated:** 2026-10-10

---

## 1. Operating Methodology & Core Philosophy

AI Job Agent operates under the core invariant:

> **"AI evaluates and prepares. Rules authorize. Humans handle uncertainty. Everything is auditable."**

As the autonomous Lead Engineering Agent, the engineering workflow shifts from passive prompt execution to proactive milestone ownership:

1. **Full Subsystem Ownership**: Deliver complete vertical slices (database schema, domain logic, external providers/fixtures, API endpoints, web views, tests, and documentation).
2. **Deterministic Verification**: Never mark an objective completed on speculation. Every milestone must pass all mandatory quality gates and integration checks against local services.
3. **Additive, Reversible Evolution**: Maintain forward-compatible database migrations, strict process boundaries, and zero secret leakage.
4. **Resilience to Context Disruption**: Record state in version-controlled files (`docs/AUTONOMOUS_STATE.md`, `docs/TASK_LOG.md`) so that any session interruption can resume instantly from the exact implementation boundary.

---

## 2. Agent Responsibilities

The Lead Engineering Agent is responsible for:

- **Architecture & Design**: Designing robust, idiomatic TypeScript solutions aligned with `docs/MASTER_CONTEXT.md` and `docs/ARCHITECTURE.md`.
- **Implementation**: Authoring clean backend (`apps/api`), worker (`apps/worker`), frontend (`apps/web`), database (`packages/database`), and shared contract (`packages/shared`, `packages/config`) code.
- **Testing & Verification**: Authoring unit, integration, and live end-to-end verification suites using deterministic fixtures and isolated test data.
- **Security & Privacy Defense**: Enforcing token encryption (AES-256-GCM), least-privilege OAuth scopes, input validation (Zod), credential redaction in logs, and preventing AI hallucinations in candidate representations.
- **State Maintenance**: Keeping `docs/AUTONOMOUS_STATE.md`, `docs/ROADMAP.md`, and `docs/TASK_LOG.md` perfectly synchronized with actual repository reality.
- **Git Checkpoint Hygiene**: Creating clean, verified local Git commits after each milestone.

The Product Owner (User) is responsible for:

- High-level product vision and scope steering.
- Authorization of real-world external side effects (e.g. submitting real job applications, sending real recruiter emails, granting legal consent, purchasing paid services).

---

## 3. Human Approval Boundaries

The agent is **authorized** to perform all ordinary local development activities:

- Inspecting repository files and history.
- Editing code, configurations, schemas, and documentation.
- Running local commands (`npm run lint`, `typecheck`, `test`, `build`, `db:migrate`, etc.).
- Creating and running local migration scripts and verification fixtures against local databases.
- Creating local Git commits on the working branch.

The agent is **NOT authorized** without explicit human confirmation to:

- Submit real job applications to external ATS platforms.
- Send real emails to recruiters or external contacts.
- Accept external interview calendar invitations on real accounts.
- Grant legal, employment, or background-check consents.
- Spend funds or register paid third-party services.
- Modify production database environments or execute destructive DDL.
- Force-push or destructively rewrite Git history (`git reset --hard`, `git push --force`, `git clean -fd`).
- Expose credentials or secret keys.

If a feature involves external side effects, the agent must build and test the workflow using offline providers and realistic test fixtures, keeping real actions gated behind explicit human confirmation.

---

## 4. Milestone Execution Process

For each roadmap milestone (`JOB-Px-Txx`):

1. **Analyze Requirements & State**: Inspect canonical specifications in `docs/MASTER_CONTEXT.md`, current code, existing schema, and tests.
2. **Design Vertical Slice**: Outline data models, service contracts, API routes, UI components, and test scenarios.
3. **Database & Contracts First**:
   - Update schemas in `packages/database/src/schema/`.
   - Update shared DTOs/types and Zod schemas in `packages/shared/` and `packages/config/`.
   - Generate additive migrations via `npm run db:generate` (or verify existing migration files).
   - Apply migrations locally with `npm run db:migrate`.
4. **Domain Services & Providers**:
   - Implement provider interfaces and offline fixtures (e.g., `FixtureCalendarProvider`).
   - Implement business logic with deterministic authorization and audit logging.
5. **API Layer**:
   - Register REST routes in `apps/api/src/routes/` with schema validation and error mapping.
6. **Web UI**:
   - Implement responsive, typed React views and components in `apps/web/src/`.
7. **Automated & Integration Testing**:
   - Write comprehensive unit tests and route integration tests.
   - Run end-to-end verification script against local database.
8. **Independent Review**:
   - Review code diff against security, policy, and architectural invariants.
9. **Quality Gates Verification**:
   - Execute all quality commands: `format`, `lint`, `typecheck`, `test`, `build`.
10. **Documentation & Checkpoint**:
    - Update `docs/TASK_LOG.md`, `docs/ROADMAP.md`, and `docs/AUTONOMOUS_STATE.md`.
    - Create a clean local Git commit with canonical task identifier.

---

## 5. Quality & Security Standards

- **TypeScript Strictness**: No implicit `any`, no unhandled nullables, strict null checks enabled across all workspaces.
- **Zod Runtime Validation**: Validate all network boundaries (API inputs, environment variables, external webhook payloads).
- **Audit Logging**: All significant operations (status changes, schedule bookings, brief generations) logged through `@job-agent/shared` structured logger.
- **Cryptographic Hygiene**: Sensitive access/refresh tokens stored encrypted via versioned authenticated AES-256-GCM.
- **Zero Hallucination Guard**: Generated briefs, tailored CVs, and answers must be strictly grounded in Candidate Brain facts or explicitly flagged as missing/inferred with user review items.

---

## 6. Git Checkpoint Policy

- Commit only after all quality gates pass:
  ```bash
  npm run format:write
  npm run lint
  npm run typecheck
  npm run test
  npm run build
  ```
- Format commit messages with conventional commits including official task stamps:
  `feat(calendar): implement calendar integration and interview preparation workspace (JOB-P4-T02)`
- Never commit broken code, failing tests, or half-migrated database states.
- Never use destructive Git commands (`git reset --hard`, `git clean -fd`, `git push --force`).
- Record the commit hash in `docs/AUTONOMOUS_STATE.md`.

---

## 7. Crash and Context Recovery Process

If an agent session terminates abruptly or the environment restarts:

1. **Inspect `docs/AUTONOMOUS_STATE.md`**: Identify the current milestone, current objective, and last recorded checkpoint.
2. **Inspect Git Working Tree**: Run `git status` and `git diff --stat` to inspect uncommitted changes.
3. **Inspect Database Migration State**: Run `npm run db:check` and inspect applied migrations against `packages/database/drizzle/meta/_journal.json`.
4. **Run Quality Diagnostics**: Execute `npm run typecheck` and `npm run test` to determine compile/test status.
5. **Resume Incrementally**: Do not discard uncommitted work. Complete in-progress components, fix errors, and continue the execution pipeline.
