# Jobee 2.0 — Engineering Operating Plan

Owner: Codex. Updated 2026-10-20. Current state: assessment approved; phase-by-phase local implementation authorized on 2026-10-20.

1. Read MASTER_CONTEXT.md, ROADMAP.md, AUTONOMOUS_STATE.md and applicable code/policies. Inspect Git status and preserve user edits.
2. Work only within current owner authorization. The owner approved phase-by-phase implementation on 2026-10-20. Continue local tasks in dependency order after verification; external actions remain separately gated.
3. Follow roadmap dependency order, closing verified deltas instead of rebuilding historical tasks. Use only JOB-P0-T01 through JOB-P5-T02; implementation details do not receive official microtask stamps.
4. Retain React/Vite, Fastify, PostgreSQL/Drizzle, storage providers and isolated Playwright worker. One orchestrated application pipeline serves both manual and scheduled triggers. Adopt extra infrastructure only for a demonstrated limitation.
5. Use forward-compatible migrations after schema mapping. Preserve users, IDs, candidate verification, documents, application history, provenance and prior consent. Never convert old auto-apply flags into broader 2.0 permission without explicit user opt-in.
6. Verify implementations with the existing eight gates: format:write, lint, typecheck, test, build, format, db:check and db:migrate. Formatting must not overwrite unrelated work. Database migrations and fixture verification run only against positively identified isolated local/test targets. Never apply migrations to production as a routine quality gate.
7. Run browser scenarios after package compilation/build has settled; rebuilding watched workspace packages during a browser run can restart the local API. Run relevant safe integration/browser scenarios; inspect truthfulness, authorization, concurrency, error handling and process boundaries. Fixture evidence and live evidence are reported separately. Never run scripts by filename alone: inspect their side effects and target first.
8. Update TASK_LOG.md, ROADMAP.md and AUTONOMOUS_STATE.md with results, limitations and checkpoint. Commit only verified scoped changes. Preserve historical records and never use destructive Git commands.
9. Report scope/status, architectural choices, frontend/backend/data/AI changes, checks, limits, security, documentation, Git state and next task. Do not claim launch readiness or end-to-end provider support from source inspection alone.

External actions require explicit owner authorization. Runtime One-click/Autopilot permissions are separate from engineering deployment or test authorization. Codex handles all engineering; no Antigravity handoff is required.
