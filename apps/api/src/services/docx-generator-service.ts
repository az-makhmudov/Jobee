import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import type { TailoredCv, FileStorageProvider, StorageObjectMetadata } from '@job-agent/shared';
import { AppError } from '@job-agent/shared';

export class DocxGeneratorService {
  constructor(private readonly storage: FileStorageProvider) {}

  /**
   * Generates a clean, ATS-compliant single-column DOCX CV document.
   */
  public async generateTailoredCvDocx(
    cv: TailoredCv,
    options: {
      packageId: string;
      versionNumber: number;
      candidateName: string;
      jobTitle: string;
    },
  ): Promise<{ metadata: StorageObjectMetadata; buffer: Buffer }> {
    try {
      const docChildren: Paragraph[] = [];

      // 1. Header: Full Name
      docChildren.push(
        new Paragraph({
          text: cv.header.fullName || options.candidateName,
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
        }),
      );

      // Headline (if present)
      if (cv.header.headline) {
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: cv.header.headline,
                italics: true,
                size: 22, // 11pt
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
          }),
        );
      }

      // Contact Line: Email | Phone | Location | Links
      const contactItems: string[] = [];
      if (cv.header.email) contactItems.push(cv.header.email);
      if (cv.header.phone) contactItems.push(cv.header.phone);
      if (cv.header.location) contactItems.push(cv.header.location);
      if (cv.header.links && cv.header.links.length > 0) {
        contactItems.push(...cv.header.links.map((l) => `${l.label}: ${l.url}`));
      }

      if (contactItems.length > 0) {
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: contactItems.join('  •  '),
                size: 18, // 9pt
                color: '555555',
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 250 },
          }),
        );
      }

      // 2. Professional Summary
      if (cv.summary && cv.summary.trim()) {
        docChildren.push(
          new Paragraph({
            text: 'PROFESSIONAL SUMMARY',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
          }),
        );
        docChildren.push(
          new Paragraph({
            children: [new TextRun({ text: cv.summary.trim(), size: 20 })],
            spacing: { after: 200 },
          }),
        );
      }

      // 3. Work Experience
      if (cv.experiences && cv.experiences.length > 0) {
        docChildren.push(
          new Paragraph({
            text: 'EXPERIENCE',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
          }),
        );

        for (const exp of cv.experiences) {
          const dateRange = `${exp.startDate} - ${exp.isCurrent ? 'Present' : exp.endDate || 'Present'}`;
          const locStr = exp.location ? ` | ${exp.location}` : '';

          // Role Title & Organization
          docChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: exp.title,
                  bold: true,
                  size: 21,
                }),
                new TextRun({
                  text: ` — ${exp.organization}${locStr}`,
                  size: 20,
                }),
              ],
              spacing: { before: 120, after: 40 },
            }),
          );

          // Dates
          docChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: dateRange,
                  italics: true,
                  size: 18,
                  color: '666666',
                }),
              ],
              spacing: { after: 80 },
            }),
          );

          // Bullets
          if (exp.bullets && exp.bullets.length > 0) {
            for (const bullet of exp.bullets) {
              docChildren.push(
                new Paragraph({
                  bullet: { level: 0 },
                  children: [new TextRun({ text: bullet.text, size: 20 })],
                  spacing: { after: 50 },
                }),
              );
            }
          }
        }
      }

      // 4. Skills
      if (cv.skills && cv.skills.length > 0) {
        docChildren.push(
          new Paragraph({
            text: 'SKILLS',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
          }),
        );

        const skillNames = cv.skills.map((s) => s.name);
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: skillNames.join(', '),
                size: 20,
              }),
            ],
            spacing: { after: 150 },
          }),
        );
      }

      // 5. Education
      if (cv.education && cv.education.length > 0) {
        docChildren.push(
          new Paragraph({
            text: 'EDUCATION',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
          }),
        );

        for (const edu of cv.education) {
          const dateRange = edu.startDate ? `${edu.startDate} - ${edu.endDate || 'Present'}` : '';
          const degreeLine = edu.fieldOfStudy ? `${edu.degree} in ${edu.fieldOfStudy}` : edu.degree;

          docChildren.push(
            new Paragraph({
              children: [
                new TextRun({ text: degreeLine, bold: true, size: 20 }),
                new TextRun({ text: ` — ${edu.institution}`, size: 20 }),
              ],
              spacing: { before: 100, after: 40 },
            }),
          );

          if (dateRange) {
            docChildren.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: dateRange,
                    italics: true,
                    size: 18,
                    color: '666666',
                  }),
                ],
                spacing: { after: 80 },
              }),
            );
          }
        }
      }

      // 6. Languages
      if (cv.languages && cv.languages.length > 0) {
        docChildren.push(
          new Paragraph({
            text: 'LANGUAGES',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
          }),
        );

        const langItems = cv.languages.map(
          (l) => `${l.language} (${l.proficiencyLevel}${l.cefrLevel ? `, ${l.cefrLevel}` : ''})`,
        );

        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: langItems.join('  •  '),
                size: 20,
              }),
            ],
            spacing: { after: 150 },
          }),
        );
      }

      // 7. Certifications
      if (cv.certifications && cv.certifications.length > 0) {
        docChildren.push(
          new Paragraph({
            text: 'CERTIFICATIONS',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
          }),
        );

        for (const cert of cv.certifications) {
          docChildren.push(
            new Paragraph({
              children: [
                new TextRun({ text: cert.name, bold: true, size: 20 }),
                new TextRun({
                  text: ` (${cert.issuer}${cert.issueDate ? `, ${cert.issueDate}` : ''})`,
                  size: 20,
                }),
              ],
              spacing: { after: 60 },
            }),
          );
        }
      }

      // Create Document
      const doc = new Document({
        sections: [
          {
            properties: {
              page: {
                margin: {
                  top: 1440, // 1 inch
                  right: 1440,
                  bottom: 1440,
                  left: 1440,
                },
              },
            },
            children: docChildren,
          },
        ],
      });

      const buffer = await Packer.toBuffer(doc);

      const safeCandidateName = (
        cv.header.fullName ||
        options.candidateName ||
        'Candidate'
      ).replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeJobTitle = (options.jobTitle || 'Role').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${safeCandidateName}_CV_${safeJobTitle}_v${options.versionNumber}.docx`;

      const metadata = await this.storage.saveFile(buffer, {
        originalFilename: filename,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      return { metadata, buffer };
    } catch (err) {
      throw AppError.internal(
        `Failed to generate CV DOCX: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Generates a clean ATS-friendly cover letter DOCX document.
   */
  public async generateCoverLetterDocx(
    coverLetterText: string,
    options: {
      packageId: string;
      versionNumber: number;
      candidateName: string;
      jobTitle: string;
      company: string;
    },
  ): Promise<{ metadata: StorageObjectMetadata; buffer: Buffer }> {
    try {
      const docChildren: Paragraph[] = [];

      // Header: Candidate Name
      docChildren.push(
        new Paragraph({
          text: options.candidateName,
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
      );

      // Date
      const todayStr = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      docChildren.push(
        new Paragraph({
          children: [new TextRun({ text: todayStr, size: 20 })],
          spacing: { after: 200 },
        }),
      );

      // Recipient / Company
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: `Hiring Team at ${options.company}`, bold: true, size: 20 }),
          ],
          spacing: { after: 50 },
        }),
      );
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: `Application for: ${options.jobTitle}`, italics: true, size: 20 }),
          ],
          spacing: { after: 300 },
        }),
      );

      // Paragraphs
      const paragraphs = coverLetterText
        .split('\n\n')
        .map((p) => p.trim())
        .filter(Boolean);

      for (const pText of paragraphs) {
        docChildren.push(
          new Paragraph({
            children: [new TextRun({ text: pText, size: 20 })],
            spacing: { after: 200 },
          }),
        );
      }

      // Document
      const doc = new Document({
        sections: [
          {
            properties: {
              page: {
                margin: {
                  top: 1440,
                  right: 1440,
                  bottom: 1440,
                  left: 1440,
                },
              },
            },
            children: docChildren,
          },
        ],
      });

      const buffer = await Packer.toBuffer(doc);

      const safeCandidateName = (options.candidateName || 'Candidate').replace(
        /[^a-zA-Z0-9_-]/g,
        '_',
      );
      const safeCompany = (options.company || 'Company').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${safeCandidateName}_CoverLetter_${safeCompany}_v${options.versionNumber}.docx`;

      const metadata = await this.storage.saveFile(buffer, {
        originalFilename: filename,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      return { metadata, buffer };
    } catch (err) {
      throw AppError.internal(
        `Failed to generate Cover Letter DOCX: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
