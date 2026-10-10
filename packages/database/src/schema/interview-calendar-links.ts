import { pgTable, uuid, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { applicationInterviews } from './application-interviews.js';
import { calendarAccounts } from './calendar-accounts.js';

export const interviewCalendarLinks = pgTable(
  'interview_calendar_links',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    interviewId: uuid('interview_id')
      .notNull()
      .references(() => applicationInterviews.id, { onDelete: 'cascade' }),
    calendarAccountId: uuid('calendar_account_id')
      .notNull()
      .references(() => calendarAccounts.id, { onDelete: 'cascade' }),
    calendarId: text('calendar_id').notNull(),
    externalEventId: text('external_event_id').notNull(),
    eventUrl: text('event_url'),
    etag: text('etag'),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('interview_calendar_links_interview_unique_idx').on(table.interviewId),
    index('interview_calendar_links_calendar_account_idx').on(table.calendarAccountId),
    uniqueIndex('interview_calendar_links_event_unique_idx').on(
      table.calendarAccountId,
      table.calendarId,
      table.externalEventId,
    ),
  ],
);

export type InterviewCalendarLink = typeof interviewCalendarLinks.$inferSelect;
export type NewInterviewCalendarLink = typeof interviewCalendarLinks.$inferInsert;
