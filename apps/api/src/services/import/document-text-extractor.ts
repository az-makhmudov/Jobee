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

    const isZip = buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b; // PK signature

    const isCsv = mimeType === 'text/csv' || ext === 'csv';
    const isJson = mimeType === 'application/json' || ext === 'json';

    // Unsupported non-zip archive extensions
    const unsupportedArchiveExts = ['tar', 'gz', 'tgz', 'bz2', '7z', 'rar'];
    const isGzip = buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
    const is7z =
      buffer.length > 4 &&
      buffer[0] === 0x37 &&
      buffer[1] === 0x7a &&
      buffer[2] === 0xbc &&
      buffer[3] === 0xaf;
    const isRar =
      buffer.length > 4 &&
      buffer[0] === 0x52 &&
      buffer[1] === 0x61 &&
      buffer[2] === 0x72 &&
      buffer[3] === 0x21;

    if (unsupportedArchiveExts.includes(ext) || isGzip || is7z || isRar) {
      throw AppError.badRequest(
        `Unsupported archive format: "${filename}". If uploading a LinkedIn profile export, please export and upload as PDF (More -> Save to PDF) or upload a standard CV (PDF/DOCX).`,
      );
    }

    let rawText = '';
    let detectedFormat: ExtractedDocumentText['detectedFormat'] = 'UNKNOWN';
    let pageCount: number | undefined;

    if (isPdf) {
      detectedFormat = 'PDF';
      const pdfResult = await this.extractFromPdf(buffer);
      rawText = pdfResult.text;
      pageCount = pdfResult.pageCount;
    } else if (
      ext === 'docx' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      isZip
    ) {
      // Disambiguate DOCX vs other ZIP archives
      const zipExtraction = await this.extractFromZipOrDocx(buffer, filename);
      detectedFormat = zipExtraction.format;
      rawText = zipExtraction.text;
    } else if (isCsv) {
      detectedFormat = 'CSV';
      rawText = buffer.toString('utf-8');
    } else if (isJson) {
      detectedFormat = 'JSON';
      rawText = buffer.toString('utf-8');
    } else {
      // Check for binary data
      if (this.isBinaryBuffer(buffer)) {
        throw AppError.badRequest(
          `Unsupported or binary document format in "${filename}". Please upload a supported PDF or DOCX document.`,
        );
      }
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
   * Disambiguates and extracts text from ZIP archives:
   * 1. Word DOCX packages (containing word/document.xml)
   * 2. LinkedIn export archives (containing Profile/Positions CSV files)
   * Rejects non-LinkedIn / unsupported ZIP archives with clear descriptive error.
   */
  private static async extractFromZipOrDocx(
    buffer: Buffer,
    filename: string,
  ): Promise<{ format: 'DOCX' | 'CSV'; text: string }> {
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(buffer);
    } catch (err) {
      throw AppError.badRequest(
        `Failed to read archive "${filename}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // 1. Check for DOCX
    const docXml = zip.file('word/document.xml');
    if (docXml) {
      const xml = await docXml.async('text');
      const text = this.parseWordprocessingXml(xml);
      return { format: 'DOCX', text };
    }

    // 2. Check for LinkedIn data export CSVs
    const linkedInCsvNames = [
      'Profile.csv',
      'Positions.csv',
      'Education.csv',
      'Skills.csv',
      'Certifications.csv',
      'Languages.csv',
      'Projects.csv',
    ];

    const foundCsvs: Array<{ name: string; content: string }> = [];
    for (const csvName of linkedInCsvNames) {
      const regex = new RegExp(`(^|/)${csvName}$`, 'i');
      const matchedFiles = zip.file(regex);
      if (matchedFiles.length > 0) {
        const content = await matchedFiles[0]!.async('text');
        foundCsvs.push({ name: csvName, content });
      }
    }

    if (foundCsvs.length > 0) {
      const combinedText = foundCsvs
        .map((f) => `--- LinkedIn ${f.name} ---\n${f.content}`)
        .join('\n\n');
      return { format: 'CSV', text: combinedText };
    }

    // Neither DOCX nor LinkedIn data export
    throw AppError.badRequest(
      `Unsupported ZIP archive format in "${filename}". ZIP archives must either be a Word document (.docx) or a recognized LinkedIn data export containing Profile/Positions CSV files. For LinkedIn profiles, we recommend exporting directly to PDF (More -> Save to PDF) or uploading your CV.`,
    );
  }

  /**
   * Detects if an arbitrary buffer contains binary data rather than text.
   */
  public static isBinaryBuffer(buffer: Buffer): boolean {
    const checkLength = Math.min(buffer.length, 1024);
    if (checkLength === 0) return false;

    let nonPrintableCount = 0;
    for (let i = 0; i < checkLength; i++) {
      const byte = buffer[i]!;
      // Null byte is a definitive binary indicator
      if (byte === 0x00) return true;
      // Printable ASCII is 32-126. Valid whitespace is 9 (\t), 10 (\n), 13 (\r).
      if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
        nonPrintableCount++;
      }
    }

    // If more than 5% non-printable control characters, treat as binary
    return nonPrintableCount / checkLength > 0.05;
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
