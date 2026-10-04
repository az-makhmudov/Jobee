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
