import crypto from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { Database } from '../client.js';
export type PreparationFingerprintReader = (
  jobId: string,
  selectedCvId: string | null,
) => Promise<string>;
/** Reuse a tenant snapshot within one read request, never across users or authorization actions. */
export async function createPreparationFingerprintReader(
  db: Database,
  userId: string,
): Promise<PreparationFingerprintReader> {
  const tables = [
    'candidate_profiles',
    'candidate_experiences',
    'candidate_education',
    'candidate_projects',
    'candidate_skills',
    'candidate_languages',
    'candidate_certifications',
    'candidate_links',
    'candidate_facts',
    'candidate_documents',
    'job_preferences',
  ];
  const snapshots = await Promise.all(
    tables.map(async (table) => {
      const result = await db.execute<{ snapshot: unknown }>(
        sql`SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.id),'[]'::jsonb) AS snapshot FROM ${sql.identifier(table)} r WHERE user_id=${userId}`,
      );
      return result.rows[0]?.snapshot;
    }),
  );
  return async (jobId, selectedCvId) => {
    const job = await db.execute(
      sql`SELECT title, company, description, content_hash, expiration_date, state FROM jobs WHERE id=${jobId} AND user_id=${userId}`,
    );
    return crypto
      .createHash('sha256')
      .update(JSON.stringify({ version: 'preparation-v1', job: job.rows, snapshots, selectedCvId }))
      .digest('hex');
  };
}
/** A tenant-only input cache key. Values never leave the database service. */
export async function computePreparationFingerprint(
  db: Database,
  userId: string,
  jobId: string,
  selectedCvId: string | null,
): Promise<string> {
  return (await createPreparationFingerprintReader(db, userId))(jobId, selectedCvId);
}
