# ADR 0003: PostgreSQL Persistence with Drizzle ORM

## Status

Accepted

## Context

AI Job Agent requires robust relational persistence for structured candidate profiles, job postings, matching evaluations, and application histories. The database must run locally during development and support serverless PostgreSQL (such as Neon) in cloud environments without vendor lock-in.

## Decision

We selected **PostgreSQL** paired with **Drizzle ORM** (`drizzle-orm` and `drizzle-kit`) using the standard `pg` (node-postgres) driver.

Key reasons:

1. **Zero Runtime Engine Bloat**: Unlike Prisma, Drizzle does not require an external C++ query engine binary, keeping builds fast, deployments small, and memory usage minimal.
2. **TypeScript-First Schema Definition**: Tables and relationships are defined in pure TypeScript with immediate type inference for inserts and selects (`$inferSelect`, `$inferInsert`).
3. **Explicit, Auditable SQL Migrations**: Drizzle Kit generates standard, transparent `.sql` migration scripts that can be audited before execution.
4. **Driver Flexibility**: Can connect via standard connection strings to local PostgreSQL, self-hosted Docker, or serverless Neon PostgreSQL.

## Consequences

- **Positive**: Strict type safety; zero hidden magic queries; minimal startup latency; straightforward migration generation (`npm run db:generate`).
- **Negative**: Relational querying requires understanding Drizzle's query builder syntax rather than an active-record pattern.
