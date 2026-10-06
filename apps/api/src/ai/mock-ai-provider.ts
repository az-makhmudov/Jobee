import { AiMatchContext, AiMatchResult, AiProvider } from './types.js';
import { validateAndSanitizeAiOutput } from './validator.js';

export class MockAiProvider implements AiProvider {
  readonly name = 'mock';
  public shouldFail = false;
  public delayMs = 0;
  public mockResponse: unknown = null;

  isAvailable(): boolean {
    return true;
  }

  async analyzeMatch(context: AiMatchContext): Promise<AiMatchResult> {
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }

    if (this.shouldFail) {
      throw new Error('Simulated AI provider network error');
    }

    if (this.mockResponse !== null) {
      return validateAndSanitizeAiOutput(this.mockResponse, context, 'mock', 'mock-model-v1', 150);
    }

    // Default intelligent mock response: maps first requirement to first candidate skill if available
    const evaluations = context.requirements.map((req, idx) => {
      const matchingSkill = context.candidateContext.skills[idx];
      return {
        requirementId: req.id,
        status: matchingSkill ? ('MET' as const) : ('UNKNOWN' as const),
        evidenceIds: matchingSkill ? [matchingSkill.id] : [],
        confidence: matchingSkill ? 90 : 50,
        reason: matchingSkill
          ? `Matched with candidate skill ${matchingSkill.name}`
          : 'No specific matching evidence found in profile',
      };
    });

    const defaultOutput = {
      evaluations,
      roleFitScore: 85,
      skillsFitScore: 80,
      strengths: ['Demonstrated technical skills in target area', 'Role alignment is strong'],
      gaps: ['Some preferred qualifications require clarification'],
      semanticSummary: 'Good candidate alignment with technical profile requirements.',
    };

    return validateAndSanitizeAiOutput(defaultOutput, context, 'mock', 'mock-model-v1', 120);
  }
}
