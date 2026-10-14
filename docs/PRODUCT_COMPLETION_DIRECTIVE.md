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
8. **Free-First Hosting Mandate & Zero Unauthorized Spend**: Prioritize approved free tiers (Oracle Cloud Always Free, Neon Free, Cloudflare R2) for private pilot operations. The agent is strictly prohibited from purchasing or activating paid cloud infrastructure or incurring fees without explicit Product Owner approval.

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
- [ ] **Cloud Deployment Readiness**: Multi-stage Docker container verified, single-port production serving, persistent storage abstraction, and deployment runbooks ready for free-first cloud launch on Oracle Cloud Always Free, Neon PostgreSQL, and Cloudflare R2.

---

## 5. Free-First Hosting & Infrastructure Strategy

### 5.1 Architectural Blueprint (Approved Free-First Stack)

| Component               | Provider / Tier                    | Specifications & Allocation                                                                                                                 | Est. Monthly Cost | Role in Jobee Architecture                                                                                                               |
| :---------------------- | :--------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------ | :---------------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| **Compute & Runtime**   | **Oracle Cloud Always Free (OCI)** | Ampere A1 Compute (`VM.Standard.A1.Flex`): up to 4 OCPUs, 24 GB RAM, 200 GB block volume, 10 TB outbound bandwidth, dedicated IPv4 address. | **$0.00**         | Runs single-port unified Jobee container (Fastify API, React 19 SPA) and Autonomous Background Worker with Playwright headless Chromium. |
| **Managed Database**    | **Neon Free PostgreSQL**           | Serverless PostgreSQL 16: 0.5 GB storage, autoscaling compute (0.25 vCPU), connection pooling via PgBouncer (`-pooler`), SSL enabled.       | **$0.00**         | Houses relational multi-tenant schema, candidate brain, CRM states, encryption metadata, and dynamic AI configurations.                  |
| **Document Storage**    | **Cloudflare R2**                  | S3-Compatible Object Storage: 10 GB free monthly storage, 1M Class A operations, 10M Class B operations, **zero egress bandwidth fees**.    | **$0.00**         | Stores candidate master CVs, tailored resumes/cover letters, and application artifacts via `S3StorageProvider`.                          |
| **Transactional Email** | **Resend Free Tier**               | 3,000 emails/month free, 100 emails/day, custom domain verification.                                                                        | **$0.00**         | Sends verification tokens, password resets, and pilot invitations.                                                                       |

### 5.2 Technical Compatibility & Feasibility Evaluation

1. **ARM Compatibility (Ampere A1)**:
   - Node.js 22 (`node:22-bookworm-slim`) provides official, optimized Linux ARM64 (`linux/arm64`) runtimes.
   - Jobee's dependency tree contains zero native C/C++ compilation bindings (`node-gyp` is not required). All packages (`fastify`, `drizzle-orm`, `pg`, `zod`, `cheerio`, `docx`, `better-auth`) are pure TypeScript/JavaScript.
   - Verified locally on `darwin/arm64` and containerized on `linux/arm64`.

2. **Docker Containerization**:
   - Multi-stage Dockerfile utilizes `node:22-bookworm-slim` multi-arch base.
   - Builds natively on ARM64 or cross-compiles seamlessly with `docker buildx`.
   - Single-port architecture serves API endpoints (`/api/*`), health probes (`/health/*`), and React 19 client assets (`/*`) through Fastify static serving on port 3000.

3. **Playwright & Headless Browser Automation**:
   - Playwright officially distributes pre-compiled Chromium builds for Linux ARM64.
   - All underlying Linux shared libraries (`libnss3`, `libatk`, `libcups`, `libgbm1`, etc.) are installed via Debian Bookworm package management.
   - **Critical Memory Advantage**: Oracle Ampere A1's 24 GB RAM eliminates the chronic out-of-memory (OOM) crashing typical of 512 MB PaaS free tiers (Render, Fly.io) when running Chromium.

4. **Background Workers & Autonomous Orchestrator**:
   - Because Oracle Cloud provides full IaaS Virtual Machines (rather than ephemeral serverless containers), Jobee's background worker runs continuously 24/7.
   - Orchestrator tasks (discovery polling, email sync, reminders, application processing) execute on scheduled intervals without sleeping or timing out.
   - Managed via Docker Compose or systemd service units with `restart: unless-stopped`.

5. **Operational Reliability, Risks & Mitigations**:
   - **OCI Idle Instance Reclamation**: Oracle reclaims Always Free instances if CPU, memory, and network fall below 20% utilization for 7 days.
     _Mitigation_: Jobee's periodic background orchestrator polling, automated test suites, and optional synthetic cron keepalive guarantee active threshold compliance. Alternatively, upgrading account to Pay-As-You-Go ($0 balance) permanently disables idle reclamation while preserving Always Free allowances.
   - **OCI Regional Capacity**: Ampere A1 instances occasionally experience temporary capacity constraints in high-demand regions during provisioning.
     _Mitigation_: Use automated provisioning retry scripts, choose low-contention availability domains, or deploy temporarily on Always Free AMD micro shapes (`VM.Standard.E2.1.Micro`, 1 GB RAM) for web while running browser automation locally.
   - **OCI VCN Ingress Security**: Oracle Virtual Cloud Network blocks inbound ports by default.
     _Mitigation_: Ingress rules for TCP ports 80, 443, and 3000 must be explicitly added to the VCN Security List and OS `iptables`/`ufw`.
   - **Neon Free Scale-to-Zero Latency**: Neon compute pauses after 5 minutes of inactivity; resuming takes ~500ms–2s.
     _Mitigation_: Database pool timeout configured with 10,000ms ceiling and auto-SSL detection (`packages/database/src/client.ts`).

### 5.3 Simplest Reliable Paid Alternative (Contingency Option)

If Oracle Cloud Always Free capacity is inaccessible or free tiers prove insufficient for pilot operations, the approved paid fallback path is:

1. **Recommended Primary Paid Option: Hetzner Cloud VPS**
   - **Shape**: `CAX11` (Ampere ARM64, 2 vCPU, 4 GB RAM, 40 GB NVMe SSD, 20 TB traffic, IPv4) or `CX22` (x86_64, 2 vCPU, 4 GB RAM, 40 GB NVMe SSD).
   - **Estimated Cost**: **~€3.79 – €3.99 / month (~$4.15 – $4.35 USD / month)**.
   - **Rationale**: Unmatched price-to-performance, instantaneous provisioning, dedicated resources without idle shutdowns, European data privacy alignment, and ample 4 GB RAM to host both Jobee and Dockerized PostgreSQL.

2. **Alternative PaaS Option: Railway Developer Plan**
   - **Estimated Cost**: **~$8.00 – $12.00 / month** ($5.00 platform subscription + usage).
   - **Rationale**: Minimal DevOps overhead, automated Git deployments, managed SSL, and integrated Postgres.

### 5.4 Human Authorization & Spend Boundary

> [!CAUTION]
> **Strict Spend Invariant**: The agent must never purchase, provision, or bind credit cards to paid cloud infrastructure without explicit, advance Product Owner approval. All development and staging verification must execute on local fixtures or approved free tiers.
