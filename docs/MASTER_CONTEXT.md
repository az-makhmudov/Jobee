# Jobee — master context

Updated 2026-10-25. Product source of truth; [status](STATUS.md) records implementation evidence, and [roadmap](ROADMAP.md) records unfinished acceptance. This document describes the intended product and identifies where the core promise is still being completed.

## Purpose and users

**Find the right jobs. Apply intelligently. Track everything.**

Jobee is an AI-assisted job discovery and application agent for individual candidates. Students and early-career applicants are central users: education, projects, transferable skills and limited work history must be meaningful inputs. Experienced applicants also use the same verified candidate context and tracking model. International students are a priority audience; first launch is Poland, with later European/Central Asian expansion only after validation. The repository is private by owner decision and the project is not open source. Starting without a CV or past employer must remain possible.

The product reduces repetitive search, truthful document preparation, repeated questions and fragmented application tracking. Suitable opportunities and credible applications matter more than submission volume. It must make a complex technical workflow understandable without exposing infrastructure or requiring users to manage separate AI agents.

The platform already has authenticated multi-user workspaces. Preserving those security boundaries is required; broad SaaS administration, billing and organization management are outside the initial product objective.

## Principles

> **AI evaluates and prepares. Rules authorize. Humans handle uncertainty. Everything is auditable.**

Candidate facts come from the candidate and verified records. AI may interpret evidence, explain fit, propose profile changes and draft materials; it cannot manufacture background, silently verify extracted content, guess legal eligibility or grant submission permission. Review should resolve material uncertainty with the minimum necessary intervention.

A recommendation is distinct from eligibility, preparation, authorization, dispatch and employer confirmation. Every one of these can have a different state. A failed, stopped or ambiguous execution must remain visible, with evidence and a safe next action. Never show a simulated success as an employer application.

Prefer permitted public sources and modular provider adapters. Be honest about feed coverage, provider limitations, cost uncertainty and validation scope. Do not depend on unsupported account automation or evading protective challenges.

The primary path is **Profile → Explore relevant jobs → Read details → Apply with Jobee → Track applications**. Optional source diagnostics, bulk preparation and communication tools belong behind contextual disclosure. Gemini is the only production AI provider, configured by the operator; users do not select providers/models. Ordinary users have 10 application attempt reservations per UTC day; admins and admin-designated testers are exempt from that platform cap. Duplicate, consent, material and uncertainty checks still apply. All users can save up to 10 candidate documents; existing excess records are preserved and block further uploads until reduced. Self-service account deletion is a required remaining launch capability, not yet implemented.

## Core modules

| Module          | Product responsibility                                                                  | Current boundary                                                                           |
| --------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Candidate Brain | Verified professional context, documents, reusable answers, permissions and preferences | Implemented; imported suggestions still require verification                               |
| Discovery       | Find/import jobs, normalize sources, deduplicate and preserve freshness                 | Public feeds and manual import exist; configured company boards are not a global catalog   |
| Matching        | Grounded fit, eligibility and useful explanations                                       | Shared backend engine implemented across API/daily/worker paths                            |
| Preparation     | Tailored CV/letter, question resolution, versioned materials and provenance             | Durable intent drives automatic preparation; reviewed flows remain available               |
| Execution       | Authorized form completion, submission, verification and recovery                       | One-click fixtures pass; employer-confirmed live acceptance remains open                   |
| Applications    | Attempts, employer lifecycle, documents, attention, messages and interviews             | Attention/recovery and contextual messages/interviews implemented locally                  |
| Integrations    | Authorized email enrichment and calendar assistance                                     | Contextual read-only email and scoped calendar fixtures pass; live acceptance remains open |
| Autopilot       | Scheduled eligible applications under an explicit bounded policy                        | Versioned opt-in now uses the shared intent engine locally; rollout defaults off           |

## Candidate journey

### 1. Build trustworthy context

The candidate signs in, uploads a CV or enters information manually, reviews import suggestions, verifies material facts and sets preferences. Professional history, education, projects, skills and documents remain editable. Job exploration must not be blocked by an arbitrary completeness percentage or optional sensitive disclosures.

Keep document upload, consent to external processing, acceptance of extracted information and permission for later AI use as separate choices. An upload alone grants none of the other permissions. Work authorization is explicit by country; residence, remote work or no sponsorship does not imply worldwide eligibility. Salary requirements need explicit currency and pay period before meaningful comparison.

### 2. Explore relevant roles

Explore is the default destination. Candidates search, filter and compare jobs with concise fit explanations, blockers, unknowns and source details. On desktop the detail sits beside the retained result list; on mobile candidates can return to their search context. Manual URLs/text remain supported when a discovery source is missing or inaccessible.

AI interprets relevant evidence; deterministic gates enforce material restrictions. A weak professional fit, a confirmed blocker and missing information must have different explanations. Stale analyses cannot preserve automatic eligibility.

### 3. Prepare and apply

Candidates can choose **Apply with Jobee** to authorize one job-scoped background workflow for up to one hour. The application and permission persist before preparation. Routine materials and verified answers to actual employer-form questions are prepared automatically; missing facts and sensitive questions pause in application context. Reviewed preparation/submission flows remain available. Each application retains its own materials and permission; shared question navigation never implies shared consent.

The **One-click Apply target** is one prominent “Apply with Jobee” action that durably authorizes an attempt for that job under accepted terms, then automatically prepares and executes routine work in the background. It must not require a separate studio/package wizard when verified information is sufficient. Missing facts, required sensitive/legal consent, unsupported forms and technical challenges pause the attempt with a direct recovery action.

The local implementation binds signed material authorization to durable intent and rechecks it before dispatch. Deterministic fixture success does not establish live provider coverage or employer-confirmed acceptance; that remaining boundary is recorded in the roadmap.

### 4. Track truthful outcomes

Applications includes automated attempts and manually tracked applications. Execution progress and employer hiring status remain distinct. Confirmed submission freezes the exact submitted material provenance. Messages, interviews, offers, notes and follow-ups appear in context. A manually tracked application need not have generated materials.

Dry run/prefill completion is not Applied. A click without confirmation may be uncertain. Do not infer employer review, rejection or interest from elapsed time. Human corrections and reconciliation must retain their audit trail.

### 5. Enable bounded Autopilot

The **Autopilot target** follows a working One-click engine. The candidate explicitly opts into a versioned or snapshotted policy defining roles, locations, work modes, employment types, eligibility, salary constraints, exclusions, volume/schedule and review conditions. The same engine serves both manual and scheduled triggers.

Users must be able to pause, disable and revise that policy. Revocation is checked before dispatch; already dispatched actions require reconciliation. Existing daily discovery/preparation is useful assistance but never grants submission permission. Legacy `autoApplyEnabled` must not silently expand into broader powers.

## Requirements and non-goals

Essential requirements are progressive onboarding; verified source-aware candidate context; useful discovery and shared matching; durable, idempotent preparation/execution; current authorization at dispatch; safe uncertainty/retry handling; tenant isolation; private documents and tokens; auditable events; accessible responsive interfaces in both themes.

The revised MVP requires one provider completing the authorized prepare/fill/submit/verify/record journey, including failure and recovery cases. Fixture coverage proves local behavior. Real employer-confirmed validation is a separate acceptance step requiring a named owner-approved target and action.

Initial non-goals: universal ATS support, dedicated mobile apps, billing/subscriptions, complex SaaS administration, standalone CV or agent-management dashboards, unrestricted recruiter messaging, automatic salary negotiation, unsupported LinkedIn automation, CAPTCHA bypass and invented qualifications. Existing useful tools remain accessible contextually rather than being deleted to meet a navigation count.

## Measuring success

Measure recommendation relevance, supported attempts with verified outcomes, unnecessary intervention, duplicates, factual accuracy, failure/recovery rates, user effort and conversion from discovery to verified submission. Hiring outcomes, saved time, model costs and student usability need actual observations. Deployment or fixture counts alone cannot establish those outcomes.

Use [architecture](ARCHITECTURE.md) for implementation boundaries, [policies](POLICIES.md) for safety, and [UX](UX.md) for current interaction behavior. Engineering procedure belongs only in [AGENTS.md](../AGENTS.md).
