# Jobee 2.0 — Canonical Master Context

Updated 2026-10-20. Engineering owner: Codex. Canonical task: JOB-P0-T01.

## Authority and current authorization

The owner approved phase-by-phase implementation on 2026-10-20 after reviewing the repository assessment. Codex is authorized to implement and verify local roadmap tasks in dependency order. Attached specifications define the target product; they do not independently authorize external actions. Real applications, outbound messages, calendar mutations, paid services and production changes still require separate explicit authorization.

Codex owns planning, architecture, coding, tests and documentation. Antigravity handoffs are discontinued. Preserve verified functionality, candidate data, identifiers, authentication and tenant isolation. Keep the invariant: **AI evaluates and prepares. Rules authorize. Humans handle uncertainty. Everything is auditable.** Never invent candidate facts.

## Reading order and conflict resolution

- This document defines product direction; ARCHITECTURE.md separates current implementation from target architecture.
- ROADMAP.md defines dependency order and separate historical/2.0 acceptance states. JOBEE_2_ASSESSMENT.md contains evidence and gaps.
- DATA_MODEL.md records current schema and incremental mapping. APPLICATION_POLICY.md and SECURITY.md govern runtime safety.
- AGENTS.md and AGENT_POLICY.md govern engineering. AUTONOMOUS_STATE.md contains the current approval boundary; AUTONOMOUS_OPERATING_PLAN.md describes execution after approval.
- TASK_LOG.md, archive/jobee-1.0, old UX/evolution documents and older ADRs preserve historical evidence. Historical autonomous continuation and blanket completion labels are superseded for this transition.
- Root JOBEE_MASTER_CONTEXT.md and AI_JOB_AGENT_MASTER_CONTEXT.md are identical compatibility mirrors of this file. No competing product specification is maintained there.

The source documents are preserved in specifications/jobee-2.0. Their conceptual entities do not mandate new tables. The three-section navigation is implemented locally under JOB-P1-T01; verified candidate-context gaps were closed under JOB-P1-T02. One-click Apply and Autopilot remain later roadmap deliverables. Existing multi-user infrastructure stays although SaaS administration is outside MVP scope.

## Implementation baseline

Audited checkout: main at f4ac34bdc3f816dce9031420a7e31f6baf9baf85. Existing canonical tasks have historical implementations. The revised One-click Apply MVP and Autopilot have not been demonstrated end to end. Do not treat the old completion claims as Jobee 2.0 acceptance. See JOBEE_2_ASSESSMENT.md for the audit baseline and JOBEE_2_IMPLEMENTATION.md for fresh implementation verification and limitations.

---

# JOBEE 2.0 — PRODUCT_SPEC.md

**Version:** 2.0\
**Date:** 2026-10-20\
**Status:** Approved product direction; Phase 1 implemented and verified locally; remaining acceptance tracked in ROADMAP.md\
**Canonical product name:** Jobee

## 1. Product Vision

Jobee is an AI-powered job discovery and application agent that searches for suitable employment opportunities based on a candidate's verified professional background, evaluates their relevance, prepares truthful and personalized applications, and submits those applications on the candidate's behalf.

The product must make a technically complex process feel simple.

**Core promise:** Find the right jobs. Apply intelligently. Track everything.

Jobee is an AI agent first, not a conventional applicant tracking system with AI features added afterward.

## 2. Primary Operating Modes

### One-click Apply

A user selects a job and clicks **Apply with Jobee**.

That single action starts a background agentic application workflow, including eligibility verification, tailored document preparation, application form completion, submission, result verification and tracking.

Users must not be required to navigate separate CV studios, application package screens, analysis pages or multistep application wizards.

If an essential piece of information is unknown, consent is required, or a technical challenge prevents safe submission, the application pauses and requests the minimum necessary user intervention.

### Autopilot

The user enables Autopilot and defines job preferences and authorization boundaries.

Jobee periodically discovers matching jobs, analyzes them, selects eligible opportunities, and initiates applications according to the user's approved rules.

Users can pause Autopilot, change their preferences, and review what Jobee has done.

Autopilot must not submit applications outside authorized boundaries.

Both modes use the same application engine. The trigger differs, not the underlying application quality or safeguards.

## 3. Primary Interface

Jobee has three main navigation sections.

### Explore

The central job-discovery experience.

Features include:

- AI-recommended jobs ranked by suitability.
- Simple search and essential filters.
- Two-pane job listing and job-detail layout on desktop.
- Job description, company, location, employment type and salary when available.
- Concise match explanation, eligibility warnings and missing information.
- One prominent **Apply with Jobee** action.
- Save or dismiss actions where useful.
- Application state displayed for previously attempted jobs.

Advanced matching logic should not clutter the interface.

### Applications

The central record of application activity.

Features include:

- All applications, including manually submitted applications.
- Application progress and employer responses.
- Agent execution status and errors.
- Applications waiting for user input.
- Recruiter messages connected to an application.
- Interview invitations and upcoming interviews.
- Clear distinction between submission progress and employment pipeline progress.
- Essential metrics and search.

A separate Inbox page is not required for the MVP. Relevant communications appear within their application context.

### Profile

The authoritative candidate information and preferences area.

Features include:

- Personal and contact information.
- Education, employment, projects, skills and qualifications.
- CV and supporting document management.
- AI-assisted CV parsing with user verification.
- Job title, location, work arrangement, seniority and salary preferences.
- Country-specific work authorization information.
- Reusable verified application answers.
- Connected accounts and services.
- Autopilot settings and permissions.

Sensitive self-identification information must be optional and user-controlled.

## 4. Fundamental User Journeys

### First-time onboarding

1. User creates or accesses an account.
2. User uploads a CV or provides professional information.
3. AI extracts candidate facts.
4. User verifies material information.
5. User sets job-search preferences.
6. Jobee begins discovering opportunities.

Onboarding should be progressive. Optional profile fields should not prevent basic job exploration.

### One-click application

1. User opens a suitable job.
2. User clicks Apply with Jobee.
3. A background application attempt begins.
4. AI evaluates the vacancy and prepares truthful materials.
5. Agent fills the supported employer application.
6. Authorized application is submitted.
7. Submission result is verified.
8. Application appears in Applications.

If intervention becomes necessary, Jobee pauses with a clear reason and a direct action to resolve it.

### Autopilot

1. User defines eligibility, preferences and application limits.
2. User explicitly enables automatic applications.
3. Jobee discovers new jobs from supported sources.
4. AI analyzes suitability and identifies relevant opportunities.
5. Policy rules determine whether submission is authorized.
6. Eligible jobs enter the application workflow.
7. Jobee submits, verifies and records outcomes.
8. User receives useful notifications and summaries.

## 5. AI Responsibilities

AI should be responsible for understanding candidate experience, interpreting jobs, identifying relevant qualifications, assessing professional fit, creating truthful tailored content, interpreting unfamiliar application questions, selecting appropriate tools and deciding the next workflow step.

AI recommendations must be grounded in verified candidate data.

Deterministic systems remain responsible for explicit authorization boundaries, hard exclusions, duplicate prevention, rate limits, lifecycle transitions, retries and auditable actions.

The goal is not merely to submit as many applications as possible. Jobee should prioritize suitable vacancies and high-quality, credible applications.

## 6. UX Requirements

- One primary application button per job.
- No mandatory intermediate application-preparation screens.
- Clear background activity indicators.
- Minimal navigation and settings.
- Meaningful information rather than unnecessary dashboards.
- Clear errors and user-action requests.
- Responsive layouts and accessible controls.
- No simulated success messages.
- No unnecessary exposure of internal agent architecture.

## 7. MVP Definition

The MVP is successful when a user can:

1. Create a verified candidate profile.
2. Configure job preferences.
3. Discover or import jobs.
4. Receive useful AI matching explanations.
5. Select a supported job.
6. Click Apply with Jobee once.
7. Allow the agent to prepare and submit an authorized application.
8. Receive accurate submission verification or a clearly explained failure/pause.
9. Track that application in a simple interface.

Real submission through at least one supported application provider is mandatory for this revised MVP.

Autopilot follows the working one-click execution foundation.

## 8. Non-goals for the Initial MVP

- Multi-tenant SaaS administration.
- Payments and subscriptions.
- Dedicated mobile applications.
- Complex analytics dashboards.
- A standalone CV studio.
- A standalone AI agent management dashboard.
- Universal application support across all job websites.
- Unsupported LinkedIn account automation.
- CAPTCHA or anti-bot bypass.
- Automatic fabrication of candidate qualifications.
- Unrestricted autonomous recruiter messaging.
- Automatic salary negotiations.

## 9. Product Success Criteria

Evaluate the product using:

- Quality and relevance of recommended jobs.
- Percentage of supported one-click application attempts successfully verified.
- Frequency of unnecessary user intervention.
- Duplicate application rate.
- Accuracy of submitted candidate information.
- Agent execution failure and recovery rates.
- Time spent by users per application.
- Successful conversion from discovery to verified submission.

Application volume alone is not a sufficient quality measure.
