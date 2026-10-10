import { pgTable, uuid, text, timestamp, boolean } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const notificationPreferences = pgTable('notification_preferences', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  emailNotificationsEnabled: boolean('email_notifications_enabled').default(true).notNull(),
  notificationEmail: text('notification_email'),
  notifyOnApprovalRequests: boolean('notify_on_approval_requests').default(true).notNull(),
  notifyOnCaptchaHalt: boolean('notify_on_captcha_halt').default(true).notNull(),
  notifyOnAutoApply: boolean('notify_on_auto_apply').default(true).notNull(),
  notifyOnInterviewReminders: boolean('notify_on_interview_reminders').default(true).notNull(),
  dailyDigestEnabled: boolean('daily_digest_enabled').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type NewNotificationPreference = typeof notificationPreferences.$inferInsert;
