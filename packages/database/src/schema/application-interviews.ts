import { pgTable, uuid, text, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { applications } from './applications.js';
import { applicationContacts } from './application-contacts.js';

export const applicationInterviews = pgTable(
  'application_interviews',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roundTitle: text('round_title').notNull(),
    interviewType: text('interview_type').notNull(),
    status: text('status').default('SCHEDULED').notNull(),
    schedulingStatus: text('scheduling_status').default('CONFIRMED').notNull(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true, mode: 'date' }).notNull(),
    durationMinutes: integer('duration_minutes'),
    timezone: text('timezone'),
    locationOrUrl: text('location_or_url'),
    meetingUrl: text('meeting_url'),
    interviewerName: text('interviewer_name'),
    contactId: uuid('contact_id').references(() => applicationContacts.id, {
      onDelete: 'set null',
    }),
    sourceEmailMessageId: text('source_email_message_id'),
    notes: text('notes'),
    feedback: text('feedback'),
    // Debrief fields
    debriefQuestionsAsked: text('debrief_questions_asked'),
    debriefTopicsDiscussed: text('debrief_topics_discussed'),
    debriefObservations: text('debrief_observations'),
    debriefFollowUpCommitments: text('debrief_follow_up_commitments'),
    debriefConcerns: text('debrief_concerns'),
    debriefExpectedNextStep: text('debrief_expected_next_step'),
    debriefExpectedResponseDate: timestamp('debrief_expected_response_date', {
      withTimezone: true,
      mode: 'date',
    }),
    debriefPrivateNotes: text('debrief_private_notes'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('app_interviews_application_id_idx').on(table.applicationId),
    index('app_interviews_scheduled_at_idx').on(table.scheduledAt),
    index('app_interviews_status_idx').on(table.status),
    index('app_interviews_scheduling_status_idx').on(table.schedulingStatus),
  ],
);

export type ApplicationInterview = typeof applicationInterviews.$inferSelect;
export type NewApplicationInterview = typeof applicationInterviews.$inferInsert;
