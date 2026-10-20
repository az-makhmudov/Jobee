# Jobee 2.0 — System Architecture

Updated 2026-10-20. Owner: Codex. Scope: JOB-P0-T01 repository reconciliation; target changes await owner approval.

## Observed implementation

| Boundary            | Existing implementation                                                                                     | Decision                                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Web                 | React/TypeScript/Vite; App.tsx; navigation.ts; contextual application workspace and profile tools           | Three primary destinations implemented locally: Explore, Applications, Profile; preserve record links |
| API                 | Fastify; candidate, discovery, matching, package, CRM, email, calendar, browser-run and orchestrator routes | Retain API; add one durable application entry point through existing services                         |
| Worker              | Separate Node/Playwright process; persistent browser runs, adapters, orphan recovery and notifications      | Retain isolation; connect preparation and execution with durable checkpoints                          |
| Persistence         | PostgreSQL/Drizzle; 23 journal entries 0000–0022                                                            | Additive changes only after model mapping; retain historical tables/IDs                               |
| Storage             | Shared local and S3-compatible providers; document artifacts and protected browser evidence                 | Retain R2-compatible abstraction and retention controls                                               |
| AI                  | Dynamic provider interface; Gemini/OpenAI/disabled/mock implementations; structured validation              | Reuse grounded analysis and generation; deterministic authorization remains independent               |
| Identity/deployment | Better Auth, tenant-scoped records, Railway API and worker configuration                                    | Preserve existing security boundaries; no infrastructure replacement                                  |

## Current workflow gaps

PreparationBatchService creates durable selected-job preparation and separately issues review tickets and submits selected ready items. SubmissionAuthorizationService binds authorization to package versions, artifacts, answers and input fingerprints. BrowserWorkerService supports TOKEN and POLICY paths; preserve and extend these checks rather than replacing them with a boolean.

AutonomousOrchestrator has its own discovery path, exclusion-only matching and draft-record preparation. DailySearchService uses fuller discovery/matching/preparation but expressly never submits. Neither is proof of the required shared end-to-end Autopilot. Consolidate their useful behavior behind one pipeline with two triggers, using existing process boundaries. Do not add independent agents, a message broker or microservices without evidence of need.

Browser runs already distinguish SUBMISSION_UNCERTAIN, CAPTCHA and manual review. Preserve these semantics. SUCCESS must be interpreted with run mode: DRY_RUN or PREFILL_ONLY success is not an employer submission. Map the existing states into user-facing execution status without overwriting employer lifecycle history. Add explicit cancellation/resume semantics only where execution is safe.

The conceptual data mapping and preservation plan is in DATA_MODEL.md; evidence and acceptance gaps are in JOBEE_2_ASSESSMENT.md. Existing production deployment is historical evidence, not a new live verification.

## Target architecture and acceptance

The following owner specification defines the target, subject to the observed mappings above and the current approval boundary.

# JOBEE 2.0 — ARCHITECTURE.md

**Version:** 2.0\
**Date:** 2026-10-20\
**Status:** Target architecture; actual repository structure must be inspected before implementation

## 1. Architectural Objective

Build a reliable AI-first job application system capable of executing complex job-search and application workflows with minimal user interaction.

The system should use the simplest architecture that can provide:

- Intelligent decisions.
- Reliable browser and provider interactions.
- Background execution.
- Verified candidate information.
- Explicit user authorization.
- Accurate application tracking.
- Auditability and recovery.

Do not introduce unnecessary microservices, independent AI agents or infrastructure until a demonstrated need exists.

## 2. Preferred Technology Direction

Retain the existing project's preferred stack unless the repository audit justifies a change:

| Layer                | Preferred technology                                 |
| -------------------- | ---------------------------------------------------- |
| Frontend             | React, TypeScript, Vite                              |
| Backend              | Node.js, TypeScript                                  |
| Database             | PostgreSQL                                           |
| Database access      | Drizzle ORM                                          |
| Document storage     | Cloudflare R2 or compatible storage                  |
| Browser execution    | Playwright in an isolated worker                     |
| AI                   | Provider-agnostic model interface                    |
| Background execution | Durable job orchestration with retries               |
| Integrations         | Modular job-source, email, calendar and ATS adapters |

These are architectural preferences, not verified descriptions of the current codebase.

## 3. Main Logical Components

### Candidate Brain

Stores verified candidate information, qualifications, experience, projects, documents, reusable answers and preferences.

All submitted application claims must be grounded in this information.

AI-extracted CV data must be reviewed before being treated as verified.

### Job Discovery Engine

Discovers jobs from supported public sources, job-alert emails and manually provided links or descriptions.

Responsibilities include normalization, source metadata, deduplication, freshness checking and job ingestion.

Official or permitted data sources should be preferred. The product must not depend on unsupported LinkedIn browser automation.

### Job Intelligence Engine

Analyzes job descriptions, extracts requirements, evaluates candidate fit and identifies blockers or uncertainties.

Matching combines AI semantic reasoning with deterministic eligibility checks.

The system must distinguish a low professional fit from a hard eligibility blocker or simply missing information.

### Application Orchestrator

The central coordinator for one-click and Autopilot application attempts.

Responsibilities include:

- Receiving an authorized application request.
- Evaluating candidate facts and applicable rules.
- Preparing the execution plan.
- Calling document-generation and form-execution tools.
- Managing workflow state.
- Pausing when approval is needed.
- Handling retries and failures.
- Verifying results.
- Recording actions and outcomes.

Use a tool-driven agentic workflow rather than requiring a separately deployed AI agent for each responsibility.

### Application Execution Worker

Executes application interactions independently of the main web/API process.

Responsibilities include provider detection, form extraction, field mapping, document uploads, field completion, validation, submission and result capture.

Initial provider adapters should prioritize realistically supportable systems such as Greenhouse, Lever and Ashby.

A CAPTCHA, identity challenge, unsupported form or unresolved material question requires manual intervention. The worker must not evade protective measures.

### Communications and Interview Layer

A later extension that integrates authorized email accounts, interprets recruiter communications, associates messages with applications and assists with interviews and calendar scheduling.

It is not a prerequisite for the first working one-click application.

## 4. Single Application Pipeline

Both manual one-click and Autopilot triggers use the same pipeline:

DISCOVER / SELECT

→ EVALUATE

→ AUTHORIZE

→ PREPARE

→ FILL

→ VALIDATE

→ SUBMIT

→ VERIFY

→ RECORD

At any appropriate stage the system may move into NEEDS_USER_ACTION, FAILED, or an explicitly unresolved state.

No mandatory user-facing steps are required between selection and execution when verified information and authorization are sufficient.

## 5. Authorization Model

AI decides what it recommends doing. Explicit user permissions and deterministic policy rules decide what it is allowed to do.

### One-click authorization

Clicking Apply with Jobee authorizes an application attempt for the selected job under the user's previously accepted terms and application rules.

The agent may submit when it has sufficient verified data, the provider is supported and no additional material approval is required.

### Autopilot authorization

Autopilot requires explicit opt-in and a stored policy defining:

- Target positions and relevant role families.
- Allowed locations.
- Work arrangement and employment types.
- Eligibility and work authorization.
- Salary requirements where applicable.
- Relevant exclusion rules.
- Application volume and scheduling limits.
- Conditions requiring user review.
- The ability to pause or disable the agent.

A match score alone must never authorize submission.

Autopilot settings must be versioned or snapshotted for traceability.

## 6. Data Architecture

Major conceptual entities:

**Candidate domain**

- CandidateProfile
- CandidateFact
- CandidateExperience
- CandidateEducation
- CandidateSkill
- CandidateDocument
- ApplicationAnswer
- JobPreference
- AutomationPolicy

**Jobs domain**

- Job
- JobSource
- JobRequirement
- JobAnalysis
- JobMatch
- JobDecision

**Application domain**

- Application
- ApplicationAttempt
- ApplicationPackage
- ApplicationDocumentVersion
- ApplicationApproval
- ApplicationEvent
- SubmissionEvidence

**Integration and automation domain**

- AgentRun
- AgentAction
- IntegrationAccount
- IntegrationSync
- Communication
- Interview
- AuditEvent

These are conceptual models. Codex must map them against actual existing schema before adding tables or migrations.

## 7. Separate Lifecycle Dimensions

A job record is not the same as an application.

An application is not the same as an execution attempt.

An execution attempt is not the same as the employer's hiring decision.

Maintain separate state dimensions.

### Execution status

QUEUED, RUNNING, NEEDS_USER_ACTION, SUBMITTING, VERIFYING, SUCCEEDED, FAILED, CANCELLED, UNKNOWN_RESULT.

UNKNOWN_RESULT is necessary when submission may have occurred but evidence is insufficient. In that case, do not blindly retry and risk duplicate applications.

### Employment pipeline status

APPLIED, CONFIRMATION_RECEIVED, SCREENING, ASSESSMENT, INTERVIEW, OFFER, REJECTED, WITHDRAWN, EXPIRED.

Additional internal stages may be retained from the existing canonical model. The UI should group them into simpler user-facing categories.

Never infer an employer viewed or reviewed an application merely from elapsed time.

## 8. Reliable Background Execution

Agentic application workflows must run in durable background execution rather than relying on an open browser tab.

Required behavior:

- Stable application and attempt identifiers.
- Idempotency and duplicate-submission prevention.
- Explicit checkpoints.
- Bounded retries.
- Recovery after interruption.
- Concurrency controls.
- Cancellation and pausing where technically possible.
- Verification before recording success.
- Preserved event history.
- Observability for failed or blocked attempts.

Workers must receive the required permissions and application context, not unrestricted access to unrelated candidate data.

## 9. AI Design and Efficiency

Prefer a single orchestrated workflow with specialized tools and clearly separated reasoning responsibilities.

Avoid multiple independent models performing the same analysis.

Use structured outputs when making machine-consumed decisions.

Cache or reuse stable verified candidate information.

Do not repeatedly regenerate the same answers without reason.

Use stronger AI reasoning for ambiguous requirements, complex forms and unfamiliar questions; use deterministic mapping for stable and previously verified information.

All AI-produced application content requires grounding in candidate facts.

## 10. Security and Privacy

- Prefer OAuth and scoped authorization over stored credentials.
- Encrypt secrets and sensitive tokens.
- Do not store plaintext third-party passwords.
- Isolate browser execution.
- Limit document and account access to authorized operations.
- Maintain agent action and submission audit trails.
- Prevent unauthorized external communication.
- Support user control over integrations and data.
- Avoid sensitive data in logs.
- Define retention and deletion behavior for candidate documents and execution artifacts.
- Account for EU data-protection requirements before any public launch.

## 11. Failure and Human Intervention

When the system encounters uncertainty or a technical limitation, it must make the reason visible.

Examples include missing work authorization information, unknown salary expectations, an unsupported ATS form, CAPTCHA, missing documents, or ambiguous submission results.

The application should remain resumable where possible.

A stopped attempt is not a successful submission.

## 12. Architecture Review Policy

Codex must inspect the existing repository before selecting infrastructure, replacing modules or creating migrations.

Preserve working functionality, historical data and identifiers.

Prefer incremental migration and tests to an unnecessary rewrite.

The primary architectural success criterion is a complete, reliable one-click application workflow, not the number of services or modules created.
