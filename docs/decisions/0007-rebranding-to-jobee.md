# ADR 0007: Official Project Identity and Rebranding to Jobee

## Status

Accepted

## Context

The project was originally planned and developed under the working name **AI Job Agent**. As the product matured into a personal AI-powered job discovery, matching, application management, and interview platform, an official, distinct brand identity was required.

The project identity needed to be concise, friendly, and cohesive while preserving all existing implementations, architectural invariants, database schemas, and canonical roadmap task stamps (`JOB-P0-T01` through `JOB-P5-T02`).

## Decision

On 2026-10-11, the project was officially named **Jobee**.

1. **Brand Identity**:
   - Canonical name: **Jobee**.
   - Working title: **AI Job Agent** (retained in historical decision logs and audit trail).
   - Core invariant preserved: _"AI evaluates and prepares. Rules authorize. Humans handle uncertainty. Everything is auditable."_

2. **Repository & Workspace**:
   - Private GitHub repository created at `az-makhmudov/Jobee`.
   - Root package named `jobee`.
   - Web application branding and browser title updated to Jobee.
   - All documentation synchronized to Jobee.

3. **Identifier Stability**:
   - Official macro-task stamps (`JOB-P0-T01` through `JOB-P5-T02`) remain unchanged.
   - Internal workspace packages and database schemas remain stable to prevent unnecessary migration churn.

## Consequences

- **Positive**: Clear, unified project identity across repository, documentation, ChatGPT planning, and user interface.
- **Positive**: 100% preservation of verified implementations, test suites, and database migrations.
- **Maintenance**: Historical logs record the rename transparently without rewriting Git history.
