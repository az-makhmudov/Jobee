import type { Database } from '@job-agent/database';
import { jobPreferences, candidateProfiles } from '@job-agent/database';
import { eq } from 'drizzle-orm';
import type { JobService } from './job-service.js';
import { createLogger, Logger } from '@job-agent/shared';

export interface DiscoveryOptions {
  limit?: number;
  sources?: ('ARBEITNOW' | 'GREENHOUSE')[];
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

export class JobDiscoveryService {
  private readonly logger: Logger;
  private readonly fetchFn: typeof fetch;

  constructor(
    private readonly db: Database,
    private readonly jobService: JobService,
    options?: {
      logger?: Logger;
      fetchFn?: typeof fetch;
    },
  ) {
    this.logger = options?.logger ?? createLogger({ service: 'job-discovery' });
    this.fetchFn = options?.fetchFn ?? fetch;
  }

  /**
   * Discover and ingest opportunities from public job sources based on candidate preferences.
   */
  public async discoverForCandidate(
    userId: string,
    options: DiscoveryOptions = {},
  ): Promise<CombinedDiscoverySummary> {
    const limit = options.limit ?? 15;
    const sources = options.sources ?? ['ARBEITNOW', 'GREENHOUSE'];

    // 1. Resolve candidate target roles and keywords from profile & preferences
    const [prefs] = await this.db
      .select()
      .from(jobPreferences)
      .where(eq(jobPreferences.userId, userId))
      .limit(1);

    const [profile] = await this.db
      .select()
      .from(candidateProfiles)
      .where(eq(candidateProfiles.userId, userId))
      .limit(1);

    const targetRoles =
      (prefs?.targetTitles as string[]) || ((prefs as any)?.targetRoles as string[]) || [];
    const headline = profile?.headline || '';
    const keywords: string[] = [
      ...targetRoles,
      ...(options.queryKeywords || []),
      ...(headline ? [headline] : []),
    ]
      .map((k) => k.trim())
      .filter((k) => k.length > 2);

    const results: DiscoveryResult[] = [];

    // 2. Discover from Arbeitnow (public API)
    if (sources.includes('ARBEITNOW')) {
      const arbeitnowRes = await this.discoverFromArbeitnow(userId, keywords, limit);
      results.push(arbeitnowRes);
    }

    // 3. Discover from Greenhouse Public Boards
    if (sources.includes('GREENHOUSE')) {
      const defaultCompanies = ['stripe', 'gitlab', 'revolut', 'canonical'];
      const targetCompanies = options.companies || defaultCompanies;
      const greenhouseRes = await this.discoverFromGreenhouse(
        userId,
        targetCompanies,
        keywords,
        limit,
      );
      results.push(greenhouseRes);
    }

    const totalDiscovered = results.reduce((sum, r) => sum + r.totalFound, 0);
    const newJobsIngested = results.reduce((sum, r) => sum + r.newJobsIngested, 0);
    const duplicatesSkipped = results.reduce((sum, r) => sum + r.duplicatesSkipped, 0);

    return {
      sourcesSummary: results,
      totalDiscovered,
      newJobsIngested,
      duplicatesSkipped,
    };
  }

  /**
   * Discovers jobs from Arbeitnow public JSON feed
   */
  private async discoverFromArbeitnow(
    userId: string,
    keywords: string[],
    limit: number,
  ): Promise<DiscoveryResult> {
    const result: DiscoveryResult = {
      source: 'ARBEITNOW',
      totalFound: 0,
      newJobsIngested: 0,
      duplicatesSkipped: 0,
      errors: [],
    };

    try {
      const res = await this.fetchFn('https://www.arbeitnow.com/api/job-board-api', {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        result.errors.push(`HTTP ${res.status} from Arbeitnow API`);
        return result;
      }

      const body = (await res.json()) as {
        data?: Array<{
          title?: string;
          company_name?: string;
          description?: string;
          url?: string;
          location?: string;
          remote?: boolean;
          tags?: string[];
        }>;
      };

      const items = body.data || [];
      result.totalFound = items.length;

      // Filter by candidate keywords if provided, or take top items
      const matchedItems = items
        .filter((item) => {
          if (keywords.length === 0) return true;
          const text = `${item.title || ''} ${item.tags?.join(' ') || ''}`.toLowerCase();
          return keywords.some((kw) => text.includes(kw.toLowerCase()));
        })
        .slice(0, limit);

      for (const item of matchedItems) {
        if (!item.title || !item.company_name || !item.description) continue;

        try {
          // Convert description HTML to readable text for ingestion
          const plainDesc = item.description
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

          const locationText = item.location || (item.remote ? 'Remote' : 'Unspecified');
          const fullText = `Title: ${item.title}\nCompany: ${item.company_name}\nLocation: ${locationText}\n\nJob Description:\n${plainDesc}`;

          const ingestRes = await this.jobService.ingestText(userId, {
            title: item.title,
            company: item.company_name,
            url: item.url,
            text: fullText,
          });

          if (ingestRes.isDuplicate) {
            result.duplicatesSkipped++;
          } else {
            result.newJobsIngested++;
          }
        } catch (err: any) {
          result.errors.push(`Failed ingesting ${item.title}: ${err.message}`);
        }
      }
    } catch (err: any) {
      this.logger.warn(`Error during Arbeitnow discovery: ${err.message}`);
      result.errors.push(err.message);
    }

    return result;
  }

  /**
   * Discovers jobs from public Greenhouse boards
   */
  private async discoverFromGreenhouse(
    userId: string,
    companies: string[],
    keywords: string[],
    limit: number,
  ): Promise<DiscoveryResult> {
    const result: DiscoveryResult = {
      source: 'GREENHOUSE',
      totalFound: 0,
      newJobsIngested: 0,
      duplicatesSkipped: 0,
      errors: [],
    };

    for (const company of companies) {
      if (result.newJobsIngested >= limit) break;

      try {
        const boardUrl = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(company)}/jobs`;
        const res = await this.fetchFn(boardUrl, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(8000),
        });

        if (!res.ok) {
          continue; // Board not found or rate limited, gracefully continue
        }

        const body = (await res.json()) as {
          jobs?: Array<{
            id: number;
            title?: string;
            absolute_url?: string;
            location?: { name?: string };
          }>;
        };

        const companyJobs = body.jobs || [];
        result.totalFound += companyJobs.length;

        // Filter by keywords
        const filtered = companyJobs.filter((j) => {
          if (keywords.length === 0) return true;
          const title = (j.title || '').toLowerCase();
          return keywords.some((kw) => title.includes(kw.toLowerCase()));
        });

        for (const j of filtered.slice(0, 3)) {
          if (!j.title || !j.absolute_url) continue;

          try {
            // Ingest via jobService.ingestUrl
            const ingestRes = await this.jobService.ingestUrl(userId, {
              url: j.absolute_url,
            });

            if (ingestRes.isDuplicate) {
              result.duplicatesSkipped++;
            } else {
              result.newJobsIngested++;
            }
          } catch (ingestErr: any) {
            result.errors.push(`Failed importing ${j.title}: ${ingestErr.message}`);
          }
        }
      } catch (err: any) {
        this.logger.debug(`Could not inspect Greenhouse board for ${company}: ${err.message}`);
      }
    }

    return result;
  }
}
