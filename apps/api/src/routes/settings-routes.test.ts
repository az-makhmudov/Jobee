import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { getConfig } from '@job-agent/config';
import {
  GeminiAiProvider,
  PRIMARY_GEMINI_MODEL,
  FALLBACK_GEMINI_MODEL,
} from '../ai/gemini-ai-provider.js';
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

  describe('2. AI Settings Endpoints', () => {
    it('returns 200 and structured provider info on GET /api/settings/ai', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/settings/ai',
      });
      expect(res.statusCode).toBe(200);

      const body = JSON.parse(res.body);
      expect(body.status).toBe('ok');
      expect(body.data).toBeDefined();
      expect(body.data.activeProvider).toBeDefined();
      expect(body.data.supportedProviders).toHaveLength(3);

      const providerIds = body.data.supportedProviders.map((p: any) => p.id);
      expect(providerIds).toContain('gemini');
      expect(providerIds).toContain('openai');
      expect(providerIds).toContain('disabled');

      expect(body.data.availableModels).toContain(PRIMARY_GEMINI_MODEL);
      expect(body.data.availableModels).toContain(FALLBACK_GEMINI_MODEL);
      expect(body.data.availableModels).toContain('gpt-4o-mini');
    });

    it('runs connectivity test successfully on POST /api/settings/ai/test', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/settings/ai/test',
      });
      expect(res.statusCode).toBe(200);

      const body = JSON.parse(res.body);
      expect(body.status).toBe('ok');
      expect(body.data.success).toBe(true);
      expect(body.data.message).toBeDefined();
      expect(body.data.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('successfully switches active AI provider to disabled via POST /api/settings/ai', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/settings/ai',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          provider: 'disabled',
          model: 'none',
        },
      });
      expect(res.statusCode).toBe(200);

      const body = JSON.parse(res.body);
      expect(body.status).toBe('ok');
      expect(body.data.activeProvider).toBe('disabled');
      expect(body.data.activeModel).toBe('none');
      expect(body.data.mode).toBe('deterministic');

      // Verify that GET /api/settings/ai reflects this change immediately
      const getRes = await app.inject({
        method: 'GET',
        url: '/api/settings/ai',
      });
      expect(getRes.statusCode).toBe(200);
      const getBody = JSON.parse(getRes.body);
      expect(getBody.data.activeProvider).toBe('disabled');
    });

    it('rejects unsupported models with 400 INVALID_MODEL', async () => {
      const hasGeminiKey = Boolean(config.GEMINI_API_KEY || config.AI_API_KEY);
      if (hasGeminiKey) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/settings/ai',
          headers: { 'Content-Type': 'application/json' },
          payload: {
            provider: 'gemini',
            model: 'unsupported-fantasy-model-99',
          },
        });
        expect(res.statusCode).toBe(400);
        const body = JSON.parse(res.body);
        expect(body.error.code).toBe('INVALID_MODEL');
        expect(body.error.message).toContain('Unsupported Gemini model');
      }
    });

    it('automatically upgrades obsolete models like gemini-2.5-flash to primary gemini-3.8-flash', async () => {
      const hasGeminiKey = Boolean(config.GEMINI_API_KEY || config.AI_API_KEY);
      if (hasGeminiKey) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/settings/ai',
          headers: { 'Content-Type': 'application/json' },
          payload: {
            provider: 'gemini',
            model: 'gemini-2.5-flash',
          },
        });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.data.activeModel).toBe(PRIMARY_GEMINI_MODEL);
      }
    });

    it('rejects unconfigured provider activation when API keys are absent', async () => {
      // If OPENAI_API_KEY is not set in test environment, attempting to activate openai should return 400
      const isOpenAiKeySet = Boolean((config as any).OPENAI_API_KEY || config.AI_API_KEY);
      if (!isOpenAiKeySet) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/settings/ai',
          headers: { 'Content-Type': 'application/json' },
          payload: {
            provider: 'openai',
            model: 'gpt-4o-mini',
          },
        });
        expect(res.statusCode).toBe(400);
        const body = JSON.parse(res.body);
        expect(body.error.code).toBe('UNCONFIGURED_CREDENTIALS');
      }
    });

    it('rejects invalid payload on POST /api/settings/ai', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/settings/ai',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          provider: 'invalid-provider-xyz',
        },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
