import { pgTable, uuid, text, timestamp, integer, boolean, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { jobs } from './jobs.js';
import { jobSources } from './job-sources.js';

export const jobRequirements = pgTable(
  'job_requirements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sourceId: uuid('source_id').references(() => jobSources.id, { onDelete: 'set null' }),
    sourceSection: text('source_section'),
    rawText: text('raw_text').notNull(),
    normalizedText: text('normalized_text'),
    category: text('category').default('OTHER').notNull(), // 'EXPERIENCE' | 'SKILL' | 'EDUCATION' | 'LANGUAGE' | 'LOCATION' | 'WORK_AUTHORIZATION' | 'CERTIFICATION' | 'RESPONSIBILITY' | 'OTHER'
    requirementStrength: text('requirement_strength').default('UNKNOWN').notNull(), // 'MANDATORY' | 'PREFERRED' | 'UNKNOWN'
    displayOrder: integer('display_order').default(0).notNull(),
    isCurrent: boolean('is_current').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('job_requirements_job_id_idx').on(table.jobId),
    index('job_requirements_category_idx').on(table.category),
    index('job_requirements_source_id_idx').on(table.sourceId),
  ],
);

export type JobRequirement = typeof jobRequirements.$inferSelect;
export type NewJobRequirement = typeof jobRequirements.$inferInsert;
