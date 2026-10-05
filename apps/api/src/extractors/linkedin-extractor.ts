import * as cheerio from 'cheerio';
import { stripHtmlToText, sanitizeJobHtml } from '@job-agent/shared';
import type { JobExtractor, RawExtractedJob } from './types.js';
import {
  parseJsonLdJobPosting,
  extractRequirementsFromList,
  extractStructuredSections,
  parseOpenGraphMeta,
} from './extractor-utils.js';

export class LinkedInExtractor implements JobExtractor {
  public canHandle(url: string | null, htmlOrText: string): boolean {
    if (url) {
      const lower = url.toLowerCase();
      if (lower.includes('linkedin.com/jobs') || lower.includes('linkedin.com/job/')) {
        return true;
      }
    }
    return htmlOrText.includes('linkedin.com') && htmlOrText.includes('job-details');
  }

  public extract(url: string | null, html: string): RawExtractedJob {
    let externalId: string | undefined;

    if (url) {
      try {
        const parsed = new URL(url);
        // Pattern 1: /jobs/view/123456789/
        const viewMatch = parsed.pathname.match(/\/jobs\/view\/(\d+)/);
        if (viewMatch) {
          externalId = viewMatch[1];
        } else {
          // Pattern 2: ?currentJobId=123456789
          const currentJobId = parsed.searchParams.get('currentJobId');
          if (currentJobId && /^\d+$/.test(currentJobId)) {
            externalId = currentJobId;
          }
        }
      } catch {
        // Ignore
      }
    }

    const $ = cheerio.load(html);

    // Detect LinkedIn Auth Wall / Sign-in redirect
    const isAuthWall =
      $('title').text().toLowerCase().includes('sign in') ||
      $('title').text().toLowerCase().includes('login') ||
      html.includes('authwall') ||
      $('.authwall-join-form').length > 0;

    // Check JSON-LD if public page was rendered
    const jsonLd = parseJsonLdJobPosting(html);
    if (jsonLd && !isAuthWall) {
      const title = (jsonLd.title as string) || $('h1').first().text().trim();
      const hiringOrg = jsonLd.hiringOrganization as Record<string, unknown> | undefined;
      const company = (hiringOrg?.name as string) || '';
      const rawDesc =
        (jsonLd.description as string) || $('.show-more-less-html__markup').html() || '';
      const descText = stripHtmlToText(rawDesc);
      const descHtml = sanitizeJobHtml(rawDesc);

      const jobLocation = jsonLd.jobLocation as Record<string, unknown> | undefined;
      const address = jobLocation?.address as Record<string, unknown> | undefined;
      const location =
        (typeof address === 'string' ? address : (address?.addressLocality as string)) || undefined;

      const reqs = extractRequirementsFromList(rawDesc);
      const sections = extractStructuredSections(rawDesc);

      return {
        provider: 'LINKEDIN',
        externalId,
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

    // Check OpenGraph tags
    const og = parseOpenGraphMeta(html);
    const ogTitle = og['og:title'] || $('title').text().trim();
    const titleAndCompany = ogTitle.split(' hiring ')[0] || ogTitle.split(' | ')[0] || '';

    // If auth wall or missing full description, mark as NEEDS_MANUAL_TEXT
    const contentEl = $('.show-more-less-html__markup, .description__text');
    const rawDesc = contentEl.html() || '';
    const descText = stripHtmlToText(rawDesc);

    if (isAuthWall || !descText || descText.length < 50) {
      return {
        provider: 'LINKEDIN',
        externalId,
        title: titleAndCompany.replace(/ - LinkedIn$/, '').trim() || 'LinkedIn Job Posting',
        company: og['og:site_name'] || undefined,
        descriptionText:
          'LinkedIn requires authentication or interactive verification to access the full job description. Please paste the job description text manually to complete ingestion.',
        canonicalUrl: url || undefined,
        rawMetadata: {
          authWallDetected: true,
          externalId,
          og,
        },
        warnings: [
          'LinkedIn authentication wall detected. The job URL and ID have been saved, but the description must be provided via pasted text.',
        ],
        needsManualText: true,
      };
    }

    const descHtml = sanitizeJobHtml(rawDesc);
    const reqs = extractRequirementsFromList(rawDesc);
    const sections = extractStructuredSections(rawDesc);

    return {
      provider: 'LINKEDIN',
      externalId,
      title: titleAndCompany.replace(/ - LinkedIn$/, '').trim(),
      descriptionText: descText,
      descriptionHtml: descHtml,
      canonicalUrl: url || undefined,
      rawMetadata: og,
      requirements: reqs,
      sections,
    };
  }
}
