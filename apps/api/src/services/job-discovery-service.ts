import { relevanceIssues } from '@job-agent/database/matching';
import { JobNormalizerService } from './job-normalizer-service.js';
import type { Database } from '@job-agent/database';
import { jobPreferences, candidateProfiles, jobSearchSettings, jobs } from '@job-agent/database';
import { eq, and, isNull, lt, or } from 'drizzle-orm';
import type { JobService } from './job-service.js';
import {
  AppError,
  createLogger,
  type Logger,
  type DiscoverySource,
  type SearchBoard,
  stripHtmlToText,
} from '@job-agent/shared';
import { JobSearchSettingsService } from './job-search-settings-service.js';
export interface DiscoveryOptions {
  limit?: number;
  sources?: DiscoverySource[];
  companies?: string[];
  queryKeywords?: string[];
}
export interface DiscoveryResult {
  source: string;
  totalFound: number;
  newJobsIngested: number;
  duplicatesSkipped: number;
  errors: string[];
}
export interface CombinedDiscoverySummary {
  sourcesSummary: DiscoveryResult[];
  totalDiscovered: number;
  newJobsIngested: number;
  duplicatesSkipped: number;
}
export interface PublicPosting {
  title: string;
  company: string;
  url: string;
  description: string;
  location: string;
  remote?: boolean;
  externalId?: string;
  board?: string;
  postedAt?: string;
  employmentType?: string;
  salary?: string;
}
const plain = (value: unknown) => stripHtmlToText(String(value ?? ''));
/** Public listing retrieval only. Discovery never authorizes employer submissions. */
export class JobDiscoveryService {
  private readonly logger: Logger;
  private readonly fetchFn: typeof fetch;
  constructor(
    private readonly db: Database,
    private readonly jobService: JobService,
    options?: { logger?: Logger; fetchFn?: typeof fetch },
  ) {
    this.logger = options?.logger ?? createLogger({ service: 'job-discovery' });
    this.fetchFn = options?.fetchFn ?? fetch;
  }
  async discoverForCandidate(
    userId: string,
    options: DiscoveryOptions = {},
  ): Promise<CombinedDiscoverySummary> {
    const settings = await new JobSearchSettingsService(this.db).get(userId);
    await this.db.insert(jobSearchSettings).values({ userId, settings }).onConflictDoNothing();
    const [lease] = await this.db
      .update(jobSearchSettings)
      .set({ discoveryLeaseAt: new Date() })
      .where(
        and(
          eq(jobSearchSettings.userId, userId),
          or(
            isNull(jobSearchSettings.discoveryLeaseAt),
            lt(jobSearchSettings.discoveryLeaseAt, new Date(Date.now() - 5 * 60_000)),
          ),
        ),
      )
      .returning();
    if (!lease)
      throw AppError.badRequest('Job discovery is already running. Please wait for it to finish.');
    const cursors = { ...lease.cursors };
    try {
      const limit = Math.min(50, Math.max(1, options.limit ?? 15));
      const sources = options.sources ?? settings.sources;
      const [prefs] = await this.db
        .select()
        .from(jobPreferences)
        .where(eq(jobPreferences.userId, userId));
      const [profile] = await this.db
        .select()
        .from(candidateProfiles)
        .where(eq(candidateProfiles.userId, userId));
      const keywords = [
        ...(prefs?.targetTitles ?? []),
        ...(prefs?.adjacentRoles ?? []),
        ...(options.queryKeywords ?? []),
      ]
        .map((k) => k.trim().toLowerCase())
        .filter((k) => k.length > 2);
      if (!keywords.length && profile?.headline) keywords.push(profile.headline.toLowerCase());
      const excluded = (prefs?.excludedKeywords ?? []).map((k) => k.toLowerCase());
      const companies = options.companies?.map((slug) => ({ source: 'GREENHOUSE' as const, slug }));
      const boards = (companies ?? settings.boards).filter((b) => sources.includes(b.source));
      // Bounded rotation means one large board cannot permanently starve another.
      const boardStart = (cursors._board ?? 0) % Math.max(1, boards.length);
      const rotated = boards.slice(boardStart).concat(boards.slice(0, boardStart)).slice(0, 5);
      cursors._board = (boardStart + rotated.length) % Math.max(1, boards.length);
      const feeds: Array<{ source: DiscoverySource; board?: SearchBoard }> = [
        ...(sources.includes('ARBEITNOW') ? [{ source: 'ARBEITNOW' as const }] : []),
        ...rotated.map((board) => ({ source: board.source, board })),
      ];
      const summaries = new Map<string, DiscoveryResult>();
      const queues: Array<{
        source: DiscoverySource;
        key: string;
        items: PublicPosting[];
        index: number;
        total: number;
        offset: number;
        summary: DiscoveryResult;
      }> = [];
      for (const feed of feeds) {
        const result = summaries.get(feed.source) ?? {
          source: feed.source,
          totalFound: 0,
          newJobsIngested: 0,
          duplicatesSkipped: 0,
          errors: [],
        };
        summaries.set(feed.source, result);
        const key = `${feed.source}:${feed.board?.slug ?? 'feed'}`;
        try {
          const offset = cursors[key] ?? 0;
          const { items, nextOffset } = await this.fetchPostings(
            feed.source,
            feed.board?.slug,
            offset,
          );
          result.totalFound += items.length;
          queues.push({
            source: feed.source,
            key,
            items,
            index: 0,
            total: items.length,
            offset: nextOffset,
            summary: result,
          });
        } catch {
          result.errors.push(
            `${feed.board?.slug ?? feed.source}: public feed could not be checked. Try again later.`,
          );
        }
      }
      const normalizer = new JobNormalizerService();
      let added = 0;
      let examined = 0;
      // Round-robin and count new jobs, not duplicate hits, toward the requested limit.
      while (added < limit && examined < 200 && queues.some((q) => q.index < q.total)) {
        for (const q of queues) {
          if (added >= limit || examined >= 200 || q.index >= q.total) continue;
          const item = q.items[q.index++]!;
          examined++;
          const text = `${item.title} ${item.employmentType ?? ''}`.toLowerCase();
          if (
            !item.title ||
            !item.url ||
            !item.description ||
            (keywords.length && !keywords.some((k) => text.includes(k))) ||
            excluded.some((k) => text.includes(k)) ||
            prefs?.excludedCompanies.some((c) => c.toLowerCase() === item.company.toLowerCase())
          )
            continue;
          // Reject known preference conflicts before they consume the discovery limit.
          // Unknown metadata stays unknown; public listings are never eligibility evidence.
          const normalized = normalizer.normalize({
            provider: q.source,
            title: item.title,
            company: item.company,
            location: item.location,
            descriptionText: item.description,
          });
          if (relevanceIssues(normalized, prefs ?? null, profile ?? null).length) continue;
          try {
            const fullText = `Title: ${item.title}\nCompany: ${item.company}\nLocation: ${item.location || 'Unknown'}\n${item.remote ? 'Work arrangement: Remote\n' : ''}${item.employmentType ? `Employment: ${item.employmentType}\n` : ''}${item.salary ? `Salary: ${item.salary}\n` : ''}\nJob Description:\n${item.description}`;
            const result = await this.jobService.ingestText(userId, {
              title: item.title,
              company: item.company,
              url: item.url,
              text: fullText,
              provider: q.source,
            });
            if (result.isDuplicate) q.summary.duplicatesSkipped++;
            else {
              q.summary.newJobsIngested++;
              added++;
            }
            await this.db
              .update(jobs)
              .set({
                lastCheckedDate: new Date(),
                updatedAt: new Date(result.job.updatedAt),
                sourceExternalId: item.externalId ?? null,
                sourceCompanyId: item.board ?? null,
                applicationUrl: item.url,
                ...(item.remote && !result.job.manualEditFields.includes('workplaceType')
                  ? { workplaceType: 'REMOTE' }
                  : {}),
              })
              .where(and(eq(jobs.id, result.job.id), eq(jobs.userId, userId)));
            if (result.isDuplicate)
              await this.jobService.refreshPublicPosting(userId, result.job.id, {
                title: item.title,
                company: item.company,
                url: item.url,
                text: fullText,
                provider: q.source,
                remote: item.remote,
              });
          } catch {
            q.summary.errors.push(`Could not import a listing from ${q.key}.`);
          }
        }
      }
      // Full-board offsets advance by examined rows. Paged APIs advance only after the current page is fully examined.
      for (const q of queues)
        cursors[q.key] =
          q.source === 'LEVER' || q.source === 'ARBEITNOW'
            ? q.index === q.total
              ? q.offset
              : (cursors[q.key] ?? 0)
            : (q.offset + q.index) % Math.max(1, q.total);
      await this.db
        .update(jobSearchSettings)
        .set({ cursors })
        .where(eq(jobSearchSettings.userId, userId));
      const results = [...summaries.values()];
      return {
        sourcesSummary: results,
        totalDiscovered: results.reduce((n, r) => n + r.totalFound, 0),
        newJobsIngested: added,
        duplicatesSkipped: results.reduce((n, r) => n + r.duplicatesSkipped, 0),
      };
    } finally {
      await this.db
        .update(jobSearchSettings)
        .set({ discoveryLeaseAt: null })
        .where(
          and(
            eq(jobSearchSettings.userId, userId),
            eq(jobSearchSettings.discoveryLeaseAt, lease.discoveryLeaseAt!),
          ),
        );
    }
  }
  async fetchPostings(
    source: DiscoverySource,
    board: string | undefined,
    offset: number,
  ): Promise<{ items: PublicPosting[]; nextOffset: number }> {
    if (board && !/^[a-zA-Z0-9_-]{1,80}$/.test(board))
      throw AppError.badRequest('Invalid company board.');
    let url: string;
    if (source === 'ARBEITNOW')
      url = `https://www.arbeitnow.com/api/job-board-api?page=${offset || 1}`;
    else if (source === 'GREENHOUSE')
      url = `https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`;
    else if (source === 'LEVER')
      url = `https://api.lever.co/v0/postings/${board}?mode=json&skip=${offset}&limit=100`;
    else url = `https://api.ashbyhq.com/posting-api/job-board/${board}?includeCompensation=true`;
    const response = await this.fetchFn(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
      redirect: 'error',
    });
    if (!response.ok) {
      this.logger.warn('Public source unavailable', { source, board, status: response.status });
      throw new Error(`Feed HTTP ${response.status}`);
    }
    const body = (await response.json()) as any;
    const rows = (source === 'LEVER' ? body : source === 'ARBEITNOW' ? body.data : body.jobs) ?? [];
    if (!Array.isArray(rows)) throw new Error('Invalid public feed');
    const items: PublicPosting[] = rows
      .slice(0, 5000)
      .filter((r: any) => r.isListed !== false)
      .map((r: any) =>
        source === 'ARBEITNOW'
          ? {
              title: r.title,
              company: r.company_name,
              url: r.url,
              description: plain(r.description),
              location: r.location,
              remote: r.remote,
              externalId: r.slug,
            }
          : source === 'GREENHOUSE'
            ? {
                title: r.title,
                company: r.company_name ?? board,
                url: r.absolute_url,
                description: plain(r.content),
                location: r.location?.name,
                externalId: String(r.id),
                board,
              }
            : source === 'LEVER'
              ? {
                  title: r.text,
                  company: board ?? '',
                  url: r.applyUrl ?? r.hostedUrl,
                  description: plain(
                    [
                      r.descriptionPlain ?? r.description,
                      ...(r.lists ?? []).map((l: any) => `${l.text} ${l.content}`),
                      r.additionalPlain ?? r.additional,
                    ].join(' '),
                  ),
                  location: r.categories?.location,
                  remote: r.workplaceType === 'remote',
                  externalId: r.id,
                  board,
                  employmentType: r.categories?.commitment,
                }
              : {
                  title: r.title,
                  company: board ?? '',
                  url: r.applyUrl ?? r.jobUrl,
                  description: plain(r.descriptionPlain ?? r.descriptionHtml),
                  location: r.location,
                  remote: r.isRemote,
                  externalId: r.id,
                  board,
                  employmentType: r.employmentType,
                  salary: r.compensation?.compensationTierSummary,
                },
      );
    if (source === 'ARBEITNOW')
      return { items, nextOffset: body.links?.next ? (offset || 1) + 1 : 1 };
    if (source === 'LEVER') return { items, nextOffset: rows.length === 100 ? offset + 100 : 0 };
    const start = offset % Math.max(1, items.length);
    return { items: items.slice(start).concat(items.slice(0, start)), nextOffset: start };
  }
}
