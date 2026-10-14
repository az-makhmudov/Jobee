import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  GeminiAiProvider,
  PRIMARY_GEMINI_MODEL,
  FALLBACK_GEMINI_MODEL,
  normalizeGeminiModel,
} from './gemini-ai-provider.js';
import { AiMatchContext } from './types.js';

describe('GeminiAiProvider & Model Management', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const mockContext: AiMatchContext = {
    jobId: 'job-123',
    jobTitle: 'Project Manager',
    jobCompany: 'Tech Corp',
    workplaceType: 'HYBRID',
    descriptionSnippet: 'Leading cross-functional software delivery teams.',
    requirements: [
      {
        id: 'req-agile',
        rawText: 'Experience in Agile/Scrum delivery',
        category: 'MUST_HAVE' as any,
        strength: 'MANDATORY' as any,
      },
    ],
    candidateContext: {
      targetRoles: ['Project Manager'],
      skills: [{ id: 'candidate_skill:agile-id', name: 'Agile', proficiency: 'EXPERT' }],
      experiences: [],
      education: [],
      languages: [],
      certifications: [],
      verifiedFacts: [],
    },
  };

  describe('1. Model Normalization & Defaults', () => {
    it('defaults undefined or empty models to PRIMARY_GEMINI_MODEL (gemini-3.8-flash)', () => {
      expect(normalizeGeminiModel()).toBe(PRIMARY_GEMINI_MODEL);
      expect(normalizeGeminiModel('')).toBe(PRIMARY_GEMINI_MODEL);
      expect(normalizeGeminiModel('   ')).toBe(PRIMARY_GEMINI_MODEL);
    });

    it('automatically upgrades obsolete models (gemini-2.5-flash, gemini-1.5-pro, etc.) to gemini-3.8-flash', () => {
      expect(normalizeGeminiModel('gemini-2.5-flash')).toBe(PRIMARY_GEMINI_MODEL);
      expect(normalizeGeminiModel('gemini-2.5-pro')).toBe(PRIMARY_GEMINI_MODEL);
      expect(normalizeGeminiModel('gemini-1.5-pro')).toBe(PRIMARY_GEMINI_MODEL);
      expect(normalizeGeminiModel('gemini-1.5-flash')).toBe(PRIMARY_GEMINI_MODEL);
      expect(normalizeGeminiModel('gemini-2.0-flash')).toBe(PRIMARY_GEMINI_MODEL);
    });

    it('preserves valid modern models (gemini-3.5-flash-lite, gemini-3.1-pro-preview)', () => {
      expect(normalizeGeminiModel('gemini-3.5-flash-lite')).toBe('gemini-3.5-flash-lite');
      expect(normalizeGeminiModel('gemini-3.1-pro-preview')).toBe('gemini-3.1-pro-preview');
    });

    it('provider normalizes model on initialization', () => {
      const provider = new GeminiAiProvider('mock-key', 'gemini-2.5-flash');
      expect(provider.configuredModel).toBe(PRIMARY_GEMINI_MODEL);
    });
  });

  describe('2. Error Handling & Status Code Mappings', () => {
    it('maps HTTP 404 to descriptive unavailable model error', async () => {
      global.fetch = vi.fn().mockImplementation(async (_url: string) => {
        return new Response(
          JSON.stringify({
            error: {
              code: 404,
              message: 'This model models/gemini-2.5-flash is no longer available to new users.',
              status: 'NOT_FOUND',
            },
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } },
        );
      });

      const provider = new GeminiAiProvider('mock-key', 'gemini-3.5-flash-lite');
      await expect(provider.analyzeMatch(mockContext)).rejects.toThrow(
        /is unavailable or has been deprecated by Google/,
      );
    });

    it('maps HTTP 429 to RATE_LIMIT_EXCEEDED with informative message', async () => {
      global.fetch = vi.fn().mockImplementation(async () => {
        return new Response(
          JSON.stringify({
            error: {
              code: 429,
              message:
                'You exceeded your current quota, please check your plan and billing details.',
              status: 'RESOURCE_EXHAUSTED',
            },
          }),
          { status: 429, headers: { 'Content-Type': 'application/json' } },
        );
      });

      const provider = new GeminiAiProvider('mock-key', PRIMARY_GEMINI_MODEL);
      await expect(provider.analyzeMatch(mockContext)).rejects.toThrow(
        /rate limit or quota exceeded/,
      );
    });

    it('maps HTTP 401/403 to UNAUTHORIZED credential error', async () => {
      global.fetch = vi.fn().mockImplementation(async () => {
        return new Response(
          JSON.stringify({
            error: {
              code: 403,
              message: 'API key not valid. Please pass a valid API key.',
              status: 'PERMISSION_DENIED',
            },
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        );
      });

      const provider = new GeminiAiProvider('bad-key', PRIMARY_GEMINI_MODEL);
      await expect(provider.analyzeMatch(mockContext)).rejects.toThrow(
        /Invalid or unauthorized Gemini API key/,
      );
    });
  });

  describe('3. High Availability Transparent Failover (503)', () => {
    it('transparently fails over from gemini-3.8-flash to gemini-3.5-flash-lite on 503 high demand', async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        callCount++;
        if (url.includes('gemini-3.8-flash')) {
          return new Response(
            JSON.stringify({
              error: {
                code: 503,
                message:
                  'This model is currently experiencing high demand. Spikes in demand are usually temporary.',
                status: 'UNAVAILABLE',
              },
            }),
            { status: 503, headers: { 'Content-Type': 'application/json' } },
          );
        }

        if (url.includes('gemini-3.5-flash-lite')) {
          return new Response(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          evaluations: [
                            {
                              requirementId: 'req-agile',
                              status: 'MET',
                              evidenceIds: ['candidate_skill:agile-id'],
                              confidence: 95,
                              reason: 'Demonstrated deep expertise in Agile methodologies.',
                            },
                          ],
                          roleFitScore: 90,
                          skillsFitScore: 95,
                          strengths: ['Agile certification & practice'],
                          gaps: [],
                          semanticSummary: 'Strong match for project management position.',
                        }),
                      },
                    ],
                  },
                },
              ],
              usageMetadata: { totalTokenCount: 150 },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        throw new Error(`Unexpected url: ${url}`);
      });

      const provider = new GeminiAiProvider('mock-key', PRIMARY_GEMINI_MODEL);
      const result = await provider.analyzeMatch(mockContext);

      expect(callCount).toBe(2);
      expect(result.model).toBe(FALLBACK_GEMINI_MODEL);
      expect(result.evaluations).toHaveLength(1);
      expect(result.evaluations[0]?.status).toBe('MET');
      expect(result.evaluations[0]?.evidenceIds).toContain('candidate_skill:agile-id');
      expect(result.roleFitScore).toBe(90);
    });
  });

  describe('4. Truthfulness & Anti-Hallucination Invariant', () => {
    it('drops invented evidence IDs and degrades evaluation status to UNKNOWN if all claims are fabricated', async () => {
      global.fetch = vi.fn().mockImplementation(async () => {
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        evaluations: [
                          {
                            requirementId: 'req-agile',
                            status: 'MET',
                            // Candidate does NOT have candidate_experience:fake-id or candidate_fact:hallucinated
                            evidenceIds: [
                              'candidate_experience:fake-id',
                              'candidate_fact:hallucinated',
                            ],
                            confidence: 90,
                            reason: 'Candidate led Agile projects at Google for 5 years.',
                          },
                        ],
                        roleFitScore: 85,
                        skillsFitScore: 85,
                        strengths: ['Claims extensive leadership'],
                        gaps: [],
                        semanticSummary: 'Fabricated match.',
                      }),
                    },
                  ],
                },
              },
            ],
            usageMetadata: { totalTokenCount: 120 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      });

      const provider = new GeminiAiProvider('mock-key', PRIMARY_GEMINI_MODEL);
      const result = await provider.analyzeMatch(mockContext);

      expect(result.evaluations).toHaveLength(1);
      const evalItem = result.evaluations[0];
      // Invented evidence must be completely stripped
      expect(evalItem?.evidenceIds).toHaveLength(0);
      // Because all evidence was dropped, status MUST degrade to UNKNOWN
      expect(evalItem?.status).toBe('UNKNOWN');
      expect(evalItem?.reason).toContain('Unverifiable evidence claims were excluded');
    });
  });
});
