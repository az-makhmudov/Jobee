# Jobee — Autonomous Implementation Backlog

**Document Status:** Durable Autonomous Engineering Backlog  
**Owner:** Lead Engineering Agent (Antigravity)  
**Authority:** Aligned with `docs/PRODUCT_COMPLETION_DIRECTIVE.md`  
**Execution Mode:** Fully Autonomous Continuous Delivery

---

## 1. Backlog Summary & Prioritization

| Item ID   | Title / Subsystem                                                 | Priority           | Status        | Description                                                                                                                                                                                                                                                                              |
| :-------- | :---------------------------------------------------------------- | :----------------- | :------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **BL-01** | **Multi-Tenant Cross-User Isolation Test Suite**                  | **P0 (Security)**  | **COMPLETED** | Build dedicated end-to-end security test suite (`multi-tenant-isolation.test.ts`) asserting zero cross-user access across all 10 domain entity categories with two independent authenticated users.                                                                                      |
| **BL-02** | **Dynamic AI Provider Switching & DB Persistence**                | **P0 (Core)**      | **COMPLETED** | Add persistent AI configuration in PostgreSQL (`application_policy` or `ai_settings`), dynamic provider resolution in matching/tailoring/prep engines, and interactive model switcher in `SettingsView.tsx`.                                                                             |
| **BL-03** | **Transactional Invitation Emails & Deep-Link Onboarding**        | **P1 (Auth)**      | **COMPLETED** | Add `sendInvitationEmail` with Jobee branding in `TransactionalEmailService`, trigger it upon invite creation, support Google Sign-In pre-matched invite resolution, and handle `?invite=<CODE>` URL parameters.                                                                         |
| **BL-04** | **Document Storage Abstraction (S3 / R2 Cloud Ready)**            | **P1 (Cloud)**     | **COMPLETED** | Enhance document storage layer with pluggable interface supporting local filesystem and S3/R2 cloud storage for containerized deployments.                                                                                                                                               |
| **BL-05** | **Production Docker Build & Single-Port Verification**            | **P1 (Deploy)**    | **COMPLETED** | Validate `docker build` and single-port production static asset serving with Playwright browser installation.                                                                                                                                                                            |
| **BL-06** | **Full Multi-User End-to-End Workflow Validation**                | **P0 (Quality)**   | **COMPLETED** | Comprehensive validation script asserting invited tester onboarding, candidate brain isolation, job discovery, match, tailored application, and approval boundaries.                                                                                                                     |
| **BL-07** | **Free-First Hosting Infrastructure & Multi-Arch ARM Validation** | **P0 (Deploy)**    | **COMPLETED** | Validate Oracle Cloud Always Free Ampere A1 (ARM64) runtime compatibility, multi-arch Docker base, Playwright Chromium on ARM, and zero-cost infrastructure readiness (`scripts/verify-free-first-infrastructure.ts`).                                                                   |
| **BL-09** | **Railway Multi-Service Deployment Preparation & Hardening**      | **P0 (Deploy)**    | **COMPLETED** | Configure Fastify dynamic `$PORT`, reverse-proxy trust (`trustProxy: true`), `BETTER_AUTH_URL` CORS, non-root Playwright container sandbox security, Railway Infrastructure as Code (`.railway/railway.ts`), and deployment verification suite (`scripts/verify-railway-deployment.ts`). |
| **BL-10** | **Live Pilot Cloud Staging & External Integration Verification**  | **P1 (Cloud/Ops)** | **READY**     | Validate live cloud staging on Railway with remote Neon PostgreSQL and Cloudflare R2, verifying Better Auth session propagation behind reverse proxies, transactional invite emails via Resend, and background worker health.                                                            |

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

### BL-07: Free-First Hosting Infrastructure & Multi-Arch ARM Validation

- **Objective**: Ensure Jobee is fully verified for zero-cost cloud deployment prioritizing Oracle Cloud Always Free (Ampere A1 ARM64 VM).
- **Scope**:
  - Verify Node.js 22 pure JS/TS runtime on `linux/arm64` and `darwin/arm64` with zero native C/C++ build dependencies.
  - Inspect multi-stage Dockerfile (`node:22-bookworm-slim`) for multi-arch build readiness and Chromium package inclusion.
  - Create dedicated automated verification script (`scripts/verify-free-first-infrastructure.ts`).
  - Document paid alternative contingency (Hetzner CAX11 at ~€3.79/month) requiring explicit Product Owner approval.

### BL-08: Neon PostgreSQL Connectivity, SSL & Cold-Start Resilience

- **Objective**: Ensure seamless out-of-the-box connectivity to Neon Free serverless PostgreSQL without SSL connection drops or cold-start timeouts.
- **Scope**:
  - Enhance `packages/database/src/client.ts` with auto-SSL detection when `DATABASE_URL` contains `neon.tech` or `sslmode=require`.
  - Extend connection timeout to 10,000ms to gracefully absorb Neon serverless compute resume latency (500ms–2s).
  - Add `DATABASE_SSL` configuration option to `packages/config/src/env.ts`.
  - Add unit tests in `packages/database/src/health.test.ts` verifying SSL configuration behavior.

### BL-09: Railway Multi-Service Deployment Preparation & Production Hardening

- **Objective**: Establish Railway as the official cloud hosting platform for Jobee with isolated API (`jobee-api`) and Background Worker (`jobee-worker`) services.
- **Scope**:
  - Implement dynamic `$PORT` environment variable handling in `packages/config/src/env.ts` so Fastify binds to Railway's assigned port dynamically while maintaining port 3000 default.
  - Configure `trustProxy: true` on Fastify in `apps/api/src/app.ts` for Railway's Cloudflare/Envoy edge reverse proxies, ensuring secure cookie handling, HTTPS detection, and correct Better Auth redirect generation.
  - Whitelist `BETTER_AUTH_URL` dynamically in Fastify CORS origin policy.
  - Harden Playwright browser launcher in `apps/worker/src/browser/playwright-browser-controller.ts` with container flags (`--no-sandbox`, `--disable-setuid-sandbox`, `--disable-dev-shm-usage`, `--disable-gpu`) to avoid Docker 64 MB `/dev/shm` exhaustion.
  - Create Railway Infrastructure as Code (`.railway/railway.ts`) using the official TypeScript engine (`railway/iac`) defining `jobee-api` and `jobee-worker` services, eliminating deprecated `railway.json` / `railway.worker.json` configurations.
  - Implement non-root container security (`USER node`, UID 1000) and strict Playwright context defense-in-depth (`permissions: []`, `ignoreHTTPSErrors: false`, `bypassCSP: false`).
  - Verify both services through an actual Docker container build and launch test.
  - Develop comprehensive deployment verification test suite (`scripts/verify-railway-deployment.ts`) covering all critical cloud runtime behaviors.

### BL-10: Live Pilot Cloud Staging & External Integration Verification

- **Objective**: Execute end-to-end cloud staging and production verification once external accounts and credentials are provided by the Product Owner.
- **Scope**:
  - Connect live Neon PostgreSQL free-tier instance (`DATABASE_URL`) with connection pooling and automated SSL.
  - Provision Cloudflare R2 bucket (`STORAGE_BACKEND=s3`, `S3_BUCKET`, `S3_ENDPOINT`) for persistent document and CV artifact storage.
  - Deploy `jobee-api` and `jobee-worker` to Railway from GitHub repository (`az-makhmudov/Jobee`).
  - Verify Better Auth session propagation across Railway custom domain / `.up.railway.app` URL with HTTPS cookies.
  - Validate Resend transactional email delivery for pilot invitations.
  - Confirm background worker autonomous discovery and analysis scheduling within Railway memory limits (~250 MB).
