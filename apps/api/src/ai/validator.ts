import { z } from 'zod';
import { AiMatchContext, AiMatchResult } from './types.js';
import { AppError, ErrorCodes } from '@job-agent/shared';

const rawAiEvaluationSchema = z.object({
  requirementId: z.string().min(1),
  status: z.enum(['MET', 'PARTIAL', 'NOT_MET', 'UNKNOWN', 'NOT_APPLICABLE']),
  evidenceIds: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(100).default(50),
  reason: z.string().default('Evaluated via AI semantic reasoning'),
});

export const rawAiMatchResponseSchema = z.object({
  evaluations: z.array(rawAiEvaluationSchema).default([]),
  roleFitScore: z.number().min(0).max(100).nullable().optional(),
  skillsFitScore: z.number().min(0).max(100).nullable().optional(),
  strengths: z.array(z.string()).default([]),
  gaps: z.array(z.string()).default([]),
  semanticSummary: z.string().default(''),
});

export function validateAndSanitizeAiOutput(
  rawOutput: unknown,
  context: AiMatchContext,
  providerName: string,
  modelName: string,
  tokensUsed?: number,
): AiMatchResult {
  const parsed = rawAiMatchResponseSchema.safeParse(rawOutput);
  if (!parsed.success) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: `AI match response failed schema validation: ${parsed.error.message}`,
      statusCode: 502,
      details: parsed.error.format(),
    });
  }

  const data = parsed.data;

  // Build valid candidate evidence ID set
  const validEvidenceIds = new Set<string>();
  for (const exp of context.candidateContext?.experiences ?? []) {
    if (exp?.id) validEvidenceIds.add(exp.id);
  }
  for (const skl of context.candidateContext?.skills ?? []) {
    if (skl?.id) validEvidenceIds.add(skl.id);
  }
  for (const edu of context.candidateContext?.education ?? []) {
    if (edu?.id) validEvidenceIds.add(edu.id);
  }
  for (const lang of context.candidateContext?.languages ?? []) {
    if (lang?.id) validEvidenceIds.add(lang.id);
  }
  for (const cert of context.candidateContext?.certifications ?? []) {
    if (cert?.id) validEvidenceIds.add(cert.id);
  }
  for (const fact of context.candidateContext?.verifiedFacts ?? []) {
    if (fact?.id) validEvidenceIds.add(fact.id);
  }

  // Build valid requirement ID set
  const validRequirementIds = new Set<string>(context.requirements.map((r) => r.id));

  // Sanitize evaluations: drop invalid requirement IDs and invented evidence IDs
  const sanitizedEvaluations = data.evaluations
    .filter((ev) => validRequirementIds.has(ev.requirementId))
    .map((ev) => {
      const sanitizedEvidenceIds = Array.from(
        new Set(ev.evidenceIds.filter((id) => validEvidenceIds.has(id))),
      );
      const hasDroppedEvidence = sanitizedEvidenceIds.length < ev.evidenceIds.length;

      let reason = ev.reason;
      let status = ev.status;

      if (
        hasDroppedEvidence &&
        (status === 'MET' || status === 'PARTIAL') &&
        sanitizedEvidenceIds.length === 0
      ) {
        // AI claimed a match based entirely on hallucinated evidence IDs
        status = 'UNKNOWN';
        reason = `${reason} (Note: Unverifiable evidence claims were excluded)`;
      }

      return {
        requirementId: ev.requirementId,
        status,
        evidenceIds: sanitizedEvidenceIds,
        confidence: Math.round(Math.max(0, Math.min(100, ev.confidence))),
        reason,
      };
    });

  return {
    evaluations: sanitizedEvaluations,
    roleFitScore:
      data.roleFitScore !== undefined && data.roleFitScore !== null
        ? Math.round(data.roleFitScore)
        : null,
    skillsFitScore:
      data.skillsFitScore !== undefined && data.skillsFitScore !== null
        ? Math.round(data.skillsFitScore)
        : null,
    strengths: data.strengths.filter((s) => s.trim().length > 0),
    gaps: data.gaps.filter((g) => g.trim().length > 0),
    semanticSummary: data.semanticSummary.trim(),
    provider: providerName,
    model: modelName,
    tokensUsed,
  };
}
