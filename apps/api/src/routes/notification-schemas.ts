import { z } from 'zod';
import { NotificationTypes, NotificationSeverities, NotificationStatuses } from '@job-agent/shared';

export const listNotificationsQuerySchema = z.object({
  status: z
    .enum([NotificationStatuses.UNREAD, NotificationStatuses.READ, NotificationStatuses.DISMISSED])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const notificationParamsSchema = z.object({
  id: z.string().uuid('Invalid notification ID format'),
});

export const createNotificationSchema = z.object({
  type: z.enum([
    NotificationTypes.APPROVAL_REMINDER,
    NotificationTypes.CAPTCHA_HALT,
    NotificationTypes.MANUAL_REVIEW_REQUIRED,
    NotificationTypes.AUTO_APPLY_SUCCESS,
    NotificationTypes.AUTO_APPLY_FAILED,
    NotificationTypes.RATE_LIMIT_EXCEEDED,
    NotificationTypes.EMAIL_SYNC_ALERT,
    NotificationTypes.INTERVIEW_UPCOMING,
    NotificationTypes.SYSTEM_ALERT,
  ]),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  severity: z
    .enum([
      NotificationSeverities.INFO,
      NotificationSeverities.WARNING,
      NotificationSeverities.CRITICAL,
    ])
    .default(NotificationSeverities.INFO),
  targetType: z.string().optional().default('SYSTEM'),
  targetId: z.string().optional().nullable(),
  actionUrl: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional().default({}),
});

export const updateNotificationPreferencesSchema = z.object({
  emailNotificationsEnabled: z.boolean().optional(),
  notificationEmail: z.string().email().optional().nullable(),
  notifyOnApprovalRequests: z.boolean().optional(),
  notifyOnCaptchaHalt: z.boolean().optional(),
  notifyOnAutoApply: z.boolean().optional(),
  notifyOnInterviewReminders: z.boolean().optional(),
  dailyDigestEnabled: z.boolean().optional(),
});
