# Jobee — Consolidated Owner Actions & External Dependencies

**Document Status:** Living Dependency & Human Decision Tracker  
**Last Updated:** 2026-10-13  
**Rule:** Engineering development proceeds autonomously using fixtures, mock tokens, and local sandboxes. The Product Owner is only prompted for real external credentials, paid services, and deployment authorization.

---

## 1. External Credentials & Third-Party Service Dependencies

| Item #     | Dependency Name                                        | Why Needed                                                                                                                                                                             | How to Provide                                                                                                                                                                                                                                                                                | Est. Cost                                                                                                 | Unblocked Feature                                                                                           | Independent Work Continuing                                                                                                                                      |
| :--------- | :----------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **DEP-01** | **Google OAuth 2.0 Client Credentials**                | Authenticates real users via Google Sign-In, accesses recruiter messages via Gmail API, and synchronizes interview schedules via Google Calendar API.                                  | Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET` in production `.env`. Configure authorized redirect URIs in Google Cloud Console.                                                      | Free tier (Google Cloud OAuth)                                                                            | Live Google Sign-In, real Gmail monitoring, real Google Calendar scheduling.                                | Local authentication with Better Auth session emulation, offline `FixtureEmailProvider`, and `FixtureCalendarProvider` continue fully.                           |
| **DEP-02** | **Transactional Email Service API Key (e.g. Resend)**  | Delivers email verification codes, password reset links, and invitation emails to new invited pilot testers.                                                                           | Create free account on Resend (resend.com), verify sending domain or use onboarding email, set `RESEND_API_KEY` and `EMAIL_FROM` in `.env`.                                                                                                                                                   | Free tier (up to 3,000 emails/month on Resend)                                                            | Real transactional email delivery for email/password registration and password recovery.                    | Local mock email logger, deterministic test token generation, and Better Auth flows continue fully.                                                              |
| **DEP-03** | **Live AI Provider API Keys (Google Gemini / OpenAI)** | Powers semantic job description parsing, requirement classification, cover letter drafting, and STAR interview prep frameworks.                                                        | Set `GEMINI_API_KEY` (Google AI Studio) or `OPENAI_API_KEY` (OpenAI Platform) in `.env` or configure via Settings view.                                                                                                                                                                       | Pay-as-you-go (Gemini free tier available; OpenAI ~$0.001/run)                                            | Live LLM semantic matching, reasoning, and document tailoring.                                              | Pluggable `DisabledAiProvider` and deterministic scoring rule engine execute with 100% anti-hallucination guarantees.                                            |
| **DEP-04** | **Official Cloud Hosting (Railway)**                   | Hosts the unified Jobee web application/API (`jobee-api`) and background worker (`jobee-worker`) as two separated containerized services with public HTTPS and automated healthchecks. | Create Railway account (railway.com), create a new Project, and connect the GitHub repository. Deploys both services declared via Infrastructure as Code (`.railway/railway.ts`): `jobee-api` and `jobee-worker`.                                                                             | **$0.00 – $8.00 / month** (Free trial credits first; Hobby plan $5.00 base + ~$1–$3 usage when upgraded). | Public HTTPS access, 24/7 background worker execution, automated SSL termination, and live browser prefill. | Local multi-stage Docker build (`node:22-bookworm-slim`), Playwright container flags, single-port production server, and Railway configuration verified locally. |
| **DEP-05** | **Free-First Database (Neon Free PostgreSQL)**         | Hosts the production multi-tenant database with serverless scaling and connection pooling.                                                                                             | Create free project at neon.tech, copy connection string with PgBouncer pooler (`-pooler`), set `DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=require`.                                                                                                                              | **$0.00 / month** (0.5 GB storage, serverless compute).                                                   | Live persistent database accessible from cloud instance without managing local PostgreSQL server.           | Local PostgreSQL with automated schema migrations (`npm run db:migrate`) and health checks verified.                                                             |
| **DEP-06** | **Free-First Document Storage (Cloudflare R2)**        | Persistent, durable storage for candidate CV uploads, tailored documents, and job application artifacts with zero egress fees.                                                         | Create Cloudflare account, enable R2, create bucket `jobee-documents`, generate S3-compatible R2 API token. Set `STORAGE_BACKEND=s3`, `S3_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com`, `S3_BUCKET=jobee-documents`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION=auto`. | **$0.00 / month** (10 GB free, zero egress fees).                                                         | High-availability cloud document persistence independent of local file storage.                             | Local filesystem storage abstraction (`LocalStorageProvider`) and `S3StorageProvider` verified with unit tests.                                                  |

---

## 2. Human Authorization Boundaries & Policy Decisions

| Item #     | Decision Required                                      | Context / Invariant                                                                                                                                                                                                                                   | Status                                                                                                                             |
| :--------- | :----------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------- |
| **DEC-01** | **Confirmation of 6 Quarantined Candidate Facts**      | Candidate Asadbek Makhmudov has 6 sensitive candidate facts (`driver_license`, `gender`, `marital_status`, `personal_summary_hook`, `relocation_preference`, `target_annual_compensation_eur`) quarantined as `UNVERIFIED` with `allowAiUse = false`. | Awaiting user explicit confirmation in Profile UI before facts can be used in job applications.                                    |
| **DEC-02** | **Real External ATS Submission Authorization**         | Jobee strictly forbids submitting real job applications to live employer systems without explicit human confirmation.                                                                                                                                 | Invariant strictly enforced by cryptographic manifest (`JOB-PROD-02`). All test runs remain in `DRY_RUN` or local fixture mode.    |
| **DEC-03** | **Git Push Authorization**                             | Git commits are created locally with clean checkpoints. No commits are pushed to remote without explicit user command.                                                                                                                                | Checkpoints kept locally on `main` branch.                                                                                         |
| **DEC-04** | **Paid Cloud Infrastructure Activation Authorization** | Product Owner has approved Railway as official host, Neon for database, and Cloudflare R2 for storage. While the Product Owner is willing to pay for hosting, **no paid plan (e.g. Railway Hobby $5/mo) may be activated without explicit approval**. | **ENFORCED (Free Resources Prioritized)**. Explicit confirmation required before attaching credit card or upgrading to Hobby plan. |

---

## 3. Step-by-Step Railway Deployment Runbook (For Product Owner)

### Step 1: Set Up Neon Free PostgreSQL

1. Sign up or log in at [neon.tech](https://neon.tech).
2. Create a project named `jobee-prod`.
3. Under **Dashboard** -> **Connection Details**, ensure **Pooled connection** is checked.
4. Copy the connection string:
   `postgresql://<user>:<password>@ep-...-pooler.region.aws.neon.tech/neondb?sslmode=require`
5. Run migrations from your local workspace to initialize the remote database:
   ```bash
   DATABASE_URL="<NEON_CONNECTION_STRING>" npm run db:migrate
   ```

### Step 2: Set Up Cloudflare R2 Object Storage

1. Sign up or log in at [cloudflare.com](https://dash.cloudflare.com/).
2. Navigate to **R2 Object Storage** and click **Create bucket**. Name it `jobee-documents`.
3. In the right sidebar, click **Manage R2 API Tokens** -> **Create API Token**.
4. Set Permissions: **Object Read & Write**, Apply to: `jobee-documents`.
5. Copy:
   - Endpoint URL: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
   - Access Key ID
   - Secret Access Key

### Step 3: Deploy `jobee-api` on Railway

1. Log in to [railway.com](https://railway.com/).
2. Click **New Project** -> **Deploy from GitHub repo** -> select the Jobee repository.
3. Railway automatically detects Infrastructure as Code in `.railway/railway.ts` (or apply via `railway config apply`), which programmatically defines:
   - `jobee-api`: Fastify API + static Web SPA, Dockerfile builder, start command `node apps/api/dist/index.js`, healthcheck `/api/health`, `ON_FAILURE` restart policy.
   - `jobee-worker`: Autonomous Orchestrator daemon, Dockerfile builder, start command `node apps/worker/dist/index.js`, `ALWAYS` restart policy.
4. For `jobee-api`: Go to **Settings** -> **Networking** -> click **Generate Domain** (e.g. `jobee-production.up.railway.app`).
5. Under **Variables**, add the production environment variables:
   ```env
   NODE_ENV=production
   DATABASE_URL=<NEON_CONNECTION_STRING>
   DATABASE_SSL=true
   STORAGE_BACKEND=s3
   S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
   S3_BUCKET=jobee-documents
   S3_REGION=auto
   S3_ACCESS_KEY_ID=<R2_ACCESS_KEY_ID>
   S3_SECRET_ACCESS_KEY=<R2_SECRET_ACCESS_KEY>
   BETTER_AUTH_SECRET=<SECURE_RANDOM_32_BYTES>
   BETTER_AUTH_URL=https://<YOUR_RAILWAY_DOMAIN>
   BETTER_AUTH_TRUSTED_ORIGINS=https://<YOUR_RAILWAY_DOMAIN>
   EMAIL_TOKEN_ENCRYPTION_KEY=<SECURE_RANDOM_32_BYTES>
   INVITE_ONLY_REGISTRATION=true
   LOG_LEVEL=info
   ```

### Step 4: Deploy `jobee-worker` on Railway

1. In the same Railway project, click **+ New** -> **GitHub Repo** -> select the same repository again.
2. Rename this second service to `jobee-worker`.
3. Go to **Settings** -> **Deploy**:
   - Custom Start Command: `node apps/worker/dist/index.js`
   - Restart Policy: `Always`
4. Go to **Settings** -> **Networking**: ensure no public domain is generated (internal service only).
5. Under **Variables**, link the same shared variables as `jobee-api`:
   ```env
   NODE_ENV=production
   DATABASE_URL=<NEON_CONNECTION_STRING>
   DATABASE_SSL=true
   STORAGE_BACKEND=s3
   S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
   S3_BUCKET=jobee-documents
   S3_REGION=auto
   S3_ACCESS_KEY_ID=<R2_ACCESS_KEY_ID>
   S3_SECRET_ACCESS_KEY=<R2_SECRET_ACCESS_KEY>
   BETTER_AUTH_SECRET=<SECURE_RANDOM_32_BYTES>
   EMAIL_TOKEN_ENCRYPTION_KEY=<SECURE_RANDOM_32_BYTES>
   ORCHESTRATOR_ENABLED=true
   WORKER_POLL_INTERVAL_MS=5000
   LOG_LEVEL=info
   ```

### Step 5: Verification & Health Check

1. Test public health endpoint:
   ```bash
   curl -i https://<YOUR_RAILWAY_DOMAIN>/api/health
   ```
   Should return `200 OK` with `{"status":"ok","service":"api"}`.
2. Test readiness endpoint:
   ```bash
   curl -i https://<YOUR_RAILWAY_DOMAIN>/api/ready
   ```
   Should report database connectivity as `connected`.

---

## 4. Railway Plan & Pricing Evaluation (Hobby vs. Free Tier)

| Plan                                   | Base Cost         | Compute Inclusions                                                                                                        | Suitability for Jobee                                          | Estimated Monthly Cost            |
| :------------------------------------- | :---------------- | :------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------- | :-------------------------------- |
| **Free / Trial Credits**               | **$0.00**         | $5.00 one-time credit, 512 MB – 8 GB execution                                                                            | Suitable for initial verification testing.                     | **$0.00** until credit exhaustion |
| **Hobby Plan (Recommended for Pilot)** | **$5.00 / month** | Includes $5.00 usage credit, 8 GB RAM per service, 8 vCPUs, continuous 24/7 background worker execution, zero idle sleep. | **Fully supports Jobee** (API + Worker + Playwright Chromium). | **~$5.00 – $8.00 / month** total  |

> [!NOTE]
> Even on the Hobby plan, compute consumption for Jobee's two lightweight services (~200 MB API + ~250 MB Worker) is largely offset by the $5.00 base credit, keeping ongoing monthly expenses extraordinarily low.
