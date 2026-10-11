# Jobee — Autonomous Agent Policy

This policy governs the behavior, responsibilities, and operational bounds of AI coding agents (such as Antigravity) working on the codebase, as well as runtime AI models evaluating jobs.

---

## 1. Prime Invariant

> **AI evaluates and prepares. Rules authorize. Humans handle uncertainty. Everything is auditable.**

### Rule Implications:

1. **Never Invent Candidate Facts**: The system and any assisting AI must NEVER fabricate qualifications, degrees, companies, job titles, start/end dates, skills, certifications, work authorization/visas, or salary history.
2. **Deterministic Authorization Over Autonomous Discretion**: Autonomous agents cannot decide on their own to dispatch an application to an employer. A deterministic policy configured and verified by the human user must explicitly allow the action.
3. **Escalate Material Uncertainty**: If a form field or requirement cannot be resolved with certainty from the Candidate Brain, halt and request human clarification.
4. **Audit Everything**: Any AI output that affects candidate representation or application submission must be preserved in structured audit logs with the prompt/context used.

---

## 2. Rules for Coding Agents Working on This Repository

1. **Preserve Official Macro-Task Stamps**: Always operate under canonical macro-task stamps (e.g. `JOB-P1-T01`, `JOB-P1-T02`). Do not fragment official roadmap tasks into dozens of tiny, confusing sub-tasks.
2. **Inspect Before Modifying**: Read master context, existing code, and git state before writing or refactoring.
3. **Additive, Reviewable Migrations**: Database schemas must evolve through clean, forward-compatible Drizzle migrations. Never modify existing production database state destructively.
4. **No Premature Architecture**: Do not implement unrequested components (e.g., full LLM chains, multi-tenant auth, Redis queues) until the roadmap task calls for them. Keep abstractions lean and focused.
5. **Zero Secrets in Git**: Never place real API tokens, database connection strings, or personal data into committed files or git history.
6. **Mandatory Verification**: Every task completion must run and verify:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run test`
   - `npm run build`
7. **CRM Lifecycle & Provenance Invariants**: Never mutate application lifecycle status or submission provenance arbitrarily; adhere strictly to deterministic state machine rules, frozen submission provenance, and append-only lifecycle event logging.
