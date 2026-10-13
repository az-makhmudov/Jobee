import { AppConfig } from '@job-agent/config';
import { DynamicAiProvider } from './dynamic-ai-provider.js';

export * from './types.js';
export * from './validator.js';
export * from './disabled-ai-provider.js';
export * from './mock-ai-provider.js';
export * from './gemini-ai-provider.js';
export * from './openai-ai-provider.js';
export * from './dynamic-ai-provider.js';

export function createAiProvider(config: AppConfig): DynamicAiProvider {
  return new DynamicAiProvider(config);
}
