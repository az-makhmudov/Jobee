import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { getConfig } from '@job-agent/config';
import { GeminiAiProvider } from '../ai/gemini-ai-provider.js';
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
      const provider = new GeminiAiProvider('test-key', 'gemini-2.5-flash');
      expect(provider.name).toBe('gemini');
      expect(provider.isAvailable()).toBe(true);

      const unconfigured = new GeminiAiProvider('', 'gemini-2.5-flash');
      expect(unconfigured.isAvailable()).toBe(false);
    });

    it('verifies gemini-provider alias works identically', () => {
      const aliased = new GeminiAlias('alias-key', 'gemini-2.5-flash');
      expect(aliased.name).toBe('gemini');
      expect(aliased.isAvailable()).toBe(true);
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

      expect(body.data.availableModels).toContain('gemini-2.5-flash');
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
  });
});
