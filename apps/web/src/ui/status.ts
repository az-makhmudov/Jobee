import type { CSSProperties } from 'react';
// Presentation only: the server remains authoritative for lifecycle transitions.
export function applicationStatusStyle(status: string): CSSProperties {
  const tone = [
    'APPLIED',
    'CONFIRMATION_RECEIVED',
    'INTERVIEW',
    'FINAL_INTERVIEW',
    'OFFER',
    'READY_TO_APPLY',
  ].includes(status)
    ? 'success'
    : ['NEEDS_REVIEW', 'SCREENING', 'ASSESSMENT', 'APPLYING'].includes(status)
      ? 'warning'
      : status === 'REJECTED'
        ? 'danger'
        : null;
  return tone
    ? { color: `var(--status-${tone})`, background: `var(--status-${tone}-container)` }
    : { color: 'var(--m3-on-secondary-container)', background: 'var(--m3-secondary-container)' };
}

export function browserRunStyle(status: string): CSSProperties {
  const tone =
    status === 'SUCCESS'
      ? 'success'
      : status === 'SUBMISSION_UNCERTAIN' || status.startsWith('STOPPED')
        ? 'warning'
        : ['FAILED', 'VALIDATION_FAILED'].includes(status)
          ? 'danger'
          : null;
  return tone
    ? { color: `var(--status-${tone})`, backgroundColor: `var(--status-${tone}-container)` }
    : {
        color: 'var(--m3-on-secondary-container)',
        backgroundColor: 'var(--m3-secondary-container)',
      };
}
