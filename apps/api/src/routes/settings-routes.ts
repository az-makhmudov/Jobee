import type { FastifyPluginAsync } from 'fastify';
import type { AppConfig } from '@job-agent/config';
import type { Database } from '@job-agent/database';
import { AppError } from '@job-agent/shared';
import type { AiProvider } from '../ai/index.js';
export interface SettingsRoutesOptions {
  config: AppConfig;
  aiProvider: AiProvider;
  db?: Database;
}
/** Operator diagnostics only. Candidate policy never configures the shared AI process. */
export const createSettingsRoutes =
  ({ aiProvider }: SettingsRoutesOptions): FastifyPluginAsync =>
  async (app) => {
    for (const prefix of ['/settings/ai', '/api/settings/ai']) {
      app.get(prefix, { preHandler: app.requireAdmin }, async () => ({
        status: 'ok',
        data: {
          activeProvider: 'gemini',
          isAvailable: aiProvider.name === 'gemini' && aiProvider.isAvailable(),
          managedBy: 'server',
        },
      }));
      app.post(prefix, async () => {
        throw AppError.forbidden(
          'AI is managed by Jobee. Provider and model settings cannot be changed by users.',
        );
      });
      app.post(prefix + '/test', async () => {
        throw AppError.forbidden('AI evaluation is an operator task.');
      });
    }
  };
