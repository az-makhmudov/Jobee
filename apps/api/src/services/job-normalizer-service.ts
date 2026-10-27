import crypto from 'node:crypto';
import type { WorkplaceType, EmploymentType, SeniorityLevel, PayPeriod } from '@job-agent/shared';
import type { RawExtractedJob } from '../extractors/types.js';

export interface NormalizedJobResult {
  title: string;
  company: string;
  locationText: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  workplaceType: WorkplaceType;
  employmentType: EmploymentType;
  seniority: SeniorityLevel;
  department: string | null;
  minSalary: number | null;
  maxSalary: number | null;
  currency: string | null;
  payPeriod: PayPeriod | null;
  compensationRaw: string | null;
  canonicalUrl: string | null;
  contentHash: string;
}

export class JobNormalizerService {
  /**
   * Cleans and canonicalizes URLs by stripping tracking parameters.
   */
  public canonicalizeUrl(rawUrl?: string | null): string | null {
    if (!rawUrl) return null;
    try {
      const parsed = new URL(rawUrl.trim());
      // Common analytics / tracking parameters to strip
      const stripParams = [
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'utm_term',
        'utm_content',
        'ref',
        'fbclid',
        'gclid',
        'trk',
        'source',
        'gh_src',
        'si',
      ];
      for (const param of stripParams) {
        parsed.searchParams.delete(param);
      }
      // Remove trailing slash
      let clean = parsed.toString();
      if (clean.endsWith('/') && parsed.pathname !== '/') {
        clean = clean.slice(0, -1);
      }
      return clean;
    } catch {
      return rawUrl.trim();
    }
  }

  /**
   * Normalizes workplace type: REMOTE, HYBRID, ONSITE, UNKNOWN
   */
  public normalizeWorkplaceType(
    textHint?: string | null,
    locationHint?: string | null,
    titleHint?: string | null,
  ): WorkplaceType {
    const combined = `${textHint || ''} ${locationHint || ''} ${titleHint || ''}`.toLowerCase();

    if (combined.includes('hybrid')) return 'HYBRID';
    if (
      combined.includes('remote') ||
      combined.includes('telecommute') ||
      combined.includes('work from home')
    ) {
      return 'REMOTE';
    }
    if (
      combined.includes('on-site') ||
      combined.includes('onsite') ||
      combined.includes('in-office') ||
      combined.includes('in person')
    ) {
      return 'ONSITE';
    }

    return 'UNKNOWN';
  }

  /**
   * Normalizes employment type: FULL_TIME, PART_TIME, CONTRACT, etc.
   */
  public normalizeEmploymentType(raw?: string | null): EmploymentType {
    if (!raw) return 'UNKNOWN';
    const lower = raw.toLowerCase().trim();

    if (
      lower.includes('full-time') ||
      lower.includes('full time') ||
      lower === 'permanent' ||
      lower === 'regular'
    ) {
      return 'FULL_TIME';
    }
    if (lower.includes('part-time') || lower.includes('part time')) {
      return 'PART_TIME';
    }
    if (
      lower.includes('contract') ||
      lower.includes('contractor') ||
      lower.includes('freelance') ||
      lower.includes('temporary')
    ) {
      return lower.includes('contract') ? 'CONTRACT' : 'TEMPORARY';
    }
    if (
      lower.includes('intern') ||
      lower.includes('werkstudent') ||
      lower.includes('working student')
    ) {
      return 'INTERNSHIP';
    }
    if (lower.includes('apprentice')) {
      return 'APPRENTICESHIP';
    }
    if (lower.includes('volunteer')) {
      return 'VOLUNTEER';
    }

    return 'UNKNOWN';
  }

  /**
   * Normalizes seniority from title / explicit metadata. Conservative.
   */
  public normalizeSeniority(title: string, rawSeniority?: string | null): SeniorityLevel {
    const combined = `${title} ${rawSeniority || ''}`
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/ł/g, 'l')
      .toLowerCase();

    if (
      /\b(?:intern|internship|trainee|staz|stazysta|stazystka|praktykant|praktykantka)\b/i.test(
        combined,
      )
    )
      return 'INTERNSHIP';
    if (/\b(?:entry|graduate|associate|junior|jr\.?|mlodszy|mlodsza)\b/i.test(combined))
      return 'JUNIOR';
    if (/\b(?:vp|vice president|chief|cto|cfo|ceo|cpo|executive)\b/i.test(combined)) {
      return 'EXECUTIVE';
    }
    if (/\b(?:director|head of)\b/i.test(combined)) return 'DIRECTOR';
    if (/\b(?:manager|lead|tech lead|team lead|principal|staff)\b/i.test(combined)) {
      if (/\bmanager\b/i.test(combined)) return 'MANAGER';
      return 'LEAD';
    }
    if (/\b(?:senior|sr\.?|lead engineer|starszy|starsza)\b/i.test(combined)) return 'SENIOR';
    if (/\b(?:mid|intermediate)\b/i.test(combined)) return 'MID';

    return 'UNKNOWN';
  }

  /**
   * Parses location text into city, region, country where reasonably confident.
   */
  public parseLocation(rawLocation?: string | null): {
    locationText: string | null;
    city: string | null;
    region: string | null;
    country: string | null;
  } {
    if (!rawLocation || !rawLocation.trim()) {
      return { locationText: null, city: null, region: null, country: null };
    }

    const trimmed = rawLocation
      .trim()
      .replace(/\s*\((?:remote|hybrid|onsite)\)\s*/gi, '')
      .trim();
    const parts = trimmed
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    let city: string | null = null;
    let region: string | null = null;
    let country: string | null = null;

    const part0 = parts[0];
    const part1 = parts[1];
    const part2 = parts[2];

    if (parts.length === 1 && part0) {
      // Single item: could be "Germany", "Berlin", or "Remote"
      if (
        /^(?:germany|switzerland|poland|uk|united kingdom|usa|united states|france|netherlands|canada|australia)$/i.test(
          part0,
        )
      ) {
        country = part0;
      } else if (!/^(?:remote|worldwide|emea|apac|latam|global)$/i.test(part0)) {
        city = part0;
      }
    } else if (parts.length === 2 && part0 && part1) {
      city = part0;
      // Second part could be State (US) or Country
      if (
        /^(?:germany|switzerland|poland|uk|united kingdom|usa|united states|france|netherlands|canada|spain)$/i.test(
          part1,
        )
      ) {
        country = part1;
      } else {
        region = part1;
      }
    } else if (parts.length >= 3 && part0 && part1 && part2) {
      city = part0;
      region = part1;
      country = part2;
    }

    return {
      locationText: trimmed || null,
      city,
      region,
      country,
    };
  }

  /**
   * Generates deterministic content fingerprint hash for deduplication.
   */
  public computeContentHash(
    title: string,
    company: string,
    locationText: string | null,
    description: string,
  ): string {
    const normTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normCompany = company.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normLoc = (locationText || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    // Take first 500 chars of normalized description
    const normDesc = description.toLowerCase().replace(/\s+/g, ' ').slice(0, 500);

    const payload = `${normTitle}|${normCompany}|${normLoc}|${normDesc}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Normalizes raw extracted job into canonical fields.
   */
  public normalize(raw: RawExtractedJob): NormalizedJobResult {
    const title = (raw.title || 'Untitled Position').trim();
    const company = (raw.company || 'Unknown Company').trim();

    const loc = this.parseLocation(raw.location);
    const canonicalUrl = this.canonicalizeUrl(raw.canonicalUrl);

    const workplaceType =
      raw.workplaceType && raw.workplaceType !== 'UNKNOWN'
        ? raw.workplaceType
        : this.normalizeWorkplaceType(
            (raw.rawMetadata?.workplaceRaw as string) || null,
            raw.location,
            title,
          );

    const employmentType =
      raw.employmentType && raw.employmentType !== 'UNKNOWN'
        ? raw.employmentType
        : this.normalizeEmploymentType(
            (raw.rawMetadata?.commitmentRaw as string) ||
              (raw.rawMetadata?.employmentType as string) ||
              null,
          );

    const seniority =
      raw.seniority && raw.seniority !== 'UNKNOWN' ? raw.seniority : this.normalizeSeniority(title);

    const contentHash = this.computeContentHash(
      title,
      company,
      loc.locationText,
      raw.descriptionText,
    );

    return {
      title,
      company,
      locationText: loc.locationText,
      city: loc.city,
      region: loc.region,
      country: loc.country,
      workplaceType,
      employmentType,
      seniority,
      department: raw.department?.trim() || null,
      minSalary: raw.minSalary ?? null,
      maxSalary: raw.maxSalary ?? null,
      currency: raw.currency?.toUpperCase() || null,
      payPeriod: raw.payPeriod ?? null,
      compensationRaw: raw.compensationRaw?.trim() || null,
      canonicalUrl,
      contentHash,
    };
  }
}
