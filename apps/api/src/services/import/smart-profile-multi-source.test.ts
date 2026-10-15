import { describe, it, expect, vi } from 'vitest';
import { ProfileComparisonEngine } from './profile-comparison-engine.js';
import { SmartProfileImportService } from './smart-profile-import-service.js';

describe('Multi-Source Profile Comparison & Provenance Tracking (JOB-SMART-PROFILE-IMPORT)', () => {
  // =========================================================================
  // 1. PROFILE IDENTITY: Abbreviated Names & Phone Number Normalization
  // =========================================================================
  describe('Profile Identity Comparison', () => {
    const existingProfile: any = {
      id: 'candidate-01',
      userId: 'user-01',
      fullName: 'Asadbek Makhmudov',
      headline: 'Lead Software Engineer',
      email: 'asadbek@example.com',
      phone: '+48 884 665 207',
      country: 'Poland',
      city: 'Warsaw',
      summary: 'Experienced software engineer',
      skills: [],
      experiences: [],
      educations: [],
      certifications: [],
      languages: [],
      projects: [],
      links: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const emptyBrainState: any = {
      profile: existingProfile,
      experiences: [],
      education: [],
      skills: [],
      certifications: [],
      languages: [],
      projects: [],
      links: [],
    };

    it('classifies abbreviated names as POTENTIAL_MATCH rather than CONFLICT or replacing name', () => {
      // Case 1: First name with initial ("Asadbek M.")
      const imported1: any = {
        fullName: 'Asadbek M.',
        email: 'asadbek@example.com',
        phone: '+48 884 665 207',
      };

      const result1 = ProfileComparisonEngine.compare(
        { profile: imported1 } as any,
        emptyBrainState,
      );
      const profileItem1 = result1.find((r) => r.section === 'PROFILE');
      expect(profileItem1).toBeDefined();
      expect(profileItem1?.classification).toBe('POTENTIAL_MATCH');
      expect(profileItem1?.conflictDetails).toContain('Abbreviated name matches existing profile');
      expect(profileItem1?.conflictDetails).toContain('Asadbek Makhmudov');
      expect(profileItem1?.conflictDetails).toContain('Asadbek M.');

      // Case 2: Initial with last name ("A. Makhmudov")
      const imported2: any = {
        fullName: 'A. Makhmudov',
        email: 'asadbek@example.com',
      };
      const result2 = ProfileComparisonEngine.compare(
        { profile: imported2 } as any,
        emptyBrainState,
      );
      const profileItem2 = result2.find((r) => r.section === 'PROFILE');
      expect(profileItem2?.classification).toBe('POTENTIAL_MATCH');

      // Case 3: Completely distinct name -> CONFLICT
      const imported3: any = {
        fullName: 'John Doe',
        email: 'asadbek@example.com',
      };
      const result3 = ProfileComparisonEngine.compare(
        { profile: imported3 } as any,
        emptyBrainState,
      );
      const profileItem3 = result3.find((r) => r.section === 'PROFILE');
      expect(profileItem3?.classification).toBe('CONFLICT');
      expect(profileItem3?.conflictDetails).toContain('Full name mismatch');
    });

    it('recognizes equivalent phone numbers across international and local representations', () => {
      // Imported without +48 country code: "884 665 207"
      const imported: any = {
        fullName: 'Asadbek Makhmudov',
        phone: '884 665 207',
        country: 'Poland',
      };

      const results = ProfileComparisonEngine.compare(
        { profile: imported } as any,
        emptyBrainState,
      );
      const profileItem = results.find((r) => r.section === 'PROFILE');
      expect(profileItem?.classification).toBe('MATCHED');
      expect(profileItem?.conflictDetails).toBeNull();
    });

    it('flags genuinely conflicting phone numbers as CONFLICT', () => {
      const imported: any = {
        fullName: 'Asadbek Makhmudov',
        phone: '+1 555 123 4567',
      };

      const results = ProfileComparisonEngine.compare(
        { profile: imported } as any,
        emptyBrainState,
      );
      const profileItem = results.find((r) => r.section === 'PROFILE');
      expect(profileItem?.classification).toBe('CONFLICT');
      expect(profileItem?.conflictDetails).toContain('Phone mismatch');
    });
  });

  // =========================================================================
  // 2. CERTIFICATION MATCHING: Ordering, Missing Issuers & Preservation
  // =========================================================================
  describe('Certification Matching & Ordering', () => {
    const existingCertifications: any[] = [
      {
        id: 'cert-01',
        candidateId: 'candidate-01',
        name: 'Foundations of Project Management',
        issuingOrganization: 'Google',
        issueDate: '2023-01',
        expirationDate: null,
        credentialId: 'GOOG-PM-123',
        credentialUrl: 'https://coursera.org/verify/123',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    it('matches existing verified certification when imported certification has null/missing issuer', () => {
      // LinkedIn PDF often provides certification title without issuer
      const importedCert: any = {
        name: 'Foundations of Project Management',
        issuingOrganization: '', // normalized from null
        issueDate: '2023-01',
        sourceReference: 'Foundations of Project Management 2023',
        confidence: 0.95,
      };

      const comparison = ProfileComparisonEngine.compareCertification(
        importedCert,
        existingCertifications,
      );

      // Invariant: Because an existing record matches the name, it is MATCHED, NOT INCOMPLETE!
      expect(comparison.classification).toBe('MATCHED');
      expect(comparison.existingEntityId).toBe('cert-01');
      expect(comparison.conflictDetails).toBeNull();
    });

    it('classifies genuinely new certification without issuer as INCOMPLETE', () => {
      const newImportedCert: any = {
        name: 'Advanced Machine Learning Specialization',
        issuingOrganization: '', // missing issuer
        issueDate: '2024-03',
        sourceReference: 'Advanced Machine Learning Specialization',
        confidence: 0.9,
      };

      const comparison = ProfileComparisonEngine.compareCertification(
        newImportedCert,
        existingCertifications,
      );

      expect(comparison.classification).toBe('INCOMPLETE');
      expect(comparison.existingEntityId).toBeNull();
      expect(comparison.conflictDetails).toBe(
        'Issuing organization is missing. You can enter it manually before approval.',
      );
    });

    it('classifies new certification with issuer as NEW', () => {
      const newImportedCert: any = {
        name: 'AWS Certified Solutions Architect',
        issuingOrganization: 'Amazon Web Services',
        issueDate: '2024-02',
        sourceReference: 'AWS Certified Solutions Architect Amazon Web Services',
        confidence: 0.95,
      };

      const comparison = ProfileComparisonEngine.compareCertification(
        newImportedCert,
        existingCertifications,
      );

      expect(comparison.classification).toBe('NEW');
      expect(comparison.existingEntityId).toBeNull();
      expect(comparison.conflictDetails).toBeNull();
    });
  });

  // =========================================================================
  // 3. EDUCATION SEMANTIC MATCHING: Degree Compatibility & Conflict Detection
  // =========================================================================
  describe('Education Semantic Matching', () => {
    const existingEducations: any[] = [
      {
        id: 'edu-01',
        candidateId: 'candidate-01',
        institution: 'University of Warsaw',
        degree: 'Bachelor of Arts',
        fieldOfStudy: 'Computer Science',
        startDate: '2018-10',
        endDate: '2022-06',
        isCurrent: false,
        grade: null,
        description: null,
        activities: null,
        verificationStatus: 'VERIFIED',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    it('recognizes compatible degree abbreviations ("B.A." vs "Bachelor of Arts") as MATCHED', () => {
      const importedEdu: any = {
        institution: 'University of Warsaw',
        degree: 'B.A.',
        fieldOfStudy: 'Computer Science',
        startDate: '2018-10',
        endDate: '2022-06',
        sourceReference: 'University of Warsaw B.A. Computer Science',
        confidence: 0.95,
      };

      const comparison = ProfileComparisonEngine.compareEducation(importedEdu, existingEducations);

      expect(comparison.classification).toBe('MATCHED');
      expect(comparison.existingEntityId).toBe('edu-01');
      expect(comparison.conflictDetails).toBeNull();
    });

    it('flags conflicting degree levels (e.g. Master of Arts vs Bachelor of Arts) as CONFLICT', () => {
      const importedEdu: any = {
        institution: 'University of Warsaw',
        degree: 'Master of Arts',
        fieldOfStudy: 'Computer Science',
        startDate: '2018-10',
        endDate: '2022-06',
        sourceReference: 'University of Warsaw M.A. Computer Science',
        confidence: 0.95,
      };

      const comparison = ProfileComparisonEngine.compareEducation(importedEdu, existingEducations);

      expect(comparison.classification).toBe('CONFLICT');
      expect(comparison.conflictDetails).toContain('Degree mismatch');
      expect(comparison.conflictDetails).toContain('Bachelor of Arts');
      expect(comparison.conflictDetails).toContain('Master of Arts');
    });

    it('flags conflicting field of study at same institution as CONFLICT', () => {
      const importedEdu: any = {
        institution: 'University of Warsaw',
        degree: 'Bachelor of Arts',
        fieldOfStudy: 'Philosophy',
        startDate: '2018-10',
        endDate: '2022-06',
        sourceReference: 'University of Warsaw B.A. Philosophy',
        confidence: 0.95,
      };

      const comparison = ProfileComparisonEngine.compareEducation(importedEdu, existingEducations);

      expect(comparison.classification).toBe('CONFLICT');
      expect(comparison.conflictDetails).toContain('Field of study mismatch');
      expect(comparison.conflictDetails).toContain('Computer Science');
      expect(comparison.conflictDetails).toContain('Philosophy');
    });
  });

  // =========================================================================
  // 4. EMPLOYMENT DATE CONFLICTS: Preserve Month Conflicts with Comparative Dates
  // =========================================================================
  describe('Employment Date Conflicts & Normalization', () => {
    const existingExperiences: any[] = [
      {
        id: 'exp-01',
        candidateId: 'candidate-01',
        organization: 'Tech Innovations Corp',
        position: 'Senior Software Engineer',
        location: 'Warsaw, Poland',
        employmentType: 'FULL_TIME',
        startDate: 'June 2023',
        endDate: 'January 2024',
        isCurrent: false,
        description: 'Led architecture redesign',
        achievements: [],
        verificationStatus: 'VERIFIED',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    it('preserves genuine date discrepancy (June 2023 vs May 2023) as CONFLICT with accurate dates', () => {
      const importedExp: any = {
        organization: 'Tech Innovations Corp',
        position: 'Senior Software Engineer',
        startDate: 'May 2023', // Started May 2023 instead of June 2023
        endDate: 'January 2024',
        sourceReference: 'Tech Innovations Corp Senior Software Engineer May 2023 - Jan 2024',
        confidence: 0.95,
      };

      const comparison = ProfileComparisonEngine.compareExperience(
        importedExp,
        existingExperiences,
      );

      expect(comparison.classification).toBe('CONFLICT');
      expect(comparison.conflictDetails).toContain('Date mismatch for Senior Software Engineer');
      expect(comparison.conflictDetails).toContain('June 2023');
      expect(comparison.conflictDetails).toContain('May 2023');
    });

    it('matches identical dates even if formatted in ISO ("2023-06" vs "June 2023")', () => {
      const importedExp: any = {
        organization: 'Tech Innovations Corp',
        position: 'Senior Software Engineer',
        startDate: '2023-06',
        endDate: '2024-01',
        sourceReference: 'Tech Innovations Corp Senior Software Engineer 2023-06 - 2024-01',
        confidence: 0.95,
      };

      const comparison = ProfileComparisonEngine.compareExperience(
        importedExp,
        existingExperiences,
      );

      expect(comparison.classification).toBe('MATCHED');
      expect(comparison.existingEntityId).toBe('exp-01');
      expect(comparison.conflictDetails).toBeNull();
    });
  });

  // =========================================================================
  // 5. SKILL CANONICAL DEDUPLICATION VS DISTINCT SKILLS
  // =========================================================================
  describe('Skill Deduplication & Separation', () => {
    const existingSkills: any[] = [
      {
        id: 'skill-01',
        candidateId: 'candidate-01',
        name: 'Agile',
        category: 'Methodology',
        proficiency: 'ADVANCED',
        yearsOfExperience: 4,
        source: 'MANUAL',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'skill-02',
        candidateId: 'candidate-01',
        name: 'Java',
        category: 'Languages',
        proficiency: 'INTERMEDIATE',
        yearsOfExperience: 3,
        source: 'MANUAL',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'skill-03',
        candidateId: 'candidate-01',
        name: 'C',
        category: 'Languages',
        proficiency: 'INTERMEDIATE',
        yearsOfExperience: 2,
        source: 'MANUAL',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    it('classifies canonical equivalents ("Agile" vs "Agile Methodologies") as POTENTIAL_MATCH', () => {
      const importedSkill: any = {
        name: 'Agile Methodologies',
        category: 'Methodology',
        sourceReference: 'Agile Methodologies',
        confidence: 0.95,
      };

      const comparison = ProfileComparisonEngine.compareSkill(importedSkill, existingSkills);

      expect(comparison.classification).toBe('POTENTIAL_MATCH');
      expect(comparison.existingEntityId).toBe('skill-01');
      expect(comparison.conflictDetails).toContain(
        'Potential equivalent of existing skill "Agile"',
      );
    });

    it('strictly separates distinct programming languages ("Java" vs "JavaScript", "C" vs "C++")', () => {
      // Case 1: JavaScript should NOT be merged with Java
      const jsSkill: any = {
        name: 'JavaScript',
        category: 'Languages',
        sourceReference: 'JavaScript',
        confidence: 0.95,
      };

      const comparisonJs = ProfileComparisonEngine.compareSkill(jsSkill, existingSkills);
      expect(comparisonJs.classification).toBe('NEW');
      expect(comparisonJs.existingEntityId).toBeNull();

      // Case 2: C++ should NOT be merged with C
      const cppSkill: any = {
        name: 'C++',
        category: 'Languages',
        sourceReference: 'C++',
        confidence: 0.95,
      };

      const comparisonCpp = ProfileComparisonEngine.compareSkill(cppSkill, existingSkills);
      expect(comparisonCpp.classification).toBe('NEW');
      expect(comparisonCpp.existingEntityId).toBeNull();
    });
  });

  // =========================================================================
  // 6. SOURCE PROVENANCE & DEDUPLICATION IN commitSession
  // =========================================================================
  describe('Source Provenance Tracking & Deduplication', () => {
    it('updates candidateFact sources to include secondary document without inserting duplicate row', async () => {
      const existingFact = {
        id: 'fact-cert-01',
        candidateId: 'cand-01',
        category: 'CERTIFICATION',
        key: 'certification:foundations of project management:google',
        value: 'Foundations of Project Management',
        structuredValue: {
          name: 'Foundations of Project Management',
          issuingOrganization: 'Google',
          issueDate: '2023-01',
          documentSource: 'CV',
          sources: ['CV'],
        },
        confidence: '0.95',
        verificationStatus: 'VERIFIED',
        allowAiUse: true,
        source: 'CV_IMPORT',
        sourceDocumentId: 'doc-cv-01',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      let candidateFactState: any = { ...existingFact };
      const insertedFacts: any[] = [];
      const auditLogEntries: any[] = [];

      const mockSession = {
        id: 'session-linkedin-01',
        userId: 'user-01',
        sourceType: 'LINKEDIN_PDF',
        status: 'REVIEW_READY',
        rawTextSnippet: 'Foundations of Project Management',
        errorMessage: null,
        extractorUsed: 'GEMINI_AI',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const approvedMatchedItem = {
        id: 'item-linkedin-cert-01',
        sessionId: 'session-linkedin-01',
        userId: 'user-01',
        section: 'CERTIFICATION' as const,
        classification: 'MATCHED' as const,
        confidenceScore: 0.95,
        sourceReference: 'Foundations of Project Management',
        extractedPayload: {
          name: 'Foundations of Project Management',
          issuingOrganization: '', // null in LinkedIn
          issueDate: '2023-01',
        },
        existingEntityId: 'fact-cert-01',
        existingPayload: existingFact.structuredValue,
        conflictDetails: null,
        reviewStatus: 'APPROVED' as const,
        userEditedPayload: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockDb: any = {
        transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb(mockDb)),
        query: {
          profileImportSessions: {
            findFirst: vi.fn().mockResolvedValue(mockSession),
          },
          profileImportItems: {
            findMany: vi.fn().mockResolvedValue([approvedMatchedItem]),
          },
          candidateFacts: {
            findFirst: vi.fn().mockImplementation(() => Promise.resolve(candidateFactState)),
            findMany: vi.fn().mockImplementation(() => Promise.resolve([candidateFactState])),
          },
        },
        update: vi.fn((table: any) => ({
          set: vi.fn((data: any) => ({
            where: vi.fn().mockImplementation(() => {
              if (table === 'candidateFacts' || (data && data.structuredValue)) {
                candidateFactState = { ...candidateFactState, ...data };
              }
              return Promise.resolve([data]);
            }),
          })),
        })),
        insert: vi.fn((table: any) => ({
          values: vi.fn().mockImplementation((val: any) => {
            if (table === 'auditLogs' || (val && val.action)) {
              auditLogEntries.push(val);
            } else {
              insertedFacts.push(val);
            }
            return {
              returning: vi.fn().mockResolvedValue([val]),
            };
          }),
        })),
      };

      const mockCandidateService: any = {
        getOverview: vi.fn().mockResolvedValue({
          completenessScore: 85,
        }),
      };

      const service = new SmartProfileImportService(mockDb, {} as any, mockCandidateService);

      const commitResult = await service.commitSession('user-01', 'session-linkedin-01');

      expect(commitResult.sessionId).toBe('session-linkedin-01');
      expect(commitResult.committedCounts.factsCreated).toBe(0);

      // Invariant: No duplicate candidate fact was inserted!
      expect(insertedFacts).toHaveLength(0);

      // Invariant: Provenance updated on existing fact to record both sources
      expect(candidateFactState.structuredValue.sources).toEqual(['CV', 'LINKEDIN_PDF']);

      // Invariant: Audit log recorded the multi-source confirmation
      const confirmationLog = auditLogEntries.find(
        (entry) => entry.action === 'CONFIRMED_BY_IMPORT',
      );
      expect(confirmationLog).toBeDefined();
      expect(confirmationLog?.entityId).toBe('fact-cert-01');
      expect(confirmationLog?.metadata?.source).toBe('LINKEDIN_PDF');
    });
  });
});
