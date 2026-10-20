import type { ApplicationLifecycleStatus, BrowserRunStatus } from '@job-agent/shared';

/** Describe recorded evidence without treating preparation or a running browser as submission. */
export function submissionSummary(
  status: ApplicationLifecycleStatus,
  appliedAt?: string | null,
  latestRunStatus?: BrowserRunStatus,
): string {
  if (latestRunStatus === 'SUBMISSION_UNCERTAIN')
    return 'Submission needs confirmation. Check the employer portal before trying again.';
  if (status === 'APPLYING')
    return 'Submission is in progress. Confirmation has not been recorded yet.';
  if (appliedAt) return 'A submission is recorded. No saved document version is linked to it.';
  if (['APPLIED', 'CONFIRMATION_RECEIVED'].includes(status))
    return 'Marked as applied. No saved document version is linked to it.';
  if (status === 'READY_TO_APPLY')
    return 'Ready for your final review. Preparing documents does not submit an application.';
  if (['DISCOVERED', 'ANALYZED', 'MATCHED', 'NEEDS_REVIEW', 'SKIPPED'].includes(status))
    return 'No submission has been recorded for this application.';
  return 'No submitted document version is linked. Check the application history for submission details.';
}

export function initialApplicationView(): 'board' | 'list' {
  try {
    return localStorage.getItem('jobee.applications.view') === 'board' ? 'board' : 'list';
  } catch {
    return 'list';
  }
}
