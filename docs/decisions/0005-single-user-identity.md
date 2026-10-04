# ADR 0005: Deterministic Single-User Identity Strategy

## Status

Accepted

## Context

AI Job Agent is architected as a personal AI job-search system. In Phase 1 (`JOB-P1-T01` and `JOB-P1-T02`), full authentication (e.g., OAuth, JWT, sessions) is out of scope to maintain velocity and eliminate unnecessary operational complexity.

However, resolving user ownership by picking arbitrary rows (`SELECT * FROM users LIMIT 1`) or hardcoding personal PII (e.g., developer email) creates instability across environments, causes test race conditions, and prevents a clean upgrade path to real multi-tenant authentication in the future.

## Decision

We implemented a deterministic single-user identity resolution pattern anchored on a dedicated `system_key` unique column in the `users` table:

1. **Schema**: `users.system_key VARCHAR(100) UNIQUE NULL`.
2. **Deterministic Primary User**:
   - `PRIMARY_USER_ID`: `00000000-0000-0000-0000-000000000001`
   - `PRIMARY_SYSTEM_KEY`: `default_primary_candidate`
3. **Helper Function**: `getOrCreatePrimaryUser(db)` in `packages/database/src/user.ts`:
   - Checks for the primary user by `system_key = 'default_primary_candidate'`.
   - If absent, inserts the deterministic UUID and key atomically.
4. **Service Integration**: `CandidateService.getPrimaryUserId()` resolves this identifier deterministically across all API routes.

## Consequences

### Positive

- **Predictable Local State**: Reboots, test suites, and database migrations consistently reference the same user identity.
- **Zero PII**: Contains no hardcoded personal developer information in source code or database migrations.
- **Migration-Friendly**: When real authentication is introduced, existing records remain valid; an authentication credential record can be attached to the primary user or new users can be provisioned.
- **Deterministic Testing**: Integration tests can seed or verify candidate entities without mocking dynamic user IDs.

### Negative / Trade-offs

- The system currently assumes a single user per database instance. Running multiple distinct users simultaneously requires implementing the full authentication layer.
