import type { Database } from '@job-agent/database';
import { systemNotifications, notificationPreferences, eq } from '@job-agent/database';
import { NotificationType, NotificationSeverity, Logger } from '@job-agent/shared';

export interface DispatchNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  severity?: NotificationSeverity;
  targetType?: string;
  targetId?: string | null;
  actionUrl?: string | null;
  metadata?: Record<string, unknown>;
}

export class NotificationDispatcher {
  constructor(
    private readonly db: Database,
    private readonly logger?: Logger,
  ) {}

  async dispatch(params: DispatchNotificationParams): Promise<string | null> {
    const {
      userId,
      type,
      title,
      message,
      severity = 'INFO',
      targetType = 'SYSTEM',
      targetId = null,
      actionUrl = null,
      metadata = {},
    } = params;

    try {
      // Check user preferences if present
      const prefs = await this.db.query.notificationPreferences?.findFirst({
        where: eq(notificationPreferences.userId, userId),
      });

      if (prefs) {
        if (type === 'APPROVAL_REMINDER' && !prefs.notifyOnApprovalRequests) {
          this.logger?.debug(`Skipping notification ${type} per user preferences`);
          return null;
        }
        if (type === 'CAPTCHA_HALT' && !prefs.notifyOnCaptchaHalt) {
          this.logger?.debug(`Skipping notification ${type} per user preferences`);
          return null;
        }
        if (
          (type === 'AUTO_APPLY_SUCCESS' || type === 'AUTO_APPLY_FAILED') &&
          !prefs.notifyOnAutoApply
        ) {
          this.logger?.debug(`Skipping notification ${type} per user preferences`);
          return null;
        }
        if (type === 'INTERVIEW_UPCOMING' && !prefs.notifyOnInterviewReminders) {
          this.logger?.debug(`Skipping notification ${type} per user preferences`);
          return null;
        }
      }

      const [notification] = await this.db
        .insert(systemNotifications)
        .values({
          userId,
          type,
          title,
          message,
          severity,
          status: 'UNREAD',
          targetType,
          targetId,
          actionUrl,
          metadata,
        })
        .returning({ id: systemNotifications.id });

      if (!notification) {
        return null;
      }

      this.logger?.info(`Dispatched system notification: ${type} - "${title}"`, {
        notificationId: notification.id,
        userId,
        type,
        severity,
      });

      return notification.id;
    } catch (err: any) {
      this.logger?.error(
        `Failed to dispatch system notification for user ${userId}: ${err.message}`,
        undefined,
        err,
      );
      return null;
    }
  }
}
