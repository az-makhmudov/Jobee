import { pgTable, uuid, text, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { jobs } from './jobs.js';

export const jobSections = pgTable(
  'job_sections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sectionType: text('section_type').notNull(), // 'RESPONSIBILITIES' | 'QUALIFICATIONS' | 'PREFERRED_QUALIFICATIONS' | 'BENEFITS' | 'ABOUT_COMPANY' | 'OTHER'
    title: text('title').notNull(),
    content: text('content').notNull(),
    displayOrder: integer('display_order').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('job_sections_job_id_idx').on(table.jobId),
    index('job_sections_type_idx').on(table.sectionType),
  ],
);

export type JobSection = typeof jobSections.$inferSelect;
export type NewJobSection = typeof jobSections.$inferInsert;
