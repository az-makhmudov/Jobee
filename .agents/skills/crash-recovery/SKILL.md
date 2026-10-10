---
name: crash-recovery
description: Recovery procedure when starting an interrupted session or recovering from an agent environment crash.
---

# Crash & Session Recovery Skill

Use this skill immediately upon starting an agent session to restore context and resume progress safely.

## Recovery Checklist

1. **Read Durable State**:
   Inspect `docs/AUTONOMOUS_STATE.md` to identify:
   - Active milestone ID
   - Current implementation objective
   - Last committed Git checkpoint
   - Known blockers or issues

2. **Inspect Working Tree**:

   ```bash
   git status
   git diff --stat
   ```

   Do NOT discard uncommitted changes (`git reset --hard` is forbidden). Identify what files were modified or untracked.

3. **Check Database Health**:

   ```bash
   npm run db:check
   ```

   Inspect `packages/database/drizzle/meta/_journal.json` to verify whether migrations were generated and applied.

4. **Diagnose Monorepo Compilation**:

   ```bash
   npm run typecheck
   npm run test
   ```

   Identify if there are compilation errors or breaking test failures.

5. **Determine Resumption Point**:
   - If previous work has compile errors, fix them first.
   - If tests or vertical slice components are missing, continue authoring them.
   - If all components and quality gates pass, proceed to verification script, documentation update, and Git commit.
