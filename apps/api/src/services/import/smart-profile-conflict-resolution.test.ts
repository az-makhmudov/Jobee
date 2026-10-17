import { describe, it, expect, vi } from 'vitest';
import { ProfileComparisonEngine } from './profile-comparison-engine.js';
import { SmartProfileExtractor } from './smart-profile-extractor.js';
import { SmartProfileImportService } from './smart-profile-import-service.js';
import type { CandidateEducationDto } from '@job-agent/shared';

describe('Smart Profile Conflict Resolution & Degree Normalization (JOB-SMART-PROFILE-IMPORT)', () => {
  // =========================================================================
  // 1. DEGREE NORMALIZATION & LEVEL COMPATIBILITY
  // =========================================================================
  describe('Degree Normalization & Compatibility', () => {
    it('exact QA reproduction: Existing "B. A." at "Vistula University" matches Imported "Bachelor\'s degree"', () => {
      const existingEducation: CandidateEducationDto[] = [
        {
          id: 'edu-vistula-01',
          userId: 'user-asadbek',
          institution: 'Vistula University',
          degree: 'B. A.',
          fieldOfStudy: 'English Studies',
          startDate: '2020-10',
          endDate: '2023-07',
          isCurrent: false,
          displayOrder: 0,
          location: 'Warsaw, Poland',
          description: null,
          activities: null,
          verificationStatus: 'VERIFIED',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const importedEdu: any = {
        institution: 'Vistula University',
        degree: "Bachelor's degree",
        fieldOfStudy: 'English Studies',
        startDate: '2020-10',
        endDate: '2023-07',
        isCurrent: false,
        sourceReference: "Bachelor's degree in English Studies at Vistula University",
        confidence: 0.95,
      };

      const result = ProfileComparisonEngine.compareEducation(importedEdu, existingEducation);

      expect(result.classification).toBe('MATCHED');
      expect(result.existingEntityId).toBe('edu-vistula-01');
      expect(result.conflictDetails).toBeNull();
    });

    it('recognizes equivalent formatting: "B.A.", "B. A.", "BA", "Bachelor of Arts"', () => {
      expect(ProfileComparisonEngine.normalizeDegreeType('B.A.')).toBe('bachelor_of_arts');
      expect(ProfileComparisonEngine.normalizeDegreeType('B. A.')).toBe('bachelor_of_arts');
      expect(ProfileComparisonEngine.normalizeDegreeType('BA')).toBe('bachelor_of_arts');
      expect(ProfileComparisonEngine.normalizeDegreeType('Bachelor of Arts')).toBe(
        'bachelor_of_arts',
      );
      expect(ProfileComparisonEngine.normalizeDegreeType("Bachelor's degree in Arts")).toBe(
        'bachelor_of_arts',
      );

      expect(ProfileComparisonEngine.isDegreeCompatible('B.A.', 'Bachelor of Arts')).toBe(true);
      expect(ProfileComparisonEngine.isDegreeCompatible('B. A.', 'Bachelor of Arts')).toBe(true);
      expect(ProfileComparisonEngine.isDegreeCompatible('BA', "Bachelor's degree")).toBe(true);
      expect(ProfileComparisonEngine.isDegreeCompatible('B. A.', "Bachelor's degree")).toBe(true);
    });

    it('recognizes Bachelor of Science variations: "B.S.", "B. S.", "B.Sc.", "BSc", "Bachelor of Science"', () => {
      expect(ProfileComparisonEngine.normalizeDegreeType('B.S.')).toBe('bachelor_of_science');
      expect(ProfileComparisonEngine.normalizeDegreeType('B. S.')).toBe('bachelor_of_science');
      expect(ProfileComparisonEngine.normalizeDegreeType('B.Sc.')).toBe('bachelor_of_science');
      expect(ProfileComparisonEngine.normalizeDegreeType('B. Sc.')).toBe('bachelor_of_science');
      expect(ProfileComparisonEngine.normalizeDegreeType('BSc')).toBe('bachelor_of_science');
      expect(ProfileComparisonEngine.normalizeDegreeType('Bachelor of Science')).toBe(
        'bachelor_of_science',
      );

      expect(ProfileComparisonEngine.isDegreeCompatible('B.S.', 'Bachelor of Science')).toBe(true);
      expect(ProfileComparisonEngine.isDegreeCompatible('B. S.', "Bachelor's degree")).toBe(true);
      expect(ProfileComparisonEngine.isDegreeCompatible('B.Sc.', 'Bachelor of Science')).toBe(true);
    });

    it('strictly separates distinct qualifications: Bachelor of Arts vs Bachelor of Science -> CONFLICT', () => {
      expect(
        ProfileComparisonEngine.isDegreeCompatible('Bachelor of Arts', 'Bachelor of Science'),
      ).toBe(false);
      expect(ProfileComparisonEngine.isDegreeCompatible('B. A.', 'B. S.')).toBe(false);
      expect(ProfileComparisonEngine.isDegreeCompatible('BA', 'BS')).toBe(false);

      const existingEducation: CandidateEducationDto[] = [
        {
          id: 'edu-01',
          userId: 'user-01',
          institution: 'Vistula University',
          degree: 'Bachelor of Arts',
          fieldOfStudy: 'Computer Science',
          startDate: '2020',
          endDate: '2023',
          isCurrent: false,
          displayOrder: 0,
          location: null,
          description: null,
          activities: null,
          verificationStatus: 'VERIFIED',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const importedEdu: any = {
        institution: 'Vistula University',
        degree: 'Bachelor of Science',
        fieldOfStudy: 'Computer Science',
        startDate: '2020',
        endDate: '2023',
        sourceReference: 'BSc at Vistula',
        confidence: 0.9,
      };

      const result = ProfileComparisonEngine.compareEducation(importedEdu, existingEducation);
      expect(result.classification).toBe('CONFLICT');
      expect(result.conflictDetails).toContain('Degree mismatch');
    });

    it("strictly separates distinct degree levels: Master's degree vs Bachelor's degree -> CONFLICT", () => {
      expect(
        ProfileComparisonEngine.isDegreeCompatible("Master's degree", "Bachelor's degree"),
      ).toBe(false);
      expect(ProfileComparisonEngine.isDegreeCompatible('M. A.', 'B. A.')).toBe(false);
      expect(ProfileComparisonEngine.isDegreeCompatible('M.S.', 'B.S.')).toBe(false);

      const existingEducation: CandidateEducationDto[] = [
        {
          id: 'edu-02',
          userId: 'user-01',
          institution: 'University of Warsaw',
          degree: "Bachelor's degree",
          fieldOfStudy: 'Economics',
          startDate: '2019',
          endDate: '2022',
          isCurrent: false,
          displayOrder: 0,
          location: null,
          description: null,
          activities: null,
          verificationStatus: 'VERIFIED',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const importedEdu: any = {
        institution: 'University of Warsaw',
        degree: "Master's degree",
        fieldOfStudy: 'Economics',
        startDate: '2019',
        endDate: '2022',
        sourceReference: 'Masters at Warsaw',
        confidence: 0.9,
      };

      const result = ProfileComparisonEngine.compareEducation(importedEdu, existingEducation);
      expect(result.classification).toBe('CONFLICT');
      expect(result.conflictDetails).toContain('Degree mismatch');
    });

    it('recognizes MBA precedence over partial B.A. abbreviation', () => {
      expect(ProfileComparisonEngine.normalizeDegreeType('MBA')).toBe('mba');
      expect(ProfileComparisonEngine.normalizeDegreeType('M.B.A.')).toBe('mba');
      expect(ProfileComparisonEngine.normalizeDegreeType('M. B. A.')).toBe('mba');
      expect(ProfileComparisonEngine.normalizeDegreeType('Master of Business Administration')).toBe(
        'mba',
      );
      expect(ProfileComparisonEngine.isDegreeCompatible('MBA', "Master's degree")).toBe(true);
      expect(ProfileComparisonEngine.isDegreeCompatible('M. B. A.', 'B. A.')).toBe(false);
    });
  });

  // =========================================================================
  // 2. SAFE EDUCATION DATE HANDLING
  // =========================================================================
  describe('Safe Education Date Handling', () => {
    it('preserves ongoing education when imported has single date, classifying as POTENTIAL_MATCH rather than false CONFLICT', () => {
      const existingOngoing: CandidateEducationDto[] = [
        {
          id: 'edu-ongoing-01',
          userId: 'user-asadbek',
          institution: 'Vistula University',
          degree: 'B. A.',
          fieldOfStudy: 'English Studies',
          startDate: '2020-10',
          endDate: null,
          isCurrent: true,
          displayOrder: 0,
          location: 'Warsaw',
          description: null,
          activities: null,
          verificationStatus: 'VERIFIED',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      // Single ambiguous date in imported document (e.g. "October 2023" from LinkedIn PDF)
      const importedSingleDate: any = {
        institution: 'Vistula University',
        degree: "Bachelor's degree",
        fieldOfStudy: 'English Studies',
        startDate: 'October 2023',
        endDate: null,
        isCurrent: false,
        sourceReference: 'Vistula University October 2023',
        confidence: 0.85,
      };

      const result = ProfileComparisonEngine.compareEducation(importedSingleDate, existingOngoing);

      // Must be POTENTIAL_MATCH requesting review, NOT a destructive CONFLICT or automatic overwrite
      expect(result.classification).toBe('POTENTIAL_MATCH');
      expect(result.existingEntityId).toBe('edu-ongoing-01');
      expect(result.conflictDetails).toContain(
        'Ongoing education at Vistula University with single imported date',
      );
      expect(result.conflictDetails).toContain('review required');
    });

    it('heuristic extractor does NOT synthesize graduation end date from a single date', () => {
      const text = `
Education
Vistula University - Bachelor of Arts in English Studies (2023)
`;
      const extracted = SmartProfileExtractor.extractWithHeuristics(text);
      expect(extracted.education.length).toBeGreaterThan(0);
      const edu = extracted.education[0]!;
      expect(edu.startDate).toBe('2023');
      expect(edu.endDate).toBeNull();
    });
  });

  // =========================================================================
  // 3. BACKEND CONFLICT RESOLUTION ENFORCEMENT (updateItem & commitSession)
  // =========================================================================
  describe('Backend Conflict Resolution Enforcement', () => {
    it('updateItem rejects approving a CONFLICT item without a resolution with 400 Bad Request', async () => {
      const conflictItem = {
        id: 'item-conflict-01',
        sessionId: 'sess-01',
        userId: 'u1',
        section: 'EXPERIENCE',
        classification: 'CONFLICT',
        confidenceScore: 0.9,
        sourceReference: 'Asia Alliance Bank Operations Assistant',
        extractedPayload: {
          organization: 'Asia Alliance Bank',
          position: 'Operations Assistant',
          startDate: 'May 2023',
          endDate: 'August 2023',
        },
        existingEntityId: 'exp-asia-01',
        existingPayload: {
          organization: 'Asia Alliance Bank',
          position: 'Operations Assistant',
          startDate: 'June 2023',
          endDate: 'August 2023',
          verificationStatus: 'VERIFIED',
        },
        conflictDetails: 'Date mismatch: existing June 2023 vs imported May 2023',
        reviewStatus: 'PENDING',
        conflictResolution: null,
        userEditedPayload: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockDb: any = {
        query: {
          profileImportItems: {
            findFirst: vi.fn().mockResolvedValue(conflictItem),
          },
        },
      };

      const service = new SmartProfileImportService(mockDb, {} as any, {} as any);

      // Attempt to approve without conflictResolution -> throws 400
      await expect(
        service.updateItem('u1', 'sess-01', 'item-conflict-01', 'APPROVED'),
      ).rejects.toThrow(
        'A conflict resolution (KEEP_EXISTING, REPLACE_EXISTING, or ADD_AS_SEPARATE) is required when approving a CONFLICT item.',
      );
    });

    it('updateItem persists conflictResolution when valid resolution is provided', async () => {
      const conflictItem = {
        id: 'item-conflict-01',
        sessionId: 'sess-01',
        userId: 'u1',
        section: 'EXPERIENCE',
        classification: 'CONFLICT',
        confidenceScore: 0.9,
        sourceReference: 'Asia Alliance Bank',
        extractedPayload: {
          organization: 'Asia Alliance Bank',
          position: 'Operations Assistant',
          startDate: 'May 2023',
        },
        existingEntityId: 'exp-asia-01',
        existingPayload: {},
        conflictDetails: 'Mismatch',
        reviewStatus: 'PENDING',
        conflictResolution: null,
        userEditedPayload: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      let capturedUpdateData: any = null;

      const mockDb: any = {
        query: {
          profileImportItems: {
            findFirst: vi.fn().mockResolvedValue(conflictItem),
          },
        },
        update: vi.fn(() => ({
          set: vi.fn((data) => {
            capturedUpdateData = data;
            return {
              where: vi.fn(() => ({
                returning: vi.fn().mockResolvedValue([
                  {
                    ...conflictItem,
                    ...data,
                  },
                ]),
              })),
            };
          }),
        })),
      };

      const service = new SmartProfileImportService(mockDb, {} as any, {} as any);

      const result = await service.updateItem(
        'u1',
        'sess-01',
        'item-conflict-01',
        'APPROVED',
        undefined,
        'KEEP_EXISTING',
      );

      expect(result.reviewStatus).toBe('APPROVED');
      expect(result.conflictResolution).toBe('KEEP_EXISTING');
      expect(capturedUpdateData.conflictResolution).toBe('KEEP_EXISTING');
    });

    // =======================================================================
    // Asia Alliance Bank QA Regression Scenario:
    // Existing: Operations Assistant, June 2023 - August 2023 (VERIFIED)
    // Imported: Operations Assistant, May 2023 - August 2023
    // =======================================================================
    describe('Asia Alliance Bank Conflict Resolutions', () => {
      const session = {
        id: 'session-qa-asia',
        userId: 'user-asadbek',
        sourceType: 'LINKEDIN_PDF',
        status: 'REVIEW_READY',
        storageKey: 'uploads/linkedin.pdf',
        documentId: 'doc-01',
      };

      it('Resolution 1: KEEP_EXISTING preserves original dates, zero duplicate rows, logs ALTERNATIVE_SOURCE_REVIEWED', async () => {
        const approvedConflictItem = {
          id: 'item-asia-conflict',
          sessionId: 'session-qa-asia',
          userId: 'user-asadbek',
          section: 'EXPERIENCE',
          classification: 'CONFLICT',
          confidenceScore: 0.9,
          sourceReference: 'Asia Alliance Bank Operations Assistant (May 2023 – August 2023)',
          extractedPayload: {
            organization: 'Asia Alliance Bank',
            position: 'Operations Assistant',
            startDate: 'May 2023',
            endDate: 'August 2023',
          },
          existingEntityId: 'exp-asia-original-01',
          existingPayload: {
            id: 'exp-asia-original-01',
            organization: 'Asia Alliance Bank',
            position: 'Operations Assistant',
            startDate: 'June 2023',
            endDate: 'August 2023',
            verificationStatus: 'VERIFIED',
          },
          conflictDetails: 'Date mismatch: June 2023 vs May 2023',
          reviewStatus: 'APPROVED',
          conflictResolution: 'KEEP_EXISTING',
          userEditedPayload: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const insertedExperiences: any[] = [];
        const updatedExperiences: any[] = [];
        const recordedAuditEvents: any[] = [];

        const mockTx: any = {
          insert: vi.fn((table: any) => ({
            values: vi.fn((vals) => {
              if (table._?.name === 'candidate_experiences' || table.organization) {
                insertedExperiences.push(vals);
              } else {
                recordedAuditEvents.push(vals);
              }
              return {
                returning: vi.fn().mockResolvedValue([{ id: 'new-id', ...vals }]),
              };
            }),
          })),
          update: vi.fn(() => ({
            set: vi.fn((vals) => {
              if (vals.organization || vals.position || vals.startDate) {
                updatedExperiences.push(vals);
              }
              return {
                where: vi.fn().mockResolvedValue([{}]),
              };
            }),
          })),
          query: {
            candidateFacts: {
              findMany: vi.fn().mockResolvedValue([]),
            },
          },
        };

        const mockDb: any = {
          query: {
            profileImportSessions: {
              findFirst: vi.fn().mockResolvedValue(session),
            },
            profileImportItems: {
              findMany: vi.fn().mockResolvedValue([approvedConflictItem]),
            },
          },
          transaction: vi.fn(async (callback) => callback(mockTx)),
          update: vi.fn(() => ({
            set: vi.fn(() => ({
              where: vi.fn().mockResolvedValue([{}]),
            })),
          })),
        };

        const candidateServiceMock: any = {
          getOverview: vi.fn().mockResolvedValue({
            completeness: {
              score: 95,
              level: 'EXCELLENT',
              isComplete: true,
              missingSections: [],
              suggestions: [],
              stats: { totalFields: 10, completedFields: 10, verifiedFields: 10 },
            },
          }),
          getCompleteness: vi.fn().mockResolvedValue({
            score: 95,
            level: 'EXCELLENT',
            isComplete: true,
            missingSections: [],
            suggestions: [],
            stats: { totalFields: 10, completedFields: 10, verifiedFields: 10 },
          }),
        };

        const service = new SmartProfileImportService(mockDb, {} as any, candidateServiceMock);

        const result = await service.commitSession('user-asadbek', 'session-qa-asia', {
          verifyOnCommit: true,
        });

        expect(result.sessionId).toBe('session-qa-asia');

        // ZERO rows inserted into candidate experiences!
        expect(insertedExperiences.length).toBe(0);
        // ZERO updates to existing candidate experiences (preserved original values)!
        expect(updatedExperiences.length).toBe(0);

        // Audit log records ALTERNATIVE_SOURCE_REVIEWED
        const alternativeAudit = recordedAuditEvents.find(
          (a) => a.action === 'ALTERNATIVE_SOURCE_REVIEWED',
        );
        expect(alternativeAudit).toBeDefined();
        expect(alternativeAudit.metadata.conflictResolution).toBe('KEEP_EXISTING');
        expect(alternativeAudit.entityId).toBe('exp-asia-original-01');
      });

      it('Resolution 2: REPLACE_EXISTING updates existing row, zero duplicate rows, preserves VERIFIED status', async () => {
        const approvedConflictItem = {
          id: 'item-asia-conflict',
          sessionId: 'session-qa-asia',
          userId: 'user-asadbek',
          section: 'EXPERIENCE',
          classification: 'CONFLICT',
          confidenceScore: 0.9,
          sourceReference: 'Asia Alliance Bank Operations Assistant (May 2023 – August 2023)',
          extractedPayload: {
            organization: 'Asia Alliance Bank',
            position: 'Operations Assistant',
            startDate: 'May 2023',
            endDate: 'August 2023',
          },
          existingEntityId: 'exp-asia-original-01',
          existingPayload: {
            id: 'exp-asia-original-01',
            organization: 'Asia Alliance Bank',
            position: 'Operations Assistant',
            startDate: 'June 2023',
            endDate: 'August 2023',
            verificationStatus: 'VERIFIED',
          },
          conflictDetails: 'Date mismatch: June 2023 vs May 2023',
          reviewStatus: 'APPROVED',
          conflictResolution: 'REPLACE_EXISTING',
          userEditedPayload: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const insertedExperiences: any[] = [];
        let updatedValues: any = null;
        const recordedAuditEvents: any[] = [];

        const mockTx: any = {
          insert: vi.fn((table: any) => ({
            values: vi.fn((vals) => {
              if (table._?.name === 'candidate_experiences' || table.organization) {
                insertedExperiences.push(vals);
              } else {
                recordedAuditEvents.push(vals);
              }
              return {
                returning: vi.fn().mockResolvedValue([{ id: 'new-id', ...vals }]),
              };
            }),
          })),
          update: vi.fn(() => ({
            set: vi.fn((vals) => {
              if (vals.startDate || vals.organization || vals.position) {
                updatedValues = vals;
              }
              return {
                where: vi.fn().mockResolvedValue([{}]),
              };
            }),
          })),
          query: {
            candidateFacts: {
              findMany: vi.fn().mockResolvedValue([
                {
                  id: 'fact-asia-01',
                  sourceEntityId: 'exp-asia-original-01',
                  structuredValue: { organization: 'Asia Alliance Bank', startDate: 'June 2023' },
                },
              ]),
            },
          },
        };

        const mockDb: any = {
          query: {
            profileImportSessions: {
              findFirst: vi.fn().mockResolvedValue(session),
            },
            profileImportItems: {
              findMany: vi.fn().mockResolvedValue([approvedConflictItem]),
            },
          },
          transaction: vi.fn(async (callback) => callback(mockTx)),
          update: vi.fn(() => ({
            set: vi.fn(() => ({
              where: vi.fn().mockResolvedValue([{}]),
            })),
          })),
        };

        const candidateServiceMock: any = {
          getOverview: vi.fn().mockResolvedValue({
            completeness: {
              score: 95,
              level: 'EXCELLENT',
              isComplete: true,
              missingSections: [],
              suggestions: [],
              stats: { totalFields: 10, completedFields: 10, verifiedFields: 10 },
            },
          }),
          getCompleteness: vi.fn().mockResolvedValue({
            score: 95,
            level: 'EXCELLENT',
            isComplete: true,
            missingSections: [],
            suggestions: [],
            stats: { totalFields: 10, completedFields: 10, verifiedFields: 10 },
          }),
        };

        const service = new SmartProfileImportService(mockDb, {} as any, candidateServiceMock);

        const result = await service.commitSession('user-asadbek', 'session-qa-asia', {
          verifyOnCommit: false, // User requested unverified, but existing record was VERIFIED!
        });

        expect(result.sessionId).toBe('session-qa-asia');

        // ZERO duplicate rows inserted!
        expect(insertedExperiences.length).toBe(0);

        // Updated existing row with new dates
        expect(updatedValues).toBeDefined();
        expect(updatedValues.startDate).toBe('May 2023');
        expect(updatedValues.endDate).toBe('August 2023');

        // VERIFIED status preserved without downgrade!
        expect(updatedValues.verificationStatus).toBe('VERIFIED');

        // Audit log records CONFLICT_RESOLVED_REPLACE
        const replaceAudit = recordedAuditEvents.find(
          (a) => a.action === 'CONFLICT_RESOLVED_REPLACE',
        );
        expect(replaceAudit).toBeDefined();
        expect(replaceAudit.entityId).toBe('exp-asia-original-01');
      });

      it('Resolution 3: ADD_AS_SEPARATE creates distinct separate row with explicit confirmation', async () => {
        const approvedConflictItem = {
          id: 'item-asia-conflict',
          sessionId: 'session-qa-asia',
          userId: 'user-asadbek',
          section: 'EXPERIENCE',
          classification: 'CONFLICT',
          confidenceScore: 0.9,
          sourceReference: 'Asia Alliance Bank Operations Assistant (May 2023 – August 2023)',
          extractedPayload: {
            organization: 'Asia Alliance Bank',
            position: 'Operations Assistant',
            startDate: 'May 2023',
            endDate: 'August 2023',
          },
          existingEntityId: 'exp-asia-original-01',
          existingPayload: {
            id: 'exp-asia-original-01',
            organization: 'Asia Alliance Bank',
            position: 'Operations Assistant',
            startDate: 'June 2023',
            endDate: 'August 2023',
          },
          conflictDetails: 'Date mismatch: June 2023 vs May 2023',
          reviewStatus: 'APPROVED',
          conflictResolution: 'ADD_AS_SEPARATE',
          userEditedPayload: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const insertedExperiences: any[] = [];
        const recordedAuditEvents: any[] = [];

        const mockTx: any = {
          insert: vi.fn((_table: any) => ({
            values: vi.fn((vals) => {
              if (vals.organization === 'Asia Alliance Bank') {
                insertedExperiences.push(vals);
              } else {
                recordedAuditEvents.push(vals);
              }
              return {
                returning: vi.fn().mockResolvedValue([{ id: 'new-separate-id', ...vals }]),
              };
            }),
          })),
          update: vi.fn(() => ({
            set: vi.fn(() => ({
              where: vi.fn().mockResolvedValue([{}]),
            })),
          })),
          query: {
            candidateFacts: {
              findMany: vi.fn().mockResolvedValue([]),
            },
            candidateExperiences: {
              findFirst: vi.fn().mockResolvedValue(null),
            },
          },
        };

        const mockDb: any = {
          query: {
            profileImportSessions: {
              findFirst: vi.fn().mockResolvedValue(session),
            },
            profileImportItems: {
              findMany: vi.fn().mockResolvedValue([approvedConflictItem]),
            },
          },
          transaction: vi.fn(async (callback) => callback(mockTx)),
          update: vi.fn(() => ({
            set: vi.fn(() => ({
              where: vi.fn().mockResolvedValue([{}]),
            })),
          })),
        };

        const candidateServiceMock: any = {
          getOverview: vi.fn().mockResolvedValue({
            completeness: {
              score: 95,
              level: 'EXCELLENT',
              isComplete: true,
              missingSections: [],
              suggestions: [],
              stats: { totalFields: 10, completedFields: 10, verifiedFields: 10 },
            },
          }),
          getCompleteness: vi.fn().mockResolvedValue({
            score: 95,
            level: 'EXCELLENT',
            isComplete: true,
            missingSections: [],
            suggestions: [],
            stats: { totalFields: 10, completedFields: 10, verifiedFields: 10 },
          }),
        };

        const service = new SmartProfileImportService(mockDb, {} as any, candidateServiceMock);

        const result = await service.commitSession('user-asadbek', 'session-qa-asia', {
          verifyOnCommit: true,
        });

        expect(result.sessionId).toBe('session-qa-asia');

        // Exactly one new separate row inserted!
        expect(insertedExperiences.length).toBe(1);
        expect(insertedExperiences[0].organization).toBe('Asia Alliance Bank');
        expect(insertedExperiences[0].startDate).toBe('May 2023');

        // Audit log records CONFLICT_RESOLVED_ADD_SEPARATE
        const separateAudit = recordedAuditEvents.find(
          (a) => a.action === 'CONFLICT_RESOLVED_ADD_SEPARATE',
        );
        expect(separateAudit).toBeDefined();
        expect(separateAudit.metadata.conflictResolution).toBe('ADD_AS_SEPARATE');
      });
    });
  });
});
