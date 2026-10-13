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
- [ ] **Cloud Deployment Readiness**: Multi-stage Docker container verified, single-port production serving, persistent storage abstraction, and deployment runbooks ready for cloud launch.
