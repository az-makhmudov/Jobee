import { describe, it, expect } from 'vitest';
import { DocumentTextExtractor } from './document-text-extractor.js';
import { SmartProfileExtractor } from './smart-profile-extractor.js';
import { ProfileComparisonEngine } from './profile-comparison-engine.js';
import { commitProfileImportSchema } from '../../routes/candidate-import-schemas.js';
import JSZip from 'jszip';

describe('Smart Profile Import Hardening Regressions (JOB-SMART-PROFILE-IMPORT)', () => {
  // =========================================================================
  // ISSUE 1: No invented fallback values; missing required data triggers INCOMPLETE
  // =========================================================================
  describe('Issue 1: Truthfulness & No Invented Fallback Values', () => {
    it('does not invent fabricated dates ("2020") or generic placeholders ("Organization", "Professional Role")', () => {
      const textWithoutDatesOrOrg = `
Work Experience
Software Engineer
• Built distributed systems and APIs.
• Reduced latency by 20%.

Certifications
AWS Certified Solutions Architect
`;
      const result = SmartProfileExtractor.extractWithHeuristics(textWithoutDatesOrOrg);

      // Verify no fabricated "2020" employment dates
      for (const exp of result.experiences) {
        expect(exp.startDate).not.toBe('2020');
        expect(exp.organization).not.toBe('Organization');
        expect(exp.position).not.toBe('Professional Role');
      }

      // Verify no fabricated "Organization" in certifications
      for (const cert of result.certifications) {
        expect(cert.issuingOrganization).not.toBe('Organization');
        expect(cert.issuingOrganization).toBe('');
      }
    });

    it('classifies experiences with missing startDate or organization as INCOMPLETE', () => {
      const comparison = ProfileComparisonEngine.compare(
        {
          profile: null,
          experiences: [
            {
              organization: 'Acme Corp',
              position: 'Staff Engineer',
              startDate: '', // Missing start date!
              isCurrent: true,
              confidence: 0.8,
              sourceReference: 'Acme Corp',
            },
            {
              organization: '', // Missing organization!
              position: 'Staff Engineer',
              startDate: '2021-01',
              isCurrent: true,
              confidence: 0.8,
              sourceReference: 'Staff Engineer',
            },
          ],
          education: [],
          skills: [],
          certifications: [],
          languages: [],
          projects: [],
          links: [],
        },
        {
          profile: null,
          experiences: [],
          education: [],
          skills: [],
          certifications: [],
          languages: [],
          projects: [],
          links: [],
        },
      );

      expect(comparison).toHaveLength(2);
      expect(comparison[0]?.classification).toBe('INCOMPLETE');
      expect(comparison[0]?.conflictDetails).toContain('Missing required experience fields');
      expect(comparison[1]?.classification).toBe('INCOMPLETE');
      expect(comparison[1]?.conflictDetails).toContain('Missing required experience fields');
    });

    it('classifies certifications with missing issuing organization as INCOMPLETE', () => {
      const comparison = ProfileComparisonEngine.compare(
        {
          profile: null,
          experiences: [],
          education: [],
          skills: [],
          certifications: [
            {
              name: 'CKA - Certified Kubernetes Administrator',
              issuingOrganization: '', // Missing issuing organization!
              confidence: 0.8,
              sourceReference: 'CKA',
            },
          ],
          languages: [],
          projects: [],
          links: [],
        },
        {
          profile: null,
          experiences: [],
          education: [],
          skills: [],
          certifications: [],
          languages: [],
          projects: [],
          links: [],
        },
      );

      expect(comparison).toHaveLength(1);
      expect(comparison[0]?.classification).toBe('INCOMPLETE');
      expect(comparison[0]?.conflictDetails).toContain(
        'Missing certification name or issuing organization',
      );
    });
  });

  // =========================================================================
  // ISSUE 2: Duplicate and matched records are not re-inserted
  // =========================================================================
  describe('Issue 2: Deduplication and Matched Entity Handling', () => {
    it('correctly classifies existing verified experiences and skills as MATCHED / DUPLICATE', () => {
      const comparison = ProfileComparisonEngine.compare(
        {
          profile: null,
          experiences: [
            {
              organization: 'Google',
              position: 'Senior Software Engineer',
              startDate: '2021-01',
              endDate: '2023-12',
              isCurrent: false,
              confidence: 0.95,
              sourceReference: 'Senior Software Engineer at Google',
            },
          ],
          education: [],
          skills: [
            { name: 'TypeScript', confidence: 0.95, sourceReference: 'TypeScript' },
            { name: 'Node.js', confidence: 0.95, sourceReference: 'Node.js' },
          ],
          certifications: [],
          languages: [],
          projects: [],
          links: [],
        },
        {
          profile: null,
          experiences: [
            {
              id: 'exp-123',
              userId: 'user-1',
              organization: 'Google LLC',
              position: 'Senior Software Engineer',
              location: 'Munich',
              employmentType: 'FULL_TIME',
              startDate: '2021-01',
              endDate: '2023-12',
              isCurrent: false,
              description: 'Cloud infrastructure',
              achievements: [],
              verificationStatus: 'VERIFIED',
              displayOrder: 0,
              createdAt: '2026-01-01T00:00:00Z',
              updatedAt: '2026-01-01T00:00:00Z',
            },
          ],
          education: [],
          skills: [
            {
              id: 'skill-ts',
              userId: 'user-1',
              name: 'TypeScript',
              category: 'Languages',
              proficiency: 'EXPERT',
              yearsExperience: 8,
              verificationStatus: 'VERIFIED',
              isActive: true,
              createdAt: '2026-01-01T00:00:00Z',
              updatedAt: '2026-01-01T00:00:00Z',
            },
          ],
          certifications: [],
          languages: [],
          projects: [],
          links: [],
        },
      );

      const expResult = comparison.find((c) => c.section === 'EXPERIENCE');
      expect(expResult?.classification).toBe('MATCHED');
      expect(expResult?.existingEntityId).toBe('exp-123');

      const tsResult = comparison.find(
        (c) => c.section === 'SKILL' && c.extractedPayload.name === 'TypeScript',
      );
      expect(tsResult?.classification).toBe('MATCHED');
      expect(tsResult?.existingEntityId).toBe('skill-ts');

      const nodeResult = comparison.find(
        (c) => c.section === 'SKILL' && c.extractedPayload.name === 'Node.js',
      );
      expect(nodeResult?.classification).toBe('NEW');
    });
  });

  // =========================================================================
  // ISSUE 3: allowAiUse=true requires verificationStatus=VERIFIED
  // =========================================================================
  describe('Issue 3: Invariant allowAiUse=true requires verificationStatus=VERIFIED', () => {
    it('Zod schema rejects allowAiOnCommit: true when verifyOnCommit: false', () => {
      const invalid = {
        verifyOnCommit: false,
        allowAiOnCommit: true,
      };

      const result = commitProfileImportSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]?.message).toContain(
          'allowAiUse=true requires verificationStatus=VERIFIED',
        );
      }
    });

    it('Zod schema accepts allowAiOnCommit: true when verifyOnCommit: true', () => {
      const valid = {
        verifyOnCommit: true,
        allowAiOnCommit: true,
      };

      const result = commitProfileImportSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('Zod schema accepts verifyOnCommit: false when allowAiOnCommit: false', () => {
      const valid = {
        verifyOnCommit: false,
        allowAiOnCommit: false,
      };

      const result = commitProfileImportSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });

  // =========================================================================
  // ISSUE 5: Verify source references against document text
  // =========================================================================
  describe('Issue 5: Verification of Provenance Source References Against Document Text', () => {
    const documentText = `
John Doe
Principal Software Engineer at CloudCorp Berlin (2020-03 - Present)
Architected distributed payment rails in Go and Rust handling 100k TPS.
Master of Science from Technical University of Munich (2018).
AWS Certified Solutions Architect - Professional.
Fluent in English and German.
`;

    it('verifies verbatim and near-verbatim quotes found in document text', () => {
      expect(
        SmartProfileExtractor.verifySourceReference(
          'Principal Software Engineer at CloudCorp',
          documentText,
        ),
      ).toBe(true);
      expect(
        SmartProfileExtractor.verifySourceReference('Technical University of Munich', documentText),
      ).toBe(true);
      expect(
        SmartProfileExtractor.verifySourceReference(
          'AWS Certified Solutions Architect',
          documentText,
        ),
      ).toBe(true);
    });

    it('rejects hallucinated citations that do not exist in the document text', () => {
      expect(
        SmartProfileExtractor.verifySourceReference(
          'Vice President of Engineering at Meta',
          documentText,
        ),
      ).toBe(false);
      expect(
        SmartProfileExtractor.verifySourceReference(
          'Doctor of Philosophy from Harvard University',
          documentText,
        ),
      ).toBe(false);
      expect(SmartProfileExtractor.verifySourceReference('', documentText)).toBe(false);
      expect(SmartProfileExtractor.verifySourceReference(null, documentText)).toBe(false);
    });

    it('ProfileComparisonEngine classifies unverified citations as LOW_CONFIDENCE', () => {
      const comparison = ProfileComparisonEngine.compare(
        {
          profile: null,
          experiences: [
            {
              organization: 'Meta',
              position: 'VP of Engineering',
              startDate: '2020-01',
              isCurrent: true,
              confidence: 0.35,
              sourceReference: '[Unverified citation] VP at Meta',
            },
          ],
          education: [],
          skills: [],
          certifications: [],
          languages: [],
          projects: [],
          links: [],
        },
        {
          profile: null,
          experiences: [],
          education: [],
          skills: [],
          certifications: [],
          languages: [],
          projects: [],
          links: [],
        },
      );

      expect(comparison).toHaveLength(1);
      expect(comparison[0]?.classification).toBe('LOW_CONFIDENCE');
      expect(comparison[0]?.conflictDetails).toContain('Source citation could not be verified');
    });
  });

  // =========================================================================
  // ISSUE 6: Unsupported archive formats fail clearly
  // =========================================================================
  describe('Issue 6: Unsupported Archive & Binary Document Detection', () => {
    it('rejects tar and gzip archives with descriptive error', async () => {
      const gzipHeader = Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00]);
      await expect(
        DocumentTextExtractor.extractText(gzipHeader, 'export.tar.gz', 'application/gzip'),
      ).rejects.toThrow(/Unsupported archive format/);
    });

    it('rejects 7z archives with descriptive error', async () => {
      const sevenZipHeader = Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]);
      await expect(
        DocumentTextExtractor.extractText(
          sevenZipHeader,
          'profile.7z',
          'application/x-7z-compressed',
        ),
      ).rejects.toThrow(/Unsupported archive format/);
    });

    it('rejects RAR archives with descriptive error', async () => {
      const rarHeader = Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07]);
      await expect(
        DocumentTextExtractor.extractText(rarHeader, 'profile.rar', 'application/x-rar-compressed'),
      ).rejects.toThrow(/Unsupported archive format/);
    });

    it('rejects random binary non-text buffers with descriptive error', async () => {
      // 500 bytes of arbitrary binary bytes containing null bytes
      const binaryBuf = Buffer.alloc(500);
      for (let i = 0; i < 500; i++) {
        binaryBuf[i] = i % 256;
      }
      expect(DocumentTextExtractor.isBinaryBuffer(binaryBuf)).toBe(true);

      await expect(
        DocumentTextExtractor.extractText(
          binaryBuf,
          'corrupted_file.bin',
          'application/octet-stream',
        ),
      ).rejects.toThrow(/Unsupported or binary document format/);
    });

    it('rejects non-LinkedIn ZIP archives that are neither DOCX nor LinkedIn export', async () => {
      const arbitraryZip = new JSZip();
      arbitraryZip.file('random_file.txt', 'Hello world');
      arbitraryZip.file('image.png', Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      const zipBuffer = await arbitraryZip.generateAsync({ type: 'nodebuffer' });

      await expect(
        DocumentTextExtractor.extractText(zipBuffer, 'archive.zip', 'application/zip'),
      ).rejects.toThrow(/Unsupported ZIP archive format/);
    });

    it('successfully extracts LinkedIn ZIP archives containing Positions.csv and Profile.csv', async () => {
      const linkedInZip = new JSZip();
      linkedInZip.file(
        'Profile.csv',
        'First Name,Last Name,Headline\nAsadbek,Makhmudov,Staff Engineer\n',
      );
      linkedInZip.file(
        'Positions.csv',
        'Company Name,Title,Started On\nAcme Corp,Tech Lead,Jan 2021\n',
      );
      const zipBuffer = await linkedInZip.generateAsync({ type: 'nodebuffer' });

      const extracted = await DocumentTextExtractor.extractText(
        zipBuffer,
        'Basic_LinkedInDataExport_10-15-2026.zip',
        'application/zip',
      );

      expect(extracted.detectedFormat).toBe('CSV');
      expect(extracted.normalizedText).toContain('Profile.csv');
      expect(extracted.normalizedText).toContain('Asadbek');
      expect(extracted.normalizedText).toContain('Positions.csv');
      expect(extracted.normalizedText).toContain('Acme Corp');
    });
  });
});
