# Student UX review protocol

Status: ready for sessions; **no participants tested and no usability outcome claimed**. Use only synthetic records. Parent milestone: JOB-UI-MIGRATION-01, student UX continuation. The owner approved the full Figma flow and authorized implementation; sessions are future validation, not an outstanding coding-approval gate.

Recruit 5–8 students, including at least one without a CV or professional work history. Do not require participants to connect real mail/calendar accounts, disclose sensitive personal answers, submit an application or grant AI consent.

## Setup

- Baseline: the previous eight-destination interface with comparable synthetic records. Compare with the approved four-destination application preview using the same amount of task data.
- Start the design review at [the review guide](https://www.figma.com/design/WistInjosE5NSGLCAnpznU/Untitled?node-id=303-24509). Alternate which interface participants see first to reduce learning bias.
- Use the isolated local preview for functional tasks and the approved Figma for visual discussion. Figma supports navigation and representative states; it does not run external actions or complete editors. Do not compare prototype-only stopping points with complete real-app submission time.
- Keep the browser at 1440px initially; record preferred theme and any need for zoom. No production account is needed.
- Ask participants to think aloud without naming the correct menu or button. Record when facilitator help becomes necessary.

## Comparable tasks

| Task prompt                                                                                | Observable outcome                                                                                                    | Important misunderstanding to check                                            |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| You returned to Jobee. Find what needs your attention first.                               | Identifies the pending application questions or profile suggestions from Home.                                        | Treating every metric as urgent; believing setup must reach 100%.              |
| Find a suitable internship and show how you would start preparing an application.          | Finds a role, reads details and locates the preparation entry point.                                                  | Treating preparation, match score or document creation as a submission.        |
| Your application needs two personal answers. Find them and explain what is still required. | Locates Questions, recognizes unresolved fields and understands separate approval decisions.                          | Approving one item clears all blockers; guessing authorization/sponsorship.    |
| Show where you would check the CV and letter before applying.                              | Locates application documents and their review entry points.                                                          | Downloading or prefill means Applied.                                          |
| Find the status of the Northstar application and what to do next.                          | Locates application list, reads Needs review and next action.                                                         | Confusing Preparing with confirmed Applied.                                    |
| Find your upcoming interview and its preparation notes.                                    | Reaches My applications / Interviews and the interview entry point.                                                   | Believing interviews disappeared after the sidebar regrouping.                 |
| Locate recruiter messages and any items needing review.                                    | Finds Messages and distinguishes it from the review queue.                                                            | Empty review queue means the mailbox has no messages.                          |
| Start without a CV or previous employment. Explain the next step.                          | Finds manual profile entry in the preview (or Getting started Figma example) and recognizes work history as optional. | Uploading automatically grants external processing or later AI-use permission. |
| Locate your uploaded document, saved answers, job preferences and appearance choice.       | Names/reaches the relevant profile/Settings location; note any secondary links not yet interactive.                   | Lost supporting capabilities or excessive nested navigation.                   |

## Capture per task

| Participant alias | Interface/order | Task | First action | Time to identify next step | Navigation changes | Completion without help | Errors/confusion | Help needed | Confidence 1–5 |
| ----------------- | --------------- | ---- | ------------ | -------------------------- | ------------------ | ----------------------- | ---------------- | ----------- | -------------- |
| Not tested        | —               | —    | —            | —                          | —                  | —                       | —                | —           | —              |

Do not collect CV contents, work-authorization answers, message text, tokens or real candidate identifiers. Notes should describe the interaction problem and the participant's understanding.

Proposed acceptance targets: next task identified within 10 seconds for returning users; at least four of the first five participants complete each supported core navigation task without help; fewer unnecessary screen changes; no misunderstanding that preparation is submission or that one approval grants unrelated permission. These are targets, not measured results or statistical claims.

## Decision after sessions

Rank observed problems by severity and frequency, then refine the approved application flow and its feature-access inventory. Recheck conditional states, restoration and focus contracts for each refinement. Do not retire features or change scoring/consent/authorization rules based on this small study alone.
