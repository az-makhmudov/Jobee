import type { FastifyPluginAsync } from 'fastify';
import type { ReadinessResponse } from '@job-agent/shared';
import { checkDatabaseHealth } from '@job-agent/database';
import type { AppConfig } from '@job-agent/config';
import type { AiProvider } from '../ai/index.js';

export function createReadyRoutes(config: AppConfig, aiProvider?: AiProvider): FastifyPluginAsync {
  return async (app) => {
    const handleReady = async (_req: any, reply: any) => {
      const dbHealth = await checkDatabaseHealth(config.DATABASE_URL);

      let overallStatus: 'ready' | 'degraded' | 'unhealthy' = 'ready';
      let statusCode = 200;

      if (dbHealth.status === 'disconnected') {
        overallStatus = 'unhealthy';
        statusCode = 503;
      } else if (dbHealth.status === 'unconfigured') {
        overallStatus = config.NODE_ENV === 'production' ? 'unhealthy' : 'degraded';
        statusCode = config.NODE_ENV === 'production' ? 503 : 200;
      }

      const isAiConfigured = aiProvider
        ? aiProvider.isAvailable()
        : Boolean(config.AI_PROVIDER === 'gemini' && (config.AI_API_KEY || config.GEMINI_API_KEY));
      const aiProviderName = aiProvider ? aiProvider.name : config.AI_PROVIDER;
      const aiMode = isAiConfigured ? ('llm' as const) : ('deterministic' as const);

      const hasGmail = Boolean(config.GMAIL_CLIENT_ID && config.GMAIL_CLIENT_SECRET);
      const hasCalendar = Boolean(
        config.GOOGLE_CALENDAR_CLIENT_ID && config.GOOGLE_CALENDAR_CLIENT_SECRET,
      );

      reply.status(statusCode);
      return {
        status: overallStatus,
        service: 'api' as const,
        version: '0.1.0',
        timestamp: new Date().toISOString(),
        checks: {
          database: dbHealth,
          ai: {
            provider: aiProviderName,
            isConfigured: isAiConfigured,
            model:
              (aiProvider as any)?.activeModel ||
              config.AI_MODEL ||
              (aiProviderName === 'gemini' ? 'gemini-2.5-flash' : 'none'),
            mode: aiMode,
          },
          integrations: {
            gmail: { isConfigured: hasGmail },
            googleCalendar: { isConfigured: hasCalendar },
          },
        },
      };
    };

    app.get<{ Reply: ReadinessResponse }>('/ready', handleReady);
    app.get<{ Reply: ReadinessResponse }>('/health/ready', handleReady);
  };
}
