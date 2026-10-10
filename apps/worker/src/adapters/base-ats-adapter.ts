import * as cheerio from 'cheerio';
import type { BrowserPage, BrowserLocator } from '../browser/browser-controller.js';
import {
  AtsProviderType,
  AtsFormFieldType,
  type AtsFormField,
  type AtsFormSchema,
  type ChallengeDetectionResult,
  type ApplicationSubmissionPayload,
} from '@job-agent/shared';

/**
 * Base ATS Adapter (JOB-P5-T01)
 *
 * Implements common form inspection, field type inference, challenge detection,
 * and deterministic value matching against candidate facts.
 */
export abstract class BaseAtsAdapter {
  abstract readonly provider: AtsProviderType;

  /**
   * Evaluates if this adapter can handle the given URL or page content.
   */
  abstract matches(url: string, content?: string): boolean;

  /**
   * Inspects the page and extracts the structured form schema.
   */
  abstract extractForm(page: BrowserPage): Promise<AtsFormSchema>;

  /**
   * Detects presence of bot challenges (Cloudflare Turnstile, reCAPTCHA, hCaptcha, etc.).
   */
  async detectChallenge(page: BrowserPage): Promise<ChallengeDetectionResult> {
    const html = (await page.content()).toLowerCase();

    // 1. Google reCAPTCHA
    if (
      html.includes('recaptcha/api') ||
      html.includes('g-recaptcha') ||
      (await page.locator('.g-recaptcha, iframe[src*="recaptcha"]').count()) > 0
    ) {
      return {
        detected: true,
        type: 'RECAPTCHA',
        selector: '.g-recaptcha, iframe[src*="recaptcha"]',
        message: 'Google reCAPTCHA verification detected on application form.',
      };
    }

    // 2. hCaptcha
    if (
      html.includes('hcaptcha.com') ||
      html.includes('h-captcha') ||
      (await page.locator('.h-captcha, iframe[src*="hcaptcha"]').count()) > 0
    ) {
      return {
        detected: true,
        type: 'HCAPTCHA',
        selector: '.h-captcha, iframe[src*="hcaptcha"]',
        message: 'hCaptcha verification detected on application form.',
      };
    }

    // 3. Cloudflare Turnstile
    if (
      html.includes('challenges.cloudflare.com/turnstile') ||
      html.includes('cf-turnstile') ||
      (await page.locator('.cf-turnstile, iframe[src*="challenges.cloudflare.com"]').count()) > 0
    ) {
      return {
        detected: true,
        type: 'CLOUDFLARE_TURNSTILE',
        selector: '.cf-turnstile',
        message: 'Cloudflare Turnstile verification detected on application form.',
      };
    }

    // 4. Arkose Labs / GeeTest
    if (html.includes('arkoselabs') || html.includes('geetest')) {
      return {
        detected: true,
        type: 'OTHER',
        message: 'Interactive bot challenge detected on application form.',
      };
    }

    return {
      detected: false,
      type: 'NONE',
    };
  }

  /**
   * Matches candidate payload facts to a form field.
   * Returns undefined if no deterministic candidate fact exists.
   */
  resolveFieldValue(
    field: AtsFormField,
    payload: ApplicationSubmissionPayload,
  ): string | undefined {
    const labelLower = field.label.toLowerCase();
    const nameLower = field.name.toLowerCase();

    // 1. Name fields
    if (
      field.mappedConcept === 'firstName' ||
      nameLower.includes('first_name') ||
      nameLower.includes('firstname') ||
      labelLower === 'first name'
    ) {
      return payload.firstName;
    }

    if (
      field.mappedConcept === 'lastName' ||
      nameLower.includes('last_name') ||
      nameLower.includes('lastname') ||
      labelLower === 'last name'
    ) {
      return payload.lastName;
    }

    if (
      field.mappedConcept === 'fullName' ||
      nameLower === 'name' ||
      nameLower === 'fullname' ||
      nameLower === 'full_name' ||
      labelLower === 'full name' ||
      labelLower === 'name'
    ) {
      return payload.fullName || `${payload.firstName} ${payload.lastName}`.trim();
    }

    // 2. Email
    if (
      field.mappedConcept === 'email' ||
      field.type === AtsFormFieldType.EMAIL ||
      nameLower.includes('email') ||
      labelLower.includes('email')
    ) {
      return payload.email;
    }

    // 3. Phone
    if (
      field.mappedConcept === 'phone' ||
      field.type === AtsFormFieldType.PHONE ||
      nameLower.includes('phone') ||
      labelLower.includes('phone')
    ) {
      return payload.phone;
    }

    // 4. Location / City
    if (
      nameLower.includes('location') ||
      nameLower.includes('city') ||
      labelLower.includes('location') ||
      labelLower.includes('city')
    ) {
      return payload.location;
    }

    // 5. URLs / Social Profiles
    if (
      nameLower.includes('linkedin') ||
      labelLower.includes('linkedin') ||
      field.mappedConcept === 'linkedin'
    ) {
      return payload.urls.linkedin || payload.urls.LinkedIn;
    }

    if (
      nameLower.includes('github') ||
      labelLower.includes('github') ||
      field.mappedConcept === 'github'
    ) {
      return payload.urls.github || payload.urls.GitHub;
    }

    if (
      nameLower.includes('portfolio') ||
      nameLower.includes('website') ||
      labelLower.includes('portfolio') ||
      labelLower.includes('website')
    ) {
      return payload.urls.portfolio || payload.urls.website;
    }

    // 6. Cover Letter
    if (
      field.mappedConcept === 'coverLetter' ||
      nameLower.includes('cover_letter') ||
      nameLower.includes('coverletter') ||
      nameLower === 'comments' ||
      labelLower.includes('cover letter')
    ) {
      return payload.coverLetterText;
    }

    // 7. Answer Library / Custom Questions
    // Match against answers map by normalized key
    const answerEntries = Object.entries(payload.answers);
    for (const [key, val] of answerEntries) {
      const keyNorm = key.toLowerCase();
      if (
        labelLower.includes(keyNorm) ||
        keyNorm.includes(labelLower) ||
        nameLower.includes(keyNorm) ||
        keyNorm.includes(nameLower)
      ) {
        return val.answerText;
      }
    }

    // Specific Work Authorization / Visa checks
    if (
      labelLower.includes('authorized to work') ||
      labelLower.includes('legal authorization') ||
      labelLower.includes('legally authorized')
    ) {
      const authAns =
        payload.answers['work_authorization'] ||
        payload.answers['authorized_to_work'] ||
        payload.answers['work_auth'];
      if (authAns) return authAns.answerText;
    }

    if (labelLower.includes('sponsorship') || labelLower.includes('sponsor')) {
      const sponAns = payload.answers['sponsorship'] || payload.answers['require_sponsorship'];
      if (sponAns) return sponAns.answerText;
    }

    return undefined;
  }

  /**
   * Selects an option in a dropdown element matching desired value or fuzzy text.
   */
  async selectDropdownOption(
    locator: BrowserLocator,
    desiredValue: string,
    options?: string[],
  ): Promise<void> {
    const valLower = desiredValue.toLowerCase().trim();

    // 1. If options list is known, find closest matching option
    if (options && options.length > 0) {
      const exactMatch = options.find((opt) => opt.toLowerCase() === valLower);
      if (exactMatch) {
        await locator.selectOption(exactMatch);
        return;
      }

      // Boolean 'yes' / 'no' mapping
      if (valLower === 'yes' || valLower === 'true') {
        const yesMatch = options.find((opt) => {
          const l = opt.toLowerCase();
          return l === 'yes' || l === 'true' || l.startsWith('yes');
        });
        if (yesMatch) {
          await locator.selectOption(yesMatch);
          return;
        }
      }

      if (valLower === 'no' || valLower === 'false') {
        const noMatch = options.find((opt) => {
          const l = opt.toLowerCase();
          return l === 'no' || l === 'false' || l.startsWith('no');
        });
        if (noMatch) {
          await locator.selectOption(noMatch);
          return;
        }
      }

      const substringMatch = options.find((opt) => opt.toLowerCase().includes(valLower));
      if (substringMatch) {
        await locator.selectOption(substringMatch);
        return;
      }
    }

    // Fallback: direct select
    await locator.selectOption(desiredValue);
  }

  /**
   * Helper to parse HTML with Cheerio for rapid DOM extraction.
   */
  protected get$FromHtml(html: string): cheerio.CheerioAPI {
    return cheerio.load(html);
  }
}
