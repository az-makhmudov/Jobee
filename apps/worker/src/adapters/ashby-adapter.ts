import * as cheerio from 'cheerio';
import type { BrowserPage } from '../browser/browser-controller.js';
import { BaseAtsAdapter } from './base-ats-adapter.js';
import {
  AtsProviderType,
  AtsFormFieldType,
  type AtsFormField,
  type AtsFormSchema,
} from '@job-agent/shared';

/**
 * Ashby ATS Adapter (JOB-P5-T01)
 *
 * Implements form extraction and interaction for Ashby job board applications.
 */
export class AshbyAdapter extends BaseAtsAdapter {
  readonly provider: AtsProviderType = AtsProviderType.ASHBY;

  matches(url: string, content?: string): boolean {
    const urlLower = url.toLowerCase();
    if (urlLower.includes('ashbyhq.com') || urlLower.includes('ashby')) {
      return true;
    }
    if (content) {
      const cLower = content.toLowerCase();
      if (
        cLower.includes('ashbyhq') ||
        cLower.includes('ashby-application-form') ||
        cLower.includes('ashby-field')
      ) {
        return true;
      }
    }
    return false;
  }

  async extractForm(page: BrowserPage): Promise<AtsFormSchema> {
    const html = await page.content();
    const title = await page.title();
    const $ = this.get$FromHtml(html);

    const fields: AtsFormField[] = [];
    const form = $('form#ashby-application-form, form').first();
    const jobTitle = $('h1, h2, h3').first().text().trim() || title;
    const company = $('.ashby-company-name, .company-name').first().text().trim() || undefined;

    let hasResumeUpload = false;

    // Scan all .ashby-field containers or form inputs
    const containers = form.find('.ashby-field');

    if (containers.length > 0) {
      containers.each((_, container) => {
        const $c = $(container);
        const dataFieldName = $c.attr('data-field-name') || '';
        const inputEl = $c.find('input, select, textarea').first();
        if (inputEl.length === 0) return;

        const name = inputEl.attr('name') || dataFieldName;
        const tagName = (inputEl[0] as { tagName?: string }).tagName?.toLowerCase() || '';
        const inputType = inputEl.attr('type')?.toLowerCase();

        let fieldType: AtsFormFieldType = AtsFormFieldType.TEXT;
        let mappedConcept: string | undefined;
        let options: string[] | undefined;

        if (tagName === 'select') {
          fieldType = AtsFormFieldType.SELECT;
          options = [];
          inputEl.find('option').each((__, opt) => {
            const val = $(opt).text().trim() || $(opt).attr('value') || '';
            if (val && !val.toLowerCase().includes('select...')) {
              options?.push(val);
            }
          });
        } else if (tagName === 'textarea') {
          fieldType = AtsFormFieldType.TEXTAREA;
        } else if (inputType === 'file' || name === 'resume') {
          const purpose = `${name} ${$c.find('label').first().text()}`.toLowerCase();
          fieldType = /cover.*letter/.test(purpose)
            ? AtsFormFieldType.FILE_COVER_LETTER
            : /resume|cv/.test(purpose)
              ? AtsFormFieldType.FILE_RESUME
              : AtsFormFieldType.CUSTOM;
          mappedConcept = fieldType === AtsFormFieldType.FILE_RESUME ? 'resume' : undefined;
          hasResumeUpload ||= fieldType === AtsFormFieldType.FILE_RESUME;
        } else if (inputType === 'email' || name === 'email') {
          fieldType = AtsFormFieldType.EMAIL;
          mappedConcept = 'email';
        } else if (inputType === 'tel' || name === 'phoneNumber' || name === 'phone') {
          fieldType = AtsFormFieldType.PHONE;
          mappedConcept = 'phone';
        } else if (name === 'name' || name === 'fullName') {
          mappedConcept = 'fullName';
        } else if (name.toLowerCase().includes('linkedin')) {
          mappedConcept = 'linkedin';
        } else if (name.toLowerCase().includes('github')) {
          mappedConcept = 'github';
        }

        const label = $c.find('label').first().text().replace(/\*/g, '').trim() || name;

        fields.push({
          id: inputEl.attr('id') || name,
          name,
          label,
          type: fieldType,
          required: this.isElementRequired($c, inputEl),
          selector: `[name="${name}"]`,
          options,
          mappedConcept,
        });
      });
    } else {
      // Fallback: standard form inputs
      form.find('input, select, textarea').each((_, el) => {
        const $el = $(el);
        const name = $el.attr('name') || '';
        if (!name) return;

        const tagName = (el as { tagName?: string }).tagName?.toLowerCase() || '';
        const inputType = $el.attr('type')?.toLowerCase();

        let fieldType: AtsFormFieldType = AtsFormFieldType.TEXT;
        let mappedConcept: string | undefined;

        if (tagName === 'select') {
          fieldType = AtsFormFieldType.SELECT;
        } else if (tagName === 'textarea') {
          fieldType = AtsFormFieldType.TEXTAREA;
        } else if (inputType === 'file') {
          const purpose = `${name} ${$el.closest('label').text()}`.toLowerCase();
          fieldType = /cover.*letter/.test(purpose)
            ? AtsFormFieldType.FILE_COVER_LETTER
            : /resume|cv/.test(purpose)
              ? AtsFormFieldType.FILE_RESUME
              : AtsFormFieldType.CUSTOM;
          mappedConcept = fieldType === AtsFormFieldType.FILE_RESUME ? 'resume' : undefined;
          hasResumeUpload ||= fieldType === AtsFormFieldType.FILE_RESUME;
        } else if (inputType === 'email' || name.includes('email')) {
          fieldType = AtsFormFieldType.EMAIL;
          mappedConcept = 'email';
        } else if (inputType === 'tel' || name.includes('phone')) {
          fieldType = AtsFormFieldType.PHONE;
          mappedConcept = 'phone';
        }

        const label = $el.closest('label').text().replace(/\*/g, '').trim() || name;

        fields.push({
          id: $el.attr('id') || name,
          name,
          label,
          type: fieldType,
          required: this.isElementRequired($el, $el),
          selector: `[name="${name}"]`,
          mappedConcept,
        });
      });
    }

    const challenge = await this.detectChallenge(page);

    return {
      provider: AtsProviderType.ASHBY,
      pageTitle: title,
      jobTitle,
      company,
      fields,
      hasCaptcha: challenge.detected,
      hasResumeUpload,
    };
  }

  private isElementRequired(container: cheerio.Cheerio<any>, el: cheerio.Cheerio<any>): boolean {
    if (el.attr('required') !== undefined || el.attr('aria-required') === 'true') {
      return true;
    }
    if (
      container.find('.required, .asterisk').length > 0 ||
      container.find('label').text().includes('*')
    ) {
      return true;
    }
    return false;
  }
}
