// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider, AppearanceSettings, readThemePreference } from './Theme.js';
import { FeedbackProvider, useFeedback } from './Feedback.js';
import { destinationFor } from './navigation.js';
import { candidateApi } from '../api/candidate-client.js';

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.theme;
});
describe('appearance preferences', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
  });
  it('defaults to the device and remembers an explicit override', async () => {
    render(
      <ThemeProvider>
        <AppearanceSettings />
      </ThemeProvider>,
    );
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
    fireEvent.click(screen.getByRole('button', { name: 'Light' }));
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('light'));
    expect(localStorage.getItem('jobee.theme')).toBe('light');
  });
  it('rejects unknown stored values and survives unavailable storage', () => {
    localStorage.setItem('jobee.theme', 'invalid');
    expect(readThemePreference()).toBe('system');
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });
    expect(readThemePreference()).toBe('system');
  });
});
describe('shared decision dialogs', () => {
  it('does not authorize an action until the user confirms', async () => {
    const action = vi.fn();
    function Example() {
      const { confirm } = useFeedback();
      return (
        <button
          onClick={async () => {
            if (await confirm('Delete the selected record?')) action();
          }}
        >
          Delete record
        </button>
      );
    }
    render(
      <FeedbackProvider>
        <Example />
      </FeedbackProvider>,
    );
    fireEvent.click(screen.getByText('Delete record'));
    expect(action).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(action).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Delete record'));
    fireEvent.click(screen.getByText('Confirm'));
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
  });
  it('returns only the user-edited answer for approval and preserves cancel', async () => {
    const result = vi.fn();
    function Example() {
      const { prompt } = useFeedback();
      return (
        <button
          onClick={async () =>
            result(await prompt('Edit value before approval:', 'Original answer'))
          }
        >
          Edit & approve
        </button>
      );
    }
    render(
      <FeedbackProvider>
        <Example />
      </FeedbackProvider>,
    );
    fireEvent.click(screen.getByText('Edit & approve'));
    await waitFor(() =>
      expect(screen.getByLabelText('Answer')).toHaveProperty('value', 'Original answer'),
    );
    fireEvent.change(screen.getByLabelText('Answer'), { target: { value: 'Revised answer' } });
    fireEvent.click(screen.getByText('Save & approve'));
    await waitFor(() => expect(result).toHaveBeenCalledWith('Revised answer'));
    fireEvent.click(screen.getByText('Edit & approve'));
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => expect(result).toHaveBeenLastCalledWith(null));
  });
});
describe('navigation compatibility', () => {
  it('groups existing section callbacks without replacing their identifiers', () => {
    for (const section of ['profile', 'career-intelligence', 'documents', 'answers', 'preferences'])
      expect(destinationFor(section)).toBe('profile');
    expect(destinationFor('activity')).toBe('settings');
    for (const section of ['applications', 'approvals', 'interviews', 'emails'])
      expect(destinationFor(section)).toBe('applications');
  });
});
describe('authenticated document preview retrieval', () => {
  it('uses the existing download route, credentials and cancellation signal', async () => {
    const blob = new Blob(['test'], { type: 'text/plain' }),
      controller = new AbortController();
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(blob));
    const result = await candidateApi.getDocumentBlob('document/id', controller.signal);
    expect(await result.text()).toBe('test');
    expect(fetcher).toHaveBeenCalledWith('/api/candidate/documents/document%2Fid/download', {
      credentials: 'include',
      signal: controller.signal,
    });
  });
  it('does not render an unauthorized response as a document', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Denied', { status: 403 }));
    await expect(candidateApi.getDocumentBlob('private-document')).rejects.toThrow(
      'do not have access',
    );
  });
});
