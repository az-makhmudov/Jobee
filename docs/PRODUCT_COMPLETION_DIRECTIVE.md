# Jobee — Master Autonomous Product Completion Directive

**Document Status:** Permanent Canonical Product Objective & Autonomous Operating Directive  
**Effective Date:** 2026-10-13  
**Authority:** Product Owner Binding Mandate  
**Active Role:** Lead Engineering Agent (Autonomous Technical Product Team)

---

## 1. Prime Directive & Core Invariants

> **AI evaluates and prepares. Rules authorize. Humans handle uncertainty. Everything is auditable.**

1. **Zero Hallucination of Candidate Facts**: Strict zero-tolerance invariant on fabricating candidate qualifications, past employers, degrees, dates, skills, citizenship, salary requirements, or answers.
2. **Deterministic Authorization over AI Discretion**: Mutating external platforms or submitting applications requires explicit, deterministic rule authorization and human confirmation.
3. **Escalate Uncertainty**: Ambiguous answers or missing candidate fields produce human review items, never AI guesses.
4. **Full Audit Trail**: All generative suggestions, evaluations, and submissions are logged with immutable timestamped context.
5. **Multi-User Data Isolation**: User A can never inspect, modify, download, approve, or execute User B's resources.
6. **Zero Secrets in Git**: No credentials, private CVs, personal database dumps, or API keys in version control.
7. **Zero Remote Push Without Approval**: The agent never executes `git push` without explicit Product Owner authorization.
8. **Official Hosting Policy & Spend Boundary (Railway)**: Railway is the official hosting platform for Jobee (superseding the Oracle Cloud Always Free strategy). Prioritize Railway's free resources where feasible. If the free tier cannot reliably support Jobee, evaluate the Hobby plan (~$5–$10/month). While the Product Owner is willing to pay when necessary, the agent is strictly prohibited from activating paid plans, purchasing resources, or deploying publicly without explicit Product Owner authorization.

---

## 2. Product Objective

Jobee is an AI-powered personal job-search and application-management platform built to operate online as a genuine, secure, multi-tenant cloud application.

The application autonomously helps candidates:

1. Maintain rich, truthful candidate profiles with master CVs and role variants.
2. Store documents securely with encrypted metadata and audit trails.
3. Configure granular job preferences and application safety policies.
4. Discover genuine job vacancies from public feeds and career portals.
5. Ingest vacancies via URL or pasted descriptions with deduplication.
6. Extract and normalize hard vs. soft requirements.
7. Match vacancies using 8-dimension scoring, explainable breakdowns, and anti-hallucination guards.
8. Adapt truthful CVs and draft tailored cover letters strictly grounded in candidate evidence.
9. Answer application questions using an authenticated Answer Library.
10. Halt execution on sensitive questions and bot challenges (reCAPTCHA, Cloudflare Turnstile).
11. Inspect and prefill supported ATS job forms (Greenhouse, Lever, Ashby) in dry-run/assisted mode.
12. Enforce cryptographic manifest-bound human authorization before any external application submission.
13. Track CRM application states across the canonical 17-state machine.
14. Monitor recruiter emails via Gmail integration and link correspondence to applications.
15. Manage interviews, availability, and conflict detection via Google Calendar integration.
16. Synthesize grounded STAR interview preparation briefs and debriefs.
17. Run background discovery and preparation cycles via the Autonomous Orchestrator.
18. Deliver responsive desktop (MacBook, Chrome, Safari) and mobile (iPhone, Android) web experiences.

---

## 3. Autonomous Operating Model & Development Rules

1. **Full Engineering Ownership**: The Lead Engineer owns the entire technical lifecycle — inspection, prioritization, architecture, coding, migrations, tests, debugging, security reviews, documentation, and checkpoints.
2. **No Task-by-Task Prompting**: The agent does not prompt the Product Owner for routine engineering tasks or await ChatGPT prompt generation between milestones.
3. **Continuous Execution**: The agent automatically advances from one verified backlog item to the next until all independently achievable product requirements are met.
4. **Honest Capability Accounting**: Functionality is categorized strictly using:
   - `FULLY_OPERATIONAL`
   - `LIVE_VERIFIED`
   - `LOCALLY_VERIFIED`
   - `FIXTURE_VERIFIED`
   - `PARTIALLY_OPERATIONAL`
   - `BLOCKED_BY_EXTERNAL_CONFIGURATION`
   - `BLOCKED_BY_HUMAN_AUTHORIZATION`
   - `NOT_IMPLEMENTED`
     Never conflate fixture success or compilation with live production readiness.
5. **Durable State Maintenance**:
   - `docs/AUTONOMOUS_STATE.md`: Real-time active checkpoint, capabilities, and continuation instructions.
   - `docs/IMPLEMENTATION_BACKLOG.md`: Internal engineering backlog prioritized and maintained by the agent.
   - `docs/OWNER_ACTIONS_REQUIRED.md`: Consolidated external dependencies (OAuth keys, email credentials, cloud authorization).
   - `docs/TASK_LOG.md`: Chronological milestone delivery audit and verification logs.
6. **Interruption & Resumption**: When an agent session ends or is interrupted, durable state is written to disk. On the next session, the agent reads `AGENTS.md`, `PRODUCT_COMPLETION_DIRECTIVE.md`, and `AUTONOMOUS_STATE.md`, inspects Git status, and resumes without prompting.

---

## 4. Acceptance Criteria for Product Completion

The Jobee application is deemed complete only when:

- [ ] **Authentication**: Better Auth Google Sign-In and Email/Password fully operational with secure sessions, email verification, password reset, and strict server-enforced invitation-only registration.
- [ ] **Data Isolation**: Complete multi-tenant isolation verified with automated cross-user penetration tests; zero cross-user leakage across any resource.
- [ ] **Legacy User Preservation**: Candidate Asadbek Makhmudov (`00000000-0000-0000-0000-000000000001`, `asadbek.mzw@gmail.com`) remains 100% intact as primary candidate/admin with all 14 skills, 2 certifications, and quarantined facts preserved.
- [ ] **Transactional Email**: Functional mailer service (e.g., Resend / SMTP adapter) with branded Jobee templates for verification, reset, and invitations.
- [ ] **Job Discovery**: Live discovery from real public sources (Arbeitnow, Greenhouse public boards), normalized, deduplicated, and ranked by preferences.
- [ ] **Real AI Engine**: Pluggable Gemini/OpenAI/Deterministic engine with runtime provider switching in Settings, persisted in the database, with active AI powering matching and tailoring.
- [ ] **Application Studio & CRM**: Truthful tailoring, document preview/download, complete 17-state CRM lifecycle, and tamper-evident audit timeline.
- [ ] **Controlled ATS Automation**: Greenhouse, Lever, and Ashby form inspection and assisted prefill with cryptographic submission authorization.
- [ ] **Communication & Calendar**: Scoped Gmail and Google Calendar OAuth integration ready for live credentials; fixture providers for offline testing.
- [ ] **Autonomous Orchestrator**: Background pipeline cycles executing discovery, matching, preparation, and notifications with full observability.
- [ ] **Cross-Device UI**: Responsive web app verified across desktop and mobile viewports.
- [ ] **Cloud Deployment Readiness**: Multi-stage Docker container verified, separated Railway services for unified Fastify API/Web and Autonomous Background Worker, reverse-proxy header trust (`trustProxy: true`), dynamic port binding (`$PORT`), persistent storage abstraction, and deployment runbooks ready for Railway cloud launch with Neon PostgreSQL and Cloudflare R2.

---

## 5. Official Cloud Hosting & Infrastructure Architecture (Railway)

### 5.1 Official Infrastructure Blueprint

| Component                     | Provider / Tier                       | Specifications & Allocation                                                                                                                                                  | Est. Monthly Cost                                   | Role in Jobee Architecture                                                                                              |
| :---------------------------- | :------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------- |
| **Application & API Hosting** | **Railway (Service: `jobee-api`)**    | Containerized Web Service (Node.js 22, Fastify 5, React 19 SPA), dynamic `$PORT` binding, public HTTPS domain, automated SSL termination, healthcheck probe (`/api/health`). | **$0.00 – $5.00** (Free trial credits / Hobby base) | Serves unified HTTP API, session authentication, and static client assets on a single public port.                      |
| **Background Processing**     | **Railway (Service: `jobee-worker`)** | Containerized Worker Service (Node.js 22 daemon), Playwright Chromium browser automation with container-safe flags, continuous 24/7 background orchestrator.                 | **Usage-based (~$1–$3)**                            | Executes periodic vacancy discovery, Gmail sync, calendar sync, interview prep synthesis, and ATS browser prefill.      |
| **Managed Database**          | **Neon Free PostgreSQL**              | Serverless PostgreSQL 16: 0.5 GB storage, autoscaling compute (0.25 vCPU), connection pooling via PgBouncer (`-pooler`), SSL enabled.                                        | **$0.00**                                           | Houses relational multi-tenant schema, candidate brain, CRM states, encryption metadata, and dynamic AI configurations. |
| **Document Storage**          | **Cloudflare R2**                     | S3-Compatible Object Storage: 10 GB free monthly storage, 1M Class A operations, 10M Class B operations, **zero egress bandwidth fees**.                                     | **$0.00**                                           | Stores candidate master CVs, tailored resumes/cover letters, and application artifacts via `S3StorageProvider`.         |
| **Authentication**            | **Better Auth**                       | Native multi-tenant authentication engine with cookie session management, Google OAuth 2.0, email/password, and server-enforced pilot invitations.                           | **$0.00**                                           | Secures all user interactions with reverse-proxy trust (`trustProxy: true`).                                            |
| **AI Matching & Tailoring**   | **Google Gemini / OpenAI**            | Pluggable `AiProvider` architecture with database-backed runtime switching in Settings.                                                                                      | **Pay-as-you-go** (Gemini free tier available)      | Powers semantic vacancy parsing, 8-dimension matching, and truthful CV/cover letter tailoring.                          |
| **Transactional Email**       | **Resend Free Tier**                  | 3,000 emails/month free, 100 emails/day, custom domain verification.                                                                                                         | **$0.00**                                           | Delivers verification tokens, password resets, and pilot invitations.                                                   |

### 5.2 Railway Service Configuration & Resource Optimization

1. **Multi-Service Architecture from Unified Repository**:
   - Both `jobee-api` and `jobee-worker` build from the root multi-stage [Dockerfile](file:///Users/bek/Job%20Agent/Dockerfile) (`node:22-bookworm-slim`).
   - `jobee-api` runs `node apps/api/dist/index.js` as its start command (configured via root [railway.json](file:///Users/bek/Job%20Agent/railway.json)).
   - `jobee-worker` runs `node apps/worker/dist/index.js` as its start command (configured via [railway.worker.json](file:///Users/bek/Job%20Agent/railway.worker.json)).
   - This service separation guarantees that high-burst browser automation tasks in the worker cannot degrade API responsiveness or interrupt interactive user sessions.

2. **Dynamic Port Binding**:
   - Railway injects a dynamic `$PORT` environment variable for web services.
   - `packages/config/src/env.ts` automatically preprocesses `$PORT` into `API_PORT`, ensuring Fastify binds correctly to Railway's assigned port without manual configuration.

3. **Reverse-Proxy Header Trust (`trustProxy: true`)**:
   - Railway terminates HTTPS at its Cloudflare/Envoy edge proxies and forwards traffic via HTTP to the container with `X-Forwarded-Proto: https` and `X-Forwarded-For`.
   - Fastify is configured with `trustProxy: true` in `apps/api/src/app.ts`, ensuring that Better Auth correctly identifies secure connections, sets `Secure; SameSite=Lax` cookies, and constructs proper OAuth redirect URLs.

4. **Playwright Chromium Container Resource Hardening**:
   - `PlaywrightBrowserController` launches headless Chromium with `--no-sandbox`, `--disable-setuid-sandbox`, `--disable-dev-shm-usage`, and `--disable-gpu`.
   - The `--disable-dev-shm-usage` flag prevents Chromium crashes caused by Docker's default 64 MB `/dev/shm` partition size by utilizing `/tmp` for shared memory.
   - Playwright instances run within Railway's generous per-service memory ceilings (up to 8 GB per service).

### 5.3 Hosting Policy, Plan Evaluation & Cost Estimates

1. **Free-First Railway Prioritization**:
   - The initial private pilot prioritizes Railway's free starter resources / trial verification credits where feasible.
2. **Hobby Plan Evaluation**:
   - **Base Subscription**: $5.00 / month (includes $5.00 in platform usage credits).
   - **Resource Rates**: $0.000231 / GB-hour RAM, $0.000463 / vCPU-hour.
   - **Realistic Usage Estimate**:
     - `jobee-api`: ~200 MB average RAM x 720 hours = 144 GB-hours = ~$0.03
     - `jobee-worker`: ~150 MB baseline RAM + Playwright bursts (~400 MB) x 720 hours = ~200 GB-hours = ~$0.05
     - CPU usage (intermittent polling, batch scoring): ~$1.00 – $2.50
     - Platform base credit covers the vast majority of compute usage.
     - **Estimated Net Monthly Cost**: **~$5.00 – $8.00 / month total**.
3. **Product Owner Willingness & Financial Boundary**:
   - The Product Owner is willing to pay for hosting when necessary.
   - However, **no paid plan will be activated, resource purchased, or public deployment initiated without explicit Product Owner authorization** (`DEC-04`).

### 5.4 Historical Context & Milestone Preservation (`JOB-HOST-01`)

The earlier `JOB-HOST-01` milestone evaluated and proved the application's multi-architecture ARM64 compatibility, zero-native C/C++ compilation footprint, and containerization. That engineering work remains 100% valid and preserved in historical records, while Railway is now established as the canonical production hosting target.
