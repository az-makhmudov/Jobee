import JSZip from 'jszip';
import { AppError } from '@job-agent/shared';

export interface ExtractedDocumentText {
  rawText: string;
  normalizedText: string;
  charCount: number;
  wordCount: number;
  detectedFormat: 'PDF' | 'DOCX' | 'TXT' | 'CSV' | 'JSON' | 'UNKNOWN';
  metadata?: {
    pageCount?: number;
    filename?: string;
  };
}

export class DocumentTextExtractor {
  /**
   * Extracts raw and normalized text from document buffer based on MIME type or filename.
   */
  public static async extractText(
    buffer: Buffer,
    filename: string,
    mimeType: string,
  ): Promise<ExtractedDocumentText> {
    const ext = filename.toLowerCase().split('.').pop() || '';
    const isPdf =
      mimeType === 'application/pdf' ||
      ext === 'pdf' ||
      (buffer.length > 4 && buffer.slice(0, 4).toString('utf-8') === '%PDF');
    const isDocx =
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      ext === 'docx' ||
      (buffer.length > 4 && buffer.slice(0, 2).toString('utf-8') === 'PK');
    const isCsv = mimeType === 'text/csv' || ext === 'csv';
    const isJson = mimeType === 'application/json' || ext === 'json';

    let rawText = '';
    let detectedFormat: ExtractedDocumentText['detectedFormat'] = 'UNKNOWN';
    let pageCount: number | undefined;

    if (isPdf) {
      detectedFormat = 'PDF';
      const pdfResult = await this.extractFromPdf(buffer);
      rawText = pdfResult.text;
      pageCount = pdfResult.pageCount;
    } else if (isDocx) {
      detectedFormat = 'DOCX';
      rawText = await this.extractFromDocx(buffer);
    } else if (isCsv) {
      detectedFormat = 'CSV';
      rawText = buffer.toString('utf-8');
    } else if (isJson) {
      detectedFormat = 'JSON';
      rawText = buffer.toString('utf-8');
    } else {
      // Default to UTF-8 text if printable
      detectedFormat = 'TXT';
      rawText = buffer.toString('utf-8');
    }

    const normalizedText = this.normalizeText(rawText);

    if (!normalizedText || normalizedText.trim().length === 0) {
      throw AppError.badRequest(
        `Unable to extract text from document (${filename}). Please ensure the file is not empty, password-protected, or image-only scanned without OCR text.`,
      );
    }

    const wordCount = normalizedText.trim().split(/\s+/).filter(Boolean).length;

    return {
      rawText,
      normalizedText,
      charCount: normalizedText.length,
      wordCount,
      detectedFormat,
      metadata: {
        pageCount,
        filename,
      },
    };
  }

  /**
   * PDF text extraction using pdf-parse v2 API
   */
  private static async extractFromPdf(
    buffer: Buffer,
  ): Promise<{ text: string; pageCount: number }> {
    try {
      const pdfParseModule = await import('pdf-parse');
      // Handle both CJS default/named export patterns
      const PDFParseClass =
        (pdfParseModule as any).PDFParse ||
        (pdfParseModule as any).default?.PDFParse ||
        (pdfParseModule as any).default;

      if (typeof PDFParseClass === 'function') {
        const parser = new PDFParseClass({ data: buffer });
        try {
          const result = await parser.getText();
          const text = result?.text || '';
          const pages = result?.pages?.length || result?.total || 1;
          return { text, pageCount: pages };
        } finally {
          if (typeof parser.destroy === 'function') {
            await parser.destroy().catch(() => {});
          }
        }
      }

      // Fallback if class constructor is not available
      if (typeof (pdfParseModule as any).default === 'function') {
        const data = await (pdfParseModule as any).default(buffer);
        return { text: data.text || '', pageCount: data.numpages || 1 };
      }

      throw new Error('PDF parsing library could not be instantiated');
    } catch (err) {
      throw AppError.badRequest(
        `Failed to parse PDF document: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * DOCX text extraction by reading word/document.xml from the ZIP package
   */
  private static async extractFromDocx(buffer: Buffer): Promise<string> {
    try {
      const zip = await JSZip.loadAsync(buffer);
      const documentXmlFile = zip.file('word/document.xml');

      if (!documentXmlFile) {
        throw new Error('Invalid DOCX format: word/document.xml not found');
      }

      const xml = await documentXmlFile.async('text');
      return this.parseWordprocessingXml(xml);
    } catch (err) {
      throw AppError.badRequest(
        `Failed to parse DOCX document: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Cleanly parses WordprocessingML XML without external XML parser dependency
   * Extracts paragraphs <w:p>, table cells <w:tc>, and text nodes <w:t>
   */
  private static parseWordprocessingXml(xml: string): string {
    const paragraphs: string[] = [];

    // Match each paragraph <w:p ...> ... </w:p>
    const pRegex = /<w:p(?:[\s>][\s\S]*?<\/w:p>|\/>)/g;
    let pMatch: RegExpExecArray | null;

    while ((pMatch = pRegex.exec(xml)) !== null) {
      const pXml = pMatch[0];

      // Extract all text content inside <w:t ...>text</w:t>
      const tRegex = /<w:t(?:[\s>][\s\S]*?>)([\s\S]*?)<\/w:t>/g;
      let tMatch: RegExpExecArray | null;
      let pText = '';

      while ((tMatch = tRegex.exec(pXml)) !== null) {
        const rawT = tMatch[1] || '';
        // Decode common XML entities
        const decoded = rawT
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'");
        pText += decoded;
      }

      // Also check for tab characters in DOCX <w:tab/>
      if (pXml.includes('<w:tab/>') || pXml.includes('<w:tab />')) {
        pText = pText.replace(/\s+/g, ' ');
      }

      const trimmed = pText.trim();
      if (trimmed.length > 0) {
        paragraphs.push(trimmed);
      }
    }

    return paragraphs.join('\n');
  }

  /**
   * Normalizes document text for clean downstream analysis:
   * - Unifies newlines
   * - Normalizes smart quotes and em-dashes
   * - Strips non-printable ASCII/Unicode control characters
   * - Consolidates consecutive empty lines
   */
  public static normalizeText(text: string): string {
    return (
      text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2013\u2014]/g, '-')
        .replace(/\u00A0/g, ' ') // Non-breaking space
        // eslint-disable-next-line no-control-regex
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Control characters
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    );
  }
}
