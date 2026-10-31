/** Job-scoped permission; distinct from generated materials and employer confirmation. */
export const APPLICATION_INTENT_TERMS = 'jobee-apply-v1' as const;
/** Legal/sensitive controls cannot fall through to fuzzy contact-field mapping. */
export function requiresApplicationQuestionConsent(text: string, controlType?: string): boolean {
  return (
    controlType === 'CHECKBOX' ||
    /\b(?:consent|agree|certif\w*|declar\w*|authoriz\w*|sponsor\w*|visa|citizen\w*|clearance|salary|compensation|disab\w*|gender|race|ethnic\w*|veteran|criminal|background|privacy|terms|nationality|date of birth)\b/i.test(
      text,
    )
  );
}
export type ApplicationIntentStatus =
  | 'QUEUED'
  | 'PREPARING'
  | 'NEEDS_USER_ACTION'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'UNKNOWN_RESULT';
export interface ApplicationIntentDto {
  id: string;
  applicationId: string;
  jobId: string;
  packageId: string | null;
  runId: string | null;
  status: ApplicationIntentStatus;
  message: string;
  expiresAt: string;
  canCancel: boolean;
  canResume: boolean;
  warnings?: ApplicationIssue[];
  actionRequired?: ApplicationIssue[];
  events: Array<{ type: string; at: string; runId?: string; issues?: ApplicationIssue[] }>;
}

export interface ApplicationIssue {
  code: string;
  severity: 'WARNING' | 'ACTION_REQUIRED' | 'BLOCKER';
  message: string;
}
