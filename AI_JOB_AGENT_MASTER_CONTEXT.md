# AI Job Agent — Master Project Context

**Document status:** Canonical project context  
**Version:** 1.0  
**Date:** 2026-10-04  
**Working project name:** AI Job Agent  
**Primary user:** Single-user personal job-search agent first; multi-user product only after the personal system is proven.

---

## 0. How This Document Must Be Used

This file is the canonical context document for the AI Job Agent project.

When this file is attached to a ChatGPT Project, new chats should use it as the primary project baseline before planning or proposing implementation work. It exists so the project can continue consistently across chats without rebuilding context from memory.

Rules for future work:

1. Treat this document as the source of truth unless a later explicit decision supersedes it.
2. Preserve official task stamps defined in this document.
3. Do not create tiny implementation task stamps for individual tables, endpoints, pages, functions, or minor fixes. Those belong inside a larger macro task.
4. New task stamps are created only when work represents a meaningful architectural unit, subsystem, vertical slice, migration, or release-level objective.
5. ChatGPT owns planning, architecture, decomposition, review, and Antigravity prompt generation.
6. Antigravity 2.0 owns repository inspection, coding, migrations, tests, implementation, and local verification.
7. Important implementation results, architectural changes, and completed task stamps must be reflected back into this master context or a linked project status document.
8. Never fabricate candidate information, experience, qualifications, work authorization, salary preferences, or application answers.
9. Automation must stop and request human approval when a material answer is uncertain.
10. Build a reliable personal system first. Do not prematurely optimize for SaaS, multiple users, payments, or large-scale scraping.

Earlier highly granular conceptual task lists are superseded by the macro-task roadmap in Section 16. They were planning sketches only and should not be used as the implementation task structure.

---

# 1. Product Vision

AI Job Agent is a personal AI-powered job-search and application system that can:

- discover relevant jobs;
- receive and interpret job alerts;
- normalize jobs from multiple sources;
- evaluate each job against the user's verified profile and preferences;
- identify hard disqualifiers;
- rank opportunities by match quality;
- prepare truthful, tailored application materials;
- answer routine application questions using a verified answer library;
- request approval for uncertain or consequential questions;
- submit applications automatically where technically and contractually appropriate;
- track every application and status change;
- monitor job-related email;
- connect recruiter communication to the correct application;
- identify assessments and interview invitations;
- coordinate interviews with the user's calendar;
- prepare interview briefs;
- maintain a complete audit history of agent actions.

The long-term experience should feel like a personal Applicant Tracking System combined with a controlled AI job-search agent.

Core workflow:

DISCOVER → NORMALIZE → FILTER → SCORE → DECIDE → PREPARE → APPROVE/AUTO → APPLY → TRACK → EMAIL SYNC → INTERVIEW → OUTCOME

---

# 2. Product Philosophy

The system follows four core principles:

**AI evaluates and prepares. Rules authorize. Humans handle uncertainty. Everything is auditable.**

This means:

- AI may interpret job descriptions, classify requirements, explain matches, tailor wording, draft cover letters, classify recruiter emails, and prepare interview material.
- Deterministic code controls salary thresholds, allowed locations, minimum match thresholds, hard exclusions, approval state, lifecycle state, calendar conflicts, and whether an action is authorized.
- The AI must never invent qualifications or silently infer sensitive/legal answers.
- Every meaningful automated action must have a recorded reason, policy basis, timestamp, and result.

---

# 3. Initial Target User and Product Strategy

The first version is for one user: the owner of the system.

The personal version is intentionally prioritized because it allows the workflow to be validated against real applications before building a generalized product.

Initial target roles may include, but are not hardcoded to:

- Project Management Intern
- Project Coordinator
- Junior Project Manager
- Operations Intern
- Business Operations / Administrative roles
- Other roles explicitly configured in job preferences

The system must not encode personal profile facts directly in source code. All candidate information belongs in structured data.

Multi-user SaaS is a later possibility, not an MVP requirement.

---

# 4. MVP Boundary

The first genuinely useful MVP does **not** require universal auto-application.

The MVP is successful when the user can:

1. Create and maintain a structured Candidate Brain.
2. Upload/manage a master CV and role-oriented CV variants.
3. Configure job preferences and application rules.
4. Add a job manually by URL or imported text.
5. Parse and normalize the job.
6. Extract mandatory and preferred requirements.
7. Score the job against the candidate profile.
8. Explain strengths, weaknesses, unknowns, and hard blockers.
9. Produce a tailored application package.
10. Generate routine answers from the verified answer library.
11. Stop for approval when an answer is uncertain.
12. Track the application lifecycle.
13. Record application events and outcomes.

After this vertical slice is reliable, discovery, email, calendar, and application submission automation are added.

---

# 5. Long-Term User Experience

A mature run may work like this:

1. The agent receives new jobs from configured sources and job-alert emails.
2. Jobs are normalized and deduplicated.
3. Hard policy rules remove obvious mismatches.
4. AI performs semantic analysis and creates a match score.
5. The policy engine chooses:
   - AUTO-APPLY,
   - REVIEW REQUIRED,
   - SKIP.
6. The Application Studio selects an appropriate CV base, tailors verified content, creates optional cover-letter content, and prepares application answers.
7. If all required answers are known and the provider is supported, the Application Agent can submit according to policy.
8. The application becomes part of the CRM.
9. Email monitoring identifies confirmations, assessments, recruiter messages, rejections, interviews, and offers.
10. Interview scheduling checks calendar availability and proposes or books times according to configured autonomy.
11. The system prepares interview material.
12. All actions remain visible in the audit history.

---

# 6. Major Product Modules

## 6.1 Candidate Brain

Structured and verified representation of the candidate.

Contains:

- identity/contact data;
- education;
- employment history;
- projects;
- skills;
- languages;
- certifications;
- portfolio links;
- work authorization facts;
- location and relocation preferences;
- availability;
- salary preferences;
- target roles;
- supporting evidence;
- candidate documents;
- reusable application answers.

Important rule: generated application content must be grounded in Candidate Brain facts.

## 6.2 Job Discovery and Ingestion

Possible sources:

- manual URL;
- pasted job description;
- LinkedIn job-alert email ingestion;
- recruiter emails;
- public career pages;
- Greenhouse job boards;
- Lever job boards;
- Ashby job boards;
- other sources added through adapters.

The architecture must not depend on unsupported LinkedIn browser automation as its foundation.

## 6.3 Job Intelligence

Responsibilities:

- clean job text;
- identify title/company/location;
- extract employment type and seniority;
- extract salary where available;
- separate mandatory requirements from preferred requirements;
- identify languages;
- detect work authorization/sponsorship requirements;
- semantic matching;
- hard-rule evaluation;
- produce score and explanation.

## 6.4 Application Studio

Responsibilities:

- select CV base variant;
- tailor truthful wording and ordering;
- generate optional summary/cover letter;
- generate or retrieve application answers;
- identify unanswered/unsafe questions;
- create an application package;
- send uncertain answers to approval.

## 6.5 Application Agent

Responsibilities:

- provider detection;
- application form extraction;
- field mapping;
- file upload;
- answer filling;
- validation;
- submission;
- manual handoff when required.

Browser automation must live outside the primary API process.

## 6.6 Application CRM

Tracks:

- discovered jobs;
- decisions;
- application packages;
- submissions;
- lifecycle status;
- recruiter communication;
- assessments;
- interviews;
- outcomes;
- timeline/audit events;
- metrics.

## 6.7 Communication Agent

Responsibilities:

- job-alert email ingestion;
- application confirmation detection;
- recruiter email classification;
- application/thread matching;
- rejection detection;
- assessment detection;
- interview invitation detection;
- offer detection;
- status synchronization.

## 6.8 Interview Agent

Responsibilities:

- extract proposed times;
- check availability;
- suggest or accept slots according to policy;
- create/update calendar events;
- store interview metadata;
- prepare role/company/interview briefing.

---

# 7. Candidate Brain and Truthfulness Model

Candidate information should be structured as facts instead of relying only on free-form CV text.

Conceptual entities include:

CandidateProfile  
CandidateExperience  
CandidateEducation  
CandidateProject  
CandidateSkill  
CandidateLanguage  
CandidateCertification  
CandidateFact  
CandidateDocument  
ApplicationAnswer  
JobPreference

Facts may eventually carry:

- source;
- confidence;
- verification status;
- valid-from / valid-to dates;
- whether AI may use the fact automatically.

The system must not convert vague experience into invented claims.

Example:

Allowed:
"Coordinated media production and team activities."

Not allowed unless verified:
"Managed a €500,000 cross-functional program."

If an application asks a factual/legal question and no approved answer exists, the correct behavior is to stop and request input.

---

# 8. Answer Library

Repeated questions should not be re-reasoned from scratch.

Each reusable application answer should support:

- normalized question/category;
- canonical answer;
- optional explanation;
- automation level;
- conditions;
- last-updated date;
- confidence/verification state.

Suggested automation levels:

**AUTO** — safe to answer automatically.  
**REVIEW** — AI may suggest an answer, but human approval is required.  
**MANUAL** — the system must not choose the answer.

Examples of questions that commonly deserve REVIEW or MANUAL handling:

- salary expectations;
- sponsorship/work authorization when not definitively stored;
- willingness to relocate;
- self-identification/diversity questions;
- declarations;
- background-check consent;
- questions requiring subjective or legally significant statements.

---

# 9. Job Policy Engine

The Policy Engine is deterministic.

It evaluates settings such as:

- permitted locations;
- remote/hybrid/on-site preference;
- target role families;
- seniority;
- employment types;
- minimum/maximum experience expectations;
- language constraints;
- salary thresholds;
- unpaid-role exclusion;
- sponsorship constraints;
- relocation policy;
- company exclusion list;
- minimum AI match score;
- auto-apply threshold;
- provider support level;
- whether all material answers are known.

Example decision:

AUTO_APPLY requires all configured hard rules to pass, the match threshold to be met, the application provider to be supported, and no unresolved approval requests to exist.

AI must not bypass the policy engine.

---

# 10. Application Lifecycle

Canonical high-level statuses:

DISCOVERED  
ANALYZED  
MATCHED  
SKIPPED  
READY_TO_APPLY  
NEEDS_REVIEW  
APPLYING  
APPLIED  
CONFIRMATION_RECEIVED  
SCREENING  
ASSESSMENT  
INTERVIEW  
FINAL_INTERVIEW  
OFFER  
REJECTED  
WITHDRAWN  
EXPIRED

Status transitions should be recorded as events rather than silently overwriting history.

---

# 11. Technical Architecture

Preferred stack:

Frontend:

- React
- TypeScript
- Vite

Backend:

- Node.js
- TypeScript

Database:

- PostgreSQL
- Neon is a preferred hosted option

ORM:

- Drizzle ORM

Storage:

- Cloudflare R2 or equivalent object storage

Browser automation:

- Playwright
- isolated browser worker

Background jobs:

- worker process;
- queue/scheduler introduced when required;
- Redis/Upstash or equivalent may be added when justified.

AI:

- provider abstraction rather than hard coupling to one model vendor.

Suggested repository shape:

apps/
web/
api/
worker/
browser-worker/

packages/
database/
candidate/
jobs/
matching/
applications/
integrations/
ai/
policies/
shared/

The exact monorepo tooling should be chosen during the platform-foundation task and documented.

---

# 12. AI vs Deterministic Code Boundary

Use AI for:

- semantic job parsing;
- requirement classification;
- semantic matching;
- strength/weakness explanations;
- CV wording adaptation;
- cover letters;
- interpreting unfamiliar application questions;
- email classification;
- recruiter message summarization;
- interview preparation.

Use deterministic code for:

- application lifecycle;
- approval state;
- salary limits;
- allowed locations;
- hard exclusions;
- minimum scores;
- provider support;
- calendar conflicts;
- authorization to submit;
- audit logging;
- deduplication keys where deterministic matching is possible;
- retries/idempotency;
- permission checks.

The system must not use an LLM as a replacement for a state machine or authorization layer.

---

# 13. Browser Automation Rules

The browser worker is an execution layer, not the product brain.

It should:

- receive an already authorized application package;
- detect or use a known application-provider adapter;
- extract/fill form fields;
- upload prepared documents;
- validate values;
- stop on unsupported or risky questions;
- stop on CAPTCHA/identity verification/manual challenge;
- record execution steps and results;
- never attempt anti-bot evasion.

Provider adapters should be incremental. Initial targets may include Greenhouse, Lever, and Ashby before more complex providers.

---

# 14. Security and Privacy

The system contains sensitive personal and career data.

Requirements:

- never store plaintext account passwords when avoidable;
- prefer OAuth and scoped tokens;
- encrypt sensitive tokens/secrets;
- keep secrets outside source control;
- apply least privilege;
- separate browser execution from core API;
- log sensitive actions without unnecessarily copying sensitive values;
- support session/token revocation;
- keep immutable or append-oriented audit records for important agent actions;
- ensure generated content can be traced back to verified candidate facts when practical;
- require explicit policy authorization before external side effects.

An agent action record should answer:

WHO/WHAT acted?  
WHAT action was attempted?  
WHY was it authorized?  
WHEN did it happen?  
WHAT data/package was used?  
WHAT was the result?

---

# 15. Macro-Task Standard

This project deliberately uses **large, meaningful tasks**.

A task stamp should represent a coherent subsystem, vertical slice, or major architectural capability. It should normally deliver multiple related components together.

Good task size examples:

- Candidate Brain + candidate profile UI + CV/document handling + answer library.
- Job ingestion + parsing + normalization + deduplication + job inbox.
- Application CRM + lifecycle + audit timeline + core metrics.

Bad task-size examples:

- create one database table;
- add one endpoint;
- build one button;
- rename one field;
- add one parser function;
- style one page.

Those are implementation steps inside a macro task and do not receive separate official stamps.

### When a Macro Task May Be Split

Split a task only if at least one of these becomes true:

1. Antigravity cannot reliably hold the required repository context in one implementation run.
2. The work contains two independent architectural boundaries that can be validated separately.
3. A migration or integration has meaningful risk and needs its own rollback checkpoint.
4. The prompt becomes so large that implementation quality would likely degrade.
5. A completed vertical slice can provide real user value before the remaining half.

Even when split, prefer at most 2-3 substantial subtasks rather than dozens of micro tasks.

### Prompt Standard

Each Antigravity implementation prompt should contain:

- task stamp;
- objective;
- repository/context-reading instructions;
- architectural constraints;
- scope;
- non-goals;
- implementation requirements;
- migration/data requirements;
- test/verification requirements;
- documentation updates;
- acceptance criteria;
- expected completion report.

Antigravity should be encouraged to inspect the repository first, make implementation decisions consistent with existing architecture, execute tests, and provide a final completion report.

---

# 16. Canonical Macro Roadmap

The following stamps are the official implementation roadmap.

## PHASE 0 — Foundation

### JOB-P0-T01 — Project Foundation, Architecture, Policies & Documentation

Purpose:
Turn the product concept into a stable engineering foundation.

Includes:

- product scope;
- MVP boundary;
- system architecture;
- agent operating principles;
- AI/deterministic boundaries;
- security/privacy baseline;
- application policy specification;
- macro-task workflow;
- repository/documentation conventions;
- initial architecture decision records as needed.

Primary deliverable:
A coherent project foundation that future implementation can follow without re-deciding core principles.

Acceptance:
The project has clear scope, architecture, policies, non-goals, task system, and documentation structure.

---

## PHASE 1 — Core Platform and Candidate Intelligence

### JOB-P1-T01 — Workspace, Database & Core Platform Foundation

Includes:

- repository/monorepo bootstrap;
- web/API/worker boundaries;
- TypeScript configuration;
- PostgreSQL/Drizzle setup;
- migration workflow;
- environment configuration;
- core shared types;
- structured logging;
- error model;
- basic app shell/navigation;
- health checks;
- test foundation;
- baseline CI/lint/typecheck commands;
- AGENTS.md and project engineering rules.

Acceptance:
The project runs locally, database migrations work, core apps/packages build, tests/lint/typecheck have defined commands, and architecture is ready for feature development.

### JOB-P1-T02 — Candidate Brain, Documents, Answer Library & Preferences

Includes:

- candidate data model;
- experience/education/projects/skills/languages/certifications;
- verified candidate facts;
- CV/document storage metadata;
- master profile and role-oriented CV concepts;
- answer library;
- job preferences;
- application policy configuration;
- candidate/profile management UI;
- validation and audit-aware updates.

Acceptance:
The system can represent the user's truthful professional profile, documents, reusable answers, and job/application rules without relying on free-form memory.

---

## PHASE 2 — Job Intelligence

### JOB-P2-T01 — Job Ingestion, Parsing, Normalization & Job Inbox

Includes:

- canonical Job model;
- manual job URL/text ingestion;
- source/provider detection;
- job content extraction for supported public pages;
- normalized fields;
- requirement storage;
- deduplication;
- source metadata;
- ingestion errors/retry states;
- job inbox/list/detail UI.

Acceptance:
The user can add jobs from initial supported inputs and consistently obtain normalized, deduplicated Job records visible in the UI.

### JOB-P2-T02 — Requirement Analysis, Matching & Policy Decision Engine

Includes:

- mandatory vs preferred requirement analysis;
- role/skills/experience/education/location/language fit;
- hard blockers;
- semantic match scoring;
- explainable score components;
- unknowns/warnings;
- deterministic policy engine;
- decisions such as MATCH, REVIEW, SKIP, and future AUTO_APPLY eligibility;
- ranked job view.

Acceptance:
Every analyzed job receives a reproducible policy result plus a useful AI match explanation grounded in Candidate Brain data.

---

## PHASE 3 — Application Workflow

### JOB-P3-T01 — Application Studio, Tailored Materials & Human Approval

Includes:

- application package model;
- CV base selection;
- truthful CV tailoring;
- cover-letter generation;
- application-question interpretation;
- answer-library matching;
- approval requests;
- safe handling of unknown/legal/salary questions;
- application review UI;
- versioning of generated materials.

Acceptance:
For a matched job, the system can prepare a complete application package while clearly separating automatic answers from items needing human approval.

### JOB-P3-T02 — Application CRM, Lifecycle, Audit Timeline & Analytics

Includes:

- application entity;
- lifecycle/state machine;
- submission metadata;
- event timeline;
- recruiter/company linkage;
- manual submission recording;
- outcome tracking;
- status transitions;
- audit history;
- initial analytics and funnel metrics;
- application dashboard.

Acceptance:
The product functions as a usable personal ATS even before automatic submission exists.

**MVP milestone:** Completion of JOB-P3-T02 produces the first complete personal job-application management MVP.

---

## PHASE 4 — Communication and Interviews

### JOB-P4-T01 — Email Intelligence, Job Alerts & Application Status Synchronization

Includes:

- email integration abstraction;
- OAuth/token handling;
- job-alert ingestion;
- relevant-email detection;
- application confirmation classification;
- recruiter-thread matching;
- assessment/rejection/offer detection;
- automatic CRM status updates where confidence and policy permit;
- ambiguous-email review queue.

Acceptance:
Relevant job/recruiter emails can update or enrich the correct application record with traceable evidence.

### JOB-P4-T02 — Calendar, Interview Scheduling & Interview Preparation

Includes:

- calendar integration abstraction;
- interview invitation extraction;
- proposed-time parsing;
- availability checks;
- manual/suggest/auto scheduling policy modes;
- calendar event creation;
- interview records;
- company/role preparation briefs;
- likely questions;
- candidate experiences to emphasize;
- follow-up reminders.

Acceptance:
The system can turn an interview invitation into an organized interview workflow without losing the application context.

---

## PHASE 5 — Controlled Automation

### JOB-P5-T01 — Browser Application Worker & Initial ATS Adapters

Includes:

- isolated Playwright worker;
- secure job execution contract;
- provider/adapter interface;
- initial adapters, prioritizing simpler providers such as Greenhouse, Lever, and Ashby;
- field extraction and mapping;
- uploads;
- validation;
- idempotency;
- screenshots/logs where useful;
- manual handoff;
- CAPTCHA/challenge stop behavior;
- submission audit events.

Acceptance:
Supported providers can execute already-authorized application packages reliably, and unsupported situations stop safely.

### JOB-P5-T02 — Autonomous Orchestrator, Scheduling, Notifications & Production Hardening

Includes:

- scheduled discovery/analysis runs;
- queues/background orchestration;
- retry/backoff;
- concurrency controls;
- auto-apply authorization evaluation;
- daily limits/rate policies;
- notifications and approval reminders;
- end-to-end observability;
- failure recovery;
- security hardening;
- deployment readiness;
- agent activity dashboard;
- operational runbooks.

Acceptance:
The system can safely operate as a controlled autonomous job agent within configured policies while remaining observable and interruptible.

---

# 17. Current Project Status

Current status:

- Product concept: DEFINED
- High-level architecture: DEFINED
- Macro roadmap: DEFINED
- Implementation repository: NOT YET INITIALIZED/CONFIRMED IN THIS DOCUMENT
- Production integrations: NOT STARTED
- Browser automation: NOT STARTED
- MVP: NOT STARTED

Current active task:

**JOB-P0-T01 — Project Foundation, Architecture, Policies & Documentation**

This master document is one of the outputs of JOB-P0-T01.

The next implementation step after foundation approval is:

**JOB-P1-T01 — Workspace, Database & Core Platform Foundation**

Do not begin browser automation first.

---

# 18. ChatGPT ↔ Antigravity 2.0 Workflow

Preferred development workflow:

CHATGPT

- discuss requirements;
- maintain architecture;
- define macro tasks;
- generate implementation prompts;
- review Antigravity completion reports;
- identify gaps and next task;
- keep project context coherent.

ANTIGRAVITY 2.0

- inspect repository;
- read AGENTS.md and relevant project docs;
- implement approved macro task;
- create/edit code;
- run migrations;
- run tests;
- run lint/typecheck/build;
- update relevant docs;
- produce a structured completion report.

USER

- transfers approved prompts to Antigravity;
- handles external approvals/credentials when needed;
- returns Antigravity results to ChatGPT;
- approves product decisions and sensitive application policies.

Git should provide implementation checkpoints and an auditable history.

---

# 19. Antigravity Completion Report Standard

After a macro task, Antigravity should report:

1. Task stamp and final status.
2. Summary of what was implemented.
3. Important architectural decisions.
4. Database migrations/schema changes.
5. New or changed APIs/services.
6. New or changed UI.
7. Tests and verification commands executed.
8. Test/build/typecheck/lint results.
9. Known limitations.
10. Security or privacy considerations.
11. Files/docs updated.
12. Git status/commit recommendation.
13. Recommended next task.

ChatGPT should review the report before the roadmap advances.

---

# 20. Documentation Strategy

Recommended repository documentation:

README.md  
AGENTS.md

docs/

- MASTER_CONTEXT.md
- PRODUCT_SPEC.md
- ARCHITECTURE.md
- DATA_MODEL.md
- SECURITY.md
- AGENT_POLICY.md
- APPLICATION_POLICY.md
- ROADMAP.md
- TASK_LOG.md
- decisions/ (ADRs as needed)

This attached master context can become `docs/MASTER_CONTEXT.md` when the repository is created.

The master context should remain concise enough for AI agents to load, while detailed subsystem specifications belong in their dedicated documents.

---

# 21. Initial Data Model Direction

Likely entities include:

users  
candidate_profiles  
candidate_experiences  
candidate_education  
candidate_projects  
candidate_skills  
candidate_languages  
candidate_certifications  
candidate_facts  
candidate_documents  
job_preferences  
application_answers  
job_sources  
jobs  
job_requirements  
job_scores  
job_decisions  
application_packages  
approval_requests  
applications  
application_events  
email_messages / email_links  
interviews  
agent_actions  
audit_logs

Exact schema design belongs to JOB-P1-T01 and JOB-P1-T02. This list is directional, not a frozen SQL schema.

---

# 22. Important Non-Goals for Early Versions

Do not prioritize:

- universal LinkedIn auto-application;
- account/session scraping as a core dependency;
- CAPTCHA bypass;
- anti-bot evasion;
- automatic fabrication of candidate information;
- fully autonomous salary negotiation;
- recruiter impersonation;
- automatic answers to uncertain legal questions;
- every job board;
- every ATS;
- mobile apps;
- payments;
- subscriptions;
- multi-tenant SaaS;
- complex enterprise administration.

The product should earn autonomy progressively.

---

# 23. Definition of "Done" for a Macro Task

A macro task is not complete merely because code was generated.

"Done" means, as applicable:

- implementation exists;
- migrations are valid;
- UI and API paths work;
- state transitions are coherent;
- tests exist for critical behavior;
- lint/typecheck/build checks pass or exceptions are explicitly documented;
- security/authorization concerns are handled;
- failure cases are considered;
- project documentation is updated;
- Antigravity provides a completion report;
- ChatGPT reviews the result and identifies remaining gaps.

---

# 24. Decision Log — Baseline Decisions

**D-001 — Personal-first:** Build for one real user before multi-user SaaS.

**D-002 — Macro-task planning:** Use a small number of substantial task stamps; implementation details remain unstamped subtasks.

**D-003 — Candidate truth source:** Candidate Brain is authoritative; AI cannot invent experience or qualifications.

**D-004 — Deterministic authorization:** AI recommendations do not directly authorize external actions.

**D-005 — Human uncertainty handling:** Material unknowns create approval requests rather than guesses.

**D-006 — Auditability:** Important decisions, submissions, and status changes are recorded.

**D-007 — Browser isolation:** Browser automation runs in a separate worker.

**D-008 — Provider abstraction:** AI, email, calendar, and ATS integrations should use interfaces/adapters where practical.

**D-009 — Progressive autonomy:** Manual/review workflows come before full auto-application.

**D-010 — LinkedIn dependency:** The product must remain useful without unofficial LinkedIn browser automation.

---

# 25. Immediate Next Step

Finish **JOB-P0-T01** by using this master context to establish the repository-facing foundation documents and the first Antigravity 2.0 implementation prompt.

Then execute:

**JOB-P1-T01 — Workspace, Database & Core Platform Foundation**

The project should not be fragmented into micro tasks unless a real tool/context/risk boundary requires it.

---

# 26. Changelog

## Version 1.0 — 2026-10-04

- Created canonical AI Job Agent project context.
- Consolidated earlier granular roadmap into macro tasks.
- Defined MVP and long-term scope.
- Defined Candidate Brain and truthfulness rules.
- Defined deterministic policy vs AI reasoning boundary.
- Defined application lifecycle.
- Defined architecture direction.
- Defined ChatGPT ↔ Antigravity 2.0 workflow.
- Defined security baseline.
- Defined macro-task sizing rules.
- Established official task stamps JOB-P0-T01 through JOB-P5-T02.
