# Jobee — Autonomous Implementation Backlog

**Document Status:** Durable Autonomous Engineering Backlog  
**Owner:** Lead Engineering Agent (Antigravity)  
**Authority:** Aligned with `docs/PRODUCT_COMPLETION_DIRECTIVE.md`  
**Execution Mode:** Fully Autonomous Continuous Delivery

---

## 1. Backlog Summary & Prioritization

| Item ID   | Title / Subsystem                                          | Priority          | Status        | Description                                                                                                                                                                                                      |
| :-------- | :--------------------------------------------------------- | :---------------- | :------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **BL-01** | **Multi-Tenant Cross-User Isolation Test Suite**           | **P0 (Security)** | **COMPLETED** | Build dedicated end-to-end security test suite (`multi-tenant-isolation.test.ts`) asserting zero cross-user access across all 10 domain entity categories with two independent authenticated users.              |
| **BL-02** | **Dynamic AI Provider Switching & DB Persistence**         | **P0 (Core)**     | **COMPLETED** | Add persistent AI configuration in PostgreSQL (`application_policy` or `ai_settings`), dynamic provider resolution in matching/tailoring/prep engines, and interactive model switcher in `SettingsView.tsx`.     |
| **BL-03** | **Transactional Invitation Emails & Deep-Link Onboarding** | **P1 (Auth)**     | **COMPLETED** | Add `sendInvitationEmail` with Jobee branding in `TransactionalEmailService`, trigger it upon invite creation, support Google Sign-In pre-matched invite resolution, and handle `?invite=<CODE>` URL parameters. |
| **BL-04** | **Document Storage Abstraction (S3 / R2 Cloud Ready)**     | **P1 (Cloud)**    | **COMPLETED** | Enhance document storage layer with pluggable interface supporting local filesystem and S3/R2 cloud storage for containerized deployments.                                                                       |
| **BL-05** | **Production Docker Build & Single-Port Verification**     | **P1 (Deploy)**   | **COMPLETED** | Validate `docker build` and single-port production static asset serving with Playwright browser installation.                                                                                                    |
| **BL-06** | **Full Multi-User End-to-End Workflow Validation**         | **P0 (Quality)**  | **COMPLETED** | Comprehensive validation script asserting invited tester onboarding, candidate brain isolation, job discovery, match, tailored application, and approval boundaries.                                             |

---

## 2. Detailed Work Item Specifications

### BL-01: Multi-Tenant Cross-User Isolation Test Suite

- **Objective**: Mathematically and empirically verify that User B cannot access, read, update, delete, approve, or execute any resource belonging to User A.
- **Scope**:
  - Create `apps/api/src/routes/multi-tenant-isolation.test.ts`.
  - Authenticate two independent users via Better Auth session tokens.
  - Seed User A: profile, document, verified fact, private fact, job, application package, pending approval request, CRM application, calendar account.
  - Execute 12 targeted cross-user penetration attempts as User B:
    1. Read User A's candidate profile.
    2. Read User A's document list.
    3. Download User A's document binary.
    4. Read User A's candidate facts.
    5. Access User A's application package.
    6. Resolve/approve User A's approval request.
    7. Read User A's CRM application.
    8. Mutate User A's CRM application state.
    9. Launch browser automation run on User A's application.
    10. Read User A's calendar accounts.
    11. Query availability on User A's calendar account.
    12. Access User A's system notifications.
  - Assert that all 12 requests are strictly rejected with `403 Forbidden` or `404 Not Found`.

### BL-02: Dynamic AI Provider Switching & DB Persistence

- **Objective**: Enable runtime switching of AI provider (`gemini`, `openai`, `disabled`) and model via Settings UI without editing environment variables or restarting the server.
- **Scope**:
  - Add `activeAiProvider` and `activeAiModel` to database schema.
  - Implement `POST /api/settings/ai` to persist user/admin preferences.
  - Connect runtime provider manager to dynamically route requests from:
    - `MatchingScoringEngine` (semantic requirement scoring)
    - `TailoringEngine` (truthful cover letter & CV adaptation)
    - `InterviewPreparationService` (grounded STAR question brief)
  - Update `SettingsView.tsx`: add provider radio buttons, model dropdown selector, and "Save AI Configuration" button.
  - Add automated test verifying that changing the provider via API instantly alters matching behavior.

### BL-03: Transactional Invitation Emails & Deep-Link Onboarding

- **Objective**: Seamless private-pilot onboarding with branded invitation emails, Google OAuth invitation recognition, and URL prefill.
- **Scope**:
  - Add `sendInvitationEmail(to, code, inviteUrl, inviterName)` to `TransactionalEmailService`.
  - Wire into `POST /api/auth/invitations` when `invitedEmail` is specified.
  - Update `databaseHooks.user.create.before` in `better-auth-instance.ts` to allow Google Sign-In for pre-invited email addresses.
  - Update `App.tsx` to detect `?invite=...` in URL query string, store in session/cookie, and auto-open `AuthModal` in signup mode with prefilled code.

### BL-04: Document Storage Abstraction (S3 / R2 Cloud Ready)

- **Objective**: Ensure containerized cloud deployments can store candidate CVs and artifacts in object storage (AWS S3, Cloudflare R2, MinIO) rather than local container disk.
- **Scope**:
  - Define `DocumentStorageProvider` interface in `packages/shared`.
  - Implement `S3DocumentStorageProvider` alongside existing `LocalStorageService`.
  - Add environment variables (`STORAGE_BACKEND`, `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`).
  - Unit test storage provider fallback and boundary errors.

### BL-05: Production Docker Build & Single-Port Verification

- **Objective**: Verify that the multi-stage Docker container builds cleanly and runs locally with production static asset serving.
- **Scope**:
  - Run container build check or validate build configuration.
  - Verify static asset serving in production mode on port 3000.

### BL-06: Full Multi-User End-to-End Workflow Validation

- **Objective**: Run live Playwright and API verification of two concurrent user workflows.
- **Scope**:
  - Automated script verifying User 1 and User 2 end-to-end.
