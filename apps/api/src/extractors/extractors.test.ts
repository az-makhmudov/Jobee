import { describe, it, expect } from 'vitest';
import { GreenhouseExtractor } from './greenhouse-extractor.js';
import { LeverExtractor } from './lever-extractor.js';
import { AshbyExtractor } from './ashby-extractor.js';
import { GenericExtractor } from './generic-extractor.js';
import { LinkedInExtractor } from './linkedin-extractor.js';
import { ManualTextExtractor } from './manual-text-extractor.js';
import { ExtractorRegistry } from './extractor-registry.js';

describe('Extractors Suite', () => {
  describe('GreenhouseExtractor', () => {
    const extractor = new GreenhouseExtractor();
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Senior Backend Engineer at Acme Corp</title>
          <meta property="og:title" content="Senior Backend Engineer at Acme Corp" />
          <meta property="og:description" content="Join our backend team building scalable microservices." />
        </head>
        <body>
          <div id="header">
            <h1 class="app-title">Senior Backend Engineer</h1>
            <span class="company-name">Acme Corp</span>
            <div class="location">Berlin, Germany (Hybrid)</div>
          </div>
          <div id="content">
            <div id="employment-type">Full-time</div>
            <div id="job-description">
              <p>We are seeking a Senior Backend Engineer to join our core platform.</p>
              <h3>Responsibilities</h3>
              <ul>
                <li>Design and maintain high-throughput REST APIs in Node.js</li>
                <li>Optimize PostgreSQL query performance and caching</li>
              </ul>
              <h3>Requirements</h3>
              <ul>
                <li>At least 5+ years of software engineering experience</li>
                <li>Strong proficiency in TypeScript and SQL</li>
                <li>Experience with Docker and Kubernetes</li>
              </ul>
            </div>
          </div>
        </body>
      </html>
    `;

    it('identifies Greenhouse matches with canHandle', () => {
      expect(extractor.canHandle('https://boards.greenhouse.io/acmecorp/jobs/12345', html)).toBe(
        true,
      );
      expect(extractor.canHandle('https://job-boards.greenhouse.io/acme/jobs/999', '')).toBe(true);
    });

    it('extracts structured job details accurately from Greenhouse HTML', async () => {
      const extracted = await extractor.extract(
        'https://boards.greenhouse.io/acmecorp/jobs/12345?gh_jid=12345',
        html,
      );

      expect(extracted.provider).toBe('GREENHOUSE');
      expect(extracted.title).toBe('Senior Backend Engineer');
      expect(extracted.company).toBe('Acme Corp');
      expect(extracted.location).toBe('Berlin, Germany (Hybrid)');
      expect(extracted.employmentType).toBe('Full-time');
      expect(extracted.externalId).toBe('12345');
      expect(extracted.requirements && extracted.requirements.length).toBe(3);
      expect(extracted.requirements?.some((r) => r.rawText.includes('5+ years'))).toBe(true);
      expect(extracted.sections && extracted.sections.length).toBe(2);
      expect(extracted.sections?.some((s) => s.type === 'RESPONSIBILITIES')).toBe(true);
    });
  });

  describe('LeverExtractor', () => {
    const extractor = new LeverExtractor();
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Lever Job Posting - Beta Labs</title>
        </head>
        <body class="lever-template">
          <div class="posting-headline">
            <h2>Lead Frontend Architect</h2>
          </div>
          <div class="posting-categories">
            <div class="location">London, UK</div>
            <div class="workplaceTypes">Hybrid</div>
            <div class="commitment">Full-time</div>
            <div class="department">Engineering</div>
          </div>
          <div class="section-wrapper">
            <div class="section">
              <h3>Role Overview</h3>
              <p>Beta Labs is looking for a Lead Frontend Architect.</p>
            </div>
            <div class="section">
              <h3>Qualifications</h3>
              <ul>
                <li>Expert in React, TypeScript, and modern CSS architecture</li>
                <li>Proven track record leading UI component systems</li>
              </ul>
            </div>
          </div>
        </body>
      </html>
    `;

    it('identifies Lever URLs and content with canHandle', () => {
      expect(extractor.canHandle('https://jobs.lever.co/betalabs/a1b2c3d4-e5f6-7890', html)).toBe(
        true,
      );
    });

    it('extracts structured data from Lever HTML', async () => {
      const extracted = await extractor.extract(
        'https://jobs.lever.co/betalabs/a1b2c3d4-e5f6-7890',
        html,
      );

      expect(extracted.provider).toBe('LEVER');
      expect(extracted.title).toBe('Lead Frontend Architect');
      expect(extracted.company).toBe('betalabs');
      expect(extracted.location).toBe('London, UK');
      expect(extracted.workplaceType).toBe('HYBRID');
      expect(extracted.employmentType).toBe('FULL_TIME');
      expect(extracted.externalId).toBe('a1b2c3d4-e5f6-7890');
      expect(extracted.requirements && extracted.requirements.length).toBeGreaterThan(0);
    });
  });

  describe('AshbyExtractor', () => {
    const extractor = new AshbyExtractor();
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Staff Platform Engineer - Ashby</title>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "JobPosting",
            "title": "Staff Platform Engineer",
            "hiringOrganization": {
              "@type": "Organization",
              "name": "CloudScale Systems"
            },
            "jobLocation": {
              "@type": "Place",
              "address": {
                "addressLocality": "Zurich",
                "addressCountry": "Switzerland"
              }
            },
            "employmentType": "FULL_TIME",
            "description": "<p>Build our distributed data infrastructure.</p><ul><li>10+ years backend systems</li><li>Deep understanding of Raft/Paxos</li></ul>"
          }
          </script>
        </head>
        <body class="ashby-job-posting">
          <h1>Staff Platform Engineer</h1>
        </body>
      </html>
    `;

    it('identifies Ashby URLs with canHandle', () => {
      expect(extractor.canHandle('https://jobs.ashbyhq.com/cloudscale/4567-8901', html)).toBe(true);
    });

    it('extracts structured Ashby job details using schema fallback', async () => {
      const extracted = await extractor.extract(
        'https://jobs.ashbyhq.com/cloudscale/4567-8901',
        html,
      );

      expect(extracted.provider).toBe('ASHBY');
      expect(extracted.title).toBe('Staff Platform Engineer');
      expect(extracted.company).toBe('CloudScale Systems');
      expect(extracted.location).toBe('Zurich, Switzerland');
      expect(extracted.employmentType).toBe('FULL_TIME');
      expect(extracted.externalId).toBe('4567-8901');
      expect(extracted.requirements && extracted.requirements.length).toBeGreaterThan(0);
    });
  });

  describe('GenericExtractor (Schema.org JobPosting & Meta tags)', () => {
    const extractor = new GenericExtractor();
    const jsonLdHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Careers at Enterprise Inc</title>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "JobPosting",
            "title": "Principal Data Scientist",
            "hiringOrganization": {
              "@type": "Organization",
              "name": "Enterprise Inc"
            },
            "jobLocation": {
              "@type": "Place",
              "address": "San Francisco, CA, USA"
            },
            "baseSalary": {
              "@type": "MonetaryAmount",
              "currency": "USD",
              "value": {
                "@type": "QuantitativeValue",
                "minValue": 180000,
                "maxValue": 220000,
                "unitText": "YEAR"
              }
            },
            "description": "<p>Lead machine learning initiatives.</p><ul><li>Ph.D. or M.S. in Computer Science</li><li>Track record of published papers</li></ul>"
          }
          </script>
        </head>
        <body>
          <main>Career page content</main>
        </body>
      </html>
    `;

    it('extracts schema.org JobPosting information faithfully', async () => {
      const extracted = await extractor.extract(
        'https://enterprise.example.com/careers/data-scientist-123',
        jsonLdHtml,
      );

      expect(extracted.provider).toBe('GENERIC');
      expect(extracted.title).toBe('Principal Data Scientist');
      expect(extracted.company).toBe('Enterprise Inc');
      expect(extracted.location).toBe('San Francisco, CA, USA');
      expect(extracted.minSalary).toBe(180000);
      expect(extracted.maxSalary).toBe(220000);
      expect(extracted.currency).toBe('USD');
      expect(extracted.requirements && extracted.requirements.length).toBe(2);
    });
  });

  describe('LinkedInExtractor', () => {
    const extractor = new LinkedInExtractor();

    it('matches linkedin.com job URLs with canHandle', () => {
      expect(
        extractor.canHandle('https://www.linkedin.com/jobs/view/3890123456/?refId=abcdef', ''),
      ).toBe(true);
      expect(extractor.canHandle('https://linkedin.com/jobs/view/987654321', '')).toBe(true);
    });

    it('extracts external ID and flags needsManualText due to auth walls', async () => {
      const extracted = await extractor.extract(
        'https://www.linkedin.com/jobs/view/3890123456/?refId=abcdef',
        '<html><head><title>Sign In | LinkedIn</title></head><body>Auth wall</body></html>',
      );

      expect(extracted.provider).toBe('LINKEDIN');
      expect(extracted.externalId).toBe('3890123456');
      expect(extracted.needsManualText).toBe(true);
      expect(extracted.warnings && extracted.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('ManualTextExtractor', () => {
    const extractor = new ManualTextExtractor();
    const rawText = `
Job Title: Senior Site Reliability Engineer
Company: CloudScale GmbH
Location: Frankfurt, Germany (Hybrid)
Salary Range: €90,000 - €115,000

About the role:
We are looking for an experienced SRE to strengthen our cloud infrastructure resilience.

Key Responsibilities:
• Maintain 99.99% uptime across multi-region Kubernetes clusters
• Lead incident response and post-mortem investigations
• Build automated Terraform infrastructure pipelines

Requirements:
• 4+ years of professional DevOps or SRE experience
• Deep knowledge of AWS, Terraform, and Kubernetes
• Proficiency in Go or Python for automation
• Fluency in English
    `;

    it('extracts structured attributes from pasted text correctly', async () => {
      const extracted = extractor.extract(rawText, { url: 'manual://pasted-text' });

      expect(extracted.provider).toBe('MANUAL');
      expect(extracted.title).toBe('Senior Site Reliability Engineer');
      expect(extracted.company).toBe('CloudScale GmbH');
      expect(extracted.location).toBe('Frankfurt, Germany (Hybrid)');
      expect(extracted.minSalary).toBe(90000);
      expect(extracted.maxSalary).toBe(115000);
      expect(extracted.currency).toBe('EUR');
      expect(extracted.requirements && extracted.requirements.length).toBeGreaterThanOrEqual(4);
      expect(extracted.requirements?.some((r) => r.rawText.includes('Kubernetes'))).toBe(true);
      expect(extracted.sections && extracted.sections.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('ExtractorRegistry', () => {
    const registry = new ExtractorRegistry();

    it('routes greenhouse URLs to GREENHOUSE', () => {
      const provider = registry.detectProvider('https://boards.greenhouse.io/stripe/jobs/12345');
      expect(provider).toBe('GREENHOUSE');
    });

    it('routes lever URLs to LEVER', () => {
      const provider = registry.detectProvider('https://jobs.lever.co/figma/abc-123');
      expect(provider).toBe('LEVER');
    });

    it('routes ashby URLs to ASHBY', () => {
      const provider = registry.detectProvider('https://jobs.ashbyhq.com/openai/123');
      expect(provider).toBe('ASHBY');
    });

    it('routes linkedin URLs to LINKEDIN', () => {
      const provider = registry.detectProvider('https://www.linkedin.com/jobs/view/12345');
      expect(provider).toBe('LINKEDIN');
    });

    it('falls back to GENERIC for unknown domains', () => {
      const provider = registry.detectProvider('https://careers.company.com/job/1');
      expect(provider).toBe('GENERIC');
    });
  });
});

it('flags JavaScript shells as incomplete instead of treating a careers page title as a vacancy', () => {
  const extracted = new GenericExtractor().extract(
    'https://example.test/vacancy-details?id=synthetic',
    '<html><head><title>Sonnedix Careers</title></head><body><noscript>Please enable JavaScript to view this page.</noscript></body></html>',
  );
  expect(extracted.needsManualText).toBe(true);
  expect(extracted.warnings?.[0]).toContain('Paste the job text');
});
