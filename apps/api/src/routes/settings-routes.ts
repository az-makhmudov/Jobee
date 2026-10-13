import type { FastifyPluginAsync } from 'fastify';
import type { AppConfig } from '@job-agent/config';
import type { AiProvider } from '../ai/index.js';

export interface SettingsRoutesOptions {
  config: AppConfig;
  aiProvider: AiProvider;
}

export const createSettingsRoutes = (options: SettingsRoutesOptions): FastifyPluginAsync => {
  const { config, aiProvider } = options;

  return async (app) => {
    // GET /settings/ai - Inspect current AI configuration
    const handleGetAiSettings = async () => {
      const isGeminiKeySet = Boolean(config.GEMINI_API_KEY || config.AI_API_KEY);
      const isOpenAiKeySet = Boolean((config as any).OPENAI_API_KEY || config.AI_API_KEY);

      return {
        status: 'ok',
        data: {
          activeProvider: aiProvider.name,
          activeModel:
            config.AI_MODEL ||
            (aiProvider.name === 'gemini'
              ? 'gemini-2.5-flash'
              : aiProvider.name === 'openai'
                ? 'gpt-4o-mini'
                : 'none'),
          isAvailable: aiProvider.isAvailable(),
          mode: aiProvider.isAvailable() ? 'llm' : 'deterministic',
          credentialsDetected: {
            gemini: isGeminiKeySet,
            openai: isOpenAiKeySet,
          },
          supportedProviders: [
            {
              id: 'gemini',
              name: 'Google Gemini',
              recommendedModel: 'gemini-2.5-flash',
              description:
                'High-speed multimodal LLM with structured output enforcement and zero-hallucination verification.',
              credentialEnv: 'GEMINI_API_KEY',
              isConfigured: isGeminiKeySet,
            },
            {
              id: 'openai',
              name: 'OpenAI GPT',
              recommendedModel: 'gpt-4o-mini',
              description:
                'OpenAI GPT model family with structured JSON outputs and candidate fact boundary validation.',
              credentialEnv: 'OPENAI_API_KEY',
              isConfigured: isOpenAiKeySet,
            },
            {
              id: 'disabled',
              name: 'Deterministic Grounded (Offline)',
              recommendedModel: 'none',
              description:
                '100% deterministic rule-based matching engine. Zero external API calls. Zero hallucination risk.',
              credentialEnv: 'None (Default)',
              isConfigured: true,
            },
          ],
          availableModels: ['gemini-2.5-flash', 'gemini-1.5-pro', 'gpt-4o', 'gpt-4o-mini'],
        },
        timestamp: new Date().toISOString(),
      };
    };

    app.get('/settings/ai', handleGetAiSettings);
    app.get('/api/settings/ai', handleGetAiSettings);

    // POST /settings/ai/test - Test live connectivity with active AI provider
    const handleTestAi = async () => {
      const startTime = Date.now();
      if (!aiProvider.isAvailable()) {
        return {
          status: 'ok',
          data: {
            success: true,
            provider: aiProvider.name,
            model: 'none',
            latencyMs: Date.now() - startTime,
            message:
              'Deterministic rule-based engine is active and ready. Zero external API calls required.',
          },
          timestamp: new Date().toISOString(),
        };
      }

      try {
        const testContext = {
          jobTitle: 'Software Engineer',
          jobCompany: 'Acme Corp',
          workplaceType: 'REMOTE' as const,
          descriptionSnippet: 'Looking for a software engineer proficient in TypeScript.',
          requirements: [
            {
              id: 'req-test-1',
              category: 'MUST_HAVE' as const,
              text: 'Proficiency in TypeScript',
              dimension: 'SKILLS' as const,
            },
          ],
          candidateContext: {
            skills: ['TypeScript', 'Node.js'],
            experiences: [],
            projects: [],
          },
        };

        const result = await aiProvider.analyzeMatch(testContext as any);
        const latencyMs = Date.now() - startTime;

        return {
          status: 'ok',
          data: {
            success: true,
            provider: aiProvider.name,
            model:
              config.AI_MODEL ||
              (aiProvider.name === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini'),
            latencyMs,
            message: `Successfully connected to ${aiProvider.name.toUpperCase()} API. Match analysis validated in ${latencyMs}ms.`,
            sampleSummary: result.semanticSummary,
          },
          timestamp: new Date().toISOString(),
        };
      } catch (err: unknown) {
        return {
          status: 'error',
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message:
              err instanceof Error
                ? err.message
                : `Failed to test ${aiProvider.name} API connectivity`,
          },
          timestamp: new Date().toISOString(),
        };
      }
    };

    app.post('/settings/ai/test', handleTestAi);
    app.post('/api/settings/ai/test', handleTestAi);
  };
};
