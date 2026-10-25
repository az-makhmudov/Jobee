export const OrchestrationTaskTypes = {
  DISCOVERY: 'DISCOVERY',
  MATCHING: 'MATCHING',
  PREPARATION: 'PREPARATION',
  AUTO_APPLY: 'AUTO_APPLY',
  EMAIL_SYNC: 'EMAIL_SYNC',
  REMINDERS: 'REMINDERS',
  PIPELINE_CYCLE: 'PIPELINE_CYCLE',
} as const;

export type OrchestrationTaskType =
  (typeof OrchestrationTaskTypes)[keyof typeof OrchestrationTaskTypes];

export const OrchestrationTriggers = {
  SCHEDULED: 'SCHEDULED',
  MANUAL: 'MANUAL',
  EVENT: 'EVENT',
} as const;

export type OrchestrationTrigger =
  (typeof OrchestrationTriggers)[keyof typeof OrchestrationTriggers];

export const OrchestrationRunStatuses = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  PARTIAL: 'PARTIAL',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

export type OrchestrationRunStatus =
  (typeof OrchestrationRunStatuses)[keyof typeof OrchestrationRunStatuses];

export interface OrchestrationStepLog {
  timestamp: string;
  stage: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface OrchestrationRunDto {
  id: string;
  userId: string;
  taskType: OrchestrationTaskType;
  trigger: OrchestrationTrigger;
  status: OrchestrationRunStatus;
  itemsProcessedCount: number;
  itemsSucceededCount: number;
  itemsFailedCount: number;
  stepLogs: OrchestrationStepLog[];
  summary: Record<string, unknown>;
  errorMessage: string | null;
  retryCount: number;
  maxRetries: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface TriggerOrchestrationRequest {
  taskType?: OrchestrationTaskType;
  force?: boolean;
}

export const NotificationTypes = {
  APPROVAL_REMINDER: 'APPROVAL_REMINDER',
  CAPTCHA_HALT: 'CAPTCHA_HALT',
  MANUAL_REVIEW_REQUIRED: 'MANUAL_REVIEW_REQUIRED',
  AUTO_APPLY_SUCCESS: 'AUTO_APPLY_SUCCESS',
  AUTO_APPLY_FAILED: 'AUTO_APPLY_FAILED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  EMAIL_SYNC_ALERT: 'EMAIL_SYNC_ALERT',
  INTERVIEW_UPCOMING: 'INTERVIEW_UPCOMING',
  SYSTEM_ALERT: 'SYSTEM_ALERT',
} as const;

export type NotificationType = (typeof NotificationTypes)[keyof typeof NotificationTypes];

export const NotificationSeverities = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL',
} as const;

export type NotificationSeverity =
  (typeof NotificationSeverities)[keyof typeof NotificationSeverities];

export const NotificationStatuses = {
  UNREAD: 'UNREAD',
  READ: 'READ',
  DISMISSED: 'DISMISSED',
} as const;

export type NotificationStatus = (typeof NotificationStatuses)[keyof typeof NotificationStatuses];

export interface SystemNotificationDto {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  severity: NotificationSeverity;
  status: NotificationStatus;
  targetType: string;
  targetId: string | null;
  actionUrl: string | null;
  metadata: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPreferencesDto {
  id: string;
  userId: string;
  emailNotificationsEnabled: boolean;
  notificationEmail: string | null;
  notifyOnApprovalRequests: boolean;
  notifyOnCaptchaHalt: boolean;
  notifyOnAutoApply: boolean;
  notifyOnInterviewReminders: boolean;
  dailyDigestEnabled: boolean;
}

export interface UpdateNotificationPreferencesRequest {
  emailNotificationsEnabled?: boolean;
  notificationEmail?: string | null;
  notifyOnApprovalRequests?: boolean;
  notifyOnCaptchaHalt?: boolean;
  notifyOnAutoApply?: boolean;
  notifyOnInterviewReminders?: boolean;
  dailyDigestEnabled?: boolean;
}

export interface SystemMetricsDto {
  totalJobsDiscovered: number;
  totalJobsMatched: number;
  totalApplicationsSubmitted: number;
  applicationsToday: number;
  maxApplicationsPerDay: number | null;
  dailyQuotaRemaining: number | null;
  autoApplyEnabled: boolean;
  pendingApprovalsCount: number;
  unreadNotificationsCount: number;
  pendingBrowserRunsCount: number;
  orchestratorRunning: boolean;
  lastPipelineRunAt: string | null;
}
