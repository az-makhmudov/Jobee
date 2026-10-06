import {
  ApplicationLifecycleStatus,
  ApplicationEventType,
  TERMINAL_APPLICATION_STATUSES,
} from '@job-agent/shared';

export interface TransitionValidationResult {
  allowed: boolean;
  isNoOp: boolean;
  isCorrection: boolean;
  reason?: string;
  mappedEventType: ApplicationEventType;
}

// Canonical transition map
const ALLOWED_FORWARD_TRANSITIONS: Record<
  ApplicationLifecycleStatus,
  readonly ApplicationLifecycleStatus[]
> = {
  [ApplicationLifecycleStatus.DISCOVERED]: [
    ApplicationLifecycleStatus.ANALYZED,
    ApplicationLifecycleStatus.MATCHED,
    ApplicationLifecycleStatus.SKIPPED,
    ApplicationLifecycleStatus.READY_TO_APPLY,
    ApplicationLifecycleStatus.NEEDS_REVIEW,
    ApplicationLifecycleStatus.APPLYING,
    ApplicationLifecycleStatus.APPLIED,
    ApplicationLifecycleStatus.EXPIRED,
    ApplicationLifecycleStatus.WITHDRAWN,
  ],
  [ApplicationLifecycleStatus.ANALYZED]: [
    ApplicationLifecycleStatus.MATCHED,
    ApplicationLifecycleStatus.SKIPPED,
    ApplicationLifecycleStatus.READY_TO_APPLY,
    ApplicationLifecycleStatus.NEEDS_REVIEW,
    ApplicationLifecycleStatus.APPLYING,
    ApplicationLifecycleStatus.APPLIED,
    ApplicationLifecycleStatus.EXPIRED,
    ApplicationLifecycleStatus.WITHDRAWN,
  ],
  [ApplicationLifecycleStatus.MATCHED]: [
    ApplicationLifecycleStatus.READY_TO_APPLY,
    ApplicationLifecycleStatus.NEEDS_REVIEW,
    ApplicationLifecycleStatus.APPLYING,
    ApplicationLifecycleStatus.APPLIED,
    ApplicationLifecycleStatus.SKIPPED,
    ApplicationLifecycleStatus.EXPIRED,
    ApplicationLifecycleStatus.WITHDRAWN,
  ],
  [ApplicationLifecycleStatus.SKIPPED]: [
    ApplicationLifecycleStatus.READY_TO_APPLY,
    ApplicationLifecycleStatus.NEEDS_REVIEW,
    ApplicationLifecycleStatus.APPLYING,
    ApplicationLifecycleStatus.APPLIED,
    ApplicationLifecycleStatus.EXPIRED,
    ApplicationLifecycleStatus.WITHDRAWN,
  ],
  [ApplicationLifecycleStatus.READY_TO_APPLY]: [
    ApplicationLifecycleStatus.APPLYING,
    ApplicationLifecycleStatus.APPLIED,
    ApplicationLifecycleStatus.NEEDS_REVIEW,
    ApplicationLifecycleStatus.SKIPPED,
    ApplicationLifecycleStatus.REJECTED,
    ApplicationLifecycleStatus.WITHDRAWN,
    ApplicationLifecycleStatus.EXPIRED,
  ],
  [ApplicationLifecycleStatus.NEEDS_REVIEW]: [
    ApplicationLifecycleStatus.READY_TO_APPLY,
    ApplicationLifecycleStatus.APPLIED,
    ApplicationLifecycleStatus.SKIPPED,
    ApplicationLifecycleStatus.REJECTED,
    ApplicationLifecycleStatus.WITHDRAWN,
    ApplicationLifecycleStatus.EXPIRED,
  ],
  [ApplicationLifecycleStatus.APPLYING]: [
    ApplicationLifecycleStatus.APPLIED,
    ApplicationLifecycleStatus.READY_TO_APPLY,
    ApplicationLifecycleStatus.REJECTED,
    ApplicationLifecycleStatus.WITHDRAWN,
    ApplicationLifecycleStatus.EXPIRED,
  ],
  [ApplicationLifecycleStatus.APPLIED]: [
    ApplicationLifecycleStatus.CONFIRMATION_RECEIVED,
    ApplicationLifecycleStatus.SCREENING,
    ApplicationLifecycleStatus.ASSESSMENT,
    ApplicationLifecycleStatus.INTERVIEW,
    ApplicationLifecycleStatus.FINAL_INTERVIEW,
    ApplicationLifecycleStatus.OFFER,
    ApplicationLifecycleStatus.REJECTED,
    ApplicationLifecycleStatus.WITHDRAWN,
    ApplicationLifecycleStatus.EXPIRED,
  ],
  [ApplicationLifecycleStatus.CONFIRMATION_RECEIVED]: [
    ApplicationLifecycleStatus.SCREENING,
    ApplicationLifecycleStatus.ASSESSMENT,
    ApplicationLifecycleStatus.INTERVIEW,
    ApplicationLifecycleStatus.FINAL_INTERVIEW,
    ApplicationLifecycleStatus.OFFER,
    ApplicationLifecycleStatus.REJECTED,
    ApplicationLifecycleStatus.WITHDRAWN,
    ApplicationLifecycleStatus.EXPIRED,
  ],
  [ApplicationLifecycleStatus.SCREENING]: [
    ApplicationLifecycleStatus.ASSESSMENT,
    ApplicationLifecycleStatus.INTERVIEW,
    ApplicationLifecycleStatus.FINAL_INTERVIEW,
    ApplicationLifecycleStatus.OFFER,
    ApplicationLifecycleStatus.REJECTED,
    ApplicationLifecycleStatus.WITHDRAWN,
    ApplicationLifecycleStatus.EXPIRED,
  ],
  [ApplicationLifecycleStatus.ASSESSMENT]: [
    ApplicationLifecycleStatus.SCREENING,
    ApplicationLifecycleStatus.INTERVIEW,
    ApplicationLifecycleStatus.FINAL_INTERVIEW,
    ApplicationLifecycleStatus.OFFER,
    ApplicationLifecycleStatus.REJECTED,
    ApplicationLifecycleStatus.WITHDRAWN,
    ApplicationLifecycleStatus.EXPIRED,
  ],
  [ApplicationLifecycleStatus.INTERVIEW]: [
    ApplicationLifecycleStatus.ASSESSMENT,
    ApplicationLifecycleStatus.FINAL_INTERVIEW,
    ApplicationLifecycleStatus.OFFER,
    ApplicationLifecycleStatus.REJECTED,
    ApplicationLifecycleStatus.WITHDRAWN,
    ApplicationLifecycleStatus.EXPIRED,
  ],
  [ApplicationLifecycleStatus.FINAL_INTERVIEW]: [
    ApplicationLifecycleStatus.OFFER,
    ApplicationLifecycleStatus.REJECTED,
    ApplicationLifecycleStatus.WITHDRAWN,
    ApplicationLifecycleStatus.EXPIRED,
  ],
  [ApplicationLifecycleStatus.OFFER]: [
    ApplicationLifecycleStatus.REJECTED,
    ApplicationLifecycleStatus.WITHDRAWN,
    ApplicationLifecycleStatus.EXPIRED,
  ],
  [ApplicationLifecycleStatus.REJECTED]: [],
  [ApplicationLifecycleStatus.WITHDRAWN]: [],
  [ApplicationLifecycleStatus.EXPIRED]: [],
};

export class ApplicationStateMachine {
  /**
   * Get list of allowed forward statuses from a given status.
   */
  static getAllowedTransitions(
    currentStatus: ApplicationLifecycleStatus,
  ): readonly ApplicationLifecycleStatus[] {
    return ALLOWED_FORWARD_TRANSITIONS[currentStatus] || [];
  }

  /**
   * Check whether a status is terminal.
   */
  static isTerminal(status: ApplicationLifecycleStatus): boolean {
    return (TERMINAL_APPLICATION_STATUSES as readonly string[]).includes(status);
  }

  /**
   * Validate a transition attempt from currentStatus to targetStatus.
   */
  static validateTransition(
    currentStatus: ApplicationLifecycleStatus,
    targetStatus: ApplicationLifecycleStatus,
    options?: {
      isCorrection?: boolean;
      correctionReason?: string;
    },
  ): TransitionValidationResult {
    // 1. Same-state transition (idempotent no-op)
    if (currentStatus === targetStatus) {
      return {
        allowed: true,
        isNoOp: true,
        isCorrection: false,
        mappedEventType: ApplicationEventType.STATUS_CHANGED,
      };
    }

    // 2. Explicit correction override
    if (options?.isCorrection) {
      if (!options.correctionReason || options.correctionReason.trim().length === 0) {
        return {
          allowed: false,
          isNoOp: false,
          isCorrection: true,
          reason: 'A reason must be provided when executing a status correction.',
          mappedEventType: ApplicationEventType.STATUS_CORRECTION,
        };
      }
      return {
        allowed: true,
        isNoOp: false,
        isCorrection: true,
        mappedEventType: ApplicationEventType.STATUS_CORRECTION,
      };
    }

    // 3. Terminal state check
    if (this.isTerminal(currentStatus)) {
      return {
        allowed: false,
        isNoOp: false,
        isCorrection: false,
        reason: `Cannot transition from terminal status '${currentStatus}' to '${targetStatus}' without an explicit correction override.`,
        mappedEventType: ApplicationEventType.STATUS_CHANGED,
      };
    }

    // 4. Standard forward transitions
    const allowed = ALLOWED_FORWARD_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      return {
        allowed: false,
        isNoOp: false,
        isCorrection: false,
        reason: `Invalid lifecycle transition: '${currentStatus}' → '${targetStatus}'. Permitted transitions: ${allowed.length > 0 ? allowed.join(', ') : 'none'}.`,
        mappedEventType: ApplicationEventType.STATUS_CHANGED,
      };
    }

    // 5. Map event type
    const mappedEventType = this.mapStatusToEventType(targetStatus);

    return {
      allowed: true,
      isNoOp: false,
      isCorrection: false,
      mappedEventType,
    };
  }

  /**
   * Map target status to canonical event type.
   */
  private static mapStatusToEventType(
    targetStatus: ApplicationLifecycleStatus,
  ): ApplicationEventType {
    switch (targetStatus) {
      case ApplicationLifecycleStatus.APPLIED:
        return ApplicationEventType.MARKED_APPLIED;
      case ApplicationLifecycleStatus.CONFIRMATION_RECEIVED:
        return ApplicationEventType.CONFIRMATION_RECEIVED;
      case ApplicationLifecycleStatus.SCREENING:
        return ApplicationEventType.SCREENING_STARTED;
      case ApplicationLifecycleStatus.ASSESSMENT:
        return ApplicationEventType.ASSESSMENT_RECEIVED;
      case ApplicationLifecycleStatus.INTERVIEW:
      case ApplicationLifecycleStatus.FINAL_INTERVIEW:
        return ApplicationEventType.INTERVIEW_SCHEDULED_MANUALLY;
      case ApplicationLifecycleStatus.OFFER:
        return ApplicationEventType.OFFER_RECEIVED;
      case ApplicationLifecycleStatus.REJECTED:
        return ApplicationEventType.REJECTED;
      case ApplicationLifecycleStatus.WITHDRAWN:
        return ApplicationEventType.WITHDRAWN;
      case ApplicationLifecycleStatus.EXPIRED:
        return ApplicationEventType.EXPIRED;
      default:
        return ApplicationEventType.STATUS_CHANGED;
    }
  }
}
