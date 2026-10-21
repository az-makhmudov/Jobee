import { describe, it, expect } from 'vitest';
import { applicationAttention, type ApplicationSummaryDto } from './application-crm.js';
const app = {
  status: 'READY_TO_APPLY',
  appliedAt: null,
  isArchived: false,
  closedAt: null,
  nextAction: null,
  isFollowUpDue: false,
  isFollowUpOverdue: false,
} satisfies Parameters<typeof applicationAttention>[0];
const run = (status: string, mode = 'SUBMIT') => ({
  runId: 'fixture',
  status,
  mode,
  createdAt: '2026-10-21T00:00:00Z',
});
describe('Application attention (JOB-P3-T02)', () => {
  it('keeps unknown outcomes visible even on closed records', () => {
    expect(
      applicationAttention(
        { ...app, status: 'WITHDRAWN', closedAt: '2026-10-21' },
        run('SUBMISSION_UNCERTAIN'),
      )?.kind,
    ).toBe('VERIFY_SUBMISSION');
  });
  it('never claims a preview was submitted or requires employer reconciliation', () => {
    expect(applicationAttention(app, run('SUCCESS', 'DRY_RUN'))).toBeNull();
    expect(applicationAttention(app, run('FAILED', 'PREFILL_ONLY'))).toBeNull();
  });
  it('offers a handoff for stopped attempts without changing lifecycle', () => {
    expect(applicationAttention(app, run('STOPPED_CAPTCHA'))?.kind).toBe('MANUAL_HANDOFF');
    expect(app.status).toBe('READY_TO_APPLY');
  });
  it('shows manual follow-ups and next actions without a package', () => {
    expect(
      applicationAttention({
        ...app,
        status: 'APPLIED',
        appliedAt: '2026-10-20',
        isFollowUpDue: true,
      })?.kind,
    ).toBe('FOLLOW_UP');
    expect(applicationAttention({ ...app, nextAction: 'Ask about interview format' })?.kind).toBe(
      'NEXT_ACTION',
    );
  });
  it('does not invent employer activity from age or reopen terminal history', () => {
    expect(applicationAttention({ ...app, status: 'APPLIED', appliedAt: '2020-01-01' })).toBeNull();
    for (const status of ['REJECTED', 'WITHDRAWN', 'EXPIRED'] as ApplicationSummaryDto['status'][])
      expect(applicationAttention({ ...app, status, nextAction: 'Old action' })).toBeNull();
    expect(
      applicationAttention({ ...app, isArchived: true }, run('SUBMISSION_UNCERTAIN')),
    ).toBeNull();
  });
});
