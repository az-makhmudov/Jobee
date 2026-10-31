import { expect, it } from 'vitest';
import { ManualTextExtractor } from './manual-text-extractor.js';
import { stripHtmlToText } from '@job-agent/shared';
it('excludes employer benefits in English and Polish descriptions', () => {
  for (const [qualifications, benefits] of [
    ['Qualifications', 'Additional Information'],
    ['Nasze oczekiwania', 'To oferujemy'],
  ]) {
    const result = new ManualTextExtractor().extract(
      `Title: Project Intern\n${qualifications}\n• English required\n${benefits}\n• Private medical care\n• Training program`,
    );
    expect(result.requirements?.map((r) => r.rawText)).toEqual(['English required']);
  }
});
it('does not turn a benefits-only document into candidate requirements', () => {
  expect(
    new ManualTextExtractor().extract('Benefits\n• Private medical care\n• Training program')
      .requirements,
  ).toEqual([]);
});
it('decodes hexadecimal entities without executing markup', () => {
  expect(stripHtmlToText('<p>A&#xa0;B&#x1F600;</p>')).toBe('A B😀');
  expect(stripHtmlToText('&#x110000;')).toBe('�');
});
