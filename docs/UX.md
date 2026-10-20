# Jobee — UX

Updated 2026-10-20 against the local Jobee 2.0 interface. [Master context](MASTER_CONTEXT.md) owns product goals; this document owns current navigation, interaction requirements and validation. The implemented three-section shell supersedes older four-destination design navigation.

## Navigation and feature access

The primary destinations are **Explore**, **Applications**, and **Profile**, defined in [navigation.ts](../apps/web/src/ui/navigation.ts). Explore is the default. Old section identifiers and record/notification targets remain compatible; unknown/retired Home destinations resolve to Explore. Preserve record IDs when changing navigation.

| Destination  | Current content and supporting access                                                                                                                                               |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Explore      | Search/results, essential filters, fit explanations, job details, manual import, tracking and preparation selection                                                                 |
| Applications | All applications, Needs review, Interviews, Messages; contextual application workspace and employer lifecycle                                                                       |
| Profile      | Professional/personal context, import review, career intelligence, uploaded documents, saved answers, job preferences, connected accounts, account/appearance settings and activity |

Home and Settings are not additional primary destinations. Settings/activity remain contextual Profile functions. Supporting features must not disappear just because their old top-level navigation was removed.

Authenticated session gating keeps signed-out users out of private views. Switching accounts must not retain another user's selections, modal records or fetched private data. Treat session failure and empty candidate data as different states.

## Explore

Desktop keeps the search/result list beside selected detail; mobile opens detail with a clear return action and focus restoration. Submitted query, filters, pagination and selection survive detail navigation. An asynchronous discovery refresh must use the current query rather than a captured old filter. Late responses must not overwrite newer searches.

Expose only essential workplace/employment/search/sort controls first. Fit ranking is useful only with an explanation: show relevant evidence, a material blocker or an unknown succinctly, with deeper analysis accessible when needed. Keep salary and eligibility unknown when source/candidate information is missing. A fit score is not a submission permission indicator.

Show source identity, real description, company, location and supplied employment/salary information. Partial discovery failures must say which coverage is incomplete; an empty list after a failed source is not “no jobs exist.” Retryable failures preserve query context. Source refresh should not discard manual corrections or historical analysis.

Manual import and correction/archive remain accessible. Public company-board configuration is not a global employer catalog. Avoid promising all jobs, a guaranteed match or a fixed live vacancy count. Previously attempted jobs should link to their application context rather than inviting duplicate submission.

## Profile and onboarding

Candidates can start with a CV or manual entry. Education, projects and transferable skills matter when employment history is absent. Optional fields and completeness suggestions should not block basic exploration. Never prefill sensitive legal answers from assumed background.

Keep these choices explicit:

1. Add/store a document.
2. Authorize external processing where used.
3. Review and accept extracted proposals/conflicts.
4. Verify facts and permit later AI use.

A successful upload does not mean the profile is verified. Import states must distinguish pending extraction, suggestions, conflicts, accepted/rejected items and retryable failure. Accepting a suggestion should not silently overwrite conflicting verified context.

Document management includes uploaded originals, explicit intent, view/download, delete where supported, and clear storage/retrieval failures. Preview loading/unavailable/unsupported states need usable fallback actions. The UI must not pretend a failed download produced a document.

Saved answers expose verification and AUTO/REVIEW/MANUAL meaning. Material edits clear verification unless deliberately reconfirmed. Sensitive/scoped answers need the appropriate application-question approval even if stored and verified. Use plain explanations rather than internal enum names as the only guidance.

Preferences include roles, locations, work modes, employment/seniority, languages, compensation/currency/period, excluded employers/keywords, authorization countries, internship eligibility and availability. Preserve false versus unknown and explicit clearing versus omission. A preferences load failure offers retry and must not let a default form overwrite existing values.

Ordinary job preferences precede separate submission-permission controls. Automation is a conscious opt-in. Editing preferences or connecting an account cannot silently grant employer-submit rights. Desktop preference forms use the available width; mobile stays readable in one column.

## Application preparation and review

Persistent selected-job preparation survives reload. Each item shows progress, selected base CV, material state, remaining questions, errors, retry and cancellation where implemented. Multi-job selection is bounded; current preparation selection supports up to ten jobs. Do not imply that cancelling preparation recalls an already dispatched employer submission.

The [application workspace](../apps/web/src/components/ApplicationWorkspaceView.tsx) brings overview, documents, questions, final review and progress into application context. Preserve user drafts when navigating or when a recoverable request fails. Steps that are blocked must explain why and remain understandable to keyboard/screen-reader users.

Repeated questions may be grouped for navigation. Each application still owns its answer and consent. One approval must not silently approve another job, another question or another material version. The final review enumerates eligible applications, current document versions, approval counts and document access. Only a deliberate final action requests the separate signed permissions used by the present reviewed-submission flow.

A prominent apply/preparation action is not evidence that the revised one-click background pipeline is complete. Until its acceptance passes, keep current review safeguards and describe preparation honestly. The target is automatic routine preparation with minimal intervention; implementation details and roadmap state belong in [architecture](ARCHITECTURE.md) and [roadmap](ROADMAP.md).

## Applications and employer activity

Applications includes generated workflows and manually tracked applications. Manual records without package versions must render normally; do not require fake documents or synthetic associations. Preserve history, notes, contacts, offers, assessments and interview preparation.

Execution progress and employer lifecycle are separate. Prepared, queued, filling, awaiting input, failed and uncertain runs are not confirmed Applied. A DRY_RUN/PREFILL_ONLY success must remain visibly different from verified external submission. Never imply an employer viewed/reviewed an application from elapsed time.

Needs review is an actionable queue, not merely an error count. Explain the missing fact, approval, stale material, unsupported form or challenge and provide a direct next action. Ambiguous submission requires employer verification and explicit reconciliation; never offer an unqualified “retry now” that could duplicate an application.

Messages and Interviews remain reachable within Applications and relevant record contexts. Gmail classification/linking and calendar/preparation can be incomplete or disconnected; show reconnection and error states honestly. Connecting identity login does not automatically connect mail/calendar. Interview reminders and review items must retain record navigation.

## Common state and interaction requirements

| State                 | Required behavior                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| Loading               | Keep context and indicate actual work; avoid presenting zero values as fetched data            |
| Empty                 | Explain whether there is no data, no search result, no connected account or no required action |
| Partial success       | Show successful results plus specific failures; retain per-item recovery                       |
| Error                 | Readable reason, preserved draft/query and a safe retry if appropriate                         |
| Stale                 | Explain which relevant input changed and why regeneration/review is required                   |
| Needs input           | Ask only for material missing information/consent, with clear scope                            |
| Unsupported/challenge | Manual employer-site handoff; no promise of automatic completion                               |
| Uncertain submission  | Visible warning, preserved evidence and reconciliation before retry                            |
| Disconnected          | Distinguish missing configuration, expired grant and intentional disconnection                 |
| Success               | State exactly what completed: upload, preparation, prefill or verified submission              |

Use semantic buttons, labeled inputs, associated errors, readable contrast, visible focus and sensible headings. Dialogs must move/contain/restore focus; mobile sidebar inertness must not strand keyboard focus. Disabled/blocked step navigation must be understandable rather than a silent focus trap. Support zoom, long titles, narrow viewports and content overflow without hiding the next action.

Both Light and Dark themes are implemented with the current UI tokens. Validate dialogs, empty states, previews, menus, status badges and error messages in both themes; a default desktop screenshot alone is insufficient. Respect reduced motion where applicable and avoid using color alone to communicate safety-critical states. These are ongoing validation requirements, not a formal accessibility conformance claim.

## Design references and assets

Retained owner-approved Figma references:

- [Flow guide](https://www.figma.com/design/WistInjosE5NSGLCAnpznU/Untitled?node-id=303-24509).
- [Screen/state index](https://www.figma.com/design/WistInjosE5NSGLCAnpznU/Untitled?node-id=304-36).
- Representative Light/Dark pairs: jobs `294:1737` / `294:1817`; detail `294:3267` / `294:3336`; applications `294:3515` / `294:3601`; documents `294:5346` / `294:5434`; questions `294:5522` / `294:5615`; final review `294:5708` / `294:5794`; progress `294:9277` / `294:9365`; profile `294:14462` / `294:14544`; document intent `298:2781` / `298:2876`.

Those frames remain useful visual references, but older Home/Settings grouping does not override current three-section navigation. Their prototype links are not functioning integrations or proof of submission behavior. No live Figma inspection or file modification was performed for this cleanup.

The old design-reference JSON was documentation-only and has been removed. Runtime asset provenance remains in [Figma asset manifest](../apps/web/public/assets/figma/manifest.json) and [icon sources](../apps/web/public/assets/icons/sources.json). Keep those machine-readable assets with their actual files and consumers; they are not competing product specifications.

## Validation and known limits

Browser scenarios are under [web E2E](../apps/web/e2e/), with theme/platform references and isolated synthetic records. [Playwright configuration](../playwright.config.ts) rejects non-loopback/non-isolated UI targets. Build shared packages before starting watched servers. Snapshot references are platform-specific; do not replace Linux references with macOS captures. The historical contract-audit script remains a comparison tool, not a reason to forbid approved later behavior changes.

The preceding feature checkpoint recorded 37 passing Chromium scenarios plus three affected render/navigation checks and inspected desktop themes/390px mobile. [Status](STATUS.md) distinguishes that evidence from checks rerun for documentation consolidation. Earlier Home snapshots do not constitute a new pixel baseline for Explore.

Human student usability and measured time savings remain unverified. Recruit 5–8 students, including someone without a CV/employment history, using synthetic records only. Test finding a relevant internship, understanding fit/unknowns, starting preparation, resolving separate personal questions, reviewing materials, reading confirmed versus uncertain progress, finding messages/interviews and editing profile/preferences. Ask participants to explain what action grants consent and what actually means Applied.

Capture first action, time to find next step, navigation changes, completion without help, errors, help and confidence using participant aliases. Do not collect CVs, work-authorization answers, real message text or account tokens. Suggested targets are next action identified within 10 seconds and at least four of the first five participants completing supported navigation tasks without help, with no confusion that preparation is submission. These are proposed targets, not observed outcomes or statistical claims. Rank issues by severity/frequency and revalidate the affected states without removing authorization rules.
