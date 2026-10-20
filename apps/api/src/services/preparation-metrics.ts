import { sql } from 'drizzle-orm';
import type { Database } from '@job-agent/database';
export async function preparationMetrics(db: Database, userId: string) {
  const result = await db.execute(sql`SELECT count(*)::int AS total,
 count(*) FILTER (WHERE status='FAILED')::int AS failed,
 count(*) FILTER (WHERE status IN ('READY','NEEDS_REVIEW'))::int AS prepared,
 count(*) FILTER (WHERE status IN ('QUEUED','PREPARING'))::int AS waiting,
 percentile_cont(0.5) WITHIN GROUP(ORDER BY extract(epoch FROM finished_at-started_at)) FILTER (WHERE finished_at IS NOT NULL AND started_at IS NOT NULL) AS median_seconds,
 percentile_cont(0.95) WITHIN GROUP(ORDER BY extract(epoch FROM finished_at-started_at)) FILTER (WHERE finished_at IS NOT NULL AND started_at IS NOT NULL) AS p95_seconds,
 max(extract(epoch FROM now()-created_at)) FILTER(WHERE status='QUEUED') AS oldest_wait_seconds
 FROM preparation_items WHERE user_id=${userId} AND created_at>now()-interval '30 days'`);
  return {
    windowDays: 30,
    ...result.rows[0],
    aiCost: null,
    aiCostNote:
      'Preparation uses deterministic generation. Matching provider usage is reported separately; no cost estimate is inferred.',
  };
}
