import { AiMatchContext, AiMatchResult, AiProvider } from './types.js';
import { AppError, ErrorCodes } from '@job-agent/shared';

export class DisabledAiProvider implements AiProvider {
  readonly name = 'disabled';

  isAvailable(): boolean {
    return false;
  }

  async analyzeMatch(_context: AiMatchContext): Promise<AiMatchResult> {
    throw new AppError({
      code: ErrorCodes.SERVICE_UNAVAILABLE,
      message: 'AI provider is disabled or unconfigured',
      statusCode: 501,
    });
  }
}
