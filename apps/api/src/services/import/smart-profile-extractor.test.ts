import { describe, it, expect } from 'vitest';
import { SmartProfileExtractor } from './smart-profile-extractor.js';

describe('SmartProfileExtractor', () => {
  const sampleResumeText = `Asadbek Makhmudov
Senior Full Stack Engineer
asadbek.test@example.com | +49 170 1234567 | Berlin, Germany
https://linkedin.com/in/asadbek-test https://github.com/asadbek-test

Professional Summary
Senior engineer with 6+ years specializing in distributed systems, Node.js, TypeScript, and AI integrations.

Work Experience
Senior Software Architect - Tech Innovations GmbH (2021-03 - Present)
• Architected event-driven microservices platform with Fastify and PostgreSQL.
• Reduced API latencies by 45% through Redis caching.

Full Stack Developer - Digital Solutions AG (2018-09 - 2021-02)
• Developed responsive user interfaces in React and TypeScript.
• Maintained automated CI/CD pipelines.

Education
Technical University Berlin
Bachelor of Science in Computer Science (2014 - 2018)

Technical Skills
TypeScript, Node.js, React, PostgreSQL, Docker, Fastify, Vitest, Cloudflare R2

Languages
English (Fluent), German (Professional working proficiency), Uzbek (Native)

Certifications
AWS Certified Solutions Architect - Associate
`;

  it('extracts structured profile details deterministically without AI', async () => {
    const { data, extractorUsed } = await SmartProfileExtractor.extract(sampleResumeText, {
      aiConsent: false,
    });

    expect(extractorUsed).toBe('HEURISTIC_PARSER');

    // Personal info
    expect(data.profile?.fullName).toBe('Asadbek Makhmudov');
    expect(data.profile?.headline).toBe('Senior Full Stack Engineer');
    expect(data.profile?.email).toBe('asadbek.test@example.com');
    expect(data.profile?.phone).toContain('1234567');
    expect(data.profile?.summary).toContain('Senior engineer with 6+ years');

    // Links
    expect(data.links.some((l) => l.url.includes('linkedin.com'))).toBe(true);
    expect(data.links.some((l) => l.url.includes('github.com'))).toBe(true);

    // Experiences
    expect(data.experiences.length).toBeGreaterThanOrEqual(1);
    const primaryExp = data.experiences[0];
    expect(primaryExp?.organization).toBeDefined();
    expect(primaryExp?.position).toBeDefined();
    expect(primaryExp?.startDate).toBeDefined();
    expect(primaryExp?.sourceReference).toBeTruthy();

    // Education
    expect(data.education.length).toBeGreaterThanOrEqual(1);
    expect(data.education[0]?.institution).toContain('Technical University');

    // Skills
    expect(data.skills.length).toBeGreaterThanOrEqual(4);
    const skillNames = data.skills.map((s) => s.name.toLowerCase());
    expect(skillNames).toContain('typescript');
    expect(skillNames).toContain('postgresql');

    // Languages
    expect(data.languages.length).toBeGreaterThanOrEqual(2);
    const langNames = data.languages.map((l) => l.language.toLowerCase());
    expect(langNames).toContain('english');
    expect(langNames).toContain('german');

    // Certifications
    expect(data.certifications.length).toBeGreaterThanOrEqual(1);
    expect(data.certifications[0]?.name).toContain('AWS Certified');
  });

  it('attaches verifiable sourceReference provenance to every extracted fact', async () => {
    const { data } = await SmartProfileExtractor.extract(sampleResumeText, {
      aiConsent: false,
    });

    for (const exp of data.experiences) {
      expect(exp.sourceReference.length).toBeGreaterThan(0);
      expect(sampleResumeText).toContain(exp.sourceReference);
    }

    for (const skill of data.skills) {
      expect(skill.sourceReference.length).toBeGreaterThan(0);
    }
  });
});
