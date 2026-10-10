---
name: quality-verification
description: Mandatory quality verification procedure and checklist before completing milestones.
---

# Quality Verification Skill

Use this skill to run and enforce all quality gates before committing work or completing a milestone.

## Verification Checklist

1. **Format Code**:

   ```bash
   npm run format:write
   ```

2. **Lint Validation**:

   ```bash
   npm run lint
   ```

   Must pass with 0 errors.

3. **TypeScript Typecheck**:

   ```bash
   npm run typecheck
   ```

   Must pass across all monorepo packages and apps (`@job-agent/shared`, `@job-agent/config`, `@job-agent/database`, `@job-agent/api`, `@job-agent/web`, `@job-agent/worker`) with 0 errors.

4. **Automated Unit & Integration Tests**:

   ```bash
   npm run test
   ```

   All test files must pass with 0 failures.

5. **Monorepo Build**:

   ```bash
   npm run build
   ```

   All packages must build and Vite web bundle must compile cleanly.

6. **Format Check**:

   ```bash
   npm run format
   ```

7. **Database Verification**:

   ```bash
   npm run db:check
   npm run db:migrate
   ```

8. **End-to-End Scenario Verification**:
   Run the milestone verification script (e.g. `npx tsx scripts/verify-<task>.ts`).
   Verify all test cases pass and clean up after themselves leaving zero orphan records in the database.
