import * as cheerio from 'cheerio';
import { stripHtmlToText, sanitizeJobHtml } from '@job-agent/shared';
import type { JobExtractor, RawExtractedJob } from './types.js';
import {
  parseJsonLdJobPosting,
  extractRequirementsFromSectionsOrText,
  extractStructuredSections,
} from './extractor-utils.js';

export class LeverExtractor implements JobExtractor {
  public canHandle(url: string | null, htmlOrText: string): boolean {
    if (url) {
      const lower = url.toLowerCase();
      if (lower.includes('jobs.lever.co') || lower.includes('lever.co')) {
        return true;
      }
    }
    return htmlOrText.includes('class="lever-job"') || htmlOrText.includes('posting-headline');
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

    // Check JSON-LD first
    const jsonLd = parseJsonLdJobPosting(html);
    if (jsonLd) {
      const title =
        (jsonLd.title as string) ||
        $('.posting-headline h2').text().trim() ||
        $('h2').first().text().trim();
      const hiringOrg = jsonLd.hiringOrganization as Record<string, unknown> | undefined;
      const company = (hiringOrg?.name as string) || sourceCompanyId?.replace(/[-_]/g, ' ') || '';

      let rawDesc = '';
      if ($('.section-wrapper').length > 0) {
        $('.section-wrapper').each((_, el) => {
          rawDesc += ($(el).html() || '') + '\n';
        });
      } else if ($('.section.page-centered').length > 0) {
        $('.section.page-centered').each((_, el) => {
          rawDesc += ($(el).html() || '') + '\n';
        });
      } else {
        rawDesc = (jsonLd.description as string) || $('.content').html() || $('body').html() || '';
      }
      const descText = stripHtmlToText(rawDesc);
      const descHtml = sanitizeJobHtml(rawDesc);

      const jobLocation = jsonLd.jobLocation as Record<string, unknown> | undefined;
      const address = jobLocation?.address as Record<string, unknown> | undefined;
      const location =
        (typeof address === 'string' ? address : (address?.addressLocality as string)) ||
        $('.posting-categories .location').text().trim() ||
        undefined;

      const workplaceRaw = $('.posting-categories .workplaceTypes').text().trim();
      const commitmentRaw = $('.posting-categories .commitment').text().trim();

      const sections = extractStructuredSections(rawDesc);
      const reqs = extractRequirementsFromSectionsOrText(sections, rawDesc);

      return {
        provider: 'LEVER',
        externalId,
        sourceCompanyId,
        title,
        company,
        location,
        descriptionText: descText,
        descriptionHtml: descHtml,
        canonicalUrl: url || undefined,
        rawMetadata: {
          ...jsonLd,
          workplaceRaw,
          commitmentRaw,
        },
        requirements: reqs,
        sections,
      };
    }

    // Fallback to DOM selectors
    const title =
      $('.posting-headline h2').text().trim() ||
      $('h2').first().text().trim() ||
      $('title')
        .text()
        .replace(/ - .*$/, '')
        .trim();

    const company = sourceCompanyId ? sourceCompanyId.replace(/[-_]/g, ' ') : '';
    const location = $('.posting-categories .location').text().trim() || undefined;
    const workplaceRaw = $('.posting-categories .workplaceTypes').text().trim();
    const commitmentRaw = $('.posting-categories .commitment').text().trim();

    let rawDesc = '';
    if ($('.section-wrapper').length > 0) {
      $('.section-wrapper').each((_, el) => {
        rawDesc += ($(el).html() || '') + '\n';
      });
    } else if ($('.section.page-centered').length > 0) {
      $('.section.page-centered').each((_, el) => {
        rawDesc += ($(el).html() || '') + '\n';
      });
    } else {
      rawDesc = $('.content').html() || $('body').html() || '';
    }
    const descText = stripHtmlToText(rawDesc);
    const descHtml = sanitizeJobHtml(rawDesc);

    const sections = extractStructuredSections(rawDesc);
    const reqs = extractRequirementsFromSectionsOrText(sections, rawDesc);

    const workplaceType = workplaceRaw
      ? workplaceRaw.toUpperCase() === 'HYBRID'
        ? 'HYBRID'
        : workplaceRaw.toUpperCase() === 'REMOTE'
          ? 'REMOTE'
          : workplaceRaw.toUpperCase().includes('ONSITE')
            ? 'ONSITE'
            : undefined
      : undefined;

    const employmentType = commitmentRaw
      ? commitmentRaw.toLowerCase().includes('full')
        ? 'FULL_TIME'
        : commitmentRaw.toLowerCase().includes('part')
          ? 'PART_TIME'
          : undefined
      : undefined;

    return {
      provider: 'LEVER',
      externalId,
      sourceCompanyId,
      title,
      company,
      location,
      workplaceType: workplaceType as any,
      employmentType: employmentType as any,
      descriptionText: descText,
      descriptionHtml: descHtml,
      canonicalUrl: url || undefined,
      rawMetadata: {
        workplaceRaw,
        commitmentRaw,
      },
      requirements: reqs,
      sections,
    };
  }
}
