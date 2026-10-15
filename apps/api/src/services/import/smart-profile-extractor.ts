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
import {
  PRIMARY_GEMINI_MODEL,
  FALLBACK_GEMINI_MODEL,
  normalizeGeminiModel,
} from '../../ai/gemini-ai-provider.js';

// Zod schema for validating Gemini AI output
const personalProfileSchema = z.object({
  preferredName: z.string().nullable().optional(),
  fullName: z.string().nullable().optional(),
  headline: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  availability: z.string().nullable().optional(),
});

const experienceSchema = z.object({
  organization: z.string().optional().default(''),
  position: z.string().optional().default(''),
  location: z.string().nullable().optional(),
  employmentType: z.string().nullable().optional(),
  startDate: z.string().optional().default(''),
  endDate: z.string().nullable().optional(),
  isCurrent: z.boolean().optional().default(false),
  description: z.string().nullable().optional(),
  achievements: z.array(z.string()).optional().default([]),
  sourceReference: z.string().optional().default(''),
  confidence: z.number().min(0).max(1).optional().default(0.9),
});

const educationSchema = z.object({
  institution: z.string().optional().default(''),
  degree: z.string().nullable().optional(),
  fieldOfStudy: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  isCurrent: z.boolean().optional().default(false),
  location: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  activities: z.string().nullable().optional(),
  sourceReference: z.string().optional().default(''),
  confidence: z.number().min(0).max(1).optional().default(0.9),
});

const skillSchema = z.object({
  name: z.string().optional().default(''),
  category: z.string().nullable().optional(),
  proficiency: z.string().nullable().optional(),
  yearsExperience: z.number().nullable().optional(),
  sourceReference: z.string().optional().default(''),
  confidence: z.number().min(0).max(1).optional().default(0.9),
});

const certificationSchema = z.object({
  name: z.string().optional().default(''),
  issuingOrganization: z.string().optional().default(''),
  issueDate: z.string().nullable().optional(),
  expirationDate: z.string().nullable().optional(),
  credentialId: z.string().nullable().optional(),
  credentialUrl: z.string().nullable().optional(),
  sourceReference: z.string().optional().default(''),
  confidence: z.number().min(0).max(1).optional().default(0.9),
});

const languageSchema = z.object({
  language: z.string().optional().default(''),
  proficiency: z.string().optional().default(''),
  cefrLevel: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  sourceReference: z.string().optional().default(''),
  confidence: z.number().min(0).max(1).optional().default(0.9),
});

const projectSchema = z.object({
  name: z.string().optional().default(''),
  role: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  projectUrl: z.string().nullable().optional(),
  skills: z.array(z.string()).optional().default([]),
  achievements: z.array(z.string()).optional().default([]),
  sourceReference: z.string().optional().default(''),
  confidence: z.number().min(0).max(1).optional().default(0.9),
});

const linkSchema = z.object({
  label: z.string().optional().default(''),
  url: z.string().optional().default(''),
  sourceReference: z.string().optional().default(''),
  confidence: z.number().min(0).max(1).optional().default(0.9),
});

const extractedProfileSchema = z.object({
  profile: personalProfileSchema.nullable().optional(),
  experiences: z.array(experienceSchema).optional().default([]),
  education: z.array(educationSchema).optional().default([]),
  skills: z.array(skillSchema).optional().default([]),
  certifications: z.array(certificationSchema).optional().default([]),
  languages: z.array(languageSchema).optional().default([]),
  projects: z.array(projectSchema).optional().default([]),
  links: z.array(linkSchema).optional().default([]),
});

export class SmartProfileExtractor {
  /**
   * Main entry point to extract structured candidate profile data from document text.
   * If AI consent is granted and API key is present, uses Gemini AI.
   * Otherwise falls back to deterministic heuristic parsing.
   */
  public static async extract(
    text: string,
    options: {
      aiConsent: boolean;
      apiKey?: string;
      model?: string;
      timeoutMs?: number;
    },
  ): Promise<{ data: ExtractedProfileData; extractorUsed: 'GEMINI_AI' | 'HEURISTIC_PARSER' }> {
    if (options.aiConsent && options.apiKey && options.apiKey.trim().length > 0) {
      try {
        const aiData = await this.extractWithGemini(
          text,
          options.apiKey,
          options.model || PRIMARY_GEMINI_MODEL,
          options.timeoutMs ?? 25000,
        );
        return { data: aiData, extractorUsed: 'GEMINI_AI' };
      } catch (err) {
        // Fall back gracefully to deterministic parser if AI call encounters issues
        process.stderr.write(
          `AI profile extraction fallback to deterministic parser: ${err instanceof Error ? err.message : String(err)}\n`,
        );
      }
    }

    const heuristicData = this.extractWithHeuristics(text);
    return { data: heuristicData, extractorUsed: 'HEURISTIC_PARSER' };
  }

  /**
   * Extracts profile data using Google Gemini API with strict structured JSON schema
   * Enforces zero-hallucination truthfulness and provenance citations.
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

EXTRACT THE FOLLOWING SECTIONS:
- profile: { preferredName, fullName, headline, email, phone, city, region, country, summary, availability }
- experiences: Array of { organization, position, location, employmentType, startDate (e.g. "2022-03" or "2022"), endDate (or null if current), isCurrent, description, achievements (array of strings), sourceReference, confidence }
- education: Array of { institution, degree, fieldOfStudy, startDate, endDate, isCurrent, location, description, activities, sourceReference, confidence }
- skills: Array of { name, category (e.g. "Languages", "Frameworks", "Cloud", "Tools"), proficiency (e.g. "Beginner", "Intermediate", "Advanced", "Expert" only if stated), yearsExperience, sourceReference, confidence }
- certifications: Array of { name, issuingOrganization, issueDate, expirationDate, credentialId, credentialUrl, sourceReference, confidence }
- languages: Array of { language, proficiency (e.g. "Native", "Fluent", "Professional", "Conversational"), cefrLevel, notes, sourceReference, confidence }
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

      const parsed = JSON.parse(content);
      const validated = extractedProfileSchema.parse(parsed);

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
  public static extractWithHeuristics(text: string): ExtractedProfileData {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

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

    let currentSection: keyof typeof sections | null = null;

    for (const line of lines) {
      const lower = line.toLowerCase();
      if (
        lower === 'summary' ||
        lower === 'professional summary' ||
        lower === 'about' ||
        lower === 'profile'
      ) {
        currentSection = 'summary';
      } else if (
        lower === 'experience' ||
        lower === 'work experience' ||
        lower === 'professional experience' ||
        lower === 'employment' ||
        lower === 'employment history'
      ) {
        currentSection = 'experience';
      } else if (
        lower === 'education' ||
        lower === 'academic background' ||
        lower === 'academics'
      ) {
        currentSection = 'education';
      } else if (
        lower === 'skills' ||
        lower === 'technical skills' ||
        lower === 'core competencies' ||
        lower === 'key skills'
      ) {
        currentSection = 'skills';
      } else if (
        lower === 'certifications' ||
        lower === 'licenses & certifications' ||
        lower === 'certificates'
      ) {
        currentSection = 'certifications';
      } else if (lower === 'languages' || lower === 'languages spoken') {
        currentSection = 'languages';
      } else if (lower === 'projects' || lower === 'key projects') {
        currentSection = 'projects';
      } else if (currentSection) {
        sections[currentSection].push(line);
      }
    }

    const summaryText = sections.summary.length > 0 ? sections.summary.join(' ') : null;

    // 3. Parse Skills
    const skills: Array<ExtractedSkill & { sourceReference: string; confidence: number }> = [];
    const skillTokens = new Set<string>();

    for (const sLine of sections.skills) {
      // Split on bullets, commas, pipes, or slashes
      const tokens = sLine
        .split(/[,|•·/]/)
        .map((t) => t.trim())
        .filter((t) => t.length > 1 && t.length < 40);

      for (const token of tokens) {
        const clean = token.replace(/^[-*•]\s*/, '').trim();
        if (clean.length > 1 && !skillTokens.has(clean.toLowerCase())) {
          skillTokens.add(clean.toLowerCase());
          skills.push({
            name: clean,
            sourceReference: sLine,
            confidence: 0.85,
          });
        }
      }
    }

    // 4. Parse Work Experiences
    const experiences: Array<
      ExtractedExperience & { sourceReference: string; confidence: number }
    > = [];
    const expLines = sections.experience;

    // Look for lines containing date ranges e.g. "2020 - 2023", "2021-03 - Present", "Jan 2021 - Present"
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
            startDate: currentExp.startDate || '',
            endDate: currentExp.endDate,
            isCurrent: currentExp.isCurrent ?? false,
            description: currentExp.lines.join('\n'),
            achievements: currentExp.lines.filter(
              (l) => l.startsWith('•') || l.startsWith('-') || l.startsWith('*'),
            ),
            sourceReference: currentExp.sourceReference,
            confidence:
              currentExp.organization && currentExp.position && currentExp.startDate ? 0.8 : 0.4,
          });
        }

        const startStr = dateMatch[1]!.trim();
        const endStr = dateMatch[2]!.trim();
        const isCurrent = /present|current|now/i.test(endStr);

        // Preceding line often contains Position and/or Organization
        const prevLine = i > 0 ? expLines[i - 1]! : '';
        const parts = line
          .replace(dateMatch[0], '')
          .trim()
          .split(/[,|@–-]/)
          .map((p) => p.trim())
          .filter(Boolean);

        let rawPos = '';
        let rawOrg = '';

        if (parts.length >= 2) {
          rawPos = parts[0]!;
          rawOrg = parts[1]!;
        } else if (parts.length === 1) {
          rawPos = parts[0]!;
          if (prevLine && !prevLine.match(dateRangeRegex)) {
            rawOrg = prevLine;
          }
        } else if (prevLine && !prevLine.match(dateRangeRegex)) {
          // Check if prevLine has split tokens like "Org - Role" or "Role at Org"
          const titlePattern =
            /\b(engineer|developer|architect|lead|manager|director|analyst|designer|consultant|specialist|officer|intern|founder|vp|head)\b/i;
          if (/\bat\b/i.test(prevLine)) {
            const atParts = prevLine.split(/\s+at\s+/i);
            rawPos = atParts[0]?.trim() || '';
            rawOrg = atParts[1]?.trim() || '';
          } else {
            const dashParts = prevLine.split(/\s*[-–|@]\s*/);
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
              rawPos = prevLine;
            }
          }
        }

        const position = rawPos.replace(/^[-*•]\s*/, '').trim();
        const organization = rawOrg.replace(/^[-*•]\s*/, '').trim();

        currentExp = {
          position,
          organization,
          startDate: startStr,
          endDate: isCurrent ? null : endStr,
          isCurrent,
          sourceReference: line,
          confidence: position && organization && startStr ? 0.8 : 0.4,
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
        startDate: currentExp.startDate || '',
        endDate: currentExp.endDate,
        isCurrent: currentExp.isCurrent ?? false,
        description: currentExp.lines.join('\n'),
        achievements: currentExp.lines.filter(
          (l) => l.startsWith('•') || l.startsWith('-') || l.startsWith('*'),
        ),
        sourceReference: currentExp.sourceReference,
        confidence:
          currentExp.organization && currentExp.position && currentExp.startDate ? 0.8 : 0.4,
      });
    }

    // 5. Parse Education
    const education: Array<ExtractedEducation & { sourceReference: string; confidence: number }> =
      [];
    const eduLines = sections.education;

    for (let i = 0; i < eduLines.length; i++) {
      const line = eduLines[i]!;
      const dateMatch = line.match(/\b(19\d{2}|20\d{2})\b/);
      const degreeMatch = line.match(
        /\b(Bachelor|Master|PhD|B\.S\.|M\.S\.|B\.A\.|M\.A\.|Doctorate|Associate|Diploma|Certificate|BSc|MSc)\b/i,
      );

      if (
        degreeMatch ||
        line.toLowerCase().includes('university') ||
        line.toLowerCase().includes('college')
      ) {
        const degree = degreeMatch ? degreeMatch[0] : null;
        education.push({
          institution: line.replace(/^[-*•]\s*/, '').trim(),
          degree,
          startDate: null,
          endDate: dateMatch ? dateMatch[0] : null,
          sourceReference: line,
          confidence: 0.8,
        });
      }
    }

    // 6. Parse Languages
    const languages: Array<ExtractedLanguage & { sourceReference: string; confidence: number }> =
      [];
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
    ];

    for (const lLine of sections.languages) {
      for (const lang of commonLangs) {
        if (new RegExp(`\\b${lang}\\b`, 'i').test(lLine)) {
          let prof = 'Professional working proficiency';
          if (/native|bilingual/i.test(lLine)) prof = 'Native or bilingual proficiency';
          else if (/fluent/i.test(lLine)) prof = 'Full professional proficiency';
          else if (/elementary|basic/i.test(lLine)) prof = 'Elementary proficiency';
          else if (/intermediate/i.test(lLine)) prof = 'Limited working proficiency';

          languages.push({
            language: lang,
            proficiency: prof,
            sourceReference: lLine,
            confidence: 0.85,
          });
        }
      }
    }

    // 7. Parse Certifications
    const certifications: Array<
      ExtractedCertification & { sourceReference: string; confidence: number }
    > = [];
    for (const cLine of sections.certifications) {
      const trimmed = cLine.replace(/^[-*•]\s*/, '').trim();
      if (trimmed.length > 3) {
        certifications.push({
          name: trimmed,
          issuingOrganization: '',
          sourceReference: cLine,
          confidence: 0.5,
        });
      }
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
