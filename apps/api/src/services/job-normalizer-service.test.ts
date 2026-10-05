import { describe, it, expect } from 'vitest';
import { JobNormalizerService } from './job-normalizer-service.js';
import type { RawExtractedJob } from '../extractors/types.js';

describe('JobNormalizerService Unit Tests', () => {
  const normalizer = new JobNormalizerService();

  describe('canonicalizeUrl', () => {
    it('strips tracking query parameters and trailing slashes', () => {
      const dirty =
        'https://boards.greenhouse.io/acme/jobs/12345/?utm_source=linkedin&utm_medium=job_board&ref=aggregator';
      const clean = normalizer.canonicalizeUrl(dirty);
      expect(clean).toBe('https://boards.greenhouse.io/acme/jobs/12345');
    });

    it('preserves non-tracking query parameters', () => {
      const urlWithId = 'https://jobs.example.com/posting?id=9876&gh_jid=9876';
      const clean = normalizer.canonicalizeUrl(urlWithId);
      expect(clean).toContain('id=9876');
    });

    it('handles null or empty URL gracefully', () => {
      expect(normalizer.canonicalizeUrl(null)).toBeNull();
      expect(normalizer.canonicalizeUrl(undefined)).toBeNull();
      expect(normalizer.canonicalizeUrl('')).toBeNull();
    });
  });

  describe('normalizeWorkplaceType', () => {
    it('detects REMOTE, HYBRID, and ONSITE from text and location hints', () => {
      expect(normalizer.normalizeWorkplaceType('Remote - Worldwide', '', '')).toBe('REMOTE');
      expect(normalizer.normalizeWorkplaceType('', 'Berlin (Hybrid)', '')).toBe('HYBRID');
      expect(normalizer.normalizeWorkplaceType('On-site', 'New York, NY', '')).toBe('ONSITE');
      expect(normalizer.normalizeWorkplaceType(null, null, null)).toBe('UNKNOWN');
    });
  });

  describe('normalizeEmploymentType', () => {
    it('normalizes various employment type strings into canonical enums', () => {
      expect(normalizer.normalizeEmploymentType('Full Time')).toBe('FULL_TIME');
      expect(normalizer.normalizeEmploymentType('part-time')).toBe('PART_TIME');
      expect(normalizer.normalizeEmploymentType('Contract / Freelance')).toBe('CONTRACT');
      expect(normalizer.normalizeEmploymentType('Summer Intern')).toBe('INTERNSHIP');
      expect(normalizer.normalizeEmploymentType('Werkstudent')).toBe('INTERNSHIP');
      expect(normalizer.normalizeEmploymentType(null)).toBe('UNKNOWN');
    });
  });

  describe('normalizeSeniority', () => {
    it('extracts seniority level from title and description clues', () => {
      expect(normalizer.normalizeSeniority('Senior Software Engineer')).toBe('SENIOR');
      expect(normalizer.normalizeSeniority('Staff Platform Engineer')).toBe('LEAD');
      expect(normalizer.normalizeSeniority('Lead Data Engineer')).toBe('LEAD');
      expect(normalizer.normalizeSeniority('Junior Frontend Developer')).toBe('JUNIOR');
      expect(normalizer.normalizeSeniority('Engineering Director')).toBe('DIRECTOR');
      expect(normalizer.normalizeSeniority('Software Engineer')).toBe('UNKNOWN');
    });
  });

  describe('parseLocation', () => {
    it('parses city, region, and country from location strings', () => {
      const loc1 = normalizer.parseLocation('Berlin, Germany');
      expect(loc1.city).toBe('Berlin');
      expect(loc1.country).toBe('Germany');

      const loc2 = normalizer.parseLocation('Austin, TX, USA');
      expect(loc2.city).toBe('Austin');
      expect(loc2.region).toBe('TX');
      expect(loc2.country).toBe('USA');

      const loc3 = normalizer.parseLocation('Remote (onsite)');
      expect(loc3.locationText).toBe('Remote');
    });
  });

  describe('computeContentHash', () => {
    it('generates deterministic SHA-256 fingerprint', () => {
      const hash1 = normalizer.computeContentHash(
        'Staff Engineer',
        'Acme Inc',
        'Berlin',
        'Looking for experienced engineer with Go and Kubernetes skills.',
      );

      const hash2 = normalizer.computeContentHash(
        '  STAFF ENGINEER  ',
        'Acme Inc',
        'berlin',
        'Looking for experienced engineer with Go and Kubernetes skills.',
      );

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it('generates different fingerprints for distinct jobs', () => {
      const hashA = normalizer.computeContentHash(
        'Product Manager',
        'Acme Inc',
        'Berlin',
        'Lead roadmap',
      );
      const hashB = normalizer.computeContentHash(
        'Frontend Engineer',
        'Acme Inc',
        'Berlin',
        'Build UI components',
      );

      expect(hashA).not.toBe(hashB);
    });
  });

  describe('normalize', () => {
    it('normalizes full RawExtractedJob into NormalizedJobResult', () => {
      const raw: RawExtractedJob = {
        provider: 'GREENHOUSE',
        title: 'Senior Site Reliability Engineer',
        company: 'CloudScale Corp',
        location: 'Frankfurt, Germany',
        descriptionText: 'Maintain multi-region Kubernetes clusters.',
        minSalary: 95000,
        maxSalary: 120000,
        currency: 'eur',
        canonicalUrl: 'https://boards.greenhouse.io/cloudscale/jobs/123?utm_source=feed',
      };

      const normalized = normalizer.normalize(raw);
      expect(normalized.title).toBe('Senior Site Reliability Engineer');
      expect(normalized.company).toBe('CloudScale Corp');
      expect(normalized.city).toBe('Frankfurt');
      expect(normalized.country).toBe('Germany');
      expect(normalized.seniority).toBe('SENIOR');
      expect(normalized.minSalary).toBe(95000);
      expect(normalized.maxSalary).toBe(120000);
      expect(normalized.currency).toBe('EUR');
      expect(normalized.canonicalUrl).toBe('https://boards.greenhouse.io/cloudscale/jobs/123');
      expect(normalized.contentHash).toHaveLength(64);
    });
  });
});
