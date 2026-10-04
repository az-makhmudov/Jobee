# ADR 0001: Monorepo Structure & Workspace Package Manager

## Status

Accepted

## Context

AI Job Agent comprises multiple services and layers: a user interface (`apps/web`), a backend API (`apps/api`), an asynchronous worker (`apps/worker`), and reusable domain modules (database, config, shared contracts).
We needed a codebase architecture that shares TypeScript types and core utilities seamlessly without publishing private packages to an external registry.

## Decision

We adopted an npm workspaces monorepo structure with distinct top-level directories:

- `apps/*`: Runnable applications and deployable processes.
- `packages/*`: Shared libraries, configuration, database definitions, and types.

We selected npm workspaces as the baseline package manager because it is natively bundled with Node.js LTS, eliminating external tool prerequisites (such as pnpm or Yarn global installations) while providing reliable workspace resolution.

## Consequences

- **Positive**: Zero extra toolchain installation for contributors; single `npm install` bootstraps the entire platform; shared TypeScript models prevent type drift between API and Web.
- **Negative**: npm workspaces require explicit workspace flags (`--workspace=...`) for subproject commands, which is mitigated by top-level root script aliases.
