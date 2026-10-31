import { describe, expect, it } from 'vitest';
import { languageRequirementGroups } from './language-requirement.js';
import { CandidateEvidenceResolver } from './candidate-evidence-resolver.js';
import type { CandidateMatchingContext } from './matching-context-builder.js';
import type { JobRequirement } from '../schema/index.js';
function evaluate(text: string, languages: string[]) {
  const context = {
    languages: languages.map((language) => ({
      id: language,
      language,
      verificationStatus: 'VERIFIED',
      cefrLevel: 'C1',
    })),
    evidenceMap: new Map(),
  } as unknown as CandidateMatchingContext;
  return new CandidateEvidenceResolver().evaluateRequirement(
    {
      id: 'requirement',
      category: 'LANGUAGE',
      requirementStrength: 'MANDATORY',
      rawText: text,
    } as JobRequirement,
    context,
  );
}
describe('compound language evidence', () => {
  const text = 'Fluency in English and French, German, Italian or Spanish';
  it('requires English plus one alternative, not English alone', () => {
    expect(evaluate(text, ['English']).status).toBe('UNKNOWN');
    expect(evaluate(text, ['English', 'German']).status).toBe('MET');
    expect(evaluate(text, ['German']).status).toBe('UNKNOWN');
  });
  it('allows alternatives and requires conjunctions', () => {
    expect(evaluate('English or German', ['German']).status).toBe('MET');
    expect(evaluate('English and German', ['English']).status).toBe('UNKNOWN');
  });
  it('keeps CEFR thresholds local to their clauses', () => {
    expect(evaluate('English B2 and German C2', ['English', 'German']).status).toBe('NOT_MET');
    expect(evaluate('English C2 and German B2', ['English', 'German']).status).toBe('NOT_MET');
  });
  it('does not guess ambiguous list semantics', () => {
    expect(languageRequirementGroups('English, German')).toBeNull();
    expect(evaluate('English B2 or German C2', ['German']).status).toBe('UNKNOWN');
    expect(evaluate('English or French and German', ['French']).status).toBe('UNKNOWN');
    expect(evaluate('English and Swahili', ['English']).status).toBe('UNKNOWN');
    expect(evaluate('English, German', ['English']).status).toBe('UNKNOWN');
  });
  it('keeps optional clauses separate', () => {
    expect(evaluate('English required; German is a plus', ['English']).status).toBe('MET');
  });
});
