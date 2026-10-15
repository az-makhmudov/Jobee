import { describe, it, expect } from 'vitest';
import { SmartProfileExtractor } from './smart-profile-extractor.js';
import { DocumentTextExtractor } from './document-text-extractor.js';
import { ProfileComparisonEngine } from './profile-comparison-engine.js';
import { AppError } from '@job-agent/shared';

describe('Real CV Import QA Remediation (JOB-SMART-PROFILE-IMPORT)', () => {
  const syntheticOnePageCv = `Alex Rivera
Senior Technical Program Manager
alex.rivera@example.com | +49 176 9876543 | Berlin, Germany
https://linkedin.com/in/alex-rivera-sample

Professional Summary
Experienced Technical Program Manager with 7+ years orchestrating complex enterprise cloud transformations and multi-squad agile initiatives.

Work Experience
Senior Technical Program Manager - Acme Global Systems, Berlin, Germany (03/2021 - Present)
• Spearheaded enterprise cloud migration reducing operational costs by 35%.
• Managed cross-functional delivery across 5 distributed engineering squads.
• Mentored junior scrum masters and established standardized sprint ceremonies.

Education
Bachelor of Science in Information Systems - Technical University of Munich (2015 - 2019)

S K I L L S   &   L A N G U A G E S
Technical Tools: TypeScript, React, Node.js, PostgreSQL, Docker, AWS
Project Management: Agile Delivery, Scrum, Risk Management, Jira, Stakeholder Alignment, OKRs
Languages: English, German, Russian

Certifications
Project Management Professional (PMP)
Project Management Institute (PMI)
Issued: May 2022

AWS Certified Solutions Architect - Associate
Amazon Web Services
Issued: November 2023
`;

  it('1. Spaced glyph headings are collapsed cleanly into canonical headings', () => {
    const rawHeading = 'S K I L L S   &   L A N G U A G E S';
    const collapsed = DocumentTextExtractor.collapseSpacedGlyphs(rawHeading);
    expect(collapsed).toBe('SKILLS & LANGUAGES');

    const rawEdu = 'E D U C A T I O N';
    expect(DocumentTextExtractor.collapseSpacedGlyphs(rawEdu)).toBe('EDUCATION');

    const rawCert = 'C E R T I F I C A T I O N S';
    expect(DocumentTextExtractor.collapseSpacedGlyphs(rawCert)).toBe('CERTIFICATIONS');
  });

  it('2. Multi-line certification blocks are grouped as single records without splitting dates or issuers', async () => {
    const { data } = await SmartProfileExtractor.extract(syntheticOnePageCv, {
      aiConsent: false,
    });

    // Exactly 2 certifications should be extracted, NOT 6 (2 names + 2 issuers + 2 dates)
    expect(data.certifications).toHaveLength(2);

    const pmp = data.certifications.find((c) => c.name.includes('Project Management Professional'));
    expect(pmp).toBeDefined();
    expect(pmp?.issuingOrganization).toBe('Project Management Institute (PMI)');
    expect(pmp?.issueDate).toBe('2022-05');

    const aws = data.certifications.find((c) => c.name.includes('AWS Certified'));
    expect(aws).toBeDefined();
    expect(aws?.issuingOrganization).toBe('Amazon Web Services');
    expect(aws?.issueDate).toBe('2023-11');

    // Verify dates and issuers were NEVER extracted as independent certification titles
    const allTitles = data.certifications.map((c) => c.name);
    expect(allTitles.some((t) => t.includes('Issued:'))).toBe(false);
    expect(allTitles.some((t) => t === 'Amazon Web Services')).toBe(false);
    expect(allTitles.some((t) => t === 'Project Management Institute (PMI)')).toBe(false);
  });

  it('3. Education separates degree, field of study, and institution instead of generic combination', async () => {
    const { data } = await SmartProfileExtractor.extract(syntheticOnePageCv, {
      aiConsent: false,
    });

    expect(data.education).toHaveLength(1);
    const edu = data.education[0];
    expect(edu?.institution).toBe('Technical University of Munich');
    expect(edu?.degree).toBe('Bachelor of Science');
    expect(edu?.fieldOfStudy).toBe('Information Systems');
    expect(edu?.startDate).toBe('2015');
    expect(edu?.endDate).toBe('2019');
  });

  it('4. Combined Skills & Languages section separates categorized skills and extracted languages', async () => {
    const { data } = await SmartProfileExtractor.extract(syntheticOnePageCv, {
      aiConsent: false,
    });

    // 12 skills across Technical Tools (6) and Project Management (6)
    expect(data.skills.length).toBe(12);
    const skillNames = data.skills.map((s) => s.name.toLowerCase());
    expect(skillNames).toContain('typescript');
    expect(skillNames).toContain('docker');
    expect(skillNames).toContain('agile delivery');
    expect(skillNames).toContain('scrum');
    expect(skillNames).toContain('risk management');

    // 3 languages extracted
    expect(data.languages.length).toBe(3);
    const langNames = data.languages.map((l) => l.language.toLowerCase());
    expect(langNames).toContain('english');
    expect(langNames).toContain('german');
    expect(langNames).toContain('russian');

    // Language proficiency must NOT be hallucinated; stored as null when omitted
    for (const lang of data.languages) {
      expect(lang.proficiency).toBeNull();
    }
  });

  it('5. Work experience separates organization, position, location, and dates cleanly', async () => {
    const { data } = await SmartProfileExtractor.extract(syntheticOnePageCv, {
      aiConsent: false,
    });

    expect(data.experiences).toHaveLength(1);
    const exp = data.experiences[0];
    expect(exp?.organization).toBe('Acme Global Systems');
    expect(exp?.position).toBe('Senior Technical Program Manager');
    expect(exp?.location).toBe('Berlin, Germany');
    expect(exp?.startDate).toBe('2021-03');
    expect(exp?.isCurrent).toBe(true);
    expect(exp?.description).toContain('enterprise cloud migration');
    expect(exp?.description).toContain('distributed engineering squads');
  });

  it('6. Language with null or omitted proficiency is classified as NEW (optional proficiency)', () => {
    const comparison = ProfileComparisonEngine.compareLanguage(
      {
        language: 'German',
        proficiency: null,
        sourceReference: 'German',
        confidence: 0.8,
      },
      [],
    );

    expect(comparison.classification).toBe('NEW');
    expect(comparison.conflictDetails).toBeNull();
  });

  it('7. Transparent AI failure reporting throws 502 AppError instead of silent downgrade to heuristic', async () => {
    // When aiConsent: true is requested without a valid key/connection, it must throw transparently
    await expect(
      SmartProfileExtractor.extract(syntheticOnePageCv, {
        aiConsent: true,
        apiKey: 'INVALID_NONEXISTENT_KEY_FOR_TEST',
      }),
    ).rejects.toThrow(AppError);
  });
});
