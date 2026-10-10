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
 * Greenhouse ATS Adapter (JOB-P5-T01)
 *
 * Implements form extraction and interaction for Greenhouse job board applications.
 */
export class GreenhouseAdapter extends BaseAtsAdapter {
  readonly provider: AtsProviderType = AtsProviderType.GREENHOUSE;

  matches(url: string, content?: string): boolean {
    const urlLower = url.toLowerCase();
    if (urlLower.includes('greenhouse.io') || urlLower.includes('gh_jid')) {
      return true;
    }
    if (content) {
      const cLower = content.toLowerCase();
      if (
        cLower.includes('greenhouse') ||
        cLower.includes('id="application_form"') ||
        cLower.includes('id="submit_app"') ||
        cLower.includes('job_application_answers_attributes')
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

    // Form element inspection
    const form = $('form#application_form, form#apply_form, form').first();
    const jobTitle = $('h1.app-title, .app-title, h1').first().text().trim() || title;
    const company = $('.company-name, .logo-container').first().text().trim() || undefined;

    // 1. First Name
    const firstNameEl = form.find('#first_name, input[name="first_name"]');
    if (firstNameEl.length > 0) {
      fields.push({
        id: firstNameEl.attr('id') || 'first_name',
        name: firstNameEl.attr('name') || 'first_name',
        label: this.getLabelForElement($, firstNameEl, 'First Name'),
        type: AtsFormFieldType.TEXT,
        required: this.isElementRequired(firstNameEl),
        selector: '#first_name, input[name="first_name"]',
        mappedConcept: 'firstName',
      });
    }

    // 2. Last Name
    const lastNameEl = form.find('#last_name, input[name="last_name"]');
    if (lastNameEl.length > 0) {
      fields.push({
        id: lastNameEl.attr('id') || 'last_name',
        name: lastNameEl.attr('name') || 'last_name',
        label: this.getLabelForElement($, lastNameEl, 'Last Name'),
        type: AtsFormFieldType.TEXT,
        required: this.isElementRequired(lastNameEl),
        selector: '#last_name, input[name="last_name"]',
        mappedConcept: 'lastName',
      });
    }

    // 3. Email
    const emailEl = form.find('#email, input[name="email"]');
    if (emailEl.length > 0) {
      fields.push({
        id: emailEl.attr('id') || 'email',
        name: emailEl.attr('name') || 'email',
        label: this.getLabelForElement($, emailEl, 'Email'),
        type: AtsFormFieldType.EMAIL,
        required: this.isElementRequired(emailEl),
        selector: '#email, input[name="email"]',
        mappedConcept: 'email',
      });
    }

    // 4. Phone
    const phoneEl = form.find('#phone, input[name="phone"]');
    if (phoneEl.length > 0) {
      fields.push({
        id: phoneEl.attr('id') || 'phone',
        name: phoneEl.attr('name') || 'phone',
        label: this.getLabelForElement($, phoneEl, 'Phone'),
        type: AtsFormFieldType.PHONE,
        required: this.isElementRequired(phoneEl),
        selector: '#phone, input[name="phone"]',
        mappedConcept: 'phone',
      });
    }

    // 5. Resume
    const resumeEl = form.find('#resume, input[type="file"][name="resume"]');
    let hasResumeUpload = false;
    if (resumeEl.length > 0) {
      hasResumeUpload = true;
      fields.push({
        id: resumeEl.attr('id') || 'resume',
        name: resumeEl.attr('name') || 'resume',
        label: this.getLabelForElement($, resumeEl, 'Resume/CV'),
        type: AtsFormFieldType.FILE_RESUME,
        required: this.isElementRequired(resumeEl),
        selector: '#resume, input[type="file"][name="resume"]',
        mappedConcept: 'resume',
      });
    }

    // 6. Cover letter
    const coverLetterEl = form.find('#cover_letter, textarea[name="cover_letter"]');
    if (coverLetterEl.length > 0) {
      fields.push({
        id: coverLetterEl.attr('id') || 'cover_letter',
        name: coverLetterEl.attr('name') || 'cover_letter',
        label: this.getLabelForElement($, coverLetterEl, 'Cover Letter'),
        type: AtsFormFieldType.TEXTAREA,
        required: this.isElementRequired(coverLetterEl),
        selector: '#cover_letter, textarea[name="cover_letter"]',
        mappedConcept: 'coverLetter',
      });
    }

    // 7. Custom questions & attribute answers
    form
      .find(
        'input[id^="job_application_answers_attributes_"], select[id^="job_application_answers_attributes_"], textarea[id^="job_application_answers_attributes_"]',
      )
      .each((_, el) => {
        const $el = $(el);
        const id = $el.attr('id') || '';
        const name = $el.attr('name') || '';
        const tagName = (el as { tagName?: string }).tagName?.toLowerCase() || '';
        const typeAttr = $el.attr('type')?.toLowerCase();

        let fieldType: AtsFormFieldType = AtsFormFieldType.TEXT;
        let options: string[] | undefined;

        if (tagName === 'select') {
          fieldType = AtsFormFieldType.SELECT;
          options = [];
          $el.find('option').each((__, opt) => {
            const val = $(opt).text().trim() || $(opt).attr('value') || '';
            if (val && !val.includes('-- Please select --')) {
              options?.push(val);
            }
          });
        } else if (tagName === 'textarea') {
          fieldType = AtsFormFieldType.TEXTAREA;
        } else if (typeAttr === 'checkbox') {
          fieldType = AtsFormFieldType.CHECKBOX;
        }

        const label = $el.attr('data-label') || this.getLabelForElement($, $el, id) || id;

        // Determine mapped concept
        let mappedConcept: string | undefined;
        const labelLower = label.toLowerCase();
        if (labelLower.includes('linkedin')) mappedConcept = 'linkedin';
        else if (labelLower.includes('github')) mappedConcept = 'github';
        else if (labelLower.includes('website') || labelLower.includes('portfolio'))
          mappedConcept = 'portfolio';

        fields.push({
          id,
          name,
          label,
          type: fieldType,
          required: this.isElementRequired($el),
          selector: `#${id}`,
          options,
          mappedConcept,
        });
      });

    const challenge = await this.detectChallenge(page);

    return {
      provider: AtsProviderType.GREENHOUSE,
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
    const parentContainer = el.closest('.field, .application-question, div');
    if (
      parentContainer.find('.asterisk, .required, span[aria-hidden="true"]').length > 0 ||
      parentContainer.text().includes('*')
    ) {
      return true;
    }
    return false;
  }

  private getLabelForElement(
    $: cheerio.CheerioAPI,
    el: cheerio.Cheerio<any>,
    defaultLabel: string,
  ): string {
    const id = el.attr('id');
    if (id) {
      const labelEl = $(`label[for="${id}"]`);
      if (labelEl.length > 0) {
        return labelEl.text().replace(/\*/g, '').trim();
      }
    }
    const parentLabel = el.closest('label');
    if (parentLabel.length > 0) {
      return parentLabel.text().replace(/\*/g, '').trim();
    }
    const fieldContainer = el.closest('.field, div');
    const labelInField = fieldContainer.find('label, .application-label').first();
    if (labelInField.length > 0) {
      return labelInField.text().replace(/\*/g, '').trim();
    }
    return defaultLabel;
  }
}
