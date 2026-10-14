import { z } from 'zod';
import { EmailClassificationType, type NormalizedEmailMessage } from '@job-agent/shared';
import type { ClassificationResult } from './deterministic-email-classifier.js';

const aiClassificationSchema = z.object({
  classification: z.nativeEnum(EmailClassificationType),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
  extractedDetails: z
    .object({
      company: z.string().optional(),
      role: z.string().optional(),
      recruiterName: z.string().optional(),
      recruiterEmail: z.string().optional(),
      externalReferenceId: z.string().optional(),
      assessmentProvider: z.string().optional(),
      assessmentUrl: z.string().optional(),
      dueDate: z.string().optional(),
      interviewDate: z.string().optional(),
      meetingUrl: z.string().optional(),
    })
    .passthrough()
    .default({}),
});

import {
  PRIMARY_GEMINI_MODEL,
  FALLBACK_GEMINI_MODEL,
  normalizeGeminiModel,
} from '../../ai/gemini-ai-provider.js';

export class AiEmailClassifier {
  private apiKey?: string;
  private model: string;

  constructor(apiKey?: string, model = PRIMARY_GEMINI_MODEL) {
    this.apiKey = apiKey;
    this.model = normalizeGeminiModel(model);
  }

  public get isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  public async classify(message: NormalizedEmailMessage): Promise<ClassificationResult | null> {
    if (!this.isAvailable) {
      return null;
    }

    const prompt = `You are a recruitment communications classifier for Jobee, a personal AI job-search platform.
Analyze the following email and classify it into exactly one of these categories:
- JOB_ALERT: Job alert aggregator (LinkedIn, Indeed, etc.) with multiple job listings
- APPLICATION_CONFIRMATION: Employer/ATS confirmation that an application was received
- APPLICATION_REJECTION: Explicit notice that the candidate was not selected or they moved forward with others
- RECRUITER_OUTREACH: Cold outreach or sourcer message looking for candidates
- SCREENING_REQUEST: Invitation to initial recruiter phone or video screen
- ASSESSMENT_REQUEST: Take-home challenge or online coding assessment (HackerRank, etc.)
- INTERVIEW_REQUEST: Request to schedule a technical or behavioral interview
- INTERVIEW_CONFIRMATION: Confirmed interview invitation with time or meeting link
- OFFER_RELATED: Job offer or discussion of employment contract terms
- APPLICATION_UPDATE: General status update on existing application
- OTHER_JOB_RELATED: Miscellaneous communication from recruiting/employer
- IRRELEVANT: Unrelated newsletters, marketing, spam, receipts, personal emails
- UNKNOWN: Cannot determine

EMAIL METADATA:
From: ${message.from.name || ''} <${message.from.email}>
Subject: ${message.subject}
Date: ${message.receivedAt.toISOString()}

EMAIL BODY:
${message.plainText.slice(0, 4000)}

Return a strict JSON object with:
- classification: string (one of the enum values above)
- confidence: number between 0.0 and 1.0
- reason: brief explanation of classification
- extractedDetails: object with company, role, recruiterName, externalReferenceId, assessmentProvider, assessmentUrl, dueDate, interviewDate, meetingUrl if found`;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey!)}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
      });

      clearTimeout(timeout);

      let activeRes = response;
      if (
        !activeRes.ok &&
        (activeRes.status === 503 || activeRes.status === 404) &&
        this.model === PRIMARY_GEMINI_MODEL
      ) {
        try {
          const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(FALLBACK_GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(this.apiKey!)}`;
          const fallbackRes = await fetch(fallbackUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.1,
              },
            }),
          });
          if (fallbackRes.ok) {
            activeRes = fallbackRes;
          }
        } catch {
          // ignore fallback error
        }
      }

      if (!activeRes.ok) {
        return null;
      }

      const resData = (await activeRes.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
      };

      const rawText = resData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) return null;

      const parsedJson = JSON.parse(rawText);
      const validated = aiClassificationSchema.parse(parsedJson);

      return {
        classification: validated.classification,
        confidence: validated.confidence,
        reason: `[AI] ${validated.reason}`,
        extractedDetails: validated.extractedDetails,
      };
    } catch {
      // Graceful fallback to deterministic
      return null;
    }
  }
}
