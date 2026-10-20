import { AiMatchContext, AiMatchResult, AiProvider } from './types.js';
import { validateAndSanitizeAiOutput } from './validator.js';
import { AppError, ErrorCodes } from '@job-agent/shared';

export const PRIMARY_GEMINI_MODEL = 'gemini-3.8-flash';
export const FALLBACK_GEMINI_MODEL = 'gemini-3.5-flash-lite';

export const OBSOLETE_GEMINI_MODELS = new Set([
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'gemini-pro',
  'gemini-flash',
]);

export function normalizeGeminiModel(model?: string): string {
  if (!model || model.trim().length === 0) {
    return PRIMARY_GEMINI_MODEL;
  }
  const trimmed = model.trim();
  if (OBSOLETE_GEMINI_MODELS.has(trimmed)) {
    return PRIMARY_GEMINI_MODEL;
  }
  return trimmed;
}

export class GeminiAiProvider implements AiProvider {
  readonly name = 'gemini';
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(apiKey: string, model = PRIMARY_GEMINI_MODEL, timeoutMs = 15000) {
    this.apiKey = apiKey;
    this.model = normalizeGeminiModel(model);
    this.timeoutMs = timeoutMs;
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  get configuredModel(): string {
    return this.model;
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
    return this.executeWithResilience(this.model, prompt, context);
  }

  private async executeWithResilience(
    targetModel: string,
    prompt: string,
    context: AiMatchContext,
  ): Promise<AiMatchResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.callGeminiApi(targetModel, prompt, controller.signal);

      // Handle successful response
      if (response.ok) {
        return await this.parseAndValidateResponse(response, context, targetModel);
      }

      // Handle errors with detailed mapping and automatic fallback
      const errorText = await response.text().catch(() => '');
      let parsedError: { error?: { code?: number; message?: string; status?: string } } | null =
        null;
      try {
        parsedError = JSON.parse(errorText);
      } catch {
        // Raw text
      }

      const rawMsg = parsedError?.error?.message || errorText;

      // 1. Model unavailable / deprecated (404)
      if (
        response.status === 404 ||
        rawMsg.includes('no longer available') ||
        rawMsg.includes('not found')
      ) {
        // If targetModel was an un-normalized obsolete model or 404, attempt fallback
        if (targetModel !== FALLBACK_GEMINI_MODEL) {
          try {
            const fallbackResponse = await this.callGeminiApi(
              FALLBACK_GEMINI_MODEL,
              prompt,
              controller.signal,
            );
            if (fallbackResponse.ok) {
              return await this.parseAndValidateResponse(
                fallbackResponse,
                context,
                FALLBACK_GEMINI_MODEL,
              );
            }
          } catch {
            // Ignore fallback error and throw main descriptive error below
          }
        }

        throw new AppError({
          code: ErrorCodes.SERVICE_UNAVAILABLE,
          message: `The requested Gemini model '${targetModel}' is unavailable or has been deprecated by Google. Recommended replacement: '${PRIMARY_GEMINI_MODEL}' or '${FALLBACK_GEMINI_MODEL}'.`,
          statusCode: 502,
        });
      }

      // 2. High demand spike (503 Service Unavailable)
      if (
        response.status === 503 ||
        rawMsg.includes('high demand') ||
        parsedError?.error?.status === 'UNAVAILABLE'
      ) {
        // If primary model experienced 503, failover transparently to high-availability gemini-3.5-flash-lite
        if (targetModel === PRIMARY_GEMINI_MODEL) {
          try {
            const fallbackResponse = await this.callGeminiApi(
              FALLBACK_GEMINI_MODEL,
              prompt,
              controller.signal,
            );
            if (fallbackResponse.ok) {
              return await this.parseAndValidateResponse(
                fallbackResponse,
                context,
                FALLBACK_GEMINI_MODEL,
              );
            }
          } catch {
            // Fall through to error
          }
        }

        throw new AppError({
          code: ErrorCodes.SERVICE_UNAVAILABLE,
          message: `Google Gemini service is temporarily experiencing high demand for model '${targetModel}'. Please retry shortly or switch to '${FALLBACK_GEMINI_MODEL}' in AI Settings.`,
          statusCode: 503,
        });
      }

      // 3. Quota or Rate Limit Exceeded (429)
      if (
        response.status === 429 ||
        rawMsg.includes('quota') ||
        parsedError?.error?.status === 'RESOURCE_EXHAUSTED'
      ) {
        throw new AppError({
          code: ErrorCodes.RATE_LIMIT_EXCEEDED,
          message: `Gemini API rate limit or quota exceeded for model '${targetModel}'. Please check your plan and billing details or wait a moment before retrying.`,
          statusCode: 429,
        });
      }

      // 4. Invalid or Unauthorized Credentials (401 / 403)
      if (
        response.status === 401 ||
        response.status === 403 ||
        parsedError?.error?.status === 'PERMISSION_DENIED'
      ) {
        throw new AppError({
          code: ErrorCodes.UNAUTHORIZED,
          message:
            'Invalid or unauthorized Gemini API key. Please check your GEMINI_API_KEY environment variable or Railway configuration.',
          statusCode: 401,
        });
      }

      // Generic upstream error
      throw new AppError({
        code: ErrorCodes.SERVICE_UNAVAILABLE,
        message: `Gemini API returned HTTP ${response.status}: ${rawMsg.slice(0, 200)}`,
        statusCode: 502,
      });
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

  private async callGeminiApi(
    model: string,
    prompt: string,
    signal: AbortSignal,
  ): Promise<Response> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      }),
    });
  }

  private async parseAndValidateResponse(
    response: Response,
    context: AiMatchContext,
    actualModelUsed: string,
  ): Promise<AiMatchResult> {
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

    return validateAndSanitizeAiOutput(parsedJson, context, 'gemini', actualModelUsed, tokensUsed);
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
