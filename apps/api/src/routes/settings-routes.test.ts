import { DynamicAiProvider } from '@job-agent/database/matching';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { getConfig } from '@job-agent/config';
import { GeminiAiProvider, PRIMARY_GEMINI_MODEL } from '../ai/gemini-ai-provider.js';
import { OpenAiAiProvider } from '../ai/openai-ai-provider.js';
import { DisabledAiProvider } from '../ai/disabled-ai-provider.js';
import GeminiAlias from '../ai/gemini-provider.js';

describe('Settings Routes & AI Provider Architecture Integration Tests', () => {
  const config = getConfig();
  let app: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    app = buildApp({ config });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. AI Provider Instantiation & Interfaces', () => {
    it('instantiates Gemini provider correctly and verifies availability', () => {
      const provider = new GeminiAiProvider('test-key', PRIMARY_GEMINI_MODEL);
      expect(provider.name).toBe('gemini');
      expect(provider.isAvailable()).toBe(true);
      expect(provider.configuredModel).toBe(PRIMARY_GEMINI_MODEL);

      const unconfigured = new GeminiAiProvider('', PRIMARY_GEMINI_MODEL);
      expect(unconfigured.isAvailable()).toBe(false);
    });

    it('verifies gemini-provider alias works identically and normalizes obsolete model', () => {
      const aliased = new GeminiAlias('alias-key', 'gemini-2.5-flash');
      expect(aliased.name).toBe('gemini');
      expect(aliased.isAvailable()).toBe(true);
      expect(aliased.configuredModel).toBe(PRIMARY_GEMINI_MODEL);
    });

    it('instantiates OpenAI provider correctly and verifies availability', () => {
      const provider = new OpenAiAiProvider('test-openai-key', 'gpt-4o-mini');
      expect(provider.name).toBe('openai');
      expect(provider.isAvailable()).toBe(true);

      const unconfigured = new OpenAiAiProvider('', 'gpt-4o-mini');
      expect(unconfigured.isAvailable()).toBe(false);
    });

    it('instantiates Disabled provider correctly and reports unavailable', () => {
      const provider = new DisabledAiProvider();
      expect(provider.name).toBe('disabled');
      expect(provider.isAvailable()).toBe(false);
    });
  });

  describe('2. Jobee-managed AI', () => {
    it('ignores a legacy candidate provider/model override and keeps Gemini', () => {
      const runtime = new DynamicAiProvider({
        ...config,
        AI_PROVIDER: 'gemini',
        GEMINI_API_KEY: 'synthetic-offline-key',
      });
      const selected = runtime.forPolicy({
        activeAiProvider: 'openai',
        activeAiModel: 'gpt-4o',
      } as NonNullable<Parameters<DynamicAiProvider['forPolicy']>[0]>);
      expect(selected).toBe(runtime);
      expect(selected.name).toBe('gemini');
      expect(() => runtime.setActiveProvider('openai')).toThrow('Gemini only');
    });
    it('shows only operator diagnostics to an admin, without selectable providers', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/settings/ai' });
      expect(res.statusCode).toBe(200);
      expect(res.json().data).toEqual({
        activeProvider: 'gemini',
        isAvailable: false,
        managedBy: 'server',
      });
    });
    it('denies candidate access to operator diagnostics', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/settings/ai',
        headers: { 'x-test-user-id': crypto.randomUUID(), 'x-test-user-role': 'user' },
      });
      expect(res.statusCode).toBe(403);
    });
    it.each(['gemini', 'openai', 'disabled'])(
      'cannot switch the shared runtime to %s through the API',
      async (provider) => {
        const res = await app.inject({
          method: 'POST',
          url: '/api/settings/ai',
          payload: { provider },
        });
        expect(res.statusCode).toBe(403);
      },
    );
    it('does not expose a user-triggered paid connectivity test', async () => {
      expect((await app.inject({ method: 'POST', url: '/api/settings/ai/test' })).statusCode).toBe(
        403,
      );
    });
  });
});
