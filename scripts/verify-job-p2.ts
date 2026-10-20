import { MatchService, DisabledAiProvider } from '@job-agent/database/matching';
/** JOB-P2-T01 / JOB-P2-T02: isolated source-to-analysis acceptance.
 * Default is offline. --live-public-feeds only reads public listings and never applies.
 */
import assert from 'node:assert/strict';
import {
  getDb,
  closeDbPool,
  users,
  jobPreferences,
  eq,
  assertSafeTestDatabase,
} from '@job-agent/database';
import { JobService } from '../apps/api/src/services/job-service.js';
import { JobDiscoveryService } from '../apps/api/src/services/job-discovery-service.js';

async function main() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('Explicit TEST_DATABASE_URL required');
  assertSafeTestDatabase(url);
  if (!['localhost', '127.0.0.1', '::1'].includes(new URL(url).hostname))
    throw new Error('Loopback verification database required');
  const db = getDb(url);
  const live = process.argv.includes('--live-public-feeds');
  const [user] = await db
    .insert(users)
    .values({
      name: 'Phase 2 verification fixture',
      email: `phase2-${crypto.randomUUID()}@example.test`,
    })
    .returning();
  try {
    await db
      .insert(jobPreferences)
      .values({ userId: user!.id, targetTitles: [live ? 'Engineer' : 'Project Manager'] });
    let description = '<h3>Requirements</h3><ul><li>Must have TypeScript experience.</li></ul>';
    const fetchFn: typeof fetch = live
      ? fetch
      : async () =>
          new Response(
            JSON.stringify({
              jobs: [
                {
                  id: 1,
                  title: 'Project Manager',
                  absolute_url: 'https://example.test/jobs/phase2',
                  location: { name: 'Warsaw, Poland' },
                  content: description,
                },
              ],
            }),
          );
    const jobs = new JobService(db);
    const discovery = new JobDiscoveryService(db, jobs, { fetchFn });
    const options = {
      sources: ['GREENHOUSE' as const],
      companies: [live ? 'stripe' : 'fixture'],
      limit: 3,
    };
    const first = await discovery.discoverForCandidate(user!.id, options);
    assert(first.newJobsIngested > 0, 'Expected relevant source listings');
    const list = await jobs.getJobs(user!.id, {
      search: live ? 'Engineer' : 'Project Manager',
    });
    assert(list.items.length > 0, 'Relevant jobs must be searchable');
    const firstId = list.items[0]!.id;
    const detail = await jobs.getJobById(user!.id, firstId);
    assert(detail.sources?.length && detail.lastCheckedDate, 'Checked provenance required');
    if (!live) {
      const originalRequirement = detail.requirements![0]!.id;
      description = '<h3>Requirements</h3><ul><li>Must have Python experience.</li></ul>';
      const second = await discovery.discoverForCandidate(user!.id, options);
      assert.equal(second.newJobsIngested, 0);
      assert.equal(second.duplicatesSkipped, 1);
      const refreshed = await jobs.getJobById(user!.id, firstId);
      assert.equal(refreshed.requirements!.length, 1);
      assert.notEqual(refreshed.requirements![0]!.id, originalRequirement);
      assert.match(refreshed.requirements![0]!.rawText, /Python/);
      await jobs.updateJob(user!.id, firstId, {
        description: 'Requirements:\n• Must have verified delivery experience.',
      });
      await discovery.discoverForCandidate(user!.id, options);
      assert.match((await jobs.getJobById(user!.id, firstId)).description, /verified delivery/);
    }
    const analysis = await new MatchService(db, new DisabledAiProvider()).analyzeJob(
      firstId,
      user!.id,
    );
    assert.equal(
      analysis.autoApplyEligible,
      false,
      'Discovery and matching never grant submission consent',
    );
    assert(analysis.summaryExplanation.length > 0, 'Grounded analysis needs an explanation');
    console.log(
      JSON.stringify({
        task: 'JOB-P2-T01 / JOB-P2-T02',
        mode: live ? 'READ_ONLY_PUBLIC_FEED' : 'OFFLINE_FIXTURE',
        source: 'GREENHOUSE',
        newJobs: first.newJobsIngested,
        searchable: true,
        checkedProvenance: true,
      }),
    );
  } finally {
    await db.delete(users).where(eq(users.id, user!.id));
    await closeDbPool();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
