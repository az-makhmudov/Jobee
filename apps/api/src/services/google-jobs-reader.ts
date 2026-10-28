import { isIP } from 'node:net';
import { z } from 'zod';
import { stripHtmlToText } from '@job-agent/shared';
import { isPrivateOrRestrictedIp } from './http-retrieval-service.js';
import type { PublicPosting } from './job-discovery-service.js';
const listing = z.object({
  title: z.string().min(1),
  company_name: z.string().min(1),
  location: z.string().default(''),
  description: z.string().min(100),
  job_id: z.string().optional(),
  via: z.string().optional(),
  apply_options: z.array(z.object({ title: z.string(), link: z.string() })).default([]),
  detected_extensions: z
    .object({ schedule_type: z.string().optional(), work_from_home: z.boolean().optional() })
    .optional(),
});
const responseSchema = z.object({
  error: z.string().optional(),
  jobs_results: z.array(z.unknown()).optional(),
});
function publicLink(value: string): string | null {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      (!host.includes('.') && !isIP(host)) ||
      /\.(local|internal)$/.test(host) ||
      (!!isIP(host) && isPrivateOrRestrictedIp(host))
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
/** Operator-configured search data only; never logs credential-bearing URLs or accesses job-board accounts. */
export class GoogleJobsReader {
  constructor(
    private readonly fetchFn: typeof fetch,
    private readonly settings: { enabled: boolean; apiKey?: string },
  ) {}
  async read(query: string, location: string, country?: string): Promise<PublicPosting[]> {
    if (!this.settings.enabled || !this.settings.apiKey)
      throw new Error('Search provider is not configured');
    const url = new URL('https://serpapi.com/search.json');
    url.search = new URLSearchParams({
      engine: 'google_jobs',
      api_key: this.settings.apiKey,
      q: query.slice(0, 200),
      location: location.slice(0, 200),
      hl: 'en',
      ...(country ? { gl: country } : {}),
    }).toString();
    let data: z.infer<typeof responseSchema>;
    try {
      const response = await this.fetchFn(url.href, {
        headers: { Accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error('Unavailable');
      data = responseSchema.parse(await response.json());
      if (data.error || !data.jobs_results) throw new Error('Unavailable');
    } catch {
      throw new Error('Additional job search is temporarily unavailable');
    }
    return data.jobs_results!.slice(0, 10).flatMap((raw) => {
      const result = listing.safeParse(raw);
      if (!result.success) return [];
      const job = result.data;
      const options = job.apply_options.flatMap((option) => {
        const link = publicLink(option.link);
        return link ? [{ publisher: option.title, url: link }] : [];
      });
      if (!options.length) return [];
      return [
        {
          title: job.title,
          company: job.company_name,
          description: stripHtmlToText(job.description),
          location: job.location,
          url: options[0]!.url,
          externalId: job.job_id,
          remote: job.detected_extensions?.work_from_home,
          employmentType: job.detected_extensions?.schedule_type,
          sourceMetadata: {
            searchProvider: 'SERPAPI',
            via: job.via ?? null,
            applyOptions: options,
          },
        },
      ];
    });
  }
}
