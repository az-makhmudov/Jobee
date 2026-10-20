# JOB-PRODUCT-EVOLUTION-01 — Product evolution

Owner authorization: 20 October 2026, implement the JobAssist-inspired plan and deploy. This program includes the pending JOB-UI-MIGRATION-01 student interface release. No employer application, recruiter message, calendar mutation or paid AI call is performed as release validation.

## Delivered journey

Home, Find jobs, My applications and My profile remain the main destinations. Find jobs supports selecting up to ten roles, choosing a CV and preparing a persistent selection. The selection survives reloads; each role exposes preparation progress, documents, remaining questions, retry and cancellation. Repeated questions are grouped for navigation only: each role retains its own answers, permissions and approvals.

Search settings configure public Arbeitnow, Greenhouse, Lever and Ashby sources and company board slugs. Traversal rotates boards and advances through full feeds or provider pages, rather than repeatedly stopping at three matches. Discovery is bounded to five company boards, 200 examined rows and 50 new jobs per run. Duplicate rows do not consume the new-job limit. Failures remain visible in source results. Known title preferences, adjacent roles and exclusions filter before preparation. Remote work does not establish legal eligibility; missing salary, jurisdiction and other facts remain unknown. Company feeds are not a global jobs catalog.

The final batch review enumerates eligible jobs, document versions, approved-answer counts and document links. A deliberate candidate action submits a separate short-lived signed manifest for each enumerated application. Unsupported destinations require the employer website. Supported hosted Greenhouse, Lever and Ashby forms are inspected at runtime; custom fields, inaccessible forms and bot challenges can still require manual assistance. Provider coverage is fixture-verified, not a claim that all forms on each platform work.

Daily discovery and preparation require candidate opt-in. A rolling 24-hour schedule uses durable leases; expired leases can recover after restart. Only MATCH results are selected for daily preparation, within the candidate's preparation budget. The optional digest is an in-app notification. Existing Gmail/Calendar reconnection and interview workspaces remain available. Daily assistance does not authorize new submissions or send outbound recruiter messages.

## Reliability and architecture

Additive migration `0022_product_evolution` adds search settings/traversal leases, preparation batches/items and browser authorization/evidence records. Existing package, document, approval and CRM services remain authoritative. The API runs one preparation at a time per instance using database row claims, a heartbeat and an active-job uniqueness constraint. Lost generation becomes a visible failed item after its lease expires; deliberate retry heals existing incomplete materials. The document generator remains in the API process; the isolated worker continues to execute employer forms.

Cache keys include tenant, candidate facts and their permissions, documents, preferences, job content, chosen base CV and a generation algorithm version. Unchanged completed inputs reuse materials. Changed queued inputs stop for review; changed inputs during generation mark the result stale. Generation uses the existing deterministic, evidence-grounded CV/letter engines. The concise letter template no longer imports inferred matching strengths as candidate claims.

Queue creation and scheduled submission share the database package's authorization service; API facade imports remain compatible. Per-user and per-application locks prevent duplicate dispatch and enforce the candidate's daily application limit (maximum 20). The worker revalidates the signed package/input manifest when claiming and immediately before dispatch. It uploads the actual checksum-verified CV and requested letter bytes. Approved sensitive answers only match the exact reviewed question; they are never generally reused across differently worded forms.

A click is not success. Adapters observe new visible provider confirmation, validation rejection, or uncertainty. Internal attempt IDs remain separate from employer references. Generic-form automatic submission is disabled. Screenshots are actually captured and checked in private storage, served through ownership-protected endpoints, expire from access after 30 days and are pruned in bounded background work. Ambiguous dispatch blocks retry until a candidate checks the employer and explicitly reconciles the attempt. Worker claims and heartbeats prevent competing execution; stale orphaned attempts retain uncertainty.

Preparation metrics at `/api/job-search/metrics` report a tenant's counts, queue age and median/p95 preparation duration over 30 days. AI cost is explicitly unknown; deterministic preparation incurs no generative-provider call. Existing matching provider accounting remains separate. No active-time savings or hiring-conversion improvement is claimed.

## Rollout and rollback

`BATCH_PREPARATION_ENABLED` and `SELECTED_SUBMISSIONS_ENABLED` default to true and can pause the new workflows without deleting materials. Daily assistance remains off until the candidate enables it. Production startup migrates schema before serving requests. Release both API and worker from the same tested commit; avoid leaving a legacy click-only worker paired with the new queue. The Node 24 container matches CI.

Schema changes are additive. Retain records and evidence on rollback; disable affected features first. A prior worker must not consume new authorized runs while paused or rolling back. Expired, changed, unknown and uncertain submissions require new candidate attention rather than automatic retry.

## Acceptance evidence and remaining evaluation

Automated coverage includes source traversal/duplicates/failure isolation, lease recovery, budgets, persistent selection, partial generation, cache reuse, tenant isolation, manifest invalidation, concurrent dispatch, uncertain retry blocking, explicit reconciliation, evidence ownership/expiry, delayed confirmation, absent receipts, network interruption and provider-specific fixture signals. Existing theme, mobile, document, consent and student-navigation regressions remain release gates.

Five-to-eight-person usability sessions, the 30-vacancy human relevance benchmark, active-time/AI-cost comparisons, real employer-confirmed application results and interview conversion require subsequent observations. These are not established by fixture tests or deployment. Dedicated Indeed session support and additional local/university feeds remain demand-led research, as specified in the plan.
