import { describe, it, expect } from 'vitest';
import { ApplicationStateMachine } from './application-state-machine.js';
import { ApplicationLifecycleStatus, ApplicationEventType } from '@job-agent/shared';

describe('ApplicationStateMachine', () => {
  it('allows valid direct progression from READY_TO_APPLY to APPLIED', () => {
    const result = ApplicationStateMachine.validateTransition(
      ApplicationLifecycleStatus.READY_TO_APPLY,
      ApplicationLifecycleStatus.APPLIED,
    );
    expect(result.allowed).toBe(true);
    expect(result.isNoOp).toBe(false);
    expect(result.mappedEventType).toBe(ApplicationEventType.MARKED_APPLIED);
  });

  it('allows realistic stage skipping from APPLIED directly to INTERVIEW', () => {
    const result = ApplicationStateMachine.validateTransition(
      ApplicationLifecycleStatus.APPLIED,
      ApplicationLifecycleStatus.INTERVIEW,
    );
    expect(result.allowed).toBe(true);
    expect(result.mappedEventType).toBe(ApplicationEventType.INTERVIEW_SCHEDULED_MANUALLY);
  });

  it('allows direct progression from SCREENING to OFFER', () => {
    const result = ApplicationStateMachine.validateTransition(
      ApplicationLifecycleStatus.SCREENING,
      ApplicationLifecycleStatus.OFFER,
    );
    expect(result.allowed).toBe(true);
    expect(result.mappedEventType).toBe(ApplicationEventType.OFFER_RECEIVED);
  });

  it('allows terminal transitions from active stages', () => {
    const rejectFromScreening = ApplicationStateMachine.validateTransition(
      ApplicationLifecycleStatus.SCREENING,
      ApplicationLifecycleStatus.REJECTED,
    );
    expect(rejectFromScreening.allowed).toBe(true);
    expect(rejectFromScreening.mappedEventType).toBe(ApplicationEventType.REJECTED);

    const withdrawFromInterview = ApplicationStateMachine.validateTransition(
      ApplicationLifecycleStatus.INTERVIEW,
      ApplicationLifecycleStatus.WITHDRAWN,
    );
    expect(withdrawFromInterview.allowed).toBe(true);
    expect(withdrawFromInterview.mappedEventType).toBe(ApplicationEventType.WITHDRAWN);

    const expireFromReady = ApplicationStateMachine.validateTransition(
      ApplicationLifecycleStatus.READY_TO_APPLY,
      ApplicationLifecycleStatus.EXPIRED,
    );
    expect(expireFromReady.allowed).toBe(true);
    expect(expireFromReady.mappedEventType).toBe(ApplicationEventType.EXPIRED);
  });

  it('treats transition to identical status as an idempotent no-op', () => {
    const noOp = ApplicationStateMachine.validateTransition(
      ApplicationLifecycleStatus.APPLIED,
      ApplicationLifecycleStatus.APPLIED,
    );
    expect(noOp.allowed).toBe(true);
    expect(noOp.isNoOp).toBe(true);
  });

  it('rejects prohibited nonsensical transitions from terminal states', () => {
    const invalid = ApplicationStateMachine.validateTransition(
      ApplicationLifecycleStatus.REJECTED,
      ApplicationLifecycleStatus.SCREENING,
    );
    expect(invalid.allowed).toBe(false);
    expect(invalid.reason).toContain('terminal');

    const invalidOffer = ApplicationStateMachine.validateTransition(
      ApplicationLifecycleStatus.OFFER,
      ApplicationLifecycleStatus.DISCOVERED,
    );
    expect(invalidOffer.allowed).toBe(false);

    const invalidWithdrawn = ApplicationStateMachine.validateTransition(
      ApplicationLifecycleStatus.WITHDRAWN,
      ApplicationLifecycleStatus.APPLYING,
    );
    expect(invalidWithdrawn.allowed).toBe(false);
  });

  it('allows controlled correction override from terminal state when reason provided', () => {
    const correctionWithoutReason = ApplicationStateMachine.validateTransition(
      ApplicationLifecycleStatus.REJECTED,
      ApplicationLifecycleStatus.INTERVIEW,
      { isCorrection: true },
    );
    expect(correctionWithoutReason.allowed).toBe(false);

    const validCorrection = ApplicationStateMachine.validateTransition(
      ApplicationLifecycleStatus.REJECTED,
      ApplicationLifecycleStatus.INTERVIEW,
      { isCorrection: true, correctionReason: 'Recruiter reached back out to reopen process' },
    );
    expect(validCorrection.allowed).toBe(true);
    expect(validCorrection.isCorrection).toBe(true);
    expect(validCorrection.mappedEventType).toBe(ApplicationEventType.STATUS_CORRECTION);
  });
});
