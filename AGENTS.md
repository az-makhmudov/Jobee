# Jobee — coding agent instructions

Applies to Codex, Antigravity and any other coding agent working in this repository. Codex currently owns engineering; no agent handoff is required. The owner approved phase-by-phase local roadmap implementation on 2026-10-20. The current request determines the active scope: complete that scope before continuing unrelated feature work.

> **AI evaluates and prepares. Rules authorize. Humans handle uncertainty. Everything is auditable.**

Never invent candidate facts, qualifications, employers, degrees, dates, skills, citizenship, salary expectations, metrics or answers. Runtime safeguards are defined in [policies](docs/POLICIES.md); a product specification is never permission for the coding agent to act on a real external account.

## Start with local evidence

1. Read [master context](docs/MASTER_CONTEXT.md) and [status](docs/STATUS.md). Load other documents only for the area being changed. [Roadmap](docs/ROADMAP.md) owns remaining milestones and dependency order.
2. Identify repository root, branch, HEAD, working-tree changes and relevant local instructions. Inspect implementation, contracts, tests, schema and configuration before editing. Local code takes precedence over historical documentation claims about behavior.
3. Preserve uncommitted work, user records, identifiers and existing verified features. Do not assume another branch or GitHub main matches this checkout. Do not restart completed subsystems.
4. Reconcile scope and dependencies before choosing a task. Use the canonical macro-task stamp throughout. Do not invent micro-task identifiers or ask for routine implementation approval already granted.

## Implementation

Own coherent vertical slices: model/contracts, domain behavior, provider fixtures, routes, UI, verification and focused documentation as needed. Reuse workspace libraries and existing boundaries; avoid redundant packages and unnecessary new services.

- Shared contracts belong in `packages/shared`; configuration belongs in `packages/config`; schema/migrations and shared backend matching/submission live in `packages/database`.
- API and worker remain independent processes. The worker must not import API implementation. Do not expose server secrets through frontend imports or Vite variables.
- Validate API input with Zod, enforce authenticated ownership on each private resource, use structured errors, and redact sensitive logs.
- Document new configuration in `.env.example` and validate it in `packages/config/src/env.ts`. Never add real secrets, credentials, candidate exports or `.env` files to Git.
- Preserve verification/provenance, immutable package versions, tenant scoping, manifest checks, duplicate/quota controls and uncertain submission recovery. Simplifying the interface must not remove these checks.
- Use additive migrations after mapping existing entities. Never infer a migration requirement from conceptual product entity names alone.
- Keep fixtures deterministic and offline. Missing facts or unclear authority become review items, not guesses or silent permission expansion.

## Verification before completion

Inspect scripts and test setup for side effects before executing them. Set an explicit isolated database target for mutation-capable tests; inspect `packages/database/src/safety.ts` and do not bypass safety guards. Use disposable test users and cleanup scoped to those users/IDs; never delete real user data.

Required project gates:

```bash
npm run format:write
npm run lint
npm run typecheck
npm run test
npm run build
npm run format
```

Review the formatter diff so unrelated local changes are not swept into the task. Lint currently has warnings; record actual warning counts and failures rather than claiming warning-free results. A passing command with skipped integration tests is not complete integration verification.

For schema or database-dependent work, also run `npm run db:check` and `npm run db:migrate` **only on a positively identified isolated local/test database**. Compare the journal and migration files. Documentation-only work does not require migrations; a read-only local journal check can establish migration state. Never migrate production as routine verification.

Run relevant `scripts/verify-*.ts` and browser scenarios for behavior changes after reviewing their effects. Build shared packages before browser servers start, and avoid rebuilding watched packages while browser tests run. Use fixture email/calendar/browser providers, disabled external AI and local storage. Verify responsive layouts, focus, themes and failure states for UX changes. Do not claim real provider success from fixtures.

For documentation changes, verify retained Markdown links, source paths, references to removed files, document responsibility boundaries and policy preservation. Keep exactly the nine core documents listed in README; separate machine-readable assets or framework-required skills need a demonstrated consumer.

## Review and Git

Review the final diff independently of implementation reasoning before committing. Check truthfulness, authorization, tenant boundaries, encryption, validation, error/log hygiene, process dependencies and unrelated changes. Subagents are optional only when explicitly requested or otherwise specifically authorized; do not require handoffs. If delegation is authorized, give disjoint write scopes and never let agents edit overlapping files concurrently.

Commit only the isolated task after required gates pass. Use a conventional message with its official stamp, for example `docs: consolidate current project documentation (JOB-DOC-CONSOLIDATION-01)`. A dirty starting tree requires careful isolation; never stage unrelated work. Do not rewrite Git history, use `git reset --hard`, `git clean -fd` or `git push --force`. Pushes, merges and deployment need separate explicit owner authorization.

## Human authorization

Local inspection, implementation, fixtures, documentation and safe verification are authorized within current scope. Separate explicit approval is required for:

- Real employer applications or live ATS submission validation.
- Outbound recruiter communications or real calendar mutations/invite acceptance.
- Legal declarations, background checks or other candidate consent.
- Paid service activation or charges.
- Production infrastructure/database changes, deployment, publishing or GitHub push/merge.

Do not treat a feature flag, credentials already on disk, an old release mandate, a product policy or a high match score as that approval. Continue unaffected local work when external approval is missing; record the specific dependency. Candidate approval inside the product and permission for a coding-agent live test are separate boundaries.

## Durable state and recovery

Keep [status](docs/STATUS.md) short and current: active task, source checkpoint, verification dates/results, limitations, blockers and next action. Update [roadmap](docs/ROADMAP.md) only when remaining acceptance changes; completed-task history belongs in Git. Update architecture, policies, UX or operations only when their responsibility changes. Do not create perpetual task logs, duplicate master contexts or standalone completion-report documents.

On a new or interrupted session:

1. Read status and inspect `git status` plus `git diff --stat`.
2. Identify unfinished work and its authorization; preserve it and resume at that boundary.
3. For database work, verify connectivity and applied migrations read-only first. Confirm isolation before mutations.
4. Run typecheck/tests when evaluating code health; documentation work can run these with final verification. Diagnose environment failures separately from product failures.
5. Resume without recreating completed systems or implying new external authority.

Report meaningful progress during work. Finish with scope/status, actual checks and limits, remaining owner dependencies, local commit if created, and final Git state. Keep completion reports in the response. To avoid a self-referential hash, status may identify its own checkpoint by task stamp and record the preceding source HEAD; the final response supplies the new commit hash.
