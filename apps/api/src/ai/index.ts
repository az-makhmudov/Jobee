import { AppConfig } from '@job-agent/config';
import { AiProvider } from './types.js';
import { DisabledAiProvider } from './disabled-ai-provider.js';
import { GeminiAiProvider } from './gemini-ai-provider.js';

export * from './types.js';
export * from './validator.js';
export * from './disabled-ai-provider.js';
export * from './mock-ai-provider.js';
export * from './gemini-ai-provider.js';

export function createAiProvider(config: AppConfig): AiProvider {
  const apiKey = config.AI_API_KEY || config.GEMINI_API_KEY;
  if (config.AI_PROVIDER === 'gemini' && apiKey) {
    const model =
      config.AI_MODEL && config.AI_MODEL.trim().length > 0
        ? config.AI_MODEL.trim()
        : 'gemini-2.5-flash';
    return new GeminiAiProvider(apiKey, model);
  }

  // Defaults to disabled provider if no credentials or provider === 'disabled'
  return new DisabledAiProvider();
}
