# Jobee — Consolidated Owner Actions & External Dependencies

**Document Status:** Living Dependency & Human Decision Tracker  
**Last Updated:** 2026-10-13  
**Rule:** Engineering development proceeds autonomously using fixtures, mock tokens, and local sandboxes. The Product Owner is only prompted for real external credentials, paid services, and deployment authorization.

---

## 1. External Credentials & Third-Party Service Dependencies

| Item #     | Dependency Name                                         | Why Needed                                                                                                                                            | How to Provide                                                                                                                                                                                                                                                                                | Est. Cost                                                                                                 | Unblocked Feature                                                                                 | Independent Work Continuing                                                                                                            |
| :--------- | :------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------- |
| **DEP-01** | **Google OAuth 2.0 Client Credentials**                 | Authenticates real users via Google Sign-In, accesses recruiter messages via Gmail API, and synchronizes interview schedules via Google Calendar API. | Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET` in production `.env`. Configure authorized redirect URIs in Google Cloud Console.                                                      | Free tier (Google Cloud OAuth)                                                                            | Live Google Sign-In, real Gmail monitoring, real Google Calendar scheduling.                      | Local authentication with Better Auth session emulation, offline `FixtureEmailProvider`, and `FixtureCalendarProvider` continue fully. |
| **DEP-02** | **Transactional Email Service API Key (e.g. Resend)**   | Delivers email verification codes, password reset links, and invitation emails to new invited pilot testers.                                          | Create free account on Resend (resend.com), verify sending domain or use onboarding email, set `RESEND_API_KEY` and `EMAIL_FROM` in `.env`.                                                                                                                                                   | Free tier (up to 3,000 emails/month on Resend)                                                            | Real transactional email delivery for email/password registration and password recovery.          | Local mock email logger, deterministic test token generation, and Better Auth flows continue fully.                                    |
| **DEP-03** | **Live AI Provider API Keys (Google Gemini / OpenAI)**  | Powers semantic job description parsing, requirement classification, cover letter drafting, and STAR interview prep frameworks.                       | Set `GEMINI_API_KEY` (Google AI Studio) or `OPENAI_API_KEY` (OpenAI Platform) in `.env` or configure via Settings view.                                                                                                                                                                       | Pay-as-you-go (Gemini free tier available; OpenAI ~$0.001/run)                                            | Live LLM semantic matching, reasoning, and document tailoring.                                    | Pluggable `DisabledAiProvider` and deterministic scoring rule engine execute with 100% anti-hallucination guarantees.                  |
| **DEP-04** | **Free-First Cloud Hosting (Oracle Cloud Always Free)** | Hosts the unified Jobee web application, static SPA, and background worker with Playwright browser automation on a dedicated cloud VM.                | Create Oracle Cloud Always Free account (cloud.oracle.com), launch Ampere A1 Compute VM (`VM.Standard.A1.Flex`, 2–4 OCPUs, 12–24 GB RAM, Ubuntu/Debian ARM64). Add ingress rules for TCP 80, 443, 3000 in VCN Security List. Provide SSH access or install Docker.                            | **$0.00 / month** (Always Free tier). Paid fallback (Hetzner CAX11 ~€3.79/mo) requires explicit approval. | Public HTTPS access, 24/7 background worker execution, live browser prefill.                      | Local multi-stage Docker build (`node:22-bookworm-slim`), Playwright on ARM/x86, and single-port production server verified locally.   |
| **DEP-05** | **Free-First Database (Neon Free PostgreSQL)**          | Hosts the production multi-tenant database with serverless scaling and connection pooling.                                                            | Create free project at neon.tech, copy connection string with PgBouncer pooler (`-pooler`), set `DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=require`.                                                                                                                              | **$0.00 / month** (0.5 GB storage, serverless compute).                                                   | Live persistent database accessible from cloud instance without managing local PostgreSQL server. | Local PostgreSQL with automated schema migrations (`npm run db:migrate`) and health checks verified.                                   |
| **DEP-06** | **Free-First Document Storage (Cloudflare R2)**         | Persistent, durable storage for candidate CV uploads, tailored documents, and job application artifacts with zero egress fees.                        | Create Cloudflare account, enable R2, create bucket `jobee-documents`, generate S3-compatible R2 API token. Set `STORAGE_BACKEND=s3`, `S3_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com`, `S3_BUCKET=jobee-documents`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION=auto`. | **$0.00 / month** (10 GB free, zero egress fees).                                                         | High-availability cloud document persistence independent of local file storage.                   | Local filesystem storage abstraction (`LocalStorageProvider`) and `S3StorageProvider` verified with unit tests.                        |

---

## 2. Human Authorization Boundaries & Policy Decisions

| Item #     | Decision Required                                      | Context / Invariant                                                                                                                                                                                                                                   | Status                                                                                                                             |
| :--------- | :----------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------- |
| **DEC-01** | **Confirmation of 6 Quarantined Candidate Facts**      | Candidate Asadbek Makhmudov has 6 sensitive candidate facts (`driver_license`, `gender`, `marital_status`, `personal_summary_hook`, `relocation_preference`, `target_annual_compensation_eur`) quarantined as `UNVERIFIED` with `allowAiUse = false`. | Awaiting user explicit confirmation in Profile UI before facts can be used in job applications.                                    |
| **DEC-02** | **Real External ATS Submission Authorization**         | Jobee strictly forbids submitting real job applications to live employer systems without explicit human confirmation.                                                                                                                                 | Invariant strictly enforced by cryptographic manifest (`JOB-PROD-02`). All test runs remain in `DRY_RUN` or local fixture mode.    |
| **DEC-03** | **Git Push Authorization**                             | Git commits are created locally with clean checkpoints. No commits are pushed to remote without explicit user command.                                                                                                                                | Checkpoints kept locally on `main` branch.                                                                                         |
| **DEC-04** | **Paid Cloud Infrastructure Activation Authorization** | Product Owner has approved a Free-First strategy (Oracle Cloud Always Free + Neon Free + Cloudflare R2). No paid infrastructure may be purchased or activated without explicit approval.                                                              | **ENFORCED (Free-First Active)**. If free capacity is constrained, user must authorize fallback (e.g. Hetzner CAX11 at ~€3.79/mo). |

---

## 3. Step-by-Step Free-First Deployment Runbook (For Product Owner)

### Step 1: Provision Oracle Cloud Always Free VM

1. Log in to [Oracle Cloud Console](https://cloud.oracle.com/).
2. Navigate to **Compute** -> **Instances** -> **Create Instance**.
3. Choose **Image**: Ubuntu 24.04 LTS (aarch64) or Debian 12 (arm64).
4. Choose **Shape**: `VM.Standard.A1.Flex` (Ampere ARM64). Allocate 2 to 4 OCPUs and 12 to 24 GB RAM (all within Always Free allowance).
5. Add your SSH Public Key.
6. Under **Networking**, create or select a VCN with a public subnet and assign a public IPv4 address.
7. **Configure VCN Ingress Rules**:
   - Go to **Virtual Cloud Networks** -> your VCN -> **Security Lists** -> **Default Security List**.
   - Add Ingress Rule: Source `0.0.0.0/0`, IP Protocol `TCP`, Destination Port Range: `80, 443, 3000`.
8. Once provisioned, connect via SSH and install Docker:
   ```bash
   ssh ubuntu@<YOUR_INSTANCE_IP>
   sudo apt-get update && sudo apt-get install -y docker.io docker-compose
   sudo usermod -aG docker ubuntu
   ```

### Step 2: Set Up Neon Free PostgreSQL

1. Sign up at [neon.tech](https://neon.tech).
2. Create a project named `jobee-prod`.
3. Under **Dashboard** -> **Connection Details**, ensure **Pooled connection** is checked.
4. Copy the connection string (`postgresql://<user>:<password>@ep-...-pooler.region.aws.neon.tech/neondb?sslmode=require`).
5. Run migrations from your local workspace to initialize the remote database:
   ```bash
   DATABASE_URL="<NEON_CONNECTION_STRING>" npm run db:migrate
   ```

### Step 3: Set Up Cloudflare R2 Object Storage

1. Sign up or log in at [cloudflare.com](https://dash.cloudflare.com/).
2. Navigate to **R2 Object Storage** and click **Create bucket**. Name it `jobee-documents`.
3. In the right sidebar, click **Manage R2 API Tokens** -> **Create API Token**.
4. Set Permissions: **Object Read & Write**, Apply to: `jobee-documents`.
5. Copy:
   - Endpoint URL: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
   - Access Key ID
   - Secret Access Key

### Step 4: Launch Jobee on the Server

1. Clone the repository on the instance and copy your `.env` containing:
   ```bash
   NODE_ENV=production
   PORT=3000
   API_HOST=0.0.0.0
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
   INVITE_ONLY_REGISTRATION=true
   ```
2. Build and run with Docker:
   ```bash
   docker build -t jobee:latest .
   docker run -d --name jobee -p 3000:3000 --env-file .env --restart unless-stopped jobee:latest
   ```
3. Test health: `curl http://localhost:3000/api/health`

---

## 4. Paid Fallback Evaluation (If Free Tier Encounters Capacity Constraints)

If Oracle Cloud Ampere A1 is out of capacity in your chosen region or registration verification issues arise, the simplest reliable paid alternative is:

- **Provider**: [Hetzner Cloud](https://www.hetzner.com/cloud)
- **Server Type**: `CAX11` (Ampere ARM64, 2 vCPU, 4 GB RAM, 40 GB NVMe, 20 TB traffic) or `CX22` (x86_64, 2 vCPU, 4 GB RAM, 40 GB NVMe).
- **Location**: Nuremberg / Falkenstein (Germany), Helsinki (Finland), or Ashburn (US).
- **Monthly Cost**: **~€3.79 – €3.99 / month (~$4.15 – $4.35 USD)**.
- **Benefits**: Instant provisioning, no idle shutdown policies, high-speed networking, GDPR compliant.
- **Rule**: Await explicit Product Owner approval before signing up or entering payment details.
