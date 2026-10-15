import { describe, it, expect } from 'vitest';
import { DocumentTextExtractor } from './document-text-extractor.js';
import { Document, Paragraph, TextRun, Packer } from 'docx';

describe('DocumentTextExtractor', () => {
  it('normalizes whitespace, unicode quotes, and line breaks properly', () => {
    const raw = `  John \u201CDoe\u201D\r\n\r\n\r\nSoftware \u2018Engineer\u2019 \u2013 London\u00A0UK  `;
    const normalized = DocumentTextExtractor.normalizeText(raw);

    expect(normalized).toBe(`John "Doe"\n\nSoftware 'Engineer' - London UK`);
  });

  it('extracts text from plain text buffers', async () => {
    const content = `Asadbek Makhmudov\nSenior Full Stack Engineer\nEmail: asadbek@example.com\n\nExperience:\nTech Corp (2021 - Present)\n- Built scalable systems`;
    const buffer = Buffer.from(content, 'utf-8');

    const result = await DocumentTextExtractor.extractText(buffer, 'resume.txt', 'text/plain');

    expect(result.detectedFormat).toBe('TXT');
    expect(result.charCount).toBeGreaterThan(50);
    expect(result.wordCount).toBeGreaterThan(10);
    expect(result.normalizedText).toContain('Asadbek Makhmudov');
    expect(result.normalizedText).toContain('Tech Corp');
  });

  it('extracts paragraphs cleanly from DOCX binary buffers', async () => {
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              children: [new TextRun({ text: 'Asadbek Makhmudov', bold: true })],
            }),
            new Paragraph({
              children: [new TextRun({ text: 'Full Stack Engineer & AI Specialist' })],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Experience: Senior Architect at Global Corp (2020 - 2024)' }),
              ],
            }),
          ],
        },
      ],
    });

    const docxBuffer = await Packer.toBuffer(doc);
    const result = await DocumentTextExtractor.extractText(
      docxBuffer,
      'candidate_cv.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );

    expect(result.detectedFormat).toBe('DOCX');
    expect(result.normalizedText).toContain('Asadbek Makhmudov');
    expect(result.normalizedText).toContain('Full Stack Engineer & AI Specialist');
    expect(result.normalizedText).toContain('Senior Architect at Global Corp');
  });

  it('rejects empty documents with an informative AppError', async () => {
    const emptyBuffer = Buffer.from('', 'utf-8');

    await expect(
      DocumentTextExtractor.extractText(emptyBuffer, 'empty.txt', 'text/plain'),
    ).rejects.toThrow('Unable to extract text from document');
  });
});
