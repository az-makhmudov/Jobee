import { AppConfig } from '@job-agent/config';
import { AiProvider, AiMatchContext, AiMatchResult } from './types.js';
import { DisabledAiProvider } from './disabled-ai-provider.js';
import { GeminiAiProvider } from './gemini-ai-provider.js';
import { OpenAiAiProvider } from './openai-ai-provider.js';

export interface ProviderSelection {
  provider: 'gemini' | 'openai' | 'disabled';
  model?: string;
}

export class DynamicAiProvider implements AiProvider {
  private config: AppConfig;
  private activeProviderName: 'gemini' | 'openai' | 'disabled';
  private activeModelName: string;
  private currentProvider: AiProvider;

  constructor(config: AppConfig, initial?: ProviderSelection) {
    this.config = config;
    this.activeProviderName = 'disabled';
    this.activeModelName = 'none';
    this.currentProvider = new DisabledAiProvider();

    const requestedProvider = initial?.provider || (config.AI_PROVIDER as any) || 'disabled';
    const requestedModel = initial?.model || config.AI_MODEL;

    try {
      this.setActiveProvider(requestedProvider, requestedModel);
    } catch {
      this.currentProvider = new DisabledAiProvider();
      this.activeProviderName = 'disabled';
      this.activeModelName = 'none';
    }
  }

  get name(): string {
    return this.activeProviderName;
  }

  get activeModel(): string {
    return this.activeModelName;
  }

  isAvailable(): boolean {
    return this.currentProvider.isAvailable();
  }

  async analyzeMatch(context: AiMatchContext): Promise<AiMatchResult> {
    return this.currentProvider.analyzeMatch(context);
  }

  setActiveProvider(providerName: 'gemini' | 'openai' | 'disabled', modelName?: string): void {
    if (providerName === 'gemini') {
      const apiKey = this.config.GEMINI_API_KEY || this.config.AI_API_KEY;
      const model =
        modelName && modelName.trim().length > 0 ? modelName.trim() : 'gemini-2.5-flash';
      if (apiKey && apiKey.trim().length > 0) {
        this.currentProvider = new GeminiAiProvider(apiKey.trim(), model);
        this.activeProviderName = 'gemini';
        this.activeModelName = model;
        return;
      }
      throw new Error('GEMINI_API_KEY is not configured in server environment');
    }

    if (providerName === 'openai') {
      const apiKey = (this.config as any).OPENAI_API_KEY || this.config.AI_API_KEY;
      const model = modelName && modelName.trim().length > 0 ? modelName.trim() : 'gpt-4o-mini';
      if (apiKey && apiKey.trim().length > 0) {
        this.currentProvider = new OpenAiAiProvider(apiKey.trim(), model);
        this.activeProviderName = 'openai';
        this.activeModelName = model;
        return;
      }
      throw new Error('OPENAI_API_KEY is not configured in server environment');
    }

    // Default: disabled
    this.currentProvider = new DisabledAiProvider();
    this.activeProviderName = 'disabled';
    this.activeModelName = 'none';
  }

  getRawCurrentProvider(): AiProvider {
    return this.currentProvider;
  }
}
