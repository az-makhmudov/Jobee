# Jobee — Antigravity & AI Coding Agent Guidelines

This document provides mandatory operational instructions for Antigravity, Antigravity 2.0, and any AI coding agents working on the **Jobee** codebase (originally developed under the working name AI Job Agent).

---

## 0. Collaborative Delivery Workflow & Roles

- **ChatGPT**: Requirements planning, architecture discussions, macro-task decomposition, prompt generation, and completion report review.
- **Antigravity 2.0**: Repository inspection, coding, migrations, tests, lint/typecheck/build, documentation updates, and implementation reports.
- **User**: Strategic oversight, external account permissions/credentials, and authorizing external actions.

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
2. **Follow Official Roadmap**: Execute work aligned with the canonical roadmap; never skip uncompleted dependencies.
3. **Preserve Official Task Stamps**: Keep all work unified under the canonical macro-task stamp (e.g. `JOB-P0-T01`, `JOB-P1-T01`). Do not invent or fragment work into micro-task identifiers.
4. **Inspect Existing Architecture Before Editing**: Always inspect the existing workspace files, types, and git status before writing code.
5. **Prefer Coherent Macro-Task Implementations**: Own the entire vertical slice without gratuitous micro-commits or premature completion declarations.
6. **Avoid Unnecessary Dependencies**: Use existing workspace libraries and dependencies; do not introduce redundant packages.
7. **Never Fabricate Candidate Information**: Strict zero-tolerance invariant on hallucinating facts, metrics, or answers.
8. **Keep AI Recommendations Separate from Authorization**: Rules authorize; AI only suggests and drafts.
9. **Maintain Security and Privacy**: Ensure candidate data and tokens are protected with cryptographic envelopes and least privilege.
10. **Zero Secrets in Git**:
    - Never commit `.env` files, API keys, or OAuth credentials.
    - Ensure new configuration variables are documented in `.env.example` and validated via Zod in `packages/config/src/env.ts`.
11. **Run Mandatory Quality Gates Before Task Completion**:
    Every task must be verified with:
    ```bash
    npm run lint
    npm run typecheck
    npm run test
    npm run build
    ```
12. **Update Documentation After Implementation**: When architecture or data models change, update corresponding documents in `docs/` and log the milestone in `docs/TASK_LOG.md`.
13. **Produce Structured Completion Reports**: After each task, output a structured report detailing scope, status, verification, and next steps.

---

## 3. Canonical Project Context & Documentation

Canonical project context lives in `docs/` and root mirrors:

- `docs/MASTER_CONTEXT.md`: The authoritative product specification, principles, and roadmap definitions. (Root files `JOBEE_MASTER_CONTEXT.md` and legacy `AI_JOB_AGENT_MASTER_CONTEXT.md` are identical mirrors).
- `docs/ROADMAP.md`: Official milestone status tracker.
- `docs/RENAME_LOG.md`: Official record of project rebranding to Jobee on 2026-10-11.
- `docs/ARCHITECTURE.md`: High-level system architecture, boundaries, and tech stack.
- `docs/DATA_MODEL.md`: Schema, entity definitions, and relationship maps.
- `docs/SECURITY.md`: Security controls, encryption envelopes, and threat models.
- `docs/APPLICATION_POLICY.md` & `docs/AGENT_POLICY.md`: Policy engine and agent behavior limits.
- `docs/PRODUCT_COMPLETION_DIRECTIVE.md`: The authoritative enduring product completion directive, autonomy boundaries, and acceptance criteria.
- `docs/AUTONOMOUS_OPERATING_PLAN.md`: Autonomous development methodology and operating procedures.
- `docs/AUTONOMOUS_STATE.md`: Real-time durable progress, blocker, and execution state tracker.
- `docs/IMPLEMENTATION_BACKLOG.md`: Internal engineering backlog prioritized and maintained by the agent.
- `docs/OWNER_ACTIONS_REQUIRED.md`: Consolidated external dependencies and required human approvals.
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
