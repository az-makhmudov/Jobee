import * as cheerio from 'cheerio';
import { stripHtmlToText, sanitizeJobHtml } from '@job-agent/shared';
import type { JobExtractor, RawExtractedJob } from './types.js';
import {
  parseJsonLdJobPosting,
  extractRequirementsFromSectionsOrText,
  extractStructuredSections,
} from './extractor-utils.js';

export class GreenhouseExtractor implements JobExtractor {
  public canHandle(url: string | null, htmlOrText: string): boolean {
    if (url) {
      const lower = url.toLowerCase();
      if (
        lower.includes('boards.greenhouse.io') ||
        lower.includes('greenhouse.io') ||
        lower.includes('gh_jid=')
      ) {
        return true;
      }
    }
    return htmlOrText.includes('id="grnhse_app"') || htmlOrText.includes('greenhouse-job-board');
  }

  public extract(url: string | null, html: string): RawExtractedJob {
    const $ = cheerio.load(html);

    // 1. External ID extraction from URL
    let externalId: string | undefined;
    let sourceCompanyId: string | undefined;

    if (url) {
      try {
        const parsed = new URL(url);
        const jid = parsed.searchParams.get('gh_jid');
        if (jid) {
          externalId = jid;
        } else {
          const match = parsed.pathname.match(/\/jobs\/(\d+)/);
          if (match) externalId = match[1];
        }

        const pathParts = parsed.pathname.split('/').filter(Boolean);
        if (pathParts.length > 0 && pathParts[0] !== 'jobs') {
          sourceCompanyId = pathParts[0];
        }
      } catch {
        // Ignore
      }
    }

    // 2. Check JSON-LD
    const jsonLd = parseJsonLdJobPosting(html);
    if (jsonLd) {
      const title =
        (jsonLd.title as string) || $('h1.app-title, .app-title, #header h1').text().trim();
      const hiringOrg = jsonLd.hiringOrganization as Record<string, unknown> | undefined;
      const company = (hiringOrg?.name as string) || sourceCompanyId || '';
      const rawDesc = (jsonLd.description as string) || $('#content, #main, .body').html() || '';
      const descText = stripHtmlToText(rawDesc);
      const descHtml = sanitizeJobHtml(rawDesc);

      const jobLocation = jsonLd.jobLocation as Record<string, unknown> | undefined;
      const address = jobLocation?.address as Record<string, unknown> | undefined;
      const location =
        typeof address === 'string'
          ? address
          : (address?.addressLocality as string) || $('.location').text().trim() || undefined;

      const sections = extractStructuredSections(rawDesc);
      const reqs = extractRequirementsFromSectionsOrText(sections, rawDesc);

      return {
        provider: 'GREENHOUSE',
        externalId,
        sourceCompanyId,
        title,
        company,
        location,
        descriptionText: descText,
        descriptionHtml: descHtml,
        canonicalUrl: url || undefined,
        rawMetadata: jsonLd,
        requirements: reqs,
        sections,
      };
    }

    // 3. Fallback to DOM selectors for Greenhouse standard theme
    const title =
      $('h1.app-title, .app-title, #header h1').text().trim() || $('title').text().trim();
    const location = $('.location').text().trim() || undefined;
    const company =
      $('.company-name').text().trim() ||
      (sourceCompanyId ? sourceCompanyId.replace(/[-_]/g, ' ') : '');
    const employmentType = $('#employment-type, .employment-type').text().trim() || undefined;
    const contentEl = $('#content, #main, .body');
    const rawDesc = contentEl.html() || $('body').html() || '';
    const descText = stripHtmlToText(rawDesc);
    const descHtml = sanitizeJobHtml(rawDesc);

    const sections = extractStructuredSections(rawDesc);
    const reqs = extractRequirementsFromSectionsOrText(sections, rawDesc);

    return {
      provider: 'GREENHOUSE',
      externalId,
      sourceCompanyId,
      title,
      company,
      location,
      employmentType: employmentType as any,
      descriptionText: descText,
      descriptionHtml: descHtml,
      canonicalUrl: url || undefined,
      requirements: reqs,
      sections,
    };
  }
}
