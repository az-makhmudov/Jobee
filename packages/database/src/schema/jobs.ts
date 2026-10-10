import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    state: text('state').default('NEW').notNull(), // 'NEW' | 'INGESTED' | 'NEEDS_REVIEW' | 'INVALID' | 'DUPLICATE' | 'ARCHIVED'
    title: text('title').notNull(),
    company: text('company').notNull(),
    companyUrl: text('company_url'),
    description: text('description').notNull(),
    descriptionHtml: text('description_html'),
    locationText: text('location_text'),
    city: text('city'),
    region: text('region'),
    country: text('country'),
    workplaceType: text('workplace_type').default('UNKNOWN').notNull(), // 'REMOTE' | 'HYBRID' | 'ONSITE' | 'UNKNOWN'
    employmentType: text('employment_type').default('UNKNOWN').notNull(), // 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP' | 'TEMPORARY' | 'APPRENTICESHIP' | 'VOLUNTEER' | 'OTHER' | 'UNKNOWN'
    seniority: text('seniority').default('UNKNOWN').notNull(), // 'INTERNSHIP' | 'ENTRY' | 'JUNIOR' | 'MID' | 'SENIOR' | 'LEAD' | 'MANAGER' | 'DIRECTOR' | 'EXECUTIVE' | 'UNKNOWN'
    department: text('department'),
    minSalary: integer('min_salary'),
    maxSalary: integer('max_salary'),
    currency: text('currency'),
    payPeriod: text('pay_period'), // 'YEAR' | 'MONTH' | 'HOUR' | 'WEEK' | 'DAY' | 'UNKNOWN'
    compensationRaw: text('compensation_raw'),
    postedDate: timestamp('posted_date', { withTimezone: true, mode: 'date' }),
    expirationDate: timestamp('expiration_date', { withTimezone: true, mode: 'date' }),
    discoveredDate: timestamp('discovered_date', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    lastCheckedDate: timestamp('last_checked_date', { withTimezone: true, mode: 'date' }),
    originalUrl: text('original_url'),
    canonicalUrl: text('canonical_url'),
    applicationUrl: text('application_url'),
    provider: text('provider').default('GENERIC').notNull(), // 'GREENHOUSE' | 'LEVER' | 'ASHBY' | 'LINKEDIN' | 'GENERIC' | 'MANUAL'
    sourceExternalId: text('source_external_id'),
    sourceCompanyId: text('source_company_id'),
    contentHash: text('content_hash').notNull(),
    isDuplicate: boolean('is_duplicate').default(false).notNull(),
    duplicateOfId: uuid('duplicate_of_id').references((): any => jobs.id, {
      onDelete: 'set null',
    }),
    hasManualEdits: boolean('has_manual_edits').default(false).notNull(),
    manualEditFields: jsonb('manual_edit_fields').$type<string[]>().default([]).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('jobs_user_state_idx').on(table.userId, table.state),
    index('jobs_user_company_idx').on(table.userId, table.company),
    index('jobs_user_provider_idx').on(table.userId, table.provider),
    index('jobs_user_content_hash_idx').on(table.userId, table.contentHash),
    index('jobs_canonical_url_idx').on(table.canonicalUrl),
    index('jobs_provider_external_id_idx').on(table.provider, table.sourceExternalId),
  ],
);

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
