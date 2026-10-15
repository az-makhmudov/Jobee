import { describe, it, expect, vi } from 'vitest';
import { ProfileComparisonEngine } from './profile-comparison-engine.js';
import { SmartProfileExtractor } from './smart-profile-extractor.js';
import { SmartProfileImportService } from './smart-profile-import-service.js';
import { calculateProfileCompleteness } from '@job-agent/shared';
import { createLanguageSchema, createSkillSchema } from '../../routes/candidate-schemas.js';
import { DocxGeneratorService } from '../docx-generator-service.js';
import { CandidateEvidenceResolver } from '../candidate-evidence-resolver.js';
import type { TailoredCv } from '@job-agent/shared';

describe('Smart Profile Import Review & Optional Proficiency (JOB-SMART-PROFILE-IMPORT)', () => {
  // =========================================================================
  // 1. OPTIONAL PROFICIENCY IN EXTRACTION & COMPARISON
  // =========================================================================
  describe('Optional Language & Skill Proficiency', () => {
    it('classifies language with null or omitted proficiency as NEW (never INCOMPLETE)', () => {
      const comparison = (ProfileComparisonEngine as any).compareLanguage(
        {
          language: 'Spanish',
          proficiency: null,
          sourceReference: 'Spanish',
          confidence: 0.9,
        },
        [],
      );

      expect(comparison.classification).toBe('NEW');
      expect(comparison.conflictDetails).toBeNull();
    });

    it('classifies language with explicit proficiency as NEW', () => {
      const comparison = (ProfileComparisonEngine as any).compareLanguage(
        {
          language: 'English',
          proficiency: 'Native',
          sourceReference: 'English (Native)',
          confidence: 0.95,
        },
        [],
      );

      expect(comparison.classification).toBe('NEW');
      expect(comparison.conflictDetails).toBeNull();
    });

    it('classifies skill with null or omitted proficiency as NEW (never INCOMPLETE)', () => {
      const comparison = (ProfileComparisonEngine as any).compareSkill(
        {
          name: 'PostgreSQL',
          proficiency: null,
          category: 'Databases',
          sourceReference: 'PostgreSQL',
          confidence: 0.85,
        },
        [],
      );

      expect(comparison.classification).toBe('NEW');
      expect(comparison.conflictDetails).toBeNull();
    });

    it('classifies skill with explicit proficiency as NEW', () => {
      const comparison = (ProfileComparisonEngine as any).compareSkill(
        {
          name: 'TypeScript',
          proficiency: 'Expert',
          category: 'Languages',
          sourceReference: 'TypeScript (Expert)',
          confidence: 0.9,
        },
        [],
      );

      expect(comparison.classification).toBe('NEW');
      expect(comparison.conflictDetails).toBeNull();
    });

    it('extracts null proficiency when document lists languages without proficiency', () => {
      const cvText = `
John Doe
Software Engineer

Languages:
English, French, German
`;
      const result = SmartProfileExtractor.extractWithHeuristics(cvText);
      expect(result.languages.length).toBe(3);
      for (const lang of result.languages) {
        expect(lang.proficiency).toBeNull();
      }
    });

    it('extracts explicit proficiency when document states it', () => {
      const cvText = `
John Doe
Software Engineer

Languages:
English (Native)
German (Fluent)
French (Conversational)
`;
      const result = SmartProfileExtractor.extractWithHeuristics(cvText);
      expect(result.languages.length).toBe(3);
      const en = result.languages.find((l) => l.language.toLowerCase() === 'english');
      const de = result.languages.find((l) => l.language.toLowerCase() === 'german');
      const fr = result.languages.find((l) => l.language.toLowerCase() === 'french');
      expect(en?.proficiency).toBe('Native');
      expect(de?.proficiency).toBe('Fluent');
      expect(fr?.proficiency).toBe('Conversational');
    });
  });

  // =========================================================================
  // 2. REQUIRED FIELDS & INCOMPLETE CLASSIFICATION ACROSS ALL 8 SECTIONS
  // =========================================================================
  describe('Section Required Field Validation & INCOMPLETE Detection', () => {
    it('marks EXPERIENCE without organization or startDate as INCOMPLETE', () => {
      const compNoOrg = (ProfileComparisonEngine as any).compareExperience(
        {
          position: 'Engineer',
          organization: '',
          startDate: '2022-01',
          sourceReference: 'Ref',
          confidence: 0.5,
        },
        [],
      );
      expect(compNoOrg.classification).toBe('INCOMPLETE');
      expect(compNoOrg.conflictDetails).toContain('organization');

      const compNoStart = (ProfileComparisonEngine as any).compareExperience(
        {
          position: 'Engineer',
          organization: 'Acme',
          startDate: '',
          sourceReference: 'Ref',
          confidence: 0.5,
        },
        [],
      );
      expect(compNoStart.classification).toBe('INCOMPLETE');
      expect(compNoStart.conflictDetails).toContain('start date');
    });

    it('marks EDUCATION without institution as INCOMPLETE', () => {
      const comp = (ProfileComparisonEngine as any).compareEducation(
        {
          institution: '',
          degree: 'BSc',
          sourceReference: 'Ref',
          confidence: 0.5,
        },
        [],
      );
      expect(comp.classification).toBe('INCOMPLETE');
      expect(comp.conflictDetails).toContain('institution');
    });

    it('marks SKILL without name as INCOMPLETE', () => {
      const comp = (ProfileComparisonEngine as any).compareSkill(
        {
          name: '',
          category: 'Tech',
          sourceReference: 'Ref',
          confidence: 0.5,
        },
        [],
      );
      expect(comp.classification).toBe('INCOMPLETE');
      expect(comp.conflictDetails).toContain('name');
    });

    it('marks CERTIFICATION without name or issuingOrganization as INCOMPLETE', () => {
      const compNoOrg = (ProfileComparisonEngine as any).compareCertification(
        {
          name: 'AWS Solutions Architect',
          issuingOrganization: '',
          sourceReference: 'Ref',
          confidence: 0.5,
        },
        [],
      );
      expect(compNoOrg.classification).toBe('INCOMPLETE');
      expect(compNoOrg.conflictDetails).toContain('Issuing organization is missing');
    });

    it('marks LANGUAGE without language name as INCOMPLETE', () => {
      const comp = (ProfileComparisonEngine as any).compareLanguage(
        {
          language: '',
          sourceReference: 'Ref',
          confidence: 0.5,
        },
        [],
      );
      expect(comp.classification).toBe('INCOMPLETE');
      expect(comp.conflictDetails).toContain('language');
    });

    it('marks PROJECT without name as INCOMPLETE', () => {
      const comp = (ProfileComparisonEngine as any).compareProject(
        {
          name: '',
          role: 'Architect',
          sourceReference: 'Ref',
          confidence: 0.5,
        },
        [],
      );
      expect(comp.classification).toBe('INCOMPLETE');
      expect(comp.conflictDetails).toContain('name');
    });

    it('marks LINK without url or label as INCOMPLETE', () => {
      const compNoUrl = (ProfileComparisonEngine as any).compareLink(
        {
          label: 'GitHub',
          url: '',
          sourceReference: 'Ref',
          confidence: 0.5,
        },
        [],
      );
      expect(compNoUrl.classification).toBe('INCOMPLETE');
      expect(compNoUrl.conflictDetails).toContain('URL');

      const compNoLabel = (ProfileComparisonEngine as any).compareLink(
        {
          label: '',
          url: 'https://github.com/example',
          sourceReference: 'Ref',
          confidence: 0.85,
        },
        [],
      );
      expect(compNoLabel.classification).toBe('INCOMPLETE');
      expect(compNoLabel.conflictDetails).toContain('label');
    });
  });

  // =========================================================================
  // 3. API SCHEMA VALIDATION FOR OPTIONAL PROFICIENCY
  // =========================================================================
  describe('API Schemas Accept Null/Omitted Proficiency', () => {
    it('accepts language without proficiency', () => {
      const parsed = createLanguageSchema.parse({
        language: 'Italian',
      });
      expect(parsed.language).toBe('Italian');
      expect(parsed.proficiency).toBeUndefined();
    });

    it('accepts language with null proficiency', () => {
      const parsed = createLanguageSchema.parse({
        language: 'Italian',
        proficiency: null,
      });
      expect(parsed.language).toBe('Italian');
      expect(parsed.proficiency).toBeNull();
    });

    it('accepts skill without proficiency', () => {
      const parsed = createSkillSchema.parse({
        name: 'Docker',
      });
      expect(parsed.name).toBe('Docker');
      expect(parsed.proficiency).toBeUndefined();
    });

    it('accepts skill with null proficiency', () => {
      const parsed = createSkillSchema.parse({
        name: 'Kubernetes',
        proficiency: null,
      });
      expect(parsed.name).toBe('Kubernetes');
      expect(parsed.proficiency).toBeNull();
    });
  });

  // =========================================================================
  // 4. PROFILE COMPLETENESS WITH OPTIONAL PROFICIENCY
  // =========================================================================
  describe('Profile Completeness Calculation', () => {
    it('treats languages and skills as satisfied without requiring proficiency', () => {
      const completeness = calculateProfileCompleteness({
        profile: {
          id: 'p1',
          userId: 'u1',
          fullName: 'Alex Mercer',
          preferredName: null,
          headline: 'Cloud Engineer',
          summary: 'Experienced cloud architect with 8+ years building platforms.',
          email: 'alex@example.com',
          phone: null,
          city: 'London',
          region: null,
          country: 'UK',
          availability: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        experiences: [
          {
            id: 'e1',
            userId: 'u1',
            organization: 'CloudCorp',
            position: 'Senior Engineer',
            location: 'London',
            employmentType: null,
            startDate: '2020-01',
            endDate: null,
            isCurrent: true,
            displayOrder: 0,
            description: null,
            achievements: [],
            verificationStatus: 'UNVERIFIED',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        education: [
          {
            id: 'edu1',
            userId: 'u1',
            institution: 'University of Oxford',
            degree: 'BSc Computer Science',
            fieldOfStudy: 'Computer Science',
            startDate: null,
            endDate: null,
            isCurrent: false,
            displayOrder: 0,
            location: null,
            description: null,
            activities: null,
            verificationStatus: 'UNVERIFIED',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        skills: [
          {
            id: 's1',
            userId: 'u1',
            name: 'Go',
            category: 'Backend',
            proficiency: null, // No proficiency specified!
            yearsExperience: null,
            isActive: true,
            verificationStatus: 'UNVERIFIED',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
          {
            id: 's2',
            userId: 'u1',
            name: 'TypeScript',
            category: 'Frontend',
            proficiency: null,
            yearsExperience: null,
            isActive: true,
            verificationStatus: 'UNVERIFIED',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
          {
            id: 's3',
            userId: 'u1',
            name: 'PostgreSQL',
            category: 'Database',
            proficiency: null,
            yearsExperience: null,
            isActive: true,
            verificationStatus: 'UNVERIFIED',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        languages: [
          {
            id: 'l1',
            userId: 'u1',
            language: 'English',
            proficiency: null, // No proficiency specified!
            cefrLevel: null,
            notes: null,
            verificationStatus: 'UNVERIFIED',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        documents: [],
        preferences: null,
      });

      const langCategory = completeness.categories.find((c) => c.category === 'languages');
      const skillCategory = completeness.categories.find((c) => c.category === 'skills');
      expect(langCategory?.completed).toBe(true);
      expect(skillCategory?.completed).toBe(true);
      expect(completeness.score).toBeGreaterThanOrEqual(70);
    });
  });

  // =========================================================================
  // 5. CLEAN FORMATTING IN DOCX GENERATION AND CONTEXT BUILDERS
  // =========================================================================
  describe('Document Generation & Context Formatting', () => {
    it('generates DOCX buffer for CV with null language proficiency without (null) string', async () => {
      const mockStorage = {
        saveFile: async () => ({
          storageKey: 'mock/path.docx',
          originalFilename: 'test.docx',
          sizeBytes: 1024,
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          sha256Checksum: 'mock',
        }),
      };
      const docxService = new DocxGeneratorService(mockStorage as any);

      const tailoredCv: TailoredCv = {
        header: {
          fullName: 'Jane Doe',
          headline: 'Architect',
          email: 'jane@example.com',
          links: [],
        },
        summary: 'Cloud specialist',
        experiences: [],
        education: [],
        skills: [
          { id: 's1', name: 'Rust', isHighlighted: false },
          { id: 's2', name: 'Go', isHighlighted: false },
        ],
        languages: [
          {
            id: 'lang-1',
            language: 'English',
            proficiencyLevel: null, // Null proficiency!
          },
          {
            id: 'lang-2',
            language: 'German',
            proficiencyLevel: 'Fluent',
            cefrLevel: 'C1',
          },
        ],
        certifications: [],
      } as any;

      const result = await docxService.generateTailoredCvDocx(tailoredCv, {
        packageId: 'pkg-1',
        versionNumber: 1,
        candidateName: 'Jane Doe',
        jobTitle: 'Architect',
      });

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.buffer.length).toBeGreaterThan(1000);
    });

    it('formats CandidateEvidenceResolver reason cleanly when proficiency is omitted', () => {
      const resolver = new CandidateEvidenceResolver();
      const matchResult = resolver.evaluateRequirement(
        {
          id: 'req-lang-1',
          jobId: 'job-1',
          category: 'LANGUAGE',
          rawText: 'Fluent in English',
          requirementStrength: 'MANDATORY',
          isMandatory: true,
          standardizedTerm: 'English',
        } as any,
        {
          userId: 'user-1',
          languages: [
            {
              id: 'l1',
              language: 'English',
              proficiency: null,
              cefrLevel: null,
            },
          ],
          evidenceMap: new Map([
            [
              'candidate_language:l1',
              { id: 'candidate_language:l1', type: 'language', label: 'Language: English' },
            ],
          ]),
        } as any,
      );

      expect(matchResult.status).toBe('MET');
      expect(matchResult.reason).toBe('Candidate proficient in English');
      expect(matchResult.reason).not.toContain('null');
      expect(matchResult.reason).not.toContain('undefined');
    });
  });

  // =========================================================================
  // 6. REVIEW APPROVAL SAFETY & COMMIT ISOLATION
  // =========================================================================
  describe('Review Approval Safety & Commit Isolation', () => {
    it('updateItem persists userEditedPayload without automatically approving the item', async () => {
      const existingItem = {
        id: 'item-1',
        sessionId: 'sess-1',
        userId: 'u1',
        section: 'EXPERIENCE',
        classification: 'NEW',
        confidenceScore: 0.9,
        sourceReference: 'Ref',
        extractedPayload: {
          organization: 'Acme',
          position: 'Dev',
          startDate: '2022-01',
        },
        existingEntityId: null,
        existingPayload: null,
        conflictDetails: null,
        reviewStatus: 'PENDING',
        userEditedPayload: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      let capturedUpdateData: any = null;

      const mockDb: any = {
        query: {
          profileImportItems: {
            findFirst: vi.fn().mockResolvedValue(existingItem),
          },
        },
        update: vi.fn(() => ({
          set: vi.fn((data) => {
            capturedUpdateData = data;
            return {
              where: vi.fn(() => ({
                returning: vi.fn().mockResolvedValue([
                  {
                    ...existingItem,
                    ...data,
                  },
                ]),
              })),
            };
          }),
        })),
      };

      const service = new SmartProfileImportService(mockDb, {} as any, {} as any);

      const result = await service.updateItem('u1', 'sess-1', 'item-1', 'EDITED', {
        organization: 'Acme Corp',
        position: 'Senior Engineer',
        startDate: '2022-01',
      });

      // Status is EDITED (NOT APPROVED)
      expect(result.reviewStatus).toBe('EDITED');
      expect(capturedUpdateData.reviewStatus).toBe('EDITED');
      // userEditedPayload is persisted
      expect(capturedUpdateData.userEditedPayload).toEqual({
        organization: 'Acme Corp',
        position: 'Senior Engineer',
        startDate: '2022-01',
      });
    });

    it('updateItem preserves userEditedPayload when explicitly approving an edited item', async () => {
      const existingEditedItem = {
        id: 'item-1',
        sessionId: 'sess-1',
        userId: 'u1',
        section: 'EXPERIENCE',
        classification: 'NEW',
        confidenceScore: 0.9,
        sourceReference: 'Ref',
        extractedPayload: {
          organization: 'Acme',
          position: 'Dev',
          startDate: '2022-01',
        },
        existingEntityId: null,
        existingPayload: null,
        conflictDetails: null,
        reviewStatus: 'EDITED',
        userEditedPayload: {
          organization: 'Acme Corp',
          position: 'Senior Engineer',
          startDate: '2022-01',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      let capturedUpdateData: any = null;

      const mockDb: any = {
        query: {
          profileImportItems: {
            findFirst: vi.fn().mockResolvedValue(existingEditedItem),
          },
        },
        update: vi.fn(() => ({
          set: vi.fn((data) => {
            capturedUpdateData = data;
            return {
              where: vi.fn(() => ({
                returning: vi.fn().mockResolvedValue([
                  {
                    ...existingEditedItem,
                    ...data,
                  },
                ]),
              })),
            };
          }),
        })),
      };

      const service = new SmartProfileImportService(mockDb, {} as any, {} as any);

      // User clicks Accept: action is 'APPROVED', userEditedPayload is undefined
      const result = await service.updateItem('u1', 'sess-1', 'item-1', 'APPROVED');

      expect(result.reviewStatus).toBe('APPROVED');
      expect(capturedUpdateData.reviewStatus).toBe('APPROVED');
      // Crucial: userEditedPayload was NOT overwritten with undefined or null
      expect(capturedUpdateData.userEditedPayload).toBeUndefined();
    });

    it('commitSession commits ONLY items with reviewStatus === APPROVED and ignores EDITED/PENDING items', async () => {
      const mockSession = {
        id: 'sess-1',
        userId: 'u1',
        status: 'REVIEW_READY',
        sourceType: 'CV',
        documentId: null,
      };

      // In this session, item-1 was EDITED (not approved), item-2 was APPROVED, item-3 was PENDING
      const approvedOnlyItem = {
        id: 'item-2',
        sessionId: 'sess-1',
        userId: 'u1',
        section: 'SKILL',
        classification: 'NEW',
        reviewStatus: 'APPROVED',
        extractedPayload: { name: 'PostgreSQL', category: 'Database', proficiency: null },
        userEditedPayload: null,
        existingEntityId: null,
        existingPayload: null,
      };

      let insertedSkill: any = null;

      const mockDb: any = {
        query: {
          profileImportSessions: {
            findFirst: vi.fn().mockResolvedValue(mockSession),
          },
          profileImportItems: {
            findMany: vi.fn(() => {
              // Simulating DB filtering: returns only APPROVED items
              return [approvedOnlyItem];
            }),
          },
        },
        transaction: vi.fn(async (cb) => {
          const tx: any = {
            query: {
              candidateSkills: {
                findFirst: vi.fn().mockResolvedValue(null),
              },
            },
            insert: vi.fn(() => ({
              values: vi.fn((val) => {
                if (val.name) {
                  insertedSkill = val;
                }
                return {
                  returning: vi.fn().mockResolvedValue([val]),
                };
              }),
            })),
            update: vi.fn(() => ({
              set: vi.fn(() => ({
                where: vi.fn().mockResolvedValue({}),
              })),
            })),
          };
          return cb(tx);
        }),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn().mockResolvedValue({}),
          })),
        })),
      };

      const service = new SmartProfileImportService(mockDb, {} as any, {} as any);
      (service as any).candidateService = {
        getOverview: vi.fn().mockResolvedValue({ completeness: { score: 100 } }),
      };
      // Mock internal recordAuditTx and loadExistingCandidateBrain
      (service as any).recordAuditTx = vi.fn().mockResolvedValue(undefined);
      (service as any).loadExistingCandidateBrain = vi.fn().mockResolvedValue({
        profile: null,
        experiences: [],
        education: [],
        skills: [{ id: 's1', name: 'PostgreSQL' }],
        certifications: [],
        languages: [],
        documents: [],
        preferences: null,
      });

      const commitResult = await service.commitSession('u1', 'sess-1', { verifyOnCommit: false });

      expect(commitResult.sessionId).toBe('sess-1');
      expect(commitResult.committedCounts.skillsCreated).toBe(1);
      // Only the approved item was inserted
      expect(insertedSkill?.name).toBe('PostgreSQL');
    });

    it('commitSession throws 400 Bad Request when session contains only EDITED or PENDING items', async () => {
      const mockSession = {
        id: 'sess-1',
        userId: 'u1',
        status: 'REVIEW_READY',
        sourceType: 'CV',
      };

      const mockDb: any = {
        query: {
          profileImportSessions: {
            findFirst: vi.fn().mockResolvedValue(mockSession),
          },
          profileImportItems: {
            // No APPROVED items in database query
            findMany: vi.fn().mockResolvedValue([]),
          },
        },
      };

      const service = new SmartProfileImportService(mockDb, {} as any, {} as any);

      await expect(service.commitSession('u1', 'sess-1')).rejects.toThrow(
        'No approved items found to commit',
      );
    });

    it('commitSession preserves existing verified record when matched item is approved without edits', async () => {
      const mockSession = {
        id: 'sess-1',
        userId: 'u1',
        status: 'REVIEW_READY',
        sourceType: 'CV',
      };

      const uneditedMatchedItem = {
        id: 'item-match-1',
        sessionId: 'sess-1',
        userId: 'u1',
        section: 'EXPERIENCE',
        classification: 'MATCHED',
        reviewStatus: 'APPROVED',
        extractedPayload: { organization: 'Revolut', position: 'PM', startDate: '2023-01' },
        userEditedPayload: null, // NO edits!
        existingEntityId: 'exp-revolut-123',
        existingPayload: {
          id: 'exp-revolut-123',
          organization: 'Revolut',
          position: 'PM',
          startDate: '2023-01',
          verificationStatus: 'VERIFIED',
        },
      };

      let candidateExperienceUpdated = false;

      const mockDb: any = {
        query: {
          profileImportSessions: {
            findFirst: vi.fn().mockResolvedValue(mockSession),
          },
          profileImportItems: {
            findMany: vi.fn().mockResolvedValue([uneditedMatchedItem]),
          },
        },
        transaction: vi.fn(async (cb) => {
          const tx: any = {
            update: vi.fn(() => ({
              set: vi.fn((setVal: any) => {
                if (setVal.organization) {
                  candidateExperienceUpdated = true;
                }
                return { where: vi.fn().mockResolvedValue({}) };
              }),
            })),
            insert: vi.fn(),
          };
          return cb(tx);
        }),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn().mockResolvedValue({}),
          })),
        })),
      };

      const service = new SmartProfileImportService(mockDb, {} as any, {} as any);
      (service as any).candidateService = {
        getOverview: vi.fn().mockResolvedValue({ completeness: { score: 100 } }),
      };
      (service as any).loadExistingCandidateBrain = vi.fn().mockResolvedValue({
        profile: null,
        experiences: [uneditedMatchedItem.existingPayload],
        education: [],
        skills: [],
        certifications: [],
        languages: [],
        documents: [],
        preferences: null,
      });

      await service.commitSession('u1', 'sess-1');

      // The unedited matched record must NOT be updated or re-inserted!
      expect(candidateExperienceUpdated).toBe(false);
    });

    it('commitSession updates matched record and preserves VERIFIED status when user explicitly edits and approves it', async () => {
      const mockSession = {
        id: 'sess-1',
        userId: 'u1',
        status: 'REVIEW_READY',
        sourceType: 'CV',
      };

      const editedMatchedItem = {
        id: 'item-match-1',
        sessionId: 'sess-1',
        userId: 'u1',
        section: 'EXPERIENCE',
        classification: 'MATCHED',
        reviewStatus: 'APPROVED',
        extractedPayload: { organization: 'Revolut', position: 'PM', startDate: '2023-01' },
        userEditedPayload: {
          organization: 'Revolut Ltd',
          position: 'Senior Associate PM',
          startDate: '2023-01',
          description: 'Updated responsibilities',
        },
        existingEntityId: 'exp-revolut-123',
        existingPayload: {
          id: 'exp-revolut-123',
          organization: 'Revolut',
          position: 'PM',
          startDate: '2023-01',
          verificationStatus: 'VERIFIED',
        },
      };

      let capturedUpdateSet: any = null;

      const mockDb: any = {
        query: {
          profileImportSessions: {
            findFirst: vi.fn().mockResolvedValue(mockSession),
          },
          profileImportItems: {
            findMany: vi.fn().mockResolvedValue([editedMatchedItem]),
          },
        },
        transaction: vi.fn(async (cb) => {
          const tx: any = {
            update: vi.fn(() => ({
              set: vi.fn((setVal: any) => {
                if (setVal.organization) {
                  capturedUpdateSet = setVal;
                }
                return {
                  where: vi.fn().mockResolvedValue({}),
                };
              }),
            })),
          };
          return cb(tx);
        }),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn().mockResolvedValue({}),
          })),
        })),
      };

      const service = new SmartProfileImportService(mockDb, {} as any, {} as any);
      (service as any).candidateService = {
        getOverview: vi.fn().mockResolvedValue({ completeness: { score: 100 } }),
      };
      (service as any).recordAuditTx = vi.fn().mockResolvedValue(undefined);
      (service as any).loadExistingCandidateBrain = vi.fn().mockResolvedValue({
        profile: null,
        experiences: [editedMatchedItem.existingPayload],
        education: [],
        skills: [],
        certifications: [],
        languages: [],
        documents: [],
        preferences: null,
      });

      // Even if verifyOnCommit is false:
      await service.commitSession('u1', 'sess-1', { verifyOnCommit: false });

      expect(capturedUpdateSet).toBeDefined();
      expect(capturedUpdateSet.organization).toBe('Revolut Ltd');
      expect(capturedUpdateSet.position).toBe('Senior Associate PM');
      // Crucial: existing verified status is preserved (never downgraded to UNVERIFIED!)
      expect(capturedUpdateSet.verificationStatus).toBe('VERIFIED');
    });
  });
});
