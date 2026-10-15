import { z } from 'zod';
import type {
  ExtractedProfileData,
  ExtractedPersonalProfile,
  ExtractedExperience,
  ExtractedEducation,
  ExtractedSkill,
  ExtractedCertification,
  ExtractedLanguage,
  ExtractedLink,
} from '@job-agent/shared';
import { AppError, ErrorCodes } from '@job-agent/shared';
import {
  PRIMARY_GEMINI_MODEL,
  FALLBACK_GEMINI_MODEL,
  normalizeGeminiModel,
} from '../../ai/gemini-ai-provider.js';
import { DocumentTextExtractor } from './document-text-extractor.js';

// Null-safe preprocessing helpers for robust AI output validation
const safeStringDefaultEmpty = z
  .preprocess((val) => {
    if (val === null || val === undefined) return '';
    return typeof val === 'string' ? val.trim() : String(val).trim();
  }, z.string())
  .default('');

const safeNullableString = z
  .preprocess((val) => {
    if (val === null || val === undefined) return null;
    const str = typeof val === 'string' ? val.trim() : String(val).trim();
    return str.length === 0 ? null : str;
  }, z.string().nullable().optional())
  .default(null);

const safeBooleanDefaultFalse = z
  .preprocess((val) => {
    if (val === null || val === undefined) return false;
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') {
      const lower = val.toLowerCase().trim();
      return lower === 'true' || lower === 'yes' || lower === '1';
    }
    return Boolean(val);
  }, z.boolean())
  .default(false);

const safeStringArray = z
  .preprocess((val) => {
    if (!val || !Array.isArray(val)) return [];
    return val
      .map((item) => (item === null || item === undefined ? '' : String(item).trim()))
      .filter((s) => s.length > 0);
  }, z.array(z.string()))
  .default([]);

const safeConfidence = z
  .preprocess((val) => {
    if (val === null || val === undefined) return 0.9;
    const num = typeof val === 'number' ? val : Number(val);
    if (isNaN(num)) return 0.9;
    return Math.max(0, Math.min(1, num));
  }, z.number())
  .default(0.9);

const safeNullableNumber = z
  .preprocess((val) => {
    if (val === null || val === undefined) return null;
    const num = typeof val === 'number' ? val : Number(val);
    return isNaN(num) ? null : num;
  }, z.number().nullable().optional())
  .default(null);

const safeSectionArray = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z
    .preprocess((val) => {
      if (!val || !Array.isArray(val)) return [];
      return val.filter((item) => item !== null && typeof item === 'object');
    }, z.array(itemSchema))
    .default([]);

// Zod schemas for validating Gemini AI output with null-safe normalization
export const personalProfileSchema = z.object({
  preferredName: safeNullableString,
  fullName: safeNullableString,
  headline: safeNullableString,
  email: safeNullableString,
  phone: safeNullableString,
  city: safeNullableString,
  region: safeNullableString,
  country: safeNullableString,
  summary: safeNullableString,
  availability: safeNullableString,
});

export const experienceSchema = z.object({
  organization: safeStringDefaultEmpty,
  position: safeStringDefaultEmpty,
  location: safeNullableString,
  employmentType: safeNullableString,
  startDate: safeStringDefaultEmpty,
  endDate: safeNullableString,
  isCurrent: safeBooleanDefaultFalse,
  description: safeNullableString,
  achievements: safeStringArray,
  sourceReference: safeStringDefaultEmpty,
  confidence: safeConfidence,
});

export const educationSchema = z.object({
  institution: safeStringDefaultEmpty,
  degree: safeNullableString,
  fieldOfStudy: safeNullableString,
  startDate: safeNullableString,
  endDate: safeNullableString,
  isCurrent: safeBooleanDefaultFalse,
  location: safeNullableString,
  description: safeNullableString,
  activities: safeNullableString,
  sourceReference: safeStringDefaultEmpty,
  confidence: safeConfidence,
});

export const skillSchema = z.object({
  name: safeStringDefaultEmpty,
  category: safeNullableString,
  proficiency: safeNullableString,
  yearsExperience: safeNullableNumber,
  sourceReference: safeStringDefaultEmpty,
  confidence: safeConfidence,
});

export const certificationSchema = z.object({
  name: safeStringDefaultEmpty,
  issuingOrganization: safeStringDefaultEmpty,
  issueDate: safeNullableString,
  expirationDate: safeNullableString,
  credentialId: safeNullableString,
  credentialUrl: safeNullableString,
  sourceReference: safeStringDefaultEmpty,
  confidence: safeConfidence,
});

export const languageSchema = z.object({
  language: safeStringDefaultEmpty,
  proficiency: safeNullableString,
  cefrLevel: safeNullableString,
  notes: safeNullableString,
  sourceReference: safeStringDefaultEmpty,
  confidence: safeConfidence,
});

export const projectSchema = z.object({
  name: safeStringDefaultEmpty,
  role: safeNullableString,
  description: safeNullableString,
  startDate: safeNullableString,
  endDate: safeNullableString,
  projectUrl: safeNullableString,
  skills: safeStringArray,
  achievements: safeStringArray,
  sourceReference: safeStringDefaultEmpty,
  confidence: safeConfidence,
});

export const linkSchema = z.object({
  label: safeStringDefaultEmpty,
  url: safeStringDefaultEmpty,
  sourceReference: safeStringDefaultEmpty,
  confidence: safeConfidence,
});

export const extractedProfileSchema = z.object({
  profile: personalProfileSchema.nullable().optional().default(null),
  experiences: safeSectionArray(experienceSchema),
  education: safeSectionArray(educationSchema),
  skills: safeSectionArray(skillSchema),
  certifications: safeSectionArray(certificationSchema),
  languages: safeSectionArray(languageSchema),
  projects: safeSectionArray(projectSchema),
  links: safeSectionArray(linkSchema),
});

export class SmartProfileExtractor {
  /**
   * Main entry point to extract structured candidate profile data from document text.
   * If AI consent is granted and API key is present, uses Gemini AI.
   * If Gemini fails, does NOT silently present heuristic results as successful AI extraction.
   * When user declines AI consent, uses deterministic heuristic parsing.
   */
  public static async extract(
    text: string,
    options: {
      aiConsent: boolean;
      apiKey?: string;
      model?: string;
      timeoutMs?: number;
      allowFallback?: boolean;
    },
  ): Promise<{ data: ExtractedProfileData; extractorUsed: 'GEMINI_AI' | 'HEURISTIC_PARSER' }> {
    if (options.aiConsent) {
      if (!options.apiKey || options.apiKey.trim().length === 0) {
        throw AppError.badRequest(
          'Google Gemini AI is not configured (missing API key). You can extract using the Basic Deterministic Parser.',
        );
      }

      try {
        const aiData = await this.extractWithGemini(
          text,
          options.apiKey,
          options.model || PRIMARY_GEMINI_MODEL,
          options.timeoutMs ?? 25000,
        );
        return { data: aiData, extractorUsed: 'GEMINI_AI' };
      } catch (err) {
        if (options.allowFallback) {
          process.stderr.write(
            `AI profile extraction fallback to deterministic parser: ${err instanceof Error ? err.message : String(err)}\n`,
          );
        } else {
          if (err instanceof AppError) {
            throw err;
          }
          const detail = err instanceof Error ? err.message : String(err);
          const sanitized = detail
            .replace(/key=[a-zA-Z0-9_-]+/gi, 'key=[REDACTED]')
            .replace(/AIza[a-zA-Z0-9_-]+/gi, '[REDACTED_API_KEY]');
          throw new AppError({
            code: ErrorCodes.SERVICE_UNAVAILABLE,
            message: `Google Gemini AI extraction failed: ${sanitized}. You can retry with Gemini AI or select the Basic Deterministic Parser.`,
            statusCode: 502,
          });
        }
      }
    }

    const heuristicData = this.extractWithHeuristics(text);
    return { data: heuristicData, extractorUsed: 'HEURISTIC_PARSER' };
  }

  /**
   * Validates and normalizes structured candidate profile data from AI JSON response.
   * Tolerates legitimate missing fields and nulls without throwing raw Zod errors.
   */
  public static parseAiProfileData(rawJson: unknown): ExtractedProfileData {
    const parseResult = extractedProfileSchema.safeParse(rawJson);
    if (!parseResult.success) {
      const failedSections = Array.from(
        new Set(
          parseResult.error.issues
            .map((i) => i.path[0])
            .filter((p): p is string => typeof p === 'string'),
        ),
      );
      const sectionDetail = failedSections.length > 0 ? ` in ${failedSections.join(', ')}` : '';

      process.stderr.write(
        `[SmartProfileExtractor] Gemini validation failed${sectionDetail}: ${parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}\n`,
      );

      throw new AppError({
        code: ErrorCodes.SERVICE_UNAVAILABLE,
        message: `Some information returned by Gemini could not be processed${sectionDetail}. Please retry extraction or use the Basic Deterministic Parser.`,
        statusCode: 502,
      });
    }
    return parseResult.data;
  }

  /**
   * Extracts profile data using Google Gemini API with strict structured JSON schema
   * Enforces zero-hallucination truthfulness, section grouping, and provenance citations.
   */
  private static async extractWithGemini(
    text: string,
    apiKey: string,
    model: string,
    timeoutMs: number,
  ): Promise<ExtractedProfileData> {
    const targetModel = normalizeGeminiModel(model);

    const systemPrompt = `You are a high-precision candidate CV/resume and LinkedIn profile parser for Jobee, an ethical personal AI job-search platform.

CRITICAL INVARIANTS:
1. STRICT TRUTHFULNESS: NEVER hallucinate, guess, or invent qualifications, employers, job titles, dates, degrees, certifications, or metrics.
2. If an item or date is ambiguous or absent in the text, DO NOT make up values; leave it null or omit it.
3. Every single extracted item MUST include a "sourceReference": a short verbatim quote from the text proving its source.
4. Provide a "confidence" score (between 0.0 and 1.0) indicating how clearly the fact was stated.

SECTION-SPECIFIC EXTRACTION RULES:
- CERTIFICATIONS: Group related certification title, issuing organization (e.g. Google, Coursera, NAVOICA, Frankfurt School, AWS, Microsoft), and completion/issue date into ONE single certification record. NEVER create separate certification records for standalone dates or issuer names.
- EDUCATION: Separate institution, degree (e.g. "Bachelor of Science", "B.S.", "Master of Science"), field of study (e.g. "Computer Science"), start date, end date, and location. Do NOT merge degree and institution into one generic entry.
- EXPERIENCES: Separate organization name and location (city, country). Do NOT merge the location into the organization name.
- SKILLS: Extract each skill as an individual item (e.g. "Agile", "Scrum", "JIRA", "Python", "SQL"), NOT as a single comma-separated blob. Categorize by heading if provided (e.g. "Project Management", "Technical Tools").
- LANGUAGES: Extract languages with their explicitly stated proficiency (e.g. "Native", "Fluent", "Conversational"). If no proficiency is stated in the document, set proficiency to null. NEVER invent language proficiency.
- PROJECTS: Extract projects. Distinguish academic projects from professional experience without inventing commercial claims.

EXTRACT THE FOLLOWING JSON OBJECT STRUCTURE:
- profile: { preferredName, fullName, headline, email, phone, city, region, country, summary, availability }
- experiences: Array of { organization, position, location, employmentType, startDate (e.g. "2022-03" or "2022"), endDate (or null if current), isCurrent, description, achievements (array of strings), sourceReference, confidence }
- education: Array of { institution, degree, fieldOfStudy, startDate, endDate, isCurrent, location, description, activities, sourceReference, confidence }
- skills: Array of { name, category (e.g. "Project Management", "Technical Tools"), proficiency (only if stated), yearsExperience, sourceReference, confidence }
- certifications: Array of { name, issuingOrganization, issueDate, expirationDate, credentialId, credentialUrl, sourceReference, confidence }
- languages: Array of { language, proficiency (or null if unstated), cefrLevel, notes, sourceReference, confidence }
- projects: Array of { name, role, description, startDate, endDate, projectUrl, skills, achievements, sourceReference, confidence }
- links: Array of { label (e.g. "LinkedIn", "GitHub", "Portfolio"), url, sourceReference, confidence }

DOCUMENT TEXT TO PARSE:
"""
${text.slice(0, 16000)}
"""`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(targetModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
      });

      clearTimeout(timeout);

      let activeRes = response;

      // Handle fallback to FALLBACK_GEMINI_MODEL if primary model fails
      if (!activeRes.ok && targetModel !== FALLBACK_GEMINI_MODEL) {
        const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(FALLBACK_GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`;
        activeRes = await fetch(fallbackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.1,
            },
          }),
        });
      }

      if (!activeRes.ok) {
        const errText = await activeRes.text().catch(() => '');
        throw new Error(`Gemini API returned status ${activeRes.status}: ${errText}`);
      }

      const body = (await activeRes.json()) as any;
      const content = body.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) {
        throw new Error('Gemini API returned empty text part');
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new AppError({
          code: ErrorCodes.SERVICE_UNAVAILABLE,
          message:
            'Gemini returned an invalid JSON response structure. Please retry extraction or use the Basic Deterministic Parser.',
          statusCode: 502,
        });
      }

      const validated = SmartProfileExtractor.parseAiProfileData(parsed);

      // Issue 5: Ground and verify all extracted source citations against the actual document text
      const verifyItem = (item: { sourceReference?: string; confidence?: number }) => {
        const isVerified = SmartProfileExtractor.verifySourceReference(item.sourceReference, text);
        if (!isVerified) {
          item.confidence = Math.min(item.confidence ?? 0.5, 0.35);
          item.sourceReference = item.sourceReference
            ? `[Unverified citation] ${item.sourceReference}`
            : '[Unverified citation]';
        }
      };

      for (const exp of validated.experiences) verifyItem(exp);
      for (const edu of validated.education) verifyItem(edu);
      for (const sk of validated.skills) verifyItem(sk);
      for (const cert of validated.certifications) verifyItem(cert);
      for (const lang of validated.languages) verifyItem(lang);
      for (const proj of validated.projects) verifyItem(proj);
      for (const lk of validated.links) verifyItem(lk);

      return validated as ExtractedProfileData;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Verifies that an extracted source reference / citation actually exists in the document text.
   * Returns false if the citation is hallucinated, empty, or cannot be grounded in document text.
   */
  public static verifySourceReference(
    sourceRef: string | undefined | null,
    documentText: string,
  ): boolean {
    if (!sourceRef || typeof sourceRef !== 'string') return false;
    const trimmed = sourceRef.trim();
    if (trimmed.length < 3) return false;

    // Clean sourceRef of quotes, bullet points, brackets
    const cleanRef = trimmed
      .replace(/^[-*•"'\s]+/, '')
      .replace(/[-*•"'\s]+$/, '')
      .toLowerCase();

    if (cleanRef.length < 3) return false;

    const cleanDoc = documentText.toLowerCase();

    // Direct substring check
    if (cleanDoc.includes(cleanRef)) {
      return true;
    }

    // Whitespace-normalized check
    const normRef = cleanRef.replace(/\s+/g, ' ');
    const normDoc = cleanDoc.replace(/\s+/g, ' ');
    if (normDoc.includes(normRef)) {
      return true;
    }

    // Multi-token check for longer quotes (at least 70% of distinctive words length >= 4 must appear)
    const tokens = normRef.split(/[\s,.;:()/\\]+/).filter((t) => t.length >= 4);

    if (tokens.length >= 3) {
      let matches = 0;
      for (const tok of tokens) {
        if (normDoc.includes(tok)) {
          matches++;
        }
      }
      if (matches / tokens.length >= 0.7) {
        return true;
      }
    }

    return false;
  }

  /**
   * Deterministic rule-based extractor using regular expressions, keyword anchors,
   * and structural parsing. Used when user declines AI consent or when AI is offline.
   */
  public static extractWithHeuristics(rawText: string): ExtractedProfileData {
    const text = DocumentTextExtractor.collapseSpacedGlyphs(rawText);
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const normalizeDateStr = (raw: string): string => {
      const trimmed = raw.trim();
      const mYMatch = trimmed.match(/^(\d{1,2})[-/.](\d{4})$/);
      if (mYMatch) {
        const month = mYMatch[1]!.padStart(2, '0');
        const year = mYMatch[2]!;
        return `${year}-${month}`;
      }
      const monthNames: Record<string, string> = {
        jan: '01',
        feb: '02',
        mar: '03',
        apr: '04',
        may: '05',
        jun: '06',
        jul: '07',
        aug: '08',
        sep: '09',
        oct: '10',
        nov: '11',
        dec: '12',
      };
      const namedMatch = trimmed.match(/^([A-Za-z]+)\.?\s+(\d{4})$/);
      if (namedMatch) {
        const prefix = namedMatch[1]!.slice(0, 3).toLowerCase();
        if (monthNames[prefix]) {
          return `${namedMatch[2]}-${monthNames[prefix]}`;
        }
      }
      return trimmed;
    };

    // 1. Personal Contact Info
    const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
    const email = emailMatch ? emailMatch[0] : null;

    const phoneMatch = text.match(
      /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/,
    );
    const phone = phoneMatch ? phoneMatch[0].trim() : null;

    // Detect Links (LinkedIn, GitHub, Portfolios)
    const links: Array<ExtractedLink & { sourceReference: string; confidence: number }> = [];
    const urlMatches = text.match(/https?:\/\/[^\s)"]+/gi) || [];

    for (const rawUrl of urlMatches) {
      let label = 'Portfolio';
      const cleanUrl = rawUrl.replace(/[.,;]$/, '');
      if (cleanUrl.includes('linkedin.com')) label = 'LinkedIn';
      else if (cleanUrl.includes('github.com')) label = 'GitHub';
      else if (cleanUrl.includes('gitlab.com')) label = 'GitLab';
      else if (cleanUrl.includes('twitter.com') || cleanUrl.includes('x.com')) label = 'Twitter';

      links.push({
        label,
        url: cleanUrl,
        sourceReference: cleanUrl,
        confidence: 0.95,
      });
    }

    // Name heuristic: usually in the first 3 lines
    let fullName: string | null = null;
    for (let i = 0; i < Math.min(lines.length, 4); i++) {
      const line = lines[i]!;
      if (
        !line.includes('@') &&
        !line.includes('http') &&
        !line.match(/\d/) &&
        line.length > 2 &&
        line.length < 50
      ) {
        fullName = line;
        break;
      }
    }

    // Headline heuristic: often line immediately after name if short
    let headline: string | null = null;
    if (fullName) {
      const nameIdx = lines.indexOf(fullName);
      if (nameIdx >= 0 && nameIdx + 1 < lines.length) {
        const nextLine = lines[nameIdx + 1]!;
        if (
          !nextLine.includes('@') &&
          !nextLine.includes('http') &&
          nextLine.length < 80 &&
          !nextLine.match(/experience|education|skills|summary/i)
        ) {
          headline = nextLine;
        }
      }
    }

    // 2. Section Partitioning
    const sections: {
      summary: string[];
      experience: string[];
      education: string[];
      skills: string[];
      certifications: string[];
      languages: string[];
      projects: string[];
    } = {
      summary: [],
      experience: [],
      education: [],
      skills: [],
      certifications: [],
      languages: [],
      projects: [],
    };

    let currentSection: keyof typeof sections | 'skills_and_languages' | null = null;

    const commonLangs = [
      'English',
      'German',
      'French',
      'Spanish',
      'Russian',
      'Uzbek',
      'Chinese',
      'Japanese',
      'Arabic',
      'Italian',
      'Portuguese',
      'Polish',
      'Ukrainian',
      'Turkish',
      'Hindi',
      'Dutch',
      'Swedish',
      'Norwegian',
      'Danish',
      'Finnish',
    ];

    const isLanguageLine = (l: string): boolean => {
      const lower = l.trim().toLowerCase();
      if (lower.startsWith('language') || lower.startsWith('languages:')) return true;
      let matches = 0;
      for (const lang of commonLangs) {
        if (new RegExp(`\\b${lang}\\b`, 'i').test(l)) {
          matches++;
        }
      }
      if (matches >= 2) return true;
      if (
        matches === 1 &&
        (lower.includes('language') ||
          lower.includes('native') ||
          lower.includes('fluent') ||
          lower.includes('intermediate') ||
          lower.includes('conversational') ||
          lower.includes('proficien') ||
          /\b[a-c][1-2]\b/i.test(l))
      ) {
        return true;
      }
      return false;
    };

    for (const line of lines) {
      const collapsedHeading = DocumentTextExtractor.collapseSpacedGlyphs(line);
      const cleanHeading = collapsedHeading
        .replace(/^#+\s*/, '')
        .replace(/^[-*•–—_]+\s*/, '')
        .replace(/[:\s]+$/, '')
        .trim();

      if (
        /^(?:professional\s+)?summary$|^executive\s+summary$|^about(?:\s+me)?$|^profile$|^personal\s+profile$|^overview$/i.test(
          cleanHeading,
        )
      ) {
        currentSection = 'summary';
      } else if (
        /^(?:work|professional|career|relevant)?\s*experience$|^employment(?:\s+history)?$|^work\s+history$/i.test(
          cleanHeading,
        )
      ) {
        currentSection = 'experience';
      } else if (
        /^education(?:\s*&\s*(?:training|credentials|qualifications))?$|^academic\s+background$|^academics$|^education\s+and\s+(?:training|credentials)$|^degrees$/i.test(
          cleanHeading,
        )
      ) {
        currentSection = 'education';
      } else if (
        /^(?:technical\s+)?skills\s*(?:&|and|\/)\s*languages$|^(?:core\s+)?competencies\s*(?:&|and)\s*languages$/i.test(
          cleanHeading,
        )
      ) {
        currentSection = 'skills_and_languages';
      } else if (
        /^(?:technical\s+|key\s+|core\s+)?skills$|^core\s+competencies$|^technical\s+proficiencies$|^areas\s+of\s+expertise$|^tools\s*(?:&|and)\s*(?:technologies|frameworks)$|^competencies$/i.test(
          cleanHeading,
        )
      ) {
        currentSection = 'skills';
      } else if (/^languages(?:\s+spoken|\s+skills|\s+proficiencies)?$/i.test(cleanHeading)) {
        currentSection = 'languages';
      } else if (
        /^(?:licenses\s*(?:&|and)\s*)?certifications$|^certificates$|^professional\s+development$|^credentials$|^certifications\s*(?:&|and)\s*licenses$/i.test(
          cleanHeading,
        )
      ) {
        currentSection = 'certifications';
      } else if (/^(?:key\s+|academic\s+|personal\s+|selected\s+)?projects$/i.test(cleanHeading)) {
        currentSection = 'projects';
      } else if (currentSection === 'skills_and_languages') {
        if (isLanguageLine(line)) {
          sections.languages.push(line);
        } else {
          sections.skills.push(line);
        }
      } else if (currentSection) {
        sections[currentSection].push(line);
      }
    }

    const summaryText = sections.summary.length > 0 ? sections.summary.join(' ') : null;

    // 3. Parse Skills
    const skills: Array<ExtractedSkill & { sourceReference: string; confidence: number }> = [];
    const skillTokens = new Set<string>();

    for (const sLine of sections.skills) {
      let category: string | null = null;
      let content = sLine;

      const catMatch = sLine.match(/^([A-Za-z\s&/-]{2,35}):\s*(.+)$/);
      if (catMatch && !catMatch[1]?.toLowerCase().includes('http')) {
        category = catMatch[1]!.trim();
        content = catMatch[2]!;
      }

      const tokens = content
        .split(/[,|•·;\t]+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 1 && t.length < 50);

      for (const token of tokens) {
        const clean = token
          .replace(/^[-*•·]\s*/, '')
          .replace(/\.$/, '')
          .trim();
        if (
          clean.length > 1 &&
          !clean.match(/^https?:\/\//) &&
          !skillTokens.has(clean.toLowerCase())
        ) {
          skillTokens.add(clean.toLowerCase());
          skills.push({
            name: clean,
            category,
            sourceReference: sLine,
            confidence: 0.9,
          });
        }
      }
    }

    // 4. Parse Work Experiences
    const experiences: Array<
      ExtractedExperience & { sourceReference: string; confidence: number }
    > = [];
    const expLines = sections.experience;

    const dateRangeRegex =
      /((?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|[A-Za-z]+)\s*)?\d{4}(?:[-/.]\d{1,2})?|\d{1,2}[-/.]\d{4})\s*[-–—to]+\s*((?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|[A-Za-z]+)\s*)?\d{4}(?:[-/.]\d{1,2})?|\d{1,2}[-/.]\d{4}|Present|Current|Now)/i;

    let currentExp:
      | (Partial<ExtractedExperience> & {
          sourceReference: string;
          confidence: number;
          lines: string[];
        })
      | null = null;

    for (let i = 0; i < expLines.length; i++) {
      const line = expLines[i]!;
      const dateMatch = line.match(dateRangeRegex);

      if (dateMatch) {
        if (currentExp && (currentExp.organization || currentExp.position)) {
          experiences.push({
            organization: currentExp.organization || '',
            position: currentExp.position || '',
            location: currentExp.location || null,
            startDate: currentExp.startDate || '',
            endDate: currentExp.endDate,
            isCurrent: currentExp.isCurrent ?? false,
            description: currentExp.lines.join('\n'),
            achievements: currentExp.lines.filter(
              (l) => l.startsWith('•') || l.startsWith('-') || l.startsWith('*'),
            ),
            sourceReference: currentExp.sourceReference,
            confidence:
              currentExp.organization && currentExp.position && currentExp.startDate ? 0.85 : 0.45,
          });
        }

        const isCurrent = /present|current|now/i.test(dateMatch[2]!.trim());
        const startStr = normalizeDateStr(dateMatch[1]!.trim());
        const endStr = isCurrent ? null : normalizeDateStr(dateMatch[2]!.trim());

        const prevLine = i > 0 ? expLines[i - 1]! : '';
        const lineWithoutDate = line.replace(dateMatch[0], '').replace(/[|()]/g, ' ').trim();

        let rawPos = '';
        let rawOrg = '';
        let location: string | null = null;

        const nextLine = i + 1 < expLines.length ? expLines[i + 1]! : '';
        if (
          nextLine &&
          !nextLine.match(dateRangeRegex) &&
          !nextLine.startsWith('•') &&
          !nextLine.startsWith('-') &&
          !nextLine.startsWith('*') &&
          nextLine.includes(',')
        ) {
          location = nextLine.replace(/^[-*•]\s*/, '').trim();
        }

        const titlePattern =
          /\b(engineer|developer|architect|lead|manager|director|analyst|designer|consultant|specialist|officer|assistant|intern|founder|vp|head)\b/i;

        const candidateHeader = lineWithoutDate.length > 2 ? lineWithoutDate : prevLine;

        if (candidateHeader.includes(',')) {
          const commaParts = candidateHeader.split(',').map((p) => p.trim());
          if (commaParts.length >= 2 && !location) {
            const potentialLoc = commaParts.slice(1).join(', ').trim();
            if (potentialLoc.length < 40 && !titlePattern.test(potentialLoc)) {
              location = potentialLoc;
            }
          }
        }

        if (/\bat\b/i.test(candidateHeader)) {
          const atParts = candidateHeader.split(/\s+at\s+/i);
          rawPos = atParts[0]?.trim() || '';
          rawOrg = atParts[1]?.trim() || '';
        } else {
          const dashParts = candidateHeader.split(/\s*[-–—|@]\s*/);
          if (dashParts.length >= 2) {
            const p0 = dashParts[0]?.trim() || '';
            const p1 = dashParts[1]?.trim() || '';
            if (titlePattern.test(p1) && !titlePattern.test(p0)) {
              rawOrg = p0;
              rawPos = p1;
            } else if (titlePattern.test(p0) && !titlePattern.test(p1)) {
              rawPos = p0;
              rawOrg = p1;
            } else {
              rawOrg = p0;
              rawPos = p1;
            }
          } else {
            rawPos = candidateHeader;
          }
        }

        if (location) {
          rawOrg = rawOrg
            .replace(
              new RegExp(`,?\\s*${location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*$`, 'i'),
              '',
            )
            .trim();
          rawPos = rawPos
            .replace(
              new RegExp(`,?\\s*${location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*$`, 'i'),
              '',
            )
            .trim();
        }

        const position = rawPos.replace(/^[-*•]\s*/, '').trim();
        const organization = rawOrg.replace(/^[-*•]\s*/, '').trim();

        currentExp = {
          position,
          organization,
          location,
          startDate: startStr,
          endDate: isCurrent ? null : endStr,
          isCurrent,
          sourceReference: line,
          confidence: position && organization && startStr ? 0.85 : 0.45,
          lines: [],
        };
      } else if (currentExp) {
        currentExp.lines.push(line);
      }
    }

    if (currentExp && (currentExp.organization || currentExp.position)) {
      experiences.push({
        organization: currentExp.organization || '',
        position: currentExp.position || '',
        location: currentExp.location || null,
        startDate: currentExp.startDate || '',
        endDate: currentExp.endDate,
        isCurrent: currentExp.isCurrent ?? false,
        description: currentExp.lines.join('\n'),
        achievements: currentExp.lines.filter(
          (l) => l.startsWith('•') || l.startsWith('-') || l.startsWith('*'),
        ),
        sourceReference: currentExp.sourceReference,
        confidence:
          currentExp.organization && currentExp.position && currentExp.startDate ? 0.85 : 0.45,
      });
    }

    // 5. Parse Education
    const education: Array<ExtractedEducation & { sourceReference: string; confidence: number }> =
      [];
    const eduLines = sections.education;

    const degreeKeywords =
      /\b(Bachelor(?:\s+of\s+[A-Za-z]+)?|Master(?:\s+of\s+[A-Za-z]+)?|B\.?S\.?c?|M\.?S\.?c?|B\.?A\.?|M\.?A\.?|Ph\.?D\.?|Associate(?:\s+Degree)?|Diploma|Certificate|Doctorate)\b/i;
    const instKeywords = /\b(university|college|school|academy|institute|polytechnic|faculty)\b/i;

    let e = 0;
    while (e < eduLines.length) {
      const line = eduLines[e]!.replace(/^[-*•·]\s*/, '').trim();
      const dateRangeMatch = line.match(
        /(\b(?:19|20)\d{2}\b)\s*[-–—to]+\s*(\b(?:19|20)\d{2}\b|Present|Current)?/i,
      );
      const singleDateMatch = line.match(/\b(19\d{2}|20\d{2})\b/);

      const hasDeg = degreeKeywords.test(line);
      const hasInst = instKeywords.test(line);

      if (hasDeg || hasInst) {
        let institution = '';
        let degree: string | null = null;
        let fieldOfStudy: string | null = null;
        const startDate: string | null = dateRangeMatch ? dateRangeMatch[1]! : null;
        const endDate: string | null = dateRangeMatch
          ? dateRangeMatch[2] || null
          : singleDateMatch
            ? singleDateMatch[0]
            : null;
        let location: string | null = null;

        // Clean line by removing parenthesized dates so dash-splitting doesn't split on "(2015 - 2019)"
        const lineWithoutDates = line
          .replace(/\s*\([^)]*(?:19|20)\d{2}[^)]*\)/g, '')
          .replace(/\s*\b(?:19|20)\d{2}\s*[-–—to]+\s*(?:(?:19|20)\d{2}|Present|Current)?\b/gi, '')
          .trim();

        const dashParts = lineWithoutDates
          .split(/\s*[-–—|]\s+/)
          .map((p) => p.trim())
          .filter(Boolean);

        if (dashParts.length >= 2) {
          const p0 = dashParts[0]!;
          const p1 = dashParts[1]!;
          const extractFieldOfStudy = (
            targetText: string,
            foundDegree: string | null,
          ): string | null => {
            if (foundDegree) {
              const idx = targetText.toLowerCase().indexOf(foundDegree.toLowerCase());
              if (idx >= 0) {
                const remainder = targetText.slice(idx + foundDegree.length);
                const inMatch = remainder.match(/\bin\s+([A-Za-z\s&/,]+?)(?=\s*[-–—(,|\d]|$)/i);
                if (inMatch && inMatch[1]!.trim().length > 1) {
                  return inMatch[1]!.trim();
                }
              }
            }
            const fallbackMatch = targetText.match(
              /\b(?:in|of)\s+([A-Za-z\s&/,]+?)(?=\s*[-–—(,|\d]|$)/i,
            );
            return fallbackMatch && fallbackMatch[1]!.trim().length > 1
              ? fallbackMatch[1]!.trim()
              : null;
          };

          if (instKeywords.test(p0) && !instKeywords.test(p1)) {
            institution = p0;
            const degMatch = p1.match(degreeKeywords);
            degree = degMatch ? degMatch[0] : p1;
            fieldOfStudy = extractFieldOfStudy(p1, degree);
          } else if (instKeywords.test(p1) && !instKeywords.test(p0)) {
            institution = p1.replace(/\s*\([^)]+\)/, '').trim();
            const degMatch = p0.match(degreeKeywords);
            degree = degMatch ? degMatch[0] : p0;
            fieldOfStudy = extractFieldOfStudy(p0, degree);
          } else {
            institution = p0;
            degree = p1;
          }
        } else {
          institution = lineWithoutDates.replace(/\s*\([^)]+\)/, '').trim();
          const degMatch = lineWithoutDates.match(degreeKeywords);
          if (degMatch) degree = degMatch[0];
          const inMatch = lineWithoutDates.match(
            /\b(?:in|of)\s+([A-Za-z\s&/,]+?)(?=\s*[-–—(,|\d]|$)/i,
          );
          if (inMatch) fieldOfStudy = inMatch[1]!.trim();
        }

        institution = institution.replace(/\s*\((?:19|20)\d{2}[^)]*\)/, '').trim();

        let consumedLines = 1;
        if (e + 1 < eduLines.length) {
          const nextLine = eduLines[e + 1]!.replace(/^[-*•·]\s*/, '').trim();
          if (
            nextLine.includes(',') &&
            !instKeywords.test(nextLine) &&
            !degreeKeywords.test(nextLine)
          ) {
            location = nextLine;
            consumedLines = 2;
          }
        }

        education.push({
          institution,
          degree,
          fieldOfStudy,
          startDate,
          endDate,
          location,
          sourceReference: eduLines.slice(e, e + consumedLines).join('\n'),
          confidence: institution && degree ? 0.9 : 0.7,
        });

        e += consumedLines;
        continue;
      }
      e++;
    }

    // 6. Parse Languages
    const languages: Array<ExtractedLanguage & { sourceReference: string; confidence: number }> =
      [];
    const seenLangs = new Set<string>();

    for (const lLine of sections.languages) {
      for (const lang of commonLangs) {
        if (new RegExp(`\\b${lang}\\b`, 'i').test(lLine) && !seenLangs.has(lang.toLowerCase())) {
          seenLangs.add(lang.toLowerCase());
          let proficiency: string | null = null;
          let cefrLevel: string | null = null;

          const cefrMatch = lLine.match(
            new RegExp(`\\b${lang}\\b[\\s\\S]{0,30}\\b([A-C][12])\\b`, 'i'),
          );
          if (cefrMatch) {
            cefrLevel = cefrMatch[1]!.toUpperCase();
          }

          const textAround = lLine.toLowerCase();
          if (/\b(?:native|bilingual|mother\s*tongue)\b/i.test(textAround)) {
            proficiency = 'Native';
          } else if (/\bfluent\b/i.test(textAround)) {
            proficiency = 'Fluent';
          } else if (/\b(?:professional|full\s+professional)\b/i.test(textAround)) {
            proficiency = 'Professional';
          } else if (/\bintermediate\b/i.test(textAround)) {
            proficiency = 'Intermediate';
          } else if (/\b(?:conversational|limited\s+working)\b/i.test(textAround)) {
            proficiency = 'Conversational';
          } else if (/\b(?:basic|elementary|beginner)\b/i.test(textAround)) {
            proficiency = 'Elementary';
          }

          // Invariant: If proficiency not stated, do NOT invent it!
          languages.push({
            language: lang,
            proficiency: proficiency || null,
            cefrLevel,
            sourceReference: lLine,
            confidence: 0.9,
          });
        }
      }
    }

    // 7. Parse Certifications with multi-line and inline grouping
    const certifications: Array<
      ExtractedCertification & { sourceReference: string; confidence: number }
    > = [];
    const certLines = sections.certifications;

    const isDateLine = (l: string): boolean => {
      const clean = l
        .replace(/^[-*•·]\s*/, '')
        .replace(/^(issued|completed|date|expires)[:\s]*/i, '')
        .trim();
      return (
        /^(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*)?\d{4}(?:\s*[-–—to]+\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*)?\d{4}|Present|Current)?$/i.test(
          clean,
        ) || /^\d{4}[-/.]\d{1,2}(?:[-/.]\d{1,2})?$/.test(clean)
      );
    };

    const isKnownIssuer = (l: string): boolean => {
      const lower = l.toLowerCase();
      const issuers = [
        'coursera',
        'google',
        'frankfurt school',
        'navoica',
        'aws',
        'amazon web services',
        'microsoft',
        'scrum alliance',
        'pmi',
        'project management institute',
        'cisco',
        'meta',
        'ibm',
        'harvard',
        'stanford',
        'edx',
        'udemy',
        'linkedin learning',
        'oracle',
        'comptia',
        'udacity',
        'hubspot',
        'salesforce',
        'asu',
        'mit',
      ];
      return (
        issuers.some((iss) => lower.includes(iss)) ||
        /\b(?:issued by|authorized by|credential id|issued|certified by)\b/i.test(lower)
      );
    };

    const extractDateFromText = (l: string): string | null => {
      const dMatch = l.match(
        /\b((?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*)?(?:19|20)\d{2}(?:[-/.]\d{1,2})?|\d{1,2}[-/.]\d{4})\b/i,
      );
      return dMatch ? normalizeDateStr(dMatch[1]!.trim()) : null;
    };

    let c = 0;
    while (c < certLines.length) {
      const line = certLines[c]!.replace(/^[-*•·]\s*/, '').trim();
      if (!line || isDateLine(line)) {
        c++;
        continue;
      }

      // Check whether next line indicates a multi-line certification block
      const nextLineRaw =
        c + 1 < certLines.length ? certLines[c + 1]!.replace(/^[-*•·]\s*/, '').trim() : '';
      const isMultiLineBlock =
        Boolean(nextLineRaw) &&
        (isKnownIssuer(nextLineRaw) ||
          isDateLine(nextLineRaw) ||
          (!isDateLine(nextLineRaw) &&
            nextLineRaw.length > 2 &&
            nextLineRaw.length < 60 &&
            !nextLineRaw.includes('•')));

      // Check inline pattern ONLY if NOT a multi-line block
      const inlineSep = !isMultiLineBlock && line.match(/\s*[-–—|]\s+/);
      if (inlineSep) {
        const parts = line
          .split(/\s*[-–—|]\s+/)
          .map((p) => p.trim())
          .filter(Boolean);
        if (
          parts.length >= 2 &&
          (isKnownIssuer(parts[1]!) || parts.length >= 3 || /\(.*\d{4}.*\)/.test(line))
        ) {
          const title = parts[0]!;
          let issuer = parts[1]!;
          let date = extractDateFromText(line);

          if (parts.length >= 3 && !date) {
            date = extractDateFromText(parts[2]!);
          }

          const dateInIssuer = issuer.match(/\(([^)]+)\)/);
          if (dateInIssuer) {
            date = date || extractDateFromText(dateInIssuer[1]!);
            issuer = issuer.replace(/\([^)]+\)/, '').trim();
          }

          certifications.push({
            name: title,
            issuingOrganization: issuer,
            issueDate: date,
            sourceReference: line,
            confidence: 0.9,
          });
          c++;
          continue;
        }
      }

      // Multi-line block pattern: Title / Issuer / Date
      const title = line;
      let issuer = '';
      let date: string | null = extractDateFromText(line);
      let consumed = 1;

      if (c + 1 < certLines.length) {
        const nextLine = certLines[c + 1]!.replace(/^[-*•·]\s*/, '').trim();
        if (isDateLine(nextLine)) {
          date = date || extractDateFromText(nextLine);
          consumed = 2;
          if (c + 2 < certLines.length) {
            const next2 = certLines[c + 2]!.replace(/^[-*•·]\s*/, '').trim();
            if (isKnownIssuer(next2)) {
              issuer = next2;
              consumed = 3;
            }
          }
        } else if (
          isKnownIssuer(nextLine) ||
          (!isDateLine(nextLine) && nextLine.length > 2 && nextLine.length < 70)
        ) {
          issuer = nextLine;
          consumed = 2;
          if (c + 2 < certLines.length) {
            const next2 = certLines[c + 2]!.replace(/^[-*•·]\s*/, '').trim();
            if (isDateLine(next2) || extractDateFromText(next2)) {
              date = date || extractDateFromText(next2);
              consumed = 3;
            }
          }
        }
      }

      // Invariant: Never create certifications where name is a standalone date or issuer
      if (!isDateLine(title) && title.length > 3) {
        certifications.push({
          name: title,
          issuingOrganization: issuer,
          issueDate: date,
          sourceReference: certLines.slice(c, c + consumed).join('\n'),
          confidence: issuer && date ? 0.9 : 0.6,
        });
      }

      c += consumed;
    }

    const personalProfile: ExtractedPersonalProfile = {
      fullName,
      headline,
      email,
      phone,
      summary: summaryText,
    };

    return {
      profile: personalProfile,
      experiences,
      education,
      skills,
      certifications,
      languages,
      projects: [],
      links,
    };
  }
}
