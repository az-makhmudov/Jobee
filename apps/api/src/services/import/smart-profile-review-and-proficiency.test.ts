import { describe, it, expect } from 'vitest';
import { ProfileComparisonEngine } from './profile-comparison-engine.js';
import { SmartProfileExtractor } from './smart-profile-extractor.js';
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
      expect(compNoOrg.conflictDetails).toContain('issuing organization');
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
});
