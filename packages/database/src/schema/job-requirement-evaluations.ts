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
import { jobs } from './jobs.js';
import { jobRequirements } from './job-requirements.js';
import { jobMatchAnalyses } from './job-match-analyses.js';

export interface CandidateEvidenceItem {
  id: string;
  type: string; // 'skill' | 'experience' | 'education' | 'language' | 'certification' | 'project' | 'fact'
  label: string; // Human-readable label, e.g. "Skill — TypeScript (Advanced)"
}

export const jobRequirementEvaluations = pgTable(
  'job_requirement_evaluations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    analysisId: uuid('analysis_id')
      .notNull()
      .references(() => jobMatchAnalyses.id, { onDelete: 'cascade' }),
    jobRequirementId: uuid('job_requirement_id')
      .notNull()
      .references(() => jobRequirements.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status').notNull(), // 'MET' | 'PARTIAL' | 'NOT_MET' | 'UNKNOWN' | 'NOT_APPLICABLE'
    source: text('source').notNull(), // 'DETERMINISTIC' | 'AI_ENRICHED'
    evidenceIds: jsonb('evidence_ids').$type<string[]>().default([]).notNull(),
    evidenceItems: jsonb('evidence_items').$type<CandidateEvidenceItem[]>().default([]).notNull(),
    reason: text('reason').notNull(),
    confidence: integer('confidence').notNull(), // 0 - 100
    contributesToBlocker: boolean('contributes_to_blocker').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('job_req_eval_analysis_id_idx').on(table.analysisId),
    index('job_req_eval_job_req_id_idx').on(table.jobRequirementId),
    index('job_req_eval_job_id_idx').on(table.jobId),
  ],
);

export type JobRequirementEvaluation = typeof jobRequirementEvaluations.$inferSelect;
export type NewJobRequirementEvaluation = typeof jobRequirementEvaluations.$inferInsert;
