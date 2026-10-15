import { describe, it, expect, vi } from 'vitest';
import { SmartProfileExtractor } from './smart-profile-extractor.js';
import { ProfileComparisonEngine } from './profile-comparison-engine.js';
import { SmartProfileImportService } from './smart-profile-import-service.js';
import { AppError } from '@job-agent/shared';

describe('LinkedIn Profile AI Extraction & QA Hardening (JOB-SMART-PROFILE-IMPORT)', () => {
  // =========================================================================
  // TEST A: Certification with valid issuer is extracted and classified as NEW
  // =========================================================================
  it('Test A: Certification with valid issuer parses cleanly and is classified as NEW', () => {
    const aiOutput = {
      certifications: [
        {
          name: 'AWS Certified Solutions Architect - Associate',
          issuingOrganization: 'Amazon Web Services',
          issueDate: '2023-05',
          expirationDate: '2026-05',
          credentialId: 'AWS-123456',
          credentialUrl: 'https://aws.amazon.com/verify/123456',
          sourceReference: 'AWS Certified Solutions Architect - Associate Amazon Web Services',
          confidence: 0.95,
        },
      ],
    };

    const parsed = SmartProfileExtractor.parseAiProfileData(aiOutput);
    expect(parsed.certifications).toHaveLength(1);
    expect(parsed.certifications[0]?.name).toBe('AWS Certified Solutions Architect - Associate');
    expect(parsed.certifications[0]?.issuingOrganization).toBe('Amazon Web Services');

    const comparison = ProfileComparisonEngine.compareCertification(parsed.certifications[0]!, []);
    expect(comparison.classification).toBe('NEW');
    expect(comparison.conflictDetails).toBeNull();
  });

  // =========================================================================
  // TEST B: Certification with null issuer normalizes to "" and is classified INCOMPLETE
  // =========================================================================
  it('Test B: Certification with null issuer normalizes to empty string and is classified as INCOMPLETE', () => {
    const aiOutput = {
      certifications: [
        {
          name: 'Professional Scrum Master I',
          issuingOrganization: null, // Gemini returned null here!
          issueDate: '2022-08',
          expirationDate: null,
          credentialId: null,
          credentialUrl: null,
          sourceReference: 'Professional Scrum Master I',
        },
      ],
    };

    const parsed = SmartProfileExtractor.parseAiProfileData(aiOutput);
    expect(parsed.certifications).toHaveLength(1);
    expect(parsed.certifications[0]?.name).toBe('Professional Scrum Master I');
    // Normalized to "" without crashing Zod validation
    expect(parsed.certifications[0]?.issuingOrganization).toBe('');

    const comparison = ProfileComparisonEngine.compareCertification(parsed.certifications[0]!, []);
    expect(comparison.classification).toBe('INCOMPLETE');
    expect(comparison.conflictDetails).toBe(
      'Issuing organization is missing. You can enter it manually before approval.',
    );
  });

  // =========================================================================
  // TEST C: Certification with omitted issuer normalizes to "" and is classified INCOMPLETE
  // =========================================================================
  it('Test C: Certification with omitted issuer normalizes to empty string and is classified as INCOMPLETE', () => {
    const aiOutput = {
      certifications: [
        {
          name: 'Certified Kubernetes Administrator',
          // issuingOrganization omitted entirely
          issueDate: '2021-03',
          sourceReference: 'Certified Kubernetes Administrator',
        },
      ],
    };

    const parsed = SmartProfileExtractor.parseAiProfileData(aiOutput);
    expect(parsed.certifications).toHaveLength(1);
    expect(parsed.certifications[0]?.name).toBe('Certified Kubernetes Administrator');
    expect(parsed.certifications[0]?.issuingOrganization).toBe('');

    const comparison = ProfileComparisonEngine.compareCertification(parsed.certifications[0]!, []);
    expect(comparison.classification).toBe('INCOMPLETE');
    expect(comparison.conflictDetails).toBe(
      'Issuing organization is missing. You can enter it manually before approval.',
    );
  });

  // =========================================================================
  // TEST D: Multiple certifications, some with null issuers
  // =========================================================================
  it('Test D: Multiple certifications with mixed null/present issuers are all extracted without error', () => {
    const aiOutput = {
      certifications: [
        {
          name: 'Google Cloud Professional Cloud Architect',
          issuingOrganization: 'Google Cloud',
          issueDate: '2024-01',
        },
        {
          name: 'Scrum Foundations',
          issuingOrganization: null,
          issueDate: '2020-04',
        },
        {
          name: 'Docker Certified Associate',
          issuingOrganization: 'Docker',
          issueDate: '2022-11',
        },
        {
          name: 'Internal Tech Leadership Award',
          issuingOrganization: null,
          issueDate: null,
        },
      ],
    };

    const parsed = SmartProfileExtractor.parseAiProfileData(aiOutput);
    expect(parsed.certifications).toHaveLength(4);

    const comparisons = parsed.certifications.map((c) =>
      ProfileComparisonEngine.compareCertification(c, []),
    );

    // 0: Valid issuer -> NEW
    expect(comparisons[0]?.classification).toBe('NEW');
    expect(comparisons[0]?.conflictDetails).toBeNull();

    // 1: Null issuer -> INCOMPLETE
    expect(comparisons[1]?.classification).toBe('INCOMPLETE');
    expect(comparisons[1]?.conflictDetails).toContain('Issuing organization is missing');

    // 2: Valid issuer -> NEW
    expect(comparisons[2]?.classification).toBe('NEW');
    expect(comparisons[2]?.conflictDetails).toBeNull();

    // 3: Null issuer -> INCOMPLETE
    expect(comparisons[3]?.classification).toBe('INCOMPLETE');
    expect(comparisons[3]?.conflictDetails).toContain('Issuing organization is missing');
  });

  // =========================================================================
  // TEST E: Realistic LinkedIn profile containing complete experiences and incomplete certifications
  // =========================================================================
  it('Test E: Complete LinkedIn profile with incomplete certifications extracts all sections cleanly', () => {
    const linkedInAiResponse = {
      profile: {
        fullName: 'Asadbek Makhmudov',
        headline: 'Lead Software Architect | Distributed Systems & AI',
        email: 'asadbek@example.com',
        phone: '+49 170 1234567',
        location: 'Berlin, Germany',
        summary:
          'Passionate engineering leader specializing in resilient distributed architectures.',
        sourceReference: 'Asadbek Makhmudov Berlin, Germany',
      },
      experiences: [
        {
          organization: 'Enterprise Innovations GmbH',
          position: 'Lead Software Architect',
          startDate: '2022-01',
          endDate: null,
          isCurrent: true,
          location: 'Berlin, Germany',
          description: 'Architecting high-scale event processing pipelines.',
          achievements: ['Reduced p99 latency by 50%'],
          skills: ['TypeScript', 'Node.js', 'PostgreSQL'],
          sourceReference: 'Enterprise Innovations GmbH Lead Software Architect',
        },
      ],
      education: [
        {
          institution: 'Technical University Berlin',
          degree: 'Master of Science',
          fieldOfStudy: 'Computer Science',
          startDate: '2018',
          endDate: '2020',
          sourceReference: 'Technical University Berlin Master of Science',
        },
      ],
      skills: [
        { name: 'TypeScript', proficiency: null, category: 'Engineering' },
        { name: 'PostgreSQL', proficiency: 'Advanced', category: 'Databases' },
      ],
      certifications: [
        {
          name: 'AWS Solutions Architect Associate',
          issuingOrganization: 'Amazon Web Services',
          issueDate: '2023-01',
        },
        {
          name: 'Foundational Leadership Certificate',
          issuingOrganization: null, // LinkedIn didn't provide issuer
          issueDate: '2021-06',
        },
      ],
      languages: [
        { language: 'English', proficiency: 'Fluent' },
        { language: 'German', proficiency: null },
      ],
      projects: [],
      links: [
        {
          label: 'LinkedIn',
          url: 'https://linkedin.com/in/asadbek-makhmudov',
        },
      ],
    };

    const parsed = SmartProfileExtractor.parseAiProfileData(linkedInAiResponse);

    expect(parsed.profile?.fullName).toBe('Asadbek Makhmudov');
    expect(parsed.experiences).toHaveLength(1);
    expect(parsed.experiences[0]?.organization).toBe('Enterprise Innovations GmbH');
    expect(parsed.education).toHaveLength(1);
    expect(parsed.education[0]?.institution).toBe('Technical University Berlin');
    expect(parsed.skills).toHaveLength(2);
    expect(parsed.certifications).toHaveLength(2);
    expect(parsed.languages).toHaveLength(2);
    expect(parsed.links).toHaveLength(1);

    // Section comparisons
    const comparisonResults = ProfileComparisonEngine.compare(parsed, {
      profile: null,
      experiences: [],
      education: [],
      skills: [],
      certifications: [],
      languages: [],
      projects: [],
      links: [],
    });

    const certResults = comparisonResults.filter((r) => r.section === 'CERTIFICATION');
    expect(certResults).toHaveLength(2);

    const validCert = certResults.find((c) =>
      (c.extractedPayload as any).name.includes('AWS Solutions Architect'),
    );
    expect(validCert?.classification).toBe('NEW');

    const incompleteCert = certResults.find((c) =>
      (c.extractedPayload as any).name.includes('Foundational Leadership'),
    );
    expect(incompleteCert?.classification).toBe('INCOMPLETE');
    expect(incompleteCert?.conflictDetails).toBe(
      'Issuing organization is missing. You can enter it manually before approval.',
    );
  });

  // =========================================================================
  // TEST F: Valid sections survive incomplete certification data
  // =========================================================================
  it('Test F: Incomplete certification does not invalidate experiences, education, or skills', () => {
    const partialProfile = {
      experiences: [
        {
          organization: 'Stripe',
          position: 'Staff Engineer',
          startDate: '2021-05',
          sourceReference: 'Stripe Staff Engineer',
        },
      ],
      education: [
        {
          institution: 'Stanford University',
          degree: 'BS',
          fieldOfStudy: 'Computer Science',
          sourceReference: 'Stanford University BS Computer Science',
        },
      ],
      skills: [{ name: 'Go', sourceReference: 'Go' }],
      certifications: [
        {
          name: 'Some Mystery Course',
          issuingOrganization: null,
          sourceReference: 'Some Mystery Course',
        },
      ],
    };

    const parsed = SmartProfileExtractor.parseAiProfileData(partialProfile);

    // All valid sections are fully preserved
    expect(parsed.experiences).toHaveLength(1);
    expect(parsed.experiences[0]?.organization).toBe('Stripe');
    expect(parsed.education).toHaveLength(1);
    expect(parsed.education[0]?.institution).toBe('Stanford University');
    expect(parsed.skills).toHaveLength(1);
    expect(parsed.skills[0]?.name).toBe('Go');
    expect(parsed.certifications).toHaveLength(1);
    expect(parsed.certifications[0]?.issuingOrganization).toBe('');
  });

  // =========================================================================
  // TEST G: Incomplete certification cannot be approved before correction
  // =========================================================================
  it('Test G: updateItem with action APPROVED rejects incomplete certification lacking issuer', async () => {
    const existingIncompleteItem = {
      id: 'cert-item-1',
      sessionId: 'sess-1',
      userId: 'user-1',
      section: 'CERTIFICATION' as const,
      classification: 'INCOMPLETE' as const,
      confidenceScore: 0.9,
      sourceReference: 'Foundational Leadership',
      extractedPayload: {
        name: 'Foundational Leadership',
        issuingOrganization: '', // missing issuer
        issueDate: '2021-06',
      },
      existingEntityId: null,
      existingPayload: null,
      conflictDetails:
        'Issuing organization is missing. You can enter it manually before approval.',
      reviewStatus: 'PENDING' as const,
      userEditedPayload: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockDb: any = {
      query: {
        profileImportItems: {
          findFirst: vi.fn().mockResolvedValue(existingIncompleteItem),
        },
      },
    };

    const service = new SmartProfileImportService(mockDb, {} as any, {} as any);

    await expect(service.updateItem('user-1', 'sess-1', 'cert-item-1', 'APPROVED')).rejects.toThrow(
      'Cannot approve incomplete certification without name and issuing organization',
    );
  });

  // =========================================================================
  // TEST H: User can edit missing issuer, re-evaluating to NEW, then approve
  // =========================================================================
  it('Test H: Editing missing issuer transitions item to NEW, allows approval and commit eligibility', async () => {
    const existingIncompleteItem = {
      id: 'cert-item-1',
      sessionId: 'sess-1',
      userId: 'user-1',
      section: 'CERTIFICATION' as const,
      classification: 'INCOMPLETE' as const,
      confidenceScore: 0.9,
      sourceReference: 'Foundational Leadership',
      extractedPayload: {
        name: 'Foundational Leadership',
        issuingOrganization: '',
        issueDate: '2021-06',
      },
      existingEntityId: null,
      existingPayload: null,
      conflictDetails:
        'Issuing organization is missing. You can enter it manually before approval.',
      reviewStatus: 'PENDING' as const,
      userEditedPayload: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    let itemState: any = { ...existingIncompleteItem };

    const mockDb: any = {
      query: {
        profileImportItems: {
          findFirst: vi.fn().mockImplementation(() => Promise.resolve(itemState)),
        },
      },
      update: vi.fn(() => ({
        set: vi.fn((data) => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockImplementation(() => {
              itemState = { ...itemState, ...data };
              return Promise.resolve([itemState]);
            }),
          })),
        })),
      })),
    };

    const service = new SmartProfileImportService(mockDb, {} as any, {} as any);

    // Step 1: User saves edit with the missing issuingOrganization
    const editResult = await service.updateItem('user-1', 'sess-1', 'cert-item-1', 'EDITED', {
      name: 'Foundational Leadership',
      issuingOrganization: 'McKinsey Academy',
      issueDate: '2021-06',
    });

    expect(editResult.reviewStatus).toBe('EDITED');
    expect(editResult.classification).toBe('NEW'); // re-evaluated from INCOMPLETE to NEW
    expect(editResult.conflictDetails).toBeNull();
    expect(editResult.userEditedPayload?.issuingOrganization).toBe('McKinsey Academy');

    // Step 2: Now that it has an issuing organization, user can explicitly approve it
    const approveResult = await service.updateItem('user-1', 'sess-1', 'cert-item-1', 'APPROVED');
    expect(approveResult.reviewStatus).toBe('APPROVED');
    expect(approveResult.classification).toBe('NEW');
    expect(approveResult.userEditedPayload?.issuingOrganization).toBe('McKinsey Academy');
  });

  // =========================================================================
  // TEST I: Truthfulness invariant: no fake issuers invented
  // =========================================================================
  it('Test I: Missing issuer is never filled with hallucinated defaults ("Unknown", "LinkedIn", etc.)', () => {
    const aiOutput = {
      certifications: [
        {
          name: 'Independent Study in Cryptography',
          issuingOrganization: null,
        },
      ],
    };

    const parsed = SmartProfileExtractor.parseAiProfileData(aiOutput);
    const cert = parsed.certifications[0]!;

    expect(cert.issuingOrganization).toBe('');
    expect(cert.issuingOrganization).not.toBe('Unknown Organization');
    expect(cert.issuingOrganization).not.toBe('LinkedIn');
    expect(cert.issuingOrganization).not.toBe('Not Specified');
  });

  // =========================================================================
  // TEST J: Invalid response structures produce clean AppError without leaking sensitive data
  // =========================================================================
  it('Test J: Invalid response structures produce clean AppError without leaking sensitive data', async () => {
    // When non-object or unparseable data is passed to validation, it throws AppError 502
    try {
      SmartProfileExtractor.parseAiProfileData(null);
      expect.fail('Should have thrown AppError');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      const appErr = err as AppError;
      expect(appErr.statusCode).toBe(502);
      expect(appErr.message).toContain(
        'Some information returned by Gemini could not be processed',
      );
      expect(appErr.message).not.toContain('ZodError');
      expect(appErr.message).not.toContain('invalid_type');
    }

    try {
      SmartProfileExtractor.parseAiProfileData('not an object');
      expect.fail('Should have thrown AppError');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      const appErr = err as AppError;
      expect(appErr.statusCode).toBe(502);
      expect(appErr.message).toContain(
        'Some information returned by Gemini could not be processed',
      );
    }

    // safeSectionArray handles non-array sections gracefully without throwing
    const handled = SmartProfileExtractor.parseAiProfileData({
      certifications: 'not an array',
    });
    expect(handled.certifications).toEqual([]);

    // Verify API key sanitization in extraction failure reporting
    await expect(
      SmartProfileExtractor.extract('resume text', {
        aiConsent: true,
        apiKey: 'AIzaSyFakeKeyForTesting1234567890',
        model: 'nonexistent-gemini-model-xyz',
      }),
    ).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(AppError);
      const appErr = err as AppError;
      expect(appErr.statusCode).toBe(502);
      // Key must be sanitized, never leaked in user message
      expect(appErr.message).not.toContain('AIzaSyFakeKeyForTesting1234567890');
      return true;
    });
  });
});
