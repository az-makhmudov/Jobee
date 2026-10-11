# Jobee — Project Rename Record

**Decision date:** 2026-10-11  
**Previous working name:** AI Job Agent  
**Canonical product and project name:** **Jobee**  
**Intended GitHub repository:** `az-makhmudov/Jobee` (private; established)  
**Scope:** Product identity, documentation, developer/agent instructions, and future naming conventions.

## What changed

- Canonical project name and headings in `docs/MASTER_CONTEXT.md` were changed to **Jobee**.
- The official documentation set (`README.md`, `AGENTS.md`, `docs/ROADMAP.md`, `docs/TASK_LOG.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/SECURITY.md`) was updated to use **Jobee**.
- Original architecture, security constraints, development workflow, macro-task definitions, and MVP boundaries were preserved.
- `JOB-P0-T01` through `JOB-P5-T02` remain the **official task stamps**. They are identifiers, not obsolete branding.
- A version 1.1 rename entry was appended to the master-context changelog.
- Root package metadata was updated to `jobee`.
- Web application branding and browser title were updated to **Jobee**.
- Private GitHub repository `az-makhmudov/Jobee` was initialized and linked as `origin`.

## Outside these prepared files

- Change the ChatGPT Project's displayed title to **Jobee** and replace/remove the old attached source document with the updated `JOBEE_MASTER_CONTEXT.md` when supported in the UI.
- When implementation continues, use **Jobee** for user-facing product strings, repo metadata, browser titles, package descriptions, and service branding. Keep internal identifier structures stable where migration risk warrants it.
- Do not retroactively rewrite historical git commits, legacy issue links, or audit entries.
