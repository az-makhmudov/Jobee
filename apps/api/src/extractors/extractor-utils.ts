import * as cheerio from 'cheerio';
import type { RequirementCategory, RequirementStrength, SectionType } from '@job-agent/shared';
import { stripHtmlToText } from '@job-agent/shared';
import type { RawExtractedRequirement, RawExtractedSection } from './types.js';

export function parseJsonLdJobPosting(html: string): Record<string, unknown> | null {
  try {
    const $ = cheerio.load(html);
    const scripts = $('script[type="application/ld+json"]');

    for (let i = 0; i < scripts.length; i++) {
      const scriptText = $(scripts[i]).text().trim();
      if (!scriptText) continue;

      try {
        const parsed = JSON.parse(scriptText);
        const candidates = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed['@graph'])
            ? parsed['@graph']
            : [parsed];

        for (const item of candidates) {
          if (
            item &&
            typeof item === 'object' &&
            (item['@type'] === 'JobPosting' ||
              (Array.isArray(item['@type']) && item['@type'].includes('JobPosting')))
          ) {
            return item as Record<string, unknown>;
          }
        }
      } catch {
        // Skip malformed JSON-LD block
      }
    }
  } catch {
    // Parser error fallback
  }

  return null;
}

export function parseOpenGraphMeta(html: string): Record<string, string> {
  const meta: Record<string, string> = {};
  try {
    const $ = cheerio.load(html);
    $('meta').each((_, el) => {
      const property = $(el).attr('property') || $(el).attr('name');
      const content = $(el).attr('content');
      if (property && content) {
        meta[property.toLowerCase()] = content.trim();
      }
    });
  } catch {
    // Ignore parse error
  }
  return meta;
}

export function classifyRequirementCategory(text: string): RequirementCategory {
  const lower = text.toLowerCase();

  if (/years? of experience|prior experience|proven track record|background in/i.test(lower)) {
    return 'EXPERIENCE';
  }

  if (/degree|bachelor|master|phd|diploma|computer science|university|b\.s\.|m\.s\./i.test(lower)) {
    return 'EDUCATION';
  }

  if (
    /fluent|native|proficiency in english|german|french|spanish|written and verbal/i.test(lower)
  ) {
    return 'LANGUAGE';
  }

  if (
    /visa|sponsorship|work permit|authorized to work|citizen|legal authorization|right to work/i.test(
      lower,
    )
  ) {
    return 'WORK_AUTHORIZATION';
  }

  if (/certified|certification|license|aws certified|pmp|scrum master|cissp/i.test(lower)) {
    return 'CERTIFICATION';
  }

  if (/must be located in|based in|reside in|willing to relocate|time zone/i.test(lower)) {
    return 'LOCATION';
  }

  if (
    /responsible for|collaborate with|lead the team|manage|deliver|maintain|architect/i.test(lower)
  ) {
    return 'RESPONSIBILITY';
  }

  if (
    /proficient with|experience with|knowledge of|familiarity with|skills in|typescript|python|react|sql|aws|docker|kubernetes|node/i.test(
      lower,
    )
  ) {
    return 'SKILL';
  }

  return 'OTHER';
}

export function classifyRequirementStrength(
  text: string,
  sectionTitle?: string,
): RequirementStrength {
  const titleLower = (sectionTitle || '').toLowerCase();
  const textLower = text.toLowerCase();

  if (
    titleLower.includes('preferred') ||
    titleLower.includes('nice to have') ||
    titleLower.includes('bonus') ||
    titleLower.includes('plus')
  ) {
    return 'PREFERRED';
  }

  if (
    titleLower.includes('minimum') ||
    titleLower.includes('basic') ||
    titleLower.includes('required') ||
    titleLower.includes('must have')
  ) {
    return 'MANDATORY';
  }

  if (
    textLower.includes('required') ||
    textLower.includes('must have') ||
    textLower.includes('must be')
  ) {
    return 'MANDATORY';
  }

  if (
    textLower.includes('nice to have') ||
    textLower.includes('preferred') ||
    textLower.includes('is a plus') ||
    textLower.includes('advantage')
  ) {
    return 'PREFERRED';
  }

  return 'UNKNOWN';
}

export function extractRequirementsFromList(
  htmlOrText: string,
  sectionTitle?: string,
): RawExtractedRequirement[] {
  const reqs: RawExtractedRequirement[] = [];

  // Check if HTML has <li> items
  if (htmlOrText.includes('<li')) {
    try {
      const $ = cheerio.load(htmlOrText);
      $('li').each((_, el) => {
        const text = $(el).text().replace(/\s+/g, ' ').trim();
        if (text && text.length > 5) {
          reqs.push({
            rawText: text,
            category: classifyRequirementCategory(text),
            strength: classifyRequirementStrength(text, sectionTitle),
            sourceSection: sectionTitle || undefined,
          });
        }
      });
      if (reqs.length > 0) return reqs;
    } catch {
      // Fallback to text parsing
    }
  }

  // Text-based bullet point parsing
  const plain = stripHtmlToText(htmlOrText);
  const lines = plain.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Matches bullet symbols or numbered lists: •, -, *, +, 1., etc.
    const bulletMatch = trimmed.match(/^(?:[•\-*+]|\d+[.)])\s+(.+)$/);
    const content = bulletMatch?.[1]?.trim();
    if (content && content.length > 5) {
      reqs.push({
        rawText: content,
        category: classifyRequirementCategory(content),
        strength: classifyRequirementStrength(content, sectionTitle),
        sourceSection: sectionTitle || undefined,
      });
    }
  }

  return reqs;
}

export function extractRequirementsFromSectionsOrText(
  sections: RawExtractedSection[] | undefined,
  fallbackHtmlOrText: string,
): RawExtractedRequirement[] {
  if (sections && sections.length > 0) {
    const sectionReqs: RawExtractedRequirement[] = [];
    for (const sec of sections) {
      // Exclude pure responsibilities, benefits, and company info from hiring requirements
      // (Responsibilities are preserved in job_sections)
      if (
        sec.type === 'RESPONSIBILITIES' ||
        sec.type === 'BENEFITS' ||
        sec.type === 'ABOUT_COMPANY'
      ) {
        continue;
      }
      const reqs = extractRequirementsFromList(sec.content, sec.title);
      sectionReqs.push(...reqs);
    }
    if (sectionReqs.length > 0) {
      return sectionReqs;
    }
  }

  // Fallback if no sections or no requirements extracted from sections
  const reqs = extractRequirementsFromList(fallbackHtmlOrText);
  // Ensure any item classified as RESPONSIBILITY is never marked MANDATORY
  return reqs.map((r) => {
    if (r.category === 'RESPONSIBILITY' && r.strength === 'MANDATORY') {
      return { ...r, strength: 'UNKNOWN' };
    }
    return r;
  });
}

export function extractStructuredSections(html: string): RawExtractedSection[] {
  const sections: RawExtractedSection[] = [];
  try {
    const $ = cheerio.load(html);

    // Look for heading followed by content
    $('h1, h2, h3, h4').each((_, el) => {
      const headingText = $(el).text().trim();
      if (!headingText) return;

      const lower = headingText.toLowerCase();
      let sectionType: SectionType = 'OTHER';

      if (
        lower.includes('responsibilit') ||
        lower.includes('what you will do') ||
        lower.includes("what you'll do") ||
        lower.includes('what you do') ||
        lower.includes('role')
      ) {
        sectionType = 'RESPONSIBILITIES';
      } else if (
        lower.includes('preferred') ||
        lower.includes('nice to have') ||
        lower.includes('bonus') ||
        lower.includes('plus')
      ) {
        sectionType = 'PREFERRED_QUALIFICATIONS';
      } else if (
        lower.includes('qualificat') ||
        lower.includes('requirement') ||
        lower.includes('what you bring') ||
        lower.includes("what we're looking for") ||
        lower.includes('what we are looking for') ||
        lower.includes('who you are')
      ) {
        sectionType = 'QUALIFICATIONS';
      } else if (lower.includes('benefit') || lower.includes('perk') || lower.includes('offer')) {
        sectionType = 'BENEFITS';
      } else if (
        lower.includes('about') ||
        lower.includes('company') ||
        lower.includes('who we are')
      ) {
        sectionType = 'ABOUT_COMPANY';
      }

      // Collect sibling elements until next heading
      const contentParts: string[] = [];
      let sibling = $(el).next();
      while (sibling.length && !sibling.is('h1, h2, h3, h4')) {
        if (sibling.is('ul, ol') || sibling.find('ul, ol').length > 0) {
          const listEls = sibling.is('ul, ol') ? sibling : sibling.find('ul, ol');
          listEls.find('li').each((_, li) => {
            const liText = $(li).text().trim();
            if (liText) contentParts.push(`• ${liText}`);
          });
        } else {
          const text = sibling.text().trim();
          if (text) contentParts.push(text);
        }
        sibling = sibling.next();
      }

      // Fallback for wrapped headings (e.g. <div><h3>Heading</h3></div><div>Content</div>)
      if (contentParts.length === 0 && $(el).parent().is('div, section')) {
        let parentSibling = $(el).parent().next();
        while (parentSibling.length && !parentSibling.find('h1, h2, h3, h4').length) {
          if (parentSibling.is('ul, ol') || parentSibling.find('ul, ol').length > 0) {
            const listEls = parentSibling.is('ul, ol')
              ? parentSibling
              : parentSibling.find('ul, ol');
            listEls.find('li').each((_, li) => {
              const liText = $(li).text().trim();
              if (liText) contentParts.push(`• ${liText}`);
            });
          } else {
            const text = parentSibling.text().trim();
            if (text) contentParts.push(text);
          }
          parentSibling = parentSibling.next();
        }
      }

      if (contentParts.length > 0) {
        sections.push({
          type: sectionType,
          title: headingText,
          content: contentParts.join('\n\n'),
        });
      }
    });
  } catch {
    // Ignore parse error
  }
  return sections;
}
