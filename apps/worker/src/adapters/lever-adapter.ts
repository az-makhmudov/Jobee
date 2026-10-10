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
 * Lever ATS Adapter (JOB-P5-T01)
 *
 * Implements form extraction and interaction for Lever job applications.
 */
export class LeverAdapter extends BaseAtsAdapter {
  readonly provider: AtsProviderType = AtsProviderType.LEVER;

  matches(url: string, content?: string): boolean {
    const urlLower = url.toLowerCase();
    if (urlLower.includes('lever.co')) {
      return true;
    }
    if (content) {
      const cLower = content.toLowerCase();
      if (
        cLower.includes('jobs.lever.co') ||
        cLower.includes('class="template-btn-submit"') ||
        cLower.includes('name="urls[linkedin]"')
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
    const form = $('form#application-form, form').first();
    const jobTitle = $('.posting-headline h2, h2, h1').first().text().trim() || title;
    const company =
      $('.main-header-logo, .posting-headline .company-name').first().text().trim() || undefined;

    // 1. Resume
    const resumeEl = form.find('input[type="file"][name="resume"], #resume-upload-input');
    let hasResumeUpload = false;
    if (resumeEl.length > 0) {
      hasResumeUpload = true;
      fields.push({
        id: 'resume',
        name: 'resume',
        label: 'Resume/CV',
        type: AtsFormFieldType.FILE_RESUME,
        required: this.isElementRequired(resumeEl),
        selector: 'input[name="resume"]',
        mappedConcept: 'resume',
      });
    }

    // 2. Full Name
    const nameEl = form.find('input[name="name"]');
    if (nameEl.length > 0) {
      fields.push({
        id: 'name',
        name: 'name',
        label: this.getLabelForLeverElement($, nameEl, 'Full Name'),
        type: AtsFormFieldType.TEXT,
        required: this.isElementRequired(nameEl),
        selector: 'input[name="name"]',
        mappedConcept: 'fullName',
      });
    }

    // 3. Email
    const emailEl = form.find('input[name="email"]');
    if (emailEl.length > 0) {
      fields.push({
        id: 'email',
        name: 'email',
        label: this.getLabelForLeverElement($, emailEl, 'Email'),
        type: AtsFormFieldType.EMAIL,
        required: this.isElementRequired(emailEl),
        selector: 'input[name="email"]',
        mappedConcept: 'email',
      });
    }

    // 4. Phone
    const phoneEl = form.find('input[name="phone"]');
    if (phoneEl.length > 0) {
      fields.push({
        id: 'phone',
        name: 'phone',
        label: this.getLabelForLeverElement($, phoneEl, 'Phone'),
        type: AtsFormFieldType.PHONE,
        required: this.isElementRequired(phoneEl),
        selector: 'input[name="phone"]',
        mappedConcept: 'phone',
      });
    }

    // 5. Current Company / Org
    const orgEl = form.find('input[name="org"]');
    if (orgEl.length > 0) {
      fields.push({
        id: 'org',
        name: 'org',
        label: 'Current company',
        type: AtsFormFieldType.TEXT,
        required: this.isElementRequired(orgEl),
        selector: 'input[name="org"]',
      });
    }

    // 6. Social URLs
    const linkedinEl = form.find('input[name="urls[LinkedIn]"]');
    if (linkedinEl.length > 0) {
      fields.push({
        id: 'urls[LinkedIn]',
        name: 'urls[LinkedIn]',
        label: 'LinkedIn URL',
        type: AtsFormFieldType.TEXT,
        required: this.isElementRequired(linkedinEl),
        selector: 'input[name="urls[LinkedIn]"]',
        mappedConcept: 'linkedin',
      });
    }

    const githubEl = form.find('input[name="urls[GitHub]"]');
    if (githubEl.length > 0) {
      fields.push({
        id: 'urls[GitHub]',
        name: 'urls[GitHub]',
        label: 'GitHub URL',
        type: AtsFormFieldType.TEXT,
        required: this.isElementRequired(githubEl),
        selector: 'input[name="urls[GitHub]"]',
        mappedConcept: 'github',
      });
    }

    // 7. Comments / Cover Letter
    const commentsEl = form.find('textarea[name="comments"]');
    if (commentsEl.length > 0) {
      fields.push({
        id: 'comments',
        name: 'comments',
        label: 'Additional Information',
        type: AtsFormFieldType.TEXTAREA,
        required: this.isElementRequired(commentsEl),
        selector: 'textarea[name="comments"]',
        mappedConcept: 'coverLetter',
      });
    }

    // 8. Custom questions / cards
    form.find('.application-question, [name^="cards["]').each((_, card) => {
      const $card = $(card);
      const inputEl = $card.is('input, select, textarea')
        ? $card
        : $card.find('input, select, textarea').first();
      if (inputEl.length === 0) return;

      const name = inputEl.attr('name') || '';
      if (
        !name ||
        name === 'name' ||
        name === 'email' ||
        name === 'phone' ||
        name === 'resume' ||
        name === 'org'
      ) {
        return;
      }

      // Check if already registered
      if (fields.some((f) => f.name === name)) return;

      const tagName = (inputEl[0] as { tagName?: string }).tagName?.toLowerCase() || '';
      let fieldType: AtsFormFieldType = AtsFormFieldType.TEXT;
      let options: string[] | undefined;

      if (tagName === 'select') {
        fieldType = AtsFormFieldType.SELECT;
        options = [];
        inputEl.find('option').each((__, opt) => {
          const val = $(opt).text().trim() || $(opt).attr('value') || '';
          if (val && !val.toLowerCase().includes('select an option')) {
            options?.push(val);
          }
        });
      } else if (tagName === 'textarea') {
        fieldType = AtsFormFieldType.TEXTAREA;
      }

      const label = this.getLabelForLeverElement($, inputEl, name);

      fields.push({
        id: name,
        name,
        label,
        type: fieldType,
        required: this.isElementRequired(inputEl) || this.isElementRequired($card),
        selector: `[name="${name}"]`,
        options,
      });
    });

    const challenge = await this.detectChallenge(page);

    return {
      provider: AtsProviderType.LEVER,
      pageTitle: title,
      jobTitle,
      company,
      fields,
      hasCaptcha: challenge.detected,
      hasResumeUpload,
    };
  }

  private isElementRequired(el: cheerio.Cheerio<any>): boolean {
    if (el.attr('required') !== undefined || el.attr('aria-required') === 'true') {
      return true;
    }
    const prevLabel = el.prev('.application-label');
    if (prevLabel.length > 0) {
      return prevLabel.find('.asterisk, .required').length > 0 || prevLabel.text().includes('*');
    }
    const questionCard = el.closest('.application-question');
    if (questionCard.length > 0) {
      const cardLabel = questionCard.find('.application-label').first();
      if (cardLabel.length > 0) {
        return cardLabel.find('.asterisk, .required').length > 0 || cardLabel.text().includes('*');
      }
    }
    return false;
  }

  private getLabelForLeverElement(
    _$: cheerio.CheerioAPI,
    el: cheerio.Cheerio<any>,
    defaultLabel: string,
  ): string {
    const prevLabel = el.prev('.application-label');
    if (prevLabel.length > 0) {
      return prevLabel.text().replace(/\*/g, '').trim();
    }
    const cardLabel = el.closest('.application-question').find('.application-label').first();
    if (cardLabel.length > 0) {
      return cardLabel.text().replace(/\*/g, '').trim();
    }
    const parentLabel = el.closest('label');
    if (parentLabel.length > 0) {
      return parentLabel.text().replace(/\*/g, '').trim();
    }
    return defaultLabel;
  }
}
