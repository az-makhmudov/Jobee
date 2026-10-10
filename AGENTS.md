# Antigravity & AI Coding Agent Guidelines

This document provides mandatory operational instructions for Antigravity, Antigravity 2.0, and any AI coding agents working on the AI Job Agent codebase.

---

## 1. Prime Directive & Core Invariant

> **AI evaluates and prepares. Rules authorize. Humans handle uncertainty. Everything is auditable.**

- **NEVER invent candidate facts**: Never hallucinate qualifications, past employers, degrees, dates, skills, citizenship, salary requirements, or answers.
- **Deterministic authorization over AI discretion**: Auto-applying or mutating external systems requires explicit, deterministic rule authorization.
- **Escalate uncertainty**: Ambiguous answers or missing candidate fields must produce human review items, not AI guesses.
- **Full audit trail**: All generative suggestions, evaluations, and submissions must be logged with timestamped context.

---

## 2. Agent Workflow & Execution Rules

1. **Read Master Context**: Before commencing work on any feature or macro-task, inspect `docs/MASTER_CONTEXT.md` and related documents in `docs/`.
2. **Preserve Official Task Stamps**: Keep all work unified under the canonical macro-task stamp (e.g. `JOB-P1-T01`, `JOB-P1-T02`). Do not invent or fragment work into micro-task identifiers.
3. **Inspect Before Editing**: Always inspect the existing workspace files, types, and git status before writing code.
4. **Avoid Unrelated Refactoring**: Focus strictly on the scope of the assigned macro-task. Do not gratuitously reformat or refactor unrelated files.
5. **Database Migration Hygiene**:
   - Migrations must be generated with `npm run db:generate`.
   - Never write raw unmanaged DDL scripts.
   - Never drop columns or tables without reviewable forward-compatible deprecation paths.
   - Never modify production data casually.
6. **Zero Secrets in Git**:
   - Never commit `.env` files or API keys.
   - Ensure new configuration variables are documented in `.env.example` and validated via Zod in `packages/config/src/env.ts`.
7. **Strict Process Boundaries**:
   - Keep `apps/api`, `apps/worker`, and `apps/web` separated.
   - Do not import frontend modules into backend services or vice-versa.
   - Prepare for future Playwright browser automation to run exclusively in an isolated worker sandbox.
8. **Structured Logging Only**:
   - Do not use raw `console.log` in production code. Use the structured logger from `@job-agent/shared`.
   - Ensure the redaction filter protects tokens and credentials.
9. **Mandatory Quality Gates Before Task Completion**:
   Every task must be verified with:
   ```bash
   npm run lint
   npm run typecheck
   npm run test
   npm run build
   ```
10. **Documentation Sync**: When architecture or data models change, update corresponding documents in `docs/` and log the milestone in `docs/TASK_LOG.md`.

---

## 3. Canonical Project Context & Documentation

Canonical project context lives exclusively in `docs/`:

- `docs/MASTER_CONTEXT.md`: The authoritative product specification, principles, and roadmap definitions. (Note: root file `AI_JOB_AGENT_MASTER_CONTEXT.md` is an identical mirror and must be kept in sync).
- `docs/ROADMAP.md`: Official milestone status tracker.
- `docs/ARCHITECTURE.md`: High-level system architecture, boundaries, and tech stack.
- `docs/DATA_MODEL.md`: Schema, entity definitions, and relationship maps.
- `docs/SECURITY.md`: Security controls, encryption envelopes, and threat models.
- `docs/APPLICATION_POLICY.md` & `docs/AGENT_POLICY.md`: Policy engine and agent behavior limits.
- `docs/AUTONOMOUS_OPERATING_PLAN.md`: Autonomous development methodology and operating procedures.
- `docs/AUTONOMOUS_STATE.md`: Real-time durable progress, blocker, and execution state tracker.
- `docs/TASK_LOG.md`: Chronological milestone delivery audit and verification logs.

---

## 4. Autonomous Milestone Execution

1. **Choosing Work**: Inspect `docs/ROADMAP.md` and `docs/AUTONOMOUS_STATE.md`. Pick the earliest milestone marked `PENDING` or `IN PROGRESS`. Never skip uncompleted earlier milestones.
2. **Autonomous Delivery**: Own the entire vertical slice without prompting the Product Owner for routine development steps. Deliver database changes, backend logic, external provider abstractions/fixtures, REST endpoints, React views, and automated tests.
3. **Continuity**: Once a milestone is verified and committed, immediately update durable state and proceed to the next milestone in sequence.

---

## 5. Verification & Quality Gates

Before declaring any milestone complete, execute the full suite of quality gates:

```bash
npm run format:write
npm run lint
npm run typecheck
npm run test
npm run build
npm run format
npm run db:check
npm run db:migrate
```

Run dedicated end-to-end integration verification scripts (e.g. `scripts/verify-*.ts`) against real local services with isolated test fixtures. Never delete real user data.

---

## 6. Subagent Delegation & Code Review

When using subagents:

- Delegate self-contained research, audits, or isolated component implementations with clear scopes and prompt requirements.
- Never have multiple agents write concurrently to overlapping files.
- Before committing, perform an independent review of diffs covering:
  1. Prime Directive & Truthfulness compliance.
  2. Security boundaries (zero plaintext tokens, Zod validation, least privilege).
  3. Clean error handling and structured logging.
  4. Process boundary integrity.

---

## 7. Durable Progress & State Maintenance

Durable state must not rely on conversation memory:

- Keep `docs/AUTONOMOUS_STATE.md` updated with the active milestone, last commit, known issues, and next action.
- Update `docs/TASK_LOG.md` upon completion of each milestone with full verification records.
- Synchronize `docs/ROADMAP.md` status flags (`COMPLETED`, `IN PROGRESS`, `PENDING`).

---

## 8. Git Checkpoint Standards

- Commit only after all quality gates pass cleanly.
- Use conventional commit messages referencing the official task stamp:
  `feat(subsystem): concise description (JOB-PX-TXX)`
- Record the commit hash in `docs/AUTONOMOUS_STATE.md`.
- Never execute destructive Git commands: `git reset --hard`, `git clean -fd`, or `git push --force`.

---

## 9. Human Authorization Boundaries

The agent is authorized for local autonomous development. The agent is **NEVER** authorized to perform real external actions without explicit human approval:

- Submitting real applications to external ATS platforms.
- Sending real outbound recruiter emails.
- Accepting external calendar invites on real accounts.
- Granting legal/background consents.
- Incurring paid service charges.
- Modifying production infrastructure or databases.

Offline simulated providers (such as `FixtureCalendarProvider` and `FixtureEmailProvider`) must be used for automated tests.

---

## 10. Crash & Interruption Recovery

When starting in an existing or interrupted session:

1. Read `docs/AUTONOMOUS_STATE.md`.
2. Inspect `git status` and `git diff --stat` to detect uncommitted work.
3. Check database health (`npm run db:check`) and applied migrations.
4. Run `npm run typecheck` and `npm run test` to evaluate codebase health.
5. Resume implementation directly from the identified boundary without restarting completed subsystems.
