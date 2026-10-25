import { afterEach, it, expect, vi } from 'vitest';
import { jobApi } from './job-client.js';
afterEach(() => vi.unstubAllGlobals());
it.each([true, false])(
  'sends relevantOnly=%s to the server instead of silently browsing the entire library',
  async (relevantOnly) => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'ok',
          data: { items: [], total: 0, page: 1, limit: 10, totalPages: 0 },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetcher);
    await jobApi.getJobs({ relevantOnly });
    const url = new URL(fetcher.mock.calls[0]![0] as string, 'http://localhost');
    expect(url.searchParams.get('relevantOnly')).toBe(String(relevantOnly));
  },
);
