import { BaseAtsAdapter } from './base-ats-adapter.js';
import type { BrowserPage, BrowserLocator } from '../browser/browser-controller.js';
import {
  AtsProviderType,
  AtsFormFieldType,
  inferHostedAtsProvider,
  type AtsFormSchema,
  type AtsFormField,
} from '@job-agent/shared';

/** Public hosted forms only; unknown variants deliberately hand back to the employer. JOB-P5-T01. */
export class SmartRecruitersAdapter extends BaseAtsAdapter {
  readonly provider = AtsProviderType.SMARTRECRUITERS;
  matches(url: string): boolean {
    return inferHostedAtsProvider(url) === this.provider;
  }

  private identity(raw: string): string | undefined {
    if (!this.matches(raw)) return;
    const path = new URL(raw).pathname;
    const parts =
      path.match(/^\/oneclick-ui\/company\/([\w-]+)\/publication\/(\d+)(?:\/|$)/i) ??
      path.match(/^\/([\w-]+)\/(\d+)(?:-|\/|$)/);
    return parts ? `${parts[1]!.toLowerCase()}:${parts[2]}` : undefined;
  }
  assertDestination(target: string, current: string): void {
    const id = this.identity(target);
    if (!id || id !== this.identity(current))
      throw new Error(
        'Application destination changed. Continue on the employer website; this browser session cannot be transferred.',
      );
  }

  /** Only labelled, unambiguous controls; a Next button is never a Submit button. */
  async control(page: BrowserPage, kind: 'entry' | 'next' | 'submit'): Promise<string | undefined> {
    const $ = this.get$FromHtml(await page.content());
    const allowed =
      kind === 'entry'
        ? /^(apply|apply now|i(?:’|')m interested)$/i
        : kind === 'next'
          ? /^(next|continue|review application)$/i
          : /^(submit application|send application|apply)$/i;
    const candidates: string[] = [];
    const nodes = $('button, input[type="submit"], a[href]').toArray();
    for (let i = 0; i < nodes.length; i++) {
      const el = $(nodes[i]);
      const text = (el.text() || el.attr('value') || '').trim();
      if (!allowed.test(text) || el.attr('disabled') !== undefined) continue;
      if (kind !== 'entry' && el.is('a')) continue;
      // Attribute selectors use JSON string escaping, never raw employer-controlled IDs.
      const id = el.attr('id');
      const name = el.attr('name');
      const href = el.attr('href');
      let path = '';
      let current = el;
      while (current.length && current[0]?.type === 'tag') {
        const tag = current.prop('tagName')?.toLowerCase();
        if (!tag) break;
        const position = current.prevAll(tag).length + 1;
        path = `${tag}:nth-of-type(${position})${path ? ' > ' + path : ''}`;
        current = current.parent();
      }
      const sel = id
        ? `[id=${JSON.stringify(id)}]`
        : name
          ? `[name=${JSON.stringify(name)}]`
          : href
            ? `a[href=${JSON.stringify(href)}]`
            : path || undefined;
      if (!sel) continue;
      const loc = page.locator(sel);
      if ((await loc.count()) !== 1 || !(await loc.isVisible())) continue;
      if (href) this.assertDestination(page.url(), new URL(href, page.url()).href);
      candidates.push(sel);
    }
    if (candidates.length > 1)
      throw new Error('Ambiguous employer navigation. Continue on the employer website.');
    return candidates[0];
  }

  override async selectDropdownOption(
    locator: BrowserLocator,
    desiredValue: string,
    options?: string[],
  ): Promise<void> {
    const label = options?.find(
      (value) => value.toLowerCase() === desiredValue.trim().toLowerCase(),
    );
    if (!label) throw new Error('No exact verified dropdown answer.');
    await locator.selectOption({ label });
  }

  async extractForm(page: BrowserPage): Promise<AtsFormSchema> {
    const $ = this.get$FromHtml(await page.content());
    const fields: AtsFormField[] = [];
    for (const node of $('form input, form select, form textarea').toArray()) {
      const el = $(node),
        id = el.attr('id'),
        name = el.attr('name') || id || '';
      const type = (el.attr('type') || 'text').toLowerCase();
      if (
        ['hidden', 'submit', 'button', 'reset'].includes(type) ||
        el.attr('disabled') !== undefined
      )
        continue;
      const selector = id ? `[id=${JSON.stringify(id)}]` : `[name=${JSON.stringify(name)}]`;
      const loc = page.locator(selector);
      if (!name || (await loc.count()) !== 1)
        throw new Error('Unsupported employer control. Continue on the employer website.');
      // File inputs are commonly visually hidden behind an upload control.
      if (type !== 'file' && !(await loc.isVisible())) continue;
      const label =
        (id
          ? $('label')
              .filter((_, l) => $(l).attr('for') === id)
              .text()
          : '') ||
        el.attr('aria-label') ||
        el.closest('label').text() ||
        name;
      const required =
        el.attr('required') !== undefined ||
        el.attr('aria-required') === 'true' ||
        label.includes('*');
      if (type === 'radio' || el.attr('role') === 'combobox' || el.is('select[multiple]'))
        throw new Error('Unsupported employer control. Continue on the employer website.');
      let fieldType: AtsFormField['type'] = el.is('select')
        ? AtsFormFieldType.SELECT
        : el.is('textarea')
          ? AtsFormFieldType.TEXTAREA
          : type === 'checkbox'
            ? AtsFormFieldType.CHECKBOX
            : type === 'email'
              ? AtsFormFieldType.EMAIL
              : type === 'tel'
                ? AtsFormFieldType.PHONE
                : AtsFormFieldType.TEXT;
      if (type === 'file') {
        const hint = `${label} ${name}`;
        if (/cover.?letter/i.test(hint)) fieldType = AtsFormFieldType.FILE_COVER_LETTER;
        else if (/resume|\bcv\b/i.test(hint)) fieldType = AtsFormFieldType.FILE_RESUME;
        else throw new Error('Unsupported document request. Continue on the employer website.');
      }
      fields.push({
        id: id || name,
        name,
        label: label.trim(),
        type: fieldType,
        required,
        selector,
        ...(el.is('select')
          ? {
              options: el
                .find('option')
                .toArray()
                .filter((o) => $(o).attr('value') !== '')
                .map((o) => $(o).text().trim()),
            }
          : {}),
      });
    }
    if ($('[role="combobox"], [contenteditable="true"]').length)
      throw new Error('Unsupported employer control. Continue on the employer website.');
    return {
      provider: this.provider,
      pageTitle: await page.title(),
      fields,
      hasResumeUpload: fields.some((f) => f.type === AtsFormFieldType.FILE_RESUME),
      hasCaptcha: (await this.detectChallenge(page)).detected,
    };
  }
}
