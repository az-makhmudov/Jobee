import type { Database } from '@job-agent/database';
import {
  systemNotifications,
  notificationPreferences,
  eq,
  and,
  desc,
  sql,
} from '@job-agent/database';
import {
  SystemNotificationDto,
  NotificationPreferencesDto,
  UpdateNotificationPreferencesRequest,
  NotificationType,
  NotificationSeverity,
  NotificationStatus,
  Logger,
  AppError,
  ErrorCodes,
} from '@job-agent/shared';

export interface CreateNotificationInput {
  type: NotificationType;
  title: string;
  message: string;
  severity?: NotificationSeverity;
  targetType?: string;
  targetId?: string | null;
  actionUrl?: string | null;
  metadata?: Record<string, unknown>;
}

export class NotificationService {
  constructor(
    private readonly db: Database,
    private readonly logger?: Logger,
  ) {}

  async createNotification(
    userId: string,
    input: CreateNotificationInput,
  ): Promise<SystemNotificationDto> {
    const {
      type,
      title,
      message,
      severity = 'INFO',
      targetType = 'SYSTEM',
      targetId = null,
      actionUrl = null,
      metadata = {},
    } = input;

    const [created] = await this.db
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
      .returning();

    if (!created) {
      throw new AppError({
        code: ErrorCodes.INTERNAL_ERROR,
        message: 'Failed to create system notification',
        statusCode: 500,
      });
    }

    this.logger?.info(`Created system notification: ${type} - "${title}"`, {
      notificationId: created.id,
      userId,
    });

    return this.mapToDto(created);
  }

  async listNotifications(
    userId: string,
    options: { status?: NotificationStatus; limit?: number; offset?: number } = {},
  ): Promise<{ notifications: SystemNotificationDto[]; total: number }> {
    const { status, limit = 20, offset = 0 } = options;

    const conditions = [eq(systemNotifications.userId, userId)];
    if (status) {
      conditions.push(eq(systemNotifications.status, status));
    }

    const whereClause = and(...conditions);

    const [totalRes] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(systemNotifications)
      .where(whereClause);

    const rows = await this.db
      .select()
      .from(systemNotifications)
      .where(whereClause)
      .orderBy(desc(systemNotifications.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      notifications: rows.map((r) => this.mapToDto(r)),
      total: Number(totalRes?.count || 0),
    };
  }

  async getUnreadCount(userId: string): Promise<number> {
    const [res] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(systemNotifications)
      .where(and(eq(systemNotifications.userId, userId), eq(systemNotifications.status, 'UNREAD')));

    return Number(res?.count || 0);
  }

  async markAsRead(userId: string, notificationId: string): Promise<SystemNotificationDto> {
    const [updated] = await this.db
      .update(systemNotifications)
      .set({
        status: 'READ',
        readAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(eq(systemNotifications.id, notificationId), eq(systemNotifications.userId, userId)),
      )
      .returning();

    if (!updated) {
      throw new AppError({
        code: ErrorCodes.NOT_FOUND,
        message: 'Notification not found',
        statusCode: 404,
      });
    }

    return this.mapToDto(updated);
  }

  async markAllAsRead(userId: string): Promise<{ count: number }> {
    const res = await this.db
      .update(systemNotifications)
      .set({
        status: 'READ',
        readAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(systemNotifications.userId, userId), eq(systemNotifications.status, 'UNREAD')))
      .returning({ id: systemNotifications.id });

    return { count: res.length };
  }

  async dismissNotification(userId: string, notificationId: string): Promise<void> {
    const [updated] = await this.db
      .update(systemNotifications)
      .set({
        status: 'DISMISSED',
        updatedAt: new Date(),
      })
      .where(
        and(eq(systemNotifications.id, notificationId), eq(systemNotifications.userId, userId)),
      )
      .returning({ id: systemNotifications.id });

    if (!updated) {
      throw new AppError({
        code: ErrorCodes.NOT_FOUND,
        message: 'Notification not found',
        statusCode: 404,
      });
    }
  }

  async getPreferences(userId: string): Promise<NotificationPreferencesDto> {
    let prefs = await this.db.query.notificationPreferences?.findFirst({
      where: eq(notificationPreferences.userId, userId),
    });

    if (!prefs) {
      const [created] = await this.db
        .insert(notificationPreferences)
        .values({
          userId,
          emailNotificationsEnabled: true,
          notifyOnApprovalRequests: true,
          notifyOnCaptchaHalt: true,
          notifyOnAutoApply: true,
          notifyOnInterviewReminders: true,
          dailyDigestEnabled: false,
        })
        .returning();
      prefs = created;
    }

    if (!prefs) {
      throw new AppError({
        code: ErrorCodes.INTERNAL_ERROR,
        message: 'Failed to initialize notification preferences',
        statusCode: 500,
      });
    }

    return {
      id: prefs.id,
      userId: prefs.userId,
      emailNotificationsEnabled: prefs.emailNotificationsEnabled,
      notificationEmail: prefs.notificationEmail,
      notifyOnApprovalRequests: prefs.notifyOnApprovalRequests,
      notifyOnCaptchaHalt: prefs.notifyOnCaptchaHalt,
      notifyOnAutoApply: prefs.notifyOnAutoApply,
      notifyOnInterviewReminders: prefs.notifyOnInterviewReminders,
      dailyDigestEnabled: prefs.dailyDigestEnabled,
    };
  }

  async updatePreferences(
    userId: string,
    update: UpdateNotificationPreferencesRequest,
  ): Promise<NotificationPreferencesDto> {
    // Ensure record exists
    await this.getPreferences(userId);

    const [updated] = await this.db
      .update(notificationPreferences)
      .set({
        ...update,
        updatedAt: new Date(),
      })
      .where(eq(notificationPreferences.userId, userId))
      .returning();

    if (!updated) {
      throw new AppError({
        code: ErrorCodes.NOT_FOUND,
        message: 'Notification preferences not found',
        statusCode: 404,
      });
    }

    return {
      id: updated.id,
      userId: updated.userId,
      emailNotificationsEnabled: updated.emailNotificationsEnabled,
      notificationEmail: updated.notificationEmail,
      notifyOnApprovalRequests: updated.notifyOnApprovalRequests,
      notifyOnCaptchaHalt: updated.notifyOnCaptchaHalt,
      notifyOnAutoApply: updated.notifyOnAutoApply,
      notifyOnInterviewReminders: updated.notifyOnInterviewReminders,
      dailyDigestEnabled: updated.dailyDigestEnabled,
    };
  }

  private mapToDto(row: any): SystemNotificationDto {
    return {
      id: row.id,
      userId: row.userId,
      type: row.type,
      title: row.title,
      message: row.message,
      severity: row.severity,
      status: row.status,
      targetType: row.targetType,
      targetId: row.targetId,
      actionUrl: row.actionUrl,
      metadata: (row.metadata as Record<string, unknown>) || {},
      readAt: row.readAt ? new Date(row.readAt).toISOString() : null,
      createdAt: new Date(row.createdAt).toISOString(),
    };
  }
}
