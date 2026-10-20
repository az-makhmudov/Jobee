# ADR 0008 — Incremental Jobee 2.0 transition

Date: 2026-10-20. Task: JOB-P0-T01. Status: accepted; owner approved phase-by-phase local implementation on 2026-10-20.

Context: the owner supplied a new product spec, architecture and roadmap. The repository already implements all historical macro-task areas but lacks acceptance for a complete one-click workflow and shared-policy Autopilot. Old documentation contains conflicting roles, navigation, autonomous continuation and completion claims.

Decision: preserve the monorepo, React/Vite, Fastify, PostgreSQL/Drizzle, storage abstraction, Better Auth/tenant isolation and isolated Playwright worker. Present Explore, Applications and Profile. Reuse candidate intelligence, discovery, matching, internal material preparation, CRM and provider adapters. Converge scheduled and user-triggered paths into one durable workflow. Retain authorization manifests, evidence and uncertain-result protection; extend consent scope/versioning rather than removing safety checks. Keep eleven canonical task stamps and use dependency order with JOB-P5-T01 before full CRM/Autopilot and communications expansion.

Consequences: no rewrite, broker, new agent fleet or destructive schema changes are justified. Existing single-user ADR 0005 is historical and superseded by current Better Auth/tenant isolation; this decision does not remove multi-user protection. Old UI decisions remain historical. Foundation implementation was approved on 2026-10-20; real applications and production changes need separate authorization.
