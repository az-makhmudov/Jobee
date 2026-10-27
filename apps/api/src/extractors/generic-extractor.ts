import * as cheerio from 'cheerio';
import { stripHtmlToText, sanitizeJobHtml } from '@job-agent/shared';
import type { JobExtractor, RawExtractedJob } from './types.js';
import {
  parseJsonLdJobPosting,
  extractRequirementsFromSectionsOrText,
  extractStructuredSections,
  parseOpenGraphMeta,
} from './extractor-utils.js';

export class GenericExtractor implements JobExtractor {
  public canHandle(): boolean {
    return true; // Fallback for all other pages
  }

  public extract(url: string | null, html: string): RawExtractedJob {
    const $ = cheerio.load(html);

    // 1. Check for JSON-LD JobPosting schema
    const jsonLd = parseJsonLdJobPosting(html);
    if (jsonLd) {
      const title =
        (jsonLd.title as string) || $('h1').first().text().trim() || $('title').text().trim();

      const hiringOrg = jsonLd.hiringOrganization as Record<string, unknown> | undefined;
      const company = (hiringOrg?.name as string) || '';

      const rawDesc = (jsonLd.description as string) || $('main, article, body').html() || '';
      const descText = stripHtmlToText(rawDesc);
      const descHtml = sanitizeJobHtml(rawDesc);

      const jobLocation = jsonLd.jobLocation as Record<string, unknown> | undefined;
      const address = jobLocation?.address as Record<string, unknown> | undefined;
      let location: string | undefined;
      if (typeof address === 'string') {
        location = address;
      } else if (address) {
        const parts = [
          address.addressLocality,
          address.addressRegion,
          address.addressCountry,
        ].filter(Boolean);
        if (parts.length > 0) location = parts.join(', ');
      }

      // Check salary in JSON-LD
      let minSalary: number | undefined;
      let maxSalary: number | undefined;
      let currency: string | undefined;
      const baseSalary = jsonLd.baseSalary as Record<string, unknown> | undefined;
      if (baseSalary) {
        currency = (baseSalary.currency as string) || undefined;
        const val = baseSalary.value as Record<string, unknown> | number | undefined;
        if (typeof val === 'number') {
          minSalary = val;
          maxSalary = val;
        } else if (typeof val === 'object' && val !== null) {
          if (typeof val.minValue === 'number') minSalary = val.minValue;
          if (typeof val.maxValue === 'number') maxSalary = val.maxValue;
          if (typeof val.value === 'number') {
            minSalary = val.value;
            maxSalary = val.value;
          }
        }
      }

      const sections = extractStructuredSections(rawDesc);
      const reqs = extractRequirementsFromSectionsOrText(sections, rawDesc);

      return {
        provider: 'GENERIC',
        ...(descText.trim().length < 100
          ? {
              needsManualText: true,
              warnings: [
                'The public page does not contain a complete vacancy description. Paste the job text.',
              ],
            }
          : {}),
        title,
        company,
        location,
        minSalary,
        maxSalary,
        currency,
        descriptionText: descText,
        descriptionHtml: descHtml,
        canonicalUrl: url || undefined,
        rawMetadata: jsonLd,
        requirements: reqs,
        sections,
      };
    }

    // 2. OpenGraph / Meta Tag Fallback
    const og = parseOpenGraphMeta(html);
    const ogTitle = og['og:title'] || $('h1').first().text().trim() || $('title').text().trim();
    const company = og['og:site_name'] || '';
    const rawDesc = $('main, article, [role="main"]').html() || $('body').html() || '';
    const descText = stripHtmlToText(rawDesc);
    const descHtml = sanitizeJobHtml(rawDesc);

    const sections = extractStructuredSections(rawDesc);
    const reqs = extractRequirementsFromSectionsOrText(sections, rawDesc);

    return {
      provider: 'GENERIC',
      ...(descText.trim().length < 100
        ? {
            needsManualText: true,
            warnings: [
              'The public page requires JavaScript or contains no complete vacancy. Paste the job text.',
            ],
          }
        : {}),
      title: ogTitle,
      company,
      descriptionText: descText,
      descriptionHtml: descHtml,
      canonicalUrl: url || undefined,
      rawMetadata: og,
      requirements: reqs,
      sections,
    };
  }
}
