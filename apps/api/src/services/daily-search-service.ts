import { and, eq, lt, or, isNull, desc, sql, gte } from 'drizzle-orm';
import {
  jobSearchSettings,
  jobs,
  applications,
  applicationQuestions,
  applicationPackages,
  applicationPackageVersions,
  systemNotifications,
  type Database,
} from '@job-agent/database';
import type { JobDiscoveryService } from './job-discovery-service.js';
import type { PreparationBatchService } from './preparation-batch-service.js';
import type { MatchService } from './match-service.js';
/** Opt-in, in-app assistance. It never submits applications or sends email. */
export class DailySearchService {
  constructor(
    private readonly db: Database,
    private readonly discovery: JobDiscoveryService,
    private readonly batches: PreparationBatchService,
    private readonly match: MatchService,
  ) {}
  async runDue() {
    const before = new Date(Date.now() - 24 * 60 * 60_000);
    const settings = await this.db
      .select()
      .from(jobSearchSettings)
      .where(or(isNull(jobSearchSettings.lastDailyAt), lt(jobSearchSettings.lastDailyAt, before)))
      .limit(20);
    for (const row of settings) {
      if (!row.settings.dailyDiscovery) continue;
      const [claim] = await this.db
        .update(jobSearchSettings)
        .set({ dailyLeaseAt: new Date() })
        .where(
          and(
            eq(jobSearchSettings.userId, row.userId),
            or(isNull(jobSearchSettings.lastDailyAt), lt(jobSearchSettings.lastDailyAt, before)),
            or(
              isNull(jobSearchSettings.dailyLeaseAt),
              lt(jobSearchSettings.dailyLeaseAt, new Date(Date.now() - 15 * 60_000)),
            ),
          ),
        )
        .returning();
      if (!claim) continue;
      let found = 0,
        prepared = 0;
      const messages: string[] = [];
      try {
        const result = await this.discovery.discoverForCandidate(row.userId, {
          limit: row.settings.dailyLimit,
        });
        found = result.newJobsIngested;
        const failures = result.sourcesSummary.reduce((n, s) => n + s.errors.length, 0);
        if (failures) messages.push(`${failures} source checks need another try.`);
        if (row.settings.dailyPreparation) {
          const candidates = await this.db
            .select({ job: jobs, app: applications })
            .from(jobs)
            .leftJoin(
              applications,
              and(eq(applications.jobId, jobs.id), eq(applications.userId, row.userId)),
            )
            .where(and(eq(jobs.userId, row.userId), gte(jobs.discoveredDate, before)))
            .orderBy(desc(jobs.discoveredDate))
            .limit(20);
          const selected = [];
          for (const { job, app } of candidates) {
            if (app || ['ARCHIVED', 'INVALID'].includes(job.state)) continue;
            const analysis = await this.match.analyzeJob(job.id, row.userId);
            if (analysis.decision === 'MATCH') selected.push(job.id);
            if (selected.length >= Math.min(10, row.settings.dailyLimit)) break;
          }
          if (selected.length) {
            const batch = await this.batches.create(row.userId, selected);
            prepared = batch.items.length;
          }
        }
      } catch {
        messages.push('Daily search paused. Review your search settings and retry from Find jobs.');
      }
      await this.db
        .update(jobSearchSettings)
        .set({ lastDailyAt: new Date(), dailyLeaseAt: null })
        .where(
          and(
            eq(jobSearchSettings.userId, row.userId),
            eq(jobSearchSettings.dailyLeaseAt, claim.dailyLeaseAt!),
          ),
        );
      if (row.settings.dailyDigest) {
        const ready = await this.db.execute<{ count: string }>(
          sql`SELECT count(*) FROM application_packages WHERE user_id=${row.userId} AND status='READY'`,
        );
        const questions = await this.db
          .select({ id: applicationQuestions.id })
          .from(applicationQuestions)
          .innerJoin(
            applicationPackages,
            eq(applicationQuestions.packageId, applicationPackages.id),
          )
          .innerJoin(
            applicationPackageVersions,
            and(
              eq(applicationQuestions.versionId, applicationPackageVersions.id),
              eq(
                applicationPackages.currentVersionNumber,
                applicationPackageVersions.versionNumber,
              ),
            ),
          )
          .where(
            and(
              eq(applicationPackages.userId, row.userId),
              eq(applicationQuestions.isRequired, true),
              eq(applicationQuestions.approvalState, 'PENDING'),
            ),
          );
        await this.db.insert(systemNotifications).values({
          userId: row.userId,
          type: 'DAILY_SEARCH_DIGEST',
          title: 'Your daily job-search update',
          message: `${found} new jobs; ${prepared} selected for preparation; ${ready.rows[0]?.count ?? 0} packages ready; ${questions.length} questions need you. ${messages.join(' ')}`,
          severity: messages.length ? 'WARNING' : 'INFO',
          targetType: 'SYSTEM',
          metadata: { found, prepared, questions: questions.length },
        });
      }
    }
  }
}
