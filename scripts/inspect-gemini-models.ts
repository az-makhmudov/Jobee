import { config } from 'dotenv';
config();

async function main() {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.AI_API_KEY || '').trim();
  if (!apiKey) {
    console.error('ERROR: GEMINI_API_KEY is not set');
    process.exit(1);
  }

  console.log('1. Querying Google Generative Language Models endpoint...');
  try {
    const listRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
    );
    if (!listRes.ok) {
      console.error(`List models failed: HTTP ${listRes.status} ${listRes.statusText}`);
      const errBody = await listRes.text();
      console.error(`Error details: ${errBody}`);
    } else {
      const data = (await listRes.json()) as {
        models?: Array<{
          name: string;
          displayName?: string;
          supportedGenerationMethods?: string[];
        }>;
      };
      const models = data.models || [];
      console.log(`Found ${models.length} available models for this API key:`);
      for (const m of models) {
        if (m.name.includes('gemini') || m.name.includes('flash') || m.name.includes('pro')) {
          console.log(
            ` - ${m.name} (${m.displayName || 'No display name'}) [${(m.supportedGenerationMethods || []).join(', ')}]`,
          );
        }
      }
    }
  } catch (err) {
    console.error('Failed to list models:', err);
  }

  // 2. Test specific candidate models
  const candidateModels = [
    'gemini-2.5-flash',
    'gemini-3.8-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-pro-preview',
    'gemini-3.1-flash-lite',
  ];

  console.log('\n2. Testing candidate models generation and structured output...');
  for (const modelId of candidateModels) {
    process.stdout.write(`Testing ${modelId}... `);
    const start = Date.now();
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: 'Return a JSON object with {"status": "ok", "model": "' + modelId + '"}' },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
      });

      const elapsed = Date.now() - start;
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.log(`FAILED (HTTP ${res.status}): ${errText.slice(0, 150)}`);
      } else {
        const body = (await res.json()) as any;
        const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
        let jsonValid = false;
        try {
          if (text) {
            JSON.parse(text);
            jsonValid = true;
          }
        } catch {
          jsonValid = false;
        }
        console.log(
          `SUCCESS in ${elapsed}ms | Structured JSON: ${jsonValid ? 'VALID' : 'INVALID'} | Response: ${text?.trim()}`,
        );
      }
    } catch (err: any) {
      console.log(`EXCEPTION: ${err.message}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
