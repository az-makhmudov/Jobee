import * as cheerio from 'cheerio';
import { stripHtmlToText, sanitizeJobHtml } from '@job-agent/shared';
import type { JobExtractor, RawExtractedJob } from './types.js';
import {
  parseJsonLdJobPosting,
  extractRequirementsFromSectionsOrText,
  extractStructuredSections,
} from './extractor-utils.js';

export class AshbyExtractor implements JobExtractor {
  public canHandle(url: string | null, htmlOrText: string): boolean {
    if (url) {
      const lower = url.toLowerCase();
      if (lower.includes('jobs.ashbyhq.com') || lower.includes('ashbyhq.com')) {
        return true;
      }
    }
    return htmlOrText.includes('ashbyhq') || htmlOrText.includes('ashby-job');
  }

  public extract(url: string | null, html: string): RawExtractedJob {
    const $ = cheerio.load(html);

    let externalId: string | undefined;
    let sourceCompanyId: string | undefined;

    if (url) {
      try {
        const parsed = new URL(url);
        const parts = parsed.pathname.split('/').filter(Boolean);
        if (parts.length >= 2) {
          sourceCompanyId = parts[0];
          externalId = parts[1];
        } else if (parts.length === 1) {
          sourceCompanyId = parts[0];
        }
      } catch {
        // Ignore
      }
    }

    // Check JSON-LD
    const jsonLd = parseJsonLdJobPosting(html);
    if (jsonLd) {
      const title = (jsonLd.title as string) || $('h1').first().text().trim();
      const hiringOrg = jsonLd.hiringOrganization as Record<string, unknown> | undefined;
      const company = (hiringOrg?.name as string) || sourceCompanyId?.replace(/[-_]/g, ' ') || '';

      const rawDesc = (jsonLd.description as string) || $('main, [role="main"]').html() || '';
      const descText = stripHtmlToText(rawDesc);
      const descHtml = sanitizeJobHtml(rawDesc);

      const jobLocation = jsonLd.jobLocation as Record<string, unknown> | undefined;
      const address = jobLocation?.address as Record<string, unknown> | undefined;
      let location: string | undefined;
      if (typeof address === 'string') {
        location = address;
      } else if (address) {
        const parts = [address.addressLocality, address.addressRegion, address.addressCountry]
          .filter(Boolean)
          .map(String);
        location = parts.length > 0 ? parts.join(', ') : undefined;
      }

      const sections = extractStructuredSections(rawDesc);
      const reqs = extractRequirementsFromSectionsOrText(sections, rawDesc);

      return {
        provider: 'ASHBY',
        externalId,
        sourceCompanyId,
        title,
        company,
        location,
        employmentType: (jsonLd.employmentType as any) || undefined,
        descriptionText: descText,
        descriptionHtml: descHtml,
        canonicalUrl: url || undefined,
        rawMetadata: jsonLd,
        requirements: reqs,
        sections,
      };
    }

    // Check __NEXT_DATA__
    const nextDataScript = $('script#__NEXT_DATA__').text().trim();
    if (nextDataScript) {
      try {
        const nextData = JSON.parse(nextDataScript);
        const jobPosting =
          nextData?.props?.pageProps?.jobPosting || nextData?.props?.pageProps?.posting;

        if (jobPosting) {
          const title = jobPosting.title || $('h1').first().text().trim();
          const company = jobPosting.companyName || sourceCompanyId?.replace(/[-_]/g, ' ') || '';
          const location = jobPosting.locationName || jobPosting.location || undefined;
          const rawDesc = jobPosting.descriptionHtml || jobPosting.description || '';
          const descText = stripHtmlToText(rawDesc);
          const descHtml = sanitizeJobHtml(rawDesc);

          const sections = extractStructuredSections(rawDesc);
          const reqs = extractRequirementsFromSectionsOrText(sections, rawDesc);

          return {
            provider: 'ASHBY',
            externalId: jobPosting.id || externalId,
            sourceCompanyId,
            title,
            company,
            location,
            descriptionText: descText,
            descriptionHtml: descHtml,
            canonicalUrl: url || undefined,
            rawMetadata: jobPosting,
            requirements: reqs,
            sections,
          };
        }
      } catch {
        // Fallback
      }
    }

    // Fallback to DOM selectors
    const title = $('h1').first().text().trim() || $('title').text().trim();
    const company = sourceCompanyId ? sourceCompanyId.replace(/[-_]/g, ' ') : '';
    const mainContent = $('main, [role="main"], body').html() || '';
    const descText = stripHtmlToText(mainContent);
    const descHtml = sanitizeJobHtml(mainContent);

    const sections = extractStructuredSections(mainContent);
    const reqs = extractRequirementsFromSectionsOrText(sections, mainContent);

    return {
      provider: 'ASHBY',
      externalId,
      sourceCompanyId,
      title,
      company,
      descriptionText: descText,
      descriptionHtml: descHtml,
      canonicalUrl: url || undefined,
      requirements: reqs,
      sections,
    };
  }
}
