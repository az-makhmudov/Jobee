import { AiMatchContext, AiMatchResult, AiProvider } from './types.js';
import { validateAndSanitizeAiOutput } from './validator.js';
import { AppError, ErrorCodes } from '@job-agent/shared';

export class GeminiAiProvider implements AiProvider {
  readonly name = 'gemini';
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(apiKey: string, model = 'gemini-2.5-flash', timeoutMs = 12000) {
    this.apiKey = apiKey;
    this.model = model;
    this.timeoutMs = timeoutMs;
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async analyzeMatch(context: AiMatchContext): Promise<AiMatchResult> {
    if (!this.isAvailable()) {
      throw new AppError({
        code: ErrorCodes.CONFIGURATION_ERROR,
        message: 'Gemini API key is not configured',
        statusCode: 500,
      });
    }

    const prompt = this.buildPrompt(context);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new AppError({
          code: ErrorCodes.SERVICE_UNAVAILABLE,
          message: `Gemini API returned HTTP ${response.status}: ${errorText.slice(0, 200)}`,
          statusCode: 502,
        });
      }

      const responseBody = (await response.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
        usageMetadata?: { totalTokenCount?: number };
      };

      const rawText = responseBody.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new AppError({
          code: ErrorCodes.SERVICE_UNAVAILABLE,
          message: 'Gemini API returned an empty completion',
          statusCode: 502,
        });
      }

      const parsedJson = JSON.parse(rawText);
      const tokensUsed = responseBody.usageMetadata?.totalTokenCount;

      return validateAndSanitizeAiOutput(parsedJson, context, 'gemini', this.model, tokensUsed);
    } catch (err: unknown) {
      if (err instanceof AppError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new AppError({
          code: ErrorCodes.SERVICE_UNAVAILABLE,
          message: `Gemini API request timed out after ${this.timeoutMs}ms`,
          statusCode: 504,
        });
      }
      throw new AppError({
        code: ErrorCodes.SERVICE_UNAVAILABLE,
        message: `Failed to invoke Gemini API: ${err instanceof Error ? err.message : String(err)}`,
        statusCode: 502,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private buildPrompt(context: AiMatchContext): string {
    return `You are an expert technical recruiter analyzing job match suitability.
Evaluate how well the candidate's structured profile meets the requirements of the job posting.

PRIME DIRECTIVES:
1. ONLY reference candidate evidence explicitly listed in Candidate Context. Do NOT invent or assume any credentials, experiences, degrees, or skills not present.
2. In 'evaluations', for each requirement include only valid 'evidenceIds' corresponding to the candidate evidence that supports it.
3. If no matching candidate evidence is found for a requirement, mark status as 'NOT_MET' or 'UNKNOWN', with an empty evidenceIds array.
4. Output MUST be valid JSON strictly matching this structure:
{
  "evaluations": [
    {
      "requirementId": "<string matching requirement.id>",
      "status": "MET" | "PARTIAL" | "NOT_MET" | "UNKNOWN" | "NOT_APPLICABLE",
      "evidenceIds": ["<matching candidate evidence ID>"],
      "confidence": <integer 0-100>,
      "reason": "<concise explanation>"
    }
  ],
  "roleFitScore": <integer 0-100>,
  "skillsFitScore": <integer 0-100>,
  "strengths": ["<concise bullet>"],
  "gaps": ["<concise bullet>"],
  "semanticSummary": "<brief 1-2 sentence overall summary>"
}

JOB POSTING:
Title: ${context.jobTitle}
Company: ${context.jobCompany}
Workplace: ${context.workplaceType}
Location: ${context.location ?? 'N/A'}
Description: ${context.descriptionSnippet}

REQUIREMENTS TO EVALUATE:
${JSON.stringify(context.requirements, null, 2)}

CANDIDATE CONTEXT:
${JSON.stringify(context.candidateContext, null, 2)}
`;
  }
}
