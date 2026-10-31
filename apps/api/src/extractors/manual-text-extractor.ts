import type { RawExtractedJob, RawExtractedSection } from './types.js';
import { extractRequirementsFromSectionsOrText } from './extractor-utils.js';

export interface ManualTextExtraInputs {
  title?: string;
  company?: string;
  url?: string;
}

export class ManualTextExtractor {
  public extract(text: string, extra: ManualTextExtraInputs = {}): RawExtractedJob {
    const lines = text.split('\n').map((l) => l.trim());
    const nonEmptyLines = lines.filter((l) => l.length > 0);

    let extractedTitle = extra.title;
    let extractedCompany = extra.company;
    let extractedLocation: string | undefined;
    let workplaceRaw: string | undefined;
    let seniorityRaw: string | undefined;
    let commitmentRaw: string | undefined;

    // Look for explicit prefix labels
    for (const line of lines) {
      seniorityRaw ??= line
        .match(/^seniority:\s*(.+)$/i)?.[1]
        ?.trim()
        .toUpperCase();
      workplaceRaw ??= line.match(/^(?:work arrangement|workplace):\s*(.+)$/i)?.[1]?.trim();
      commitmentRaw ??= line.match(/^(?:employment|employment type):\s*(.+)$/i)?.[1]?.trim();
      if (!extractedTitle) {
        const titleMatch = line.match(/^(?:job\s+title|title|role|position):\s*(.+)$/i);
        if (titleMatch?.[1]) extractedTitle = titleMatch[1].trim();
      }

      if (!extractedCompany) {
        const companyMatch = line.match(/^(?:company|organization|employer):\s*(.+)$/i);
        if (companyMatch?.[1]) extractedCompany = companyMatch[1].trim();
      }

      if (!extractedLocation) {
        const locationMatch = line.match(/^(?:location|work\s+location|based\s+in):\s*(.+)$/i);
        if (locationMatch?.[1]) extractedLocation = locationMatch[1].trim();
      }
    }

    // Fallbacks if not explicitly found
    const firstLine = nonEmptyLines[0];
    if (!extractedTitle && firstLine) {
      // First line if reasonable length (< 80 chars) and not a bullet
      if (firstLine.length < 80 && !/^[•\-*]/.test(firstLine)) {
        extractedTitle = firstLine;
      } else {
        extractedTitle = 'Untitled Position';
      }
    }

    const secondLine = nonEmptyLines[1];
    if (!extractedCompany && secondLine) {
      // Check if second line is company-like
      if (secondLine.length < 50 && !/^[•\-*]/.test(secondLine)) {
        const lower = secondLine.toLowerCase();
        if (
          !lower.includes('experience') &&
          !lower.includes('salary') &&
          !lower.includes('remote')
        ) {
          extractedCompany = secondLine;
        }
      }
    }

    // Salary parsing heuristic (e.g. $100,000 - $140,000, €80k - €100k, 120,000 CHF)
    let minSalary: number | undefined;
    let maxSalary: number | undefined;
    let currency: string | undefined;
    let compensationRaw: string | undefined;

    const salaryRegex =
      /([$€£]|CHF|USD|EUR|GBP)?\s*(\d{2,3}(?:[,.]\d{3})*(?:k)?|\d{2,3}k)\s*(?:-|to)\s*([$€£]|CHF|USD|EUR|GBP)?\s*(\d{2,3}(?:[,.]\d{3})*(?:k)?|\d{2,3}k)\s*(CHF|USD|EUR|GBP)?/i;

    const salaryMatch = text.match(salaryRegex);
    if (salaryMatch) {
      compensationRaw = salaryMatch[0].trim();
      const currSymbol = salaryMatch[1] || salaryMatch[3] || salaryMatch[5];
      if (currSymbol) {
        if (currSymbol === '$' || currSymbol === 'USD') currency = 'USD';
        else if (currSymbol === '€' || currSymbol === 'EUR') currency = 'EUR';
        else if (currSymbol === '£' || currSymbol === 'GBP') currency = 'GBP';
        else if (currSymbol === 'CHF') currency = 'CHF';
      }

      const parseNum = (str: string | undefined) => {
        if (!str) return NaN;
        const clean = str.replace(/[,.]/g, '').toLowerCase();
        if (clean.endsWith('k')) {
          return parseInt(clean.replace('k', ''), 10) * 1000;
        }
        return parseInt(clean, 10);
      };

      const val1 = parseNum(salaryMatch[2]);
      const val2 = parseNum(salaryMatch[4]);
      if (!isNaN(val1) && !isNaN(val2)) {
        minSalary = Math.min(val1, val2);
        maxSalary = Math.max(val1, val2);
      }
    }

    // Section detection from text
    const sections: RawExtractedSection[] = [];
    let currentSection: RawExtractedSection | null = null;

    for (const line of lines) {
      const isHeader =
        /^(?:about\s+(?:the\s+)?(?:role|company|team|us)|(?:key\s+|core\s+)?responsibilities|requirements|(?:key\s+|required\s+|preferred\s+|minimum\s+|basic\s+)?qualifications|nice\s+to\s+have|what\s+you(?:'ll)?\s+do|benefits|what\s+we\s+offer|additional information|company description|job description|kwalifikacje|wymagania|nasze oczekiwania|opis firmy|opis oferty pracy|to oferujemy|oferujemy|dodatkowe informacje):?$/i.test(
          line,
        );

      if (isHeader) {
        if (currentSection) sections.push(currentSection);
        const lower = line.toLowerCase();
        let type: RawExtractedSection['type'] = 'OTHER';
        if (
          lower.includes('responsibilit') ||
          lower.includes('what you') ||
          ['opis oferty pracy', 'job description'].includes(lower)
        ) {
          type = 'RESPONSIBILITIES';
        } else if (lower.includes('preferred') || lower.includes('nice to have')) {
          type = 'PREFERRED_QUALIFICATIONS';
        } else if (
          lower.includes('require') ||
          lower.includes('qualificat') ||
          ['kwalifikacje', 'wymagania', 'nasze oczekiwania'].includes(lower)
        ) {
          type = 'QUALIFICATIONS';
        } else if (
          lower.includes('benefit') ||
          lower.includes('offer') ||
          ['to oferujemy', 'oferujemy', 'dodatkowe informacje', 'additional information'].includes(
            lower,
          )
        ) {
          type = 'BENEFITS';
        } else if (
          lower.includes('about') ||
          ['opis firmy', 'company description'].includes(lower)
        ) {
          type = 'ABOUT_COMPANY';
        }

        currentSection = {
          type,
          title: line.replace(/:$/, ''),
          content: '',
        };
      } else if (currentSection) {
        currentSection.content += (currentSection.content ? '\n' : '') + line;
      }
    }
    if (currentSection) sections.push(currentSection);

    // Extract requirements aware of sections (responsibilities stay in sections)
    const requirements = extractRequirementsFromSectionsOrText(sections, text);

    return {
      provider: 'MANUAL',
      ...([
        'INTERNSHIP',
        'ENTRY',
        'JUNIOR',
        'MID',
        'SENIOR',
        'LEAD',
        'DIRECTOR',
        'MANAGER',
        'EXECUTIVE',
      ].includes(seniorityRaw ?? '')
        ? { seniority: seniorityRaw as NonNullable<RawExtractedJob['seniority']> }
        : {}),
      rawMetadata: { workplaceRaw, commitmentRaw },
      title: extractedTitle || 'Pasted Job',
      company: extractedCompany || 'Unknown Company',
      location: extractedLocation,
      minSalary,
      maxSalary,
      currency,
      compensationRaw,
      descriptionText: text.trim(),
      canonicalUrl: extra.url || undefined,
      requirements,
      sections,
    };
  }
}
