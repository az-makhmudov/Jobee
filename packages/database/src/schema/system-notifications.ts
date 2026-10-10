import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const systemNotifications = pgTable(
  'system_notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // 'APPROVAL_REMINDER' | 'CAPTCHA_HALT' | 'MANUAL_REVIEW_REQUIRED' | 'AUTO_APPLY_SUCCESS' | 'AUTO_APPLY_FAILED' | 'RATE_LIMIT_EXCEEDED' | 'EMAIL_SYNC_ALERT' | 'INTERVIEW_UPCOMING' | 'SYSTEM_ALERT'
    title: text('title').notNull(),
    message: text('message').notNull(),
    severity: text('severity').default('INFO').notNull(), // 'INFO' | 'WARNING' | 'CRITICAL'
    status: text('status').default('UNREAD').notNull(), // 'UNREAD' | 'READ' | 'DISMISSED'
    targetType: text('target_type').default('SYSTEM').notNull(), // 'APPLICATION' | 'JOB' | 'APPROVAL_REQUEST' | 'BROWSER_RUN' | 'EMAIL' | 'INTERVIEW' | 'SYSTEM'
    targetId: text('target_id'),
    actionUrl: text('action_url'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    readAt: timestamp('read_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('system_notifications_user_id_idx').on(table.userId),
    index('system_notifications_status_idx').on(table.status),
    index('system_notifications_type_idx').on(table.type),
    index('system_notifications_created_at_idx').on(table.createdAt),
  ],
);

export type SystemNotification = typeof systemNotifications.$inferSelect;
export type NewSystemNotification = typeof systemNotifications.$inferInsert;
