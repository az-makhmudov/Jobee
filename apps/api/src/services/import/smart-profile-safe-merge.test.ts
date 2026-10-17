import { describe, it, expect, vi } from 'vitest';
import { candidateProfiles } from '@job-agent/database';
import { SmartProfileImportService } from './smart-profile-import-service.js';

describe('Safe Multi-Source Merge & Profile Singleton Protection (JOB-SMART-PROFILE-IMPORT)', () => {
  // =========================================================================
  // 1. FIELD-AWARE MERGING (Missing values never erase existing data)
  // =========================================================================
  describe('Field-Aware Merging Engine', () => {
    it('TEST 1: Replacing one experience date preserves existing descriptions and achievements', () => {
      const existingExperience = {
        organization: 'Asia Alliance Bank',
        position: 'Product Operations Specialist',
        startDate: 'June 2023',
        endDate: 'August 2023',
        isCurrent: false,
        location: 'Tashkent, Uzbekistan',
        employmentType: 'FULL_TIME',
        description: 'Detailed CV description of operations workflows and reconciliations.',
        achievements: [
          'Automated daily reconciliation pipeline reducing manual overhead by 30%',
          'Delivered operations audit compliance report on time',
        ],
      };

      // LinkedIn extraction: has new start date, but missing description and achievements
      const incomingExperience = {
        organization: 'Asia Alliance Bank',
        position: 'Product Operations Specialist',
        startDate: 'May 2023', // Discrepancy to update
        endDate: 'August 2023',
        isCurrent: false,
        location: null, // missing in import
        employmentType: null, // missing in import
        description: null, // missing in import
        achievements: [], // missing in import
      };

      const result = SmartProfileImportService.mergeFieldsWithExisting(
        'EXPERIENCE',
        existingExperience,
        incomingExperience,
      );

      // Start date updated
      expect(result.merged.startDate).toBe('May 2023');
      expect(result.changedFields).toContain('startDate');

      // Description and achievements PRESERVED
      expect(result.merged.description).toBe(
        'Detailed CV description of operations workflows and reconciliations.',
      );
      expect(result.merged.achievements).toEqual([
        'Automated daily reconciliation pipeline reducing manual overhead by 30%',
        'Delivered operations audit compliance report on time',
      ]);
      expect(result.merged.location).toBe('Tashkent, Uzbekistan');
      expect(result.merged.employmentType).toBe('FULL_TIME');

      expect(result.preservedFields).toContain('description');
      expect(result.preservedFields).toContain('achievements');
      expect(result.preservedFields).toContain('location');
      expect(result.preservedFields).toContain('employmentType');
    });

    it('TEST 2: Missing imported fields never erase data across all candidate brain sections', () => {
      // A. Education
      const existingEdu = {
        institution: 'Vistula University',
        degree: 'B. A.',
        fieldOfStudy: 'English Studies',
        startDate: '2020-10',
        endDate: '2023-07',
        isCurrent: false,
        location: 'Warsaw, Poland',
        description:
          'Rigorous academic curriculum with linguistic and business communications focus.',
        activities: 'Student Council, Debate Club',
      };
      const incomingEdu = {
        institution: 'Vistula University',
        degree: "Bachelor's degree",
        fieldOfStudy: null,
        startDate: '2020-10',
        endDate: '2023-07',
        location: '',
        description: null,
        activities: null,
      };
      const mergedEdu = SmartProfileImportService.mergeFieldsWithExisting(
        'EDUCATION',
        existingEdu,
        incomingEdu,
      );
      expect(mergedEdu.merged.fieldOfStudy).toBe('English Studies');
      expect(mergedEdu.merged.description).toBe(
        'Rigorous academic curriculum with linguistic and business communications focus.',
      );
      expect(mergedEdu.merged.activities).toBe('Student Council, Debate Club');
      expect(mergedEdu.merged.location).toBe('Warsaw, Poland');
      expect(mergedEdu.preservedFields).toContain('description');
      expect(mergedEdu.preservedFields).toContain('activities');

      // B. Certification
      const existingCert = {
        name: 'Foundations of Project Management',
        issuingOrganization: 'Google',
        issueDate: '2023-05',
        expirationDate: null,
        credentialId: 'COURSERA-GOOGLE-12345',
        credentialUrl: 'https://coursera.org/verify/COURSERA-GOOGLE-12345',
      };
      const incomingCert = {
        name: 'Foundations of Project Management',
        issuingOrganization: '', // LinkedIn null issuer normalized to empty string
        issueDate: '2023-05',
        credentialId: null,
        credentialUrl: '',
      };
      const mergedCert = SmartProfileImportService.mergeFieldsWithExisting(
        'CERTIFICATION',
        existingCert,
        incomingCert,
      );
      expect(mergedCert.merged.issuingOrganization).toBe('Google');
      expect(mergedCert.merged.credentialId).toBe('COURSERA-GOOGLE-12345');
      expect(mergedCert.merged.credentialUrl).toBe(
        'https://coursera.org/verify/COURSERA-GOOGLE-12345',
      );
      expect(mergedCert.preservedFields).toContain('issuingOrganization');

      // C. Skill
      const existingSkill = {
        name: 'Agile Methodologies',
        category: 'Project Management',
        proficiency: 'EXPERT',
        yearsExperience: 3,
      };
      const incomingSkill = {
        name: 'Agile Methodologies',
        category: null,
        proficiency: null,
        yearsExperience: null,
      };
      const mergedSkill = SmartProfileImportService.mergeFieldsWithExisting(
        'SKILL',
        existingSkill,
        incomingSkill,
      );
      expect(mergedSkill.merged.category).toBe('Project Management');
      expect(mergedSkill.merged.proficiency).toBe('EXPERT');
      expect(mergedSkill.merged.yearsExperience).toBe(3);
      expect(mergedSkill.preservedFields).toContain('proficiency');

      // D. Language
      const existingLang = {
        language: 'English',
        proficiency: 'PROFICIENT',
        cefrLevel: 'C1',
        notes: 'IELTS Academic 8.0, English Studies degree',
      };
      const incomingLang = {
        language: 'English',
        proficiency: null,
        cefrLevel: null,
        notes: null,
      };
      const mergedLang = SmartProfileImportService.mergeFieldsWithExisting(
        'LANGUAGE',
        existingLang,
        incomingLang,
      );
      expect(mergedLang.merged.proficiency).toBe('PROFICIENT');
      expect(mergedLang.merged.cefrLevel).toBe('C1');
      expect(mergedLang.merged.notes).toBe('IELTS Academic 8.0, English Studies degree');
      expect(mergedLang.preservedFields).toContain('proficiency');
    });

    it('TEST 3: Explicit field clearing requires deliberate confirmation', () => {
      const existingExperience = {
        organization: 'Asia Alliance Bank',
        position: 'Product Operations Specialist',
        startDate: 'June 2023',
        description: 'Detailed CV description',
        achievements: ['Achievement 1'],
      };

      // Case A: Missing or empty string without explicit clearing flag -> PRESERVES data
      const nonDeliberateIncoming = {
        organization: 'Asia Alliance Bank',
        position: 'Product Operations Specialist',
        startDate: 'June 2023',
        description: '',
        achievements: [],
      };
      const preservedResult = SmartProfileImportService.mergeFieldsWithExisting(
        'EXPERIENCE',
        existingExperience,
        nonDeliberateIncoming,
        { explicitlyClearedFields: [] },
      );
      expect(preservedResult.merged.description).toBe('Detailed CV description');
      expect(preservedResult.merged.achievements).toEqual(['Achievement 1']);
      expect(preservedResult.changedFields).not.toContain('description');

      // Case B: Deliberate clearing with explicit authorization -> CLEARS data
      const deliberateIncoming = {
        organization: 'Asia Alliance Bank',
        position: 'Product Operations Specialist',
        startDate: 'June 2023',
        description: '',
        achievements: [],
      };
      const clearedResult = SmartProfileImportService.mergeFieldsWithExisting(
        'EXPERIENCE',
        existingExperience,
        deliberateIncoming,
        { explicitlyClearedFields: ['description', 'achievements'] },
      );
      expect(clearedResult.merged.description).toBeNull();
      expect(clearedResult.merged.achievements).toEqual([]);
      expect(clearedResult.changedFields).toContain('description');
      expect(clearedResult.changedFields).toContain('achievements');
    });
  });

  // =========================================================================
  // 2. PROFILE SINGLETON PROTECTION & ABBREVIATED NAME INTEGRITY
  // =========================================================================
  describe('Profile Singleton Protection & Abbreviated Name Integrity', () => {
    it('TEST 4: ADD_AS_SEPARATE is strictly prohibited for PROFILE section in updateItem and commitSession', async () => {
      const profileItem = {
        id: 'item-profile-01',
        sessionId: 'sess-profile-qa',
        userId: 'u1',
        section: 'PROFILE',
        classification: 'CONFLICT',
        confidenceScore: 0.9,
        sourceReference: 'LinkedIn personal profile',
        extractedPayload: { fullName: 'Asadbek M.', headline: 'New Headline' },
        existingEntityId: 'prof-existing-01',
        existingPayload: { fullName: 'Asadbek Makhmudov' },
        conflictDetails: 'Name variation',
        reviewStatus: 'PENDING',
        conflictResolution: null,
        userEditedPayload: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockDb: any = {
        query: {
          profileImportItems: {
            findFirst: vi.fn().mockResolvedValue(profileItem),
            findMany: vi.fn().mockResolvedValue([
              {
                ...profileItem,
                reviewStatus: 'APPROVED',
                conflictResolution: 'ADD_AS_SEPARATE',
              },
            ]),
          },
          profileImportSessions: {
            findFirst: vi.fn().mockResolvedValue({
              id: 'sess-profile-qa',
              userId: 'u1',
              sourceType: 'LINKEDIN_PDF',
            }),
          },
        },
        transaction: vi.fn(async (cb) => cb(mockDb)),
      };

      const service = new SmartProfileImportService(mockDb, {} as any, {} as any);

      // updateItem rejects ADD_AS_SEPARATE for PROFILE
      await expect(
        service.updateItem(
          'u1',
          'sess-profile-qa',
          'item-profile-01',
          'APPROVED',
          undefined,
          'ADD_AS_SEPARATE',
        ),
      ).rejects.toThrow(/ADD_AS_SEPARATE is not permitted for personal profile records/i);

      // commitSession rejects ADD_AS_SEPARATE for PROFILE
      await expect(
        service.commitSession('u1', 'sess-profile-qa', { verifyOnCommit: false }),
      ).rejects.toThrow(/ADD_AS_SEPARATE is not permitted for personal profile records/i);
    });

    it('TEST 5: Confirming an abbreviated name preserves the existing full name', () => {
      const existingProfile = {
        fullName: 'Asadbek Makhmudov',
        headline: 'Lead Project Operations Manager',
        email: 'asadbek@example.com',
        phone: '+48 884 665 207',
        summary: 'Experienced project operations professional.',
      };

      // LinkedIn imports abbreviated initials: "Asadbek M."
      const incomingProfile = {
        fullName: 'Asadbek M.',
        headline: 'Lead Project Operations Manager',
        email: null,
        phone: null,
        summary: null,
      };

      const result = SmartProfileImportService.mergeFieldsWithExisting(
        'PROFILE',
        existingProfile,
        incomingProfile,
      );

      // Existing full name is 100% PRESERVED
      expect(result.merged.fullName).toBe('Asadbek Makhmudov');
      expect(result.changedFields).not.toContain('fullName');
      expect(result.preservedFields).toContain('fullName');
      expect(result.merged.email).toBe('asadbek@example.com');
      expect(result.merged.phone).toBe('+48 884 665 207');
      expect(result.merged.summary).toBe('Experienced project operations professional.');
    });

    it('TEST 6: Profile replacement updates only approved fields without silent overwrites', async () => {
      const existingProfile = {
        id: 'prof-user-asadbek',
        userId: 'user-asadbek',
        fullName: 'Asadbek Makhmudov',
        headline: 'Operations Assistant',
        email: 'asadbek@example.com',
        phone: '+48 884 665 207',
        city: 'Warsaw',
        country: 'Poland',
        summary: 'Verified comprehensive career summary.',
        verificationStatus: 'VERIFIED',
      };

      const conflictProfileItem = {
        id: 'item-profile-conflict',
        sessionId: 'sess-profile-replace',
        userId: 'user-asadbek',
        section: 'PROFILE',
        classification: 'CONFLICT',
        confidenceScore: 0.9,
        sourceReference: 'LinkedIn profile export',
        extractedPayload: {
          fullName: 'Asadbek M.', // Abbreviated
          headline: 'Senior Project Manager & Operations Specialist', // Approved change!
          email: null, // missing in LinkedIn
          phone: null, // missing in LinkedIn
          city: null, // missing in LinkedIn
          country: null, // missing in LinkedIn
          summary: null, // missing in LinkedIn
        },
        existingEntityId: 'prof-user-asadbek',
        existingPayload: existingProfile,
        conflictDetails: 'Headline and name mismatch',
        reviewStatus: 'APPROVED',
        conflictResolution: 'REPLACE_EXISTING',
        userEditedPayload: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      let updatedProfileValues: any = null;
      const recordedAuditEvents: any[] = [];

      const mockTx: any = {
        insert: vi.fn(),
        update: vi.fn((table) => ({
          set: vi.fn((vals) => {
            if (table === candidateProfiles) {
              updatedProfileValues = vals;
            }
            return {
              where: vi.fn().mockResolvedValue([{}]),
            };
          }),
        })),
        query: {
          candidateProfiles: {
            findFirst: vi.fn().mockResolvedValue(existingProfile),
          },
          candidateFacts: {
            findMany: vi.fn().mockResolvedValue([]),
          },
        },
      };

      const mockDb: any = {
        query: {
          profileImportSessions: {
            findFirst: vi.fn().mockResolvedValue({
              id: 'sess-profile-replace',
              userId: 'user-asadbek',
              sourceType: 'LINKEDIN_PDF',
            }),
          },
          profileImportItems: {
            findMany: vi.fn().mockResolvedValue([conflictProfileItem]),
          },
        },
        transaction: vi.fn(async (cb) => cb(mockTx)),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([{}]),
          })),
        })),
      };

      const candidateServiceMock: any = {
        getOverview: vi.fn().mockResolvedValue({ completeness: { score: 100 } }),
        getCompleteness: vi.fn().mockResolvedValue({ score: 100 }),
      };

      const service = new SmartProfileImportService(mockDb, {} as any, candidateServiceMock);
      (service as any).recordAuditTx = vi.fn(async (_tx, evt) => {
        recordedAuditEvents.push(evt);
      });

      const commitResult = await service.commitSession('user-asadbek', 'sess-profile-replace', {
        verifyOnCommit: true,
      });

      expect(commitResult.sessionId).toBe('sess-profile-replace');

      // Headline was updated
      expect(updatedProfileValues.headline).toBe('Senior Project Manager & Operations Specialist');
      // Full name was preserved as the verified full name (NOT downgraded to "Asadbek M.")
      expect(updatedProfileValues.fullName).toBe('Asadbek Makhmudov');
      // Email, phone, city, country, summary were safely preserved from existing profile
      expect(updatedProfileValues.email).toBe('asadbek@example.com');
      expect(updatedProfileValues.phone).toBe('+48 884 665 207');
      expect(updatedProfileValues.city).toBe('Warsaw');
      expect(updatedProfileValues.country).toBe('Poland');
      expect(updatedProfileValues.summary).toBe('Verified comprehensive career summary.');

      // Audit trail verifies CONFLICT_RESOLVED_REPLACE
      const audit = recordedAuditEvents.find((a) => a.action === 'CONFLICT_RESOLVED_REPLACE');
      expect(audit).toBeDefined();
      expect(audit.changedFields).toContain('headline');
      expect(audit.changedFields).not.toContain('fullName');
      expect(audit.metadata.preservedFields).toContain('fullName');
    });

    it('TEST 7: Existing verified facts and multi-source audit history remain intact without status downgrade', async () => {
      const existingExperience = {
        id: 'exp-asia-01',
        organization: 'Asia Alliance Bank',
        position: 'Operations Assistant',
        startDate: 'June 2023',
        endDate: 'August 2023',
        isCurrent: false,
        description: 'Detailed verified operations experience',
        achievements: ['Achievement A'],
        verificationStatus: 'VERIFIED',
      };

      const approvedConflictItem = {
        id: 'item-exp-conflict',
        sessionId: 'sess-facts-qa',
        userId: 'user-asadbek',
        section: 'EXPERIENCE',
        classification: 'CONFLICT',
        confidenceScore: 0.9,
        sourceReference: 'Asia Alliance Bank (May 2023 – August 2023)',
        extractedPayload: {
          organization: 'Asia Alliance Bank',
          position: 'Operations Assistant',
          startDate: 'May 2023',
          endDate: 'August 2023',
        },
        existingEntityId: 'exp-asia-01',
        existingPayload: existingExperience,
        conflictDetails: 'Start date mismatch',
        reviewStatus: 'APPROVED',
        conflictResolution: 'REPLACE_EXISTING',
        userEditedPayload: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      let updatedFactValues: any = null;

      const mockTx: any = {
        update: vi.fn(() => ({
          set: vi.fn((vals) => {
            if (vals.structuredValue) {
              updatedFactValues = vals;
            }
            return {
              where: vi.fn().mockResolvedValue([{}]),
            };
          }),
        })),
        query: {
          candidateExperiences: {
            findFirst: vi.fn().mockResolvedValue(existingExperience),
          },
          candidateFacts: {
            findMany: vi.fn().mockResolvedValue([
              {
                id: 'fact-asia-01',
                userId: 'user-asadbek',
                sourceEntityId: 'exp-asia-01',
                verificationStatus: 'VERIFIED', // Already VERIFIED
                structuredValue: {
                  organization: 'Asia Alliance Bank',
                  startDate: 'June 2023',
                  description: 'Detailed verified operations experience',
                  sources: ['CV'],
                },
              },
            ]),
          },
        },
      };

      const mockDb: any = {
        query: {
          profileImportSessions: {
            findFirst: vi.fn().mockResolvedValue({
              id: 'sess-facts-qa',
              userId: 'user-asadbek',
              sourceType: 'LINKEDIN_PDF',
            }),
          },
          profileImportItems: {
            findMany: vi.fn().mockResolvedValue([approvedConflictItem]),
          },
        },
        transaction: vi.fn(async (cb) => cb(mockTx)),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([{}]),
          })),
        })),
      };

      const candidateServiceMock: any = {
        getOverview: vi.fn().mockResolvedValue({ completeness: { score: 100 } }),
        getCompleteness: vi.fn().mockResolvedValue({ score: 100 }),
      };

      const service = new SmartProfileImportService(mockDb, {} as any, candidateServiceMock);
      (service as any).recordAuditTx = vi.fn().mockResolvedValue(undefined);

      await service.commitSession('user-asadbek', 'sess-facts-qa', {
        verifyOnCommit: false, // commitSession requested false, but existing fact was VERIFIED
      });

      // Verification status MUST NOT be downgraded to UNVERIFIED
      expect(updatedFactValues.verificationStatus).toBe('VERIFIED');

      // Sources must contain both original CV and new LINKEDIN_PDF
      expect(updatedFactValues.structuredValue.sources).toEqual(['CV', 'LINKEDIN_PDF']);
      // Start date updated in fact
      expect(updatedFactValues.structuredValue.startDate).toBe('May 2023');
      // Description preserved in fact
      expect(updatedFactValues.structuredValue.description).toBe(
        'Detailed verified operations experience',
      );
    });
  });
});
