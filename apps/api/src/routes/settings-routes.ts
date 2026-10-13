import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import type { AppConfig } from '@job-agent/config';
import type { Database } from '@job-agent/database';
import { applicationPolicy, eq } from '@job-agent/database';
import { z } from 'zod';
import type { AiProvider } from '../ai/index.js';

export interface SettingsRoutesOptions {
  config: AppConfig;
  aiProvider: AiProvider;
  db?: Database;
}

const updateAiSettingsSchema = z.object({
  provider: z.enum(['gemini', 'openai', 'disabled']),
  model: z.string().optional(),
});

export const createSettingsRoutes = (options: SettingsRoutesOptions): FastifyPluginAsync => {
  const { config, aiProvider, db } = options;

  return async (app) => {
    // Helper to resolve current user ID if available
    const getOptionalUserId = async (request: FastifyRequest): Promise<string | null> => {
      try {
        const { requireCurrentUserId } = await import('../plugins/auth-plugin.js');
        return await requireCurrentUserId(request);
      } catch {
        return null;
      }
    };

    const buildSettingsPayload = (providerName: string, modelName: string) => {
      const isGeminiKeySet = Boolean(config.GEMINI_API_KEY || config.AI_API_KEY);
      const isOpenAiKeySet = Boolean((config as any).OPENAI_API_KEY || config.AI_API_KEY);

      return {
        activeProvider: providerName,
        activeModel: modelName,
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
        availableModels: ['gemini-2.5-flash', 'gemini-1.5-pro', 'gpt-4o-mini', 'gpt-4o', 'none'],
      };
    };

    // GET /settings/ai - Inspect current AI configuration
    const handleGetAiSettings = async (request: FastifyRequest, reply: FastifyReply) => {
      let currentProvider = aiProvider.name;
      let currentModel = (aiProvider as any).activeModel || config.AI_MODEL || 'none';

      // Check user preferences in database if available
      const userId = await getOptionalUserId(request);
      if (userId && db) {
        try {
          const userPolicy = await db.query.applicationPolicy.findFirst({
            where: eq(applicationPolicy.userId, userId),
          });
          if (userPolicy?.activeAiProvider) {
            currentProvider = userPolicy.activeAiProvider;
            currentModel = userPolicy.activeAiModel;
          }
        } catch {
          // Fall back to runtime provider
        }
      }

      if (!currentModel || currentModel === 'none') {
        currentModel =
          currentProvider === 'gemini'
            ? 'gemini-2.5-flash'
            : currentProvider === 'openai'
              ? 'gpt-4o-mini'
              : 'none';
      }

      return reply.status(200).send({
        status: 'ok',
        data: buildSettingsPayload(currentProvider, currentModel),
        timestamp: new Date().toISOString(),
      });
    };

    app.get('/settings/ai', handleGetAiSettings);
    app.get('/api/settings/ai', handleGetAiSettings);

    // POST /settings/ai - Dynamically configure active AI provider & model
    const handleUpdateAiSettings = async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = updateAiSettingsSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          status: 'error',
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid AI settings payload',
            details: parseResult.error.flatten(),
          },
          timestamp: new Date().toISOString(),
        });
      }

      const { provider, model } = parseResult.data;

      // Validate credential availability for requested provider
      if (provider === 'gemini') {
        const hasGeminiKey = Boolean(config.GEMINI_API_KEY || config.AI_API_KEY);
        if (!hasGeminiKey) {
          return reply.status(400).send({
            status: 'error',
            error: {
              code: 'UNCONFIGURED_CREDENTIALS',
              message:
                'Cannot activate Google Gemini: GEMINI_API_KEY is not configured in server environment.',
            },
            timestamp: new Date().toISOString(),
          });
        }
      }

      if (provider === 'openai') {
        const hasOpenAiKey = Boolean((config as any).OPENAI_API_KEY || config.AI_API_KEY);
        if (!hasOpenAiKey) {
          return reply.status(400).send({
            status: 'error',
            error: {
              code: 'UNCONFIGURED_CREDENTIALS',
              message:
                'Cannot activate OpenAI: OPENAI_API_KEY is not configured in server environment.',
            },
            timestamp: new Date().toISOString(),
          });
        }
      }

      const resolvedModel =
        model && model.trim().length > 0
          ? model.trim()
          : provider === 'gemini'
            ? 'gemini-2.5-flash'
            : provider === 'openai'
              ? 'gpt-4o-mini'
              : 'none';

      // Update runtime dynamic provider if supported
      if (typeof (aiProvider as any).setActiveProvider === 'function') {
        (aiProvider as any).setActiveProvider(provider, resolvedModel);
      }

      // Persist to user's application policy if DB and user are available
      const userId = await getOptionalUserId(request);
      if (userId && db) {
        try {
          await db
            .insert(applicationPolicy)
            .values({
              userId,
              activeAiProvider: provider,
              activeAiModel: resolvedModel,
            })
            .onConflictDoUpdate({
              target: applicationPolicy.userId,
              set: {
                activeAiProvider: provider,
                activeAiModel: resolvedModel,
                updatedAt: new Date(),
              },
            });
        } catch {
          // Non-blocking if table or user constraint fails
        }
      }

      return reply.status(200).send({
        status: 'ok',
        data: buildSettingsPayload(provider, resolvedModel),
        message: `Successfully switched active AI provider to ${provider.toUpperCase()} (${resolvedModel}).`,
        timestamp: new Date().toISOString(),
      });
    };

    app.post('/settings/ai', handleUpdateAiSettings);
    app.post('/api/settings/ai', handleUpdateAiSettings);

    // POST /settings/ai/test - Test live connectivity with active AI provider
    const handleTestAi = async (_request: FastifyRequest, reply: FastifyReply) => {
      const startTime = Date.now();
      if (!aiProvider.isAvailable()) {
        return reply.status(200).send({
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
        });
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

        return reply.status(200).send({
          status: 'ok',
          data: {
            success: true,
            provider: aiProvider.name,
            model:
              (aiProvider as any).activeModel ||
              config.AI_MODEL ||
              (aiProvider.name === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini'),
            latencyMs,
            message: `Successfully connected to ${aiProvider.name.toUpperCase()} API. Match analysis validated in ${latencyMs}ms.`,
            sampleSummary: result.semanticSummary,
          },
          timestamp: new Date().toISOString(),
        });
      } catch (err: unknown) {
        return reply.status(200).send({
          status: 'error',
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message:
              err instanceof Error
                ? err.message
                : `Failed to test ${aiProvider.name} API connectivity`,
          },
          timestamp: new Date().toISOString(),
        });
      }
    };

    app.post('/settings/ai/test', handleTestAi);
    app.post('/api/settings/ai/test', handleTestAi);
  };
};
