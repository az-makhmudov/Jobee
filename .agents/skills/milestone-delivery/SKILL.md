---
name: milestone-delivery
description: Standard operating procedure for autonomously delivering a full vertical slice roadmap milestone.
---

# Milestone Delivery Skill

Use this skill when delivering an official roadmap milestone (e.g., `JOB-P4-T02`, `JOB-P5-T01`).

## Workflow Steps

1. **Scope Identification**:
   - Inspect `docs/MASTER_CONTEXT.md` Section 16 for the exact milestone definition and acceptance criteria.
   - Inspect `docs/AUTONOMOUS_STATE.md` to confirm current progress and dependencies.

2. **Database & Contracts First**:
   - Update schemas in `packages/database/src/schema/`.
   - Update shared DTOs/types in `packages/shared/src/types/`.
   - Update environment schema in `packages/config/src/env.ts` and `.env.example`.
   - If DB schema changed, run `npm run db:generate` and `npm run db:migrate`.

3. **Core Backend & Domain Services**:
   - Implement provider interfaces and deterministic offline simulators in `apps/api/src/services/`.
   - Implement domain logic with structured error handling (`AppError`) and audit logging (`logger`).
   - Ground all AI outputs against verified Candidate Brain facts with strict anti-hallucination checks.

4. **API Routes**:
   - Register Fastify routes with Zod validation in `apps/api/src/routes/`.
   - Register new route plugins in `apps/api/src/app.ts`.

5. **Frontend Views**:
   - Implement React components in `apps/web/src/components/` and views in `apps/web/src/`.
   - Wire API client calls, loading states, and error handling.
   - Integrate links/navigation from Dashboard and CRM.

6. **Quality & Verification**:
   - Author unit and integration tests under `*.test.ts`.
   - Create an end-to-end verification script under `scripts/verify-*.ts`.
   - Run the `quality-verification` skill.

7. **Documentation & Git Checkpoint**:
   - Update `docs/TASK_LOG.md` with verification results.
   - Update `docs/ROADMAP.md` status to `COMPLETED`.
   - Update `docs/AUTONOMOUS_STATE.md` with the new commit checkpoint.
   - Create local git commit: `feat(<subsystem>): <message> (<TASK-STAMP>)`.
