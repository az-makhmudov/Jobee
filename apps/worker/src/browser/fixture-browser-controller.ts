import * as cheerio from 'cheerio';
import type { BrowserController, BrowserPage, BrowserLocator } from './browser-controller.js';

interface ElementState {
  value?: string;
  checked?: boolean;
  selectedOption?: string;
  files?: Array<{ name: string; mimeType: string }>;
}

class FixtureLocator implements BrowserLocator {
  constructor(
    private readonly page: FixtureBrowserPage,
    private readonly selector: string,
    private readonly index: number = 0,
  ) {}

  private getElement() {
    const $ = this.page.get$();
    const matched = $(this.selector);
    if (this.index >= matched.length) return null;
    return matched.eq(this.index);
  }

  async fill(value: string): Promise<void> {
    const el = this.getElement();
    if (!el) {
      throw new Error(`Element not found for selector: ${this.selector} (index ${this.index})`);
    }
    this.page.setElementState(this.selector, this.index, { value });
    el.val(value);
    el.attr('value', value);
  }

  async click(): Promise<void> {
    const el = this.getElement();
    if (!el) {
      throw new Error(`Element not found for selector: ${this.selector} (index ${this.index})`);
    }
    this.page.recordClick(this.selector);
  }

  async selectOption(
    values: string | string[] | { value?: string; label?: string; index?: number },
  ): Promise<string[]> {
    const el = this.getElement();
    if (!el) {
      throw new Error(`Element not found for selector: ${this.selector}`);
    }
    let chosen = '';
    if (typeof values === 'string') {
      chosen = values;
    } else if (Array.isArray(values)) {
      chosen = values[0] || '';
    } else if (values.value) {
      chosen = values.value;
    } else if (values.label) {
      chosen = values.label;
    }
    this.page.setElementState(this.selector, this.index, { selectedOption: chosen, value: chosen });
    el.val(chosen);
    return [chosen];
  }

  async check(): Promise<void> {
    const el = this.getElement();
    if (!el) throw new Error(`Element not found: ${this.selector}`);
    this.page.setElementState(this.selector, this.index, { checked: true });
    el.attr('checked', 'checked');
  }

  async uncheck(): Promise<void> {
    const el = this.getElement();
    if (!el) throw new Error(`Element not found: ${this.selector}`);
    this.page.setElementState(this.selector, this.index, { checked: false });
    el.removeAttr('checked');
  }

  async setInputFiles(
    files:
      | string
      | string[]
      | { name: string; mimeType: string; buffer: Buffer }
      | Array<{ name: string; mimeType: string; buffer: Buffer }>,
  ): Promise<void> {
    const el = this.getElement();
    if (!el) throw new Error(`Element not found: ${this.selector}`);
    let fileInfo: Array<{ name: string; mimeType: string }> = [];
    if (typeof files === 'string') {
      fileInfo = [{ name: files.split('/').pop() || 'resume.pdf', mimeType: 'application/pdf' }];
    } else if (Array.isArray(files)) {
      fileInfo = files.map((f) =>
        typeof f === 'string'
          ? { name: f.split('/').pop() || 'resume.pdf', mimeType: 'application/pdf' }
          : { name: f.name, mimeType: f.mimeType },
      );
    } else {
      fileInfo = [{ name: files.name, mimeType: files.mimeType }];
    }
    this.page.setElementState(this.selector, this.index, { files: fileInfo });
    el.attr('data-attached-files', fileInfo.map((f) => f.name).join(','));
  }

  async isVisible(): Promise<boolean> {
    const el = this.getElement();
    if (!el) return false;
    const style = el.attr('style') || '';
    if (style.includes('display: none') || style.includes('visibility: hidden')) return false;
    if (el.attr('hidden') !== undefined) return false;
    return true;
  }

  async count(): Promise<number> {
    const $ = this.page.get$();
    return $(this.selector).length;
  }

  async textContent(): Promise<string | null> {
    const el = this.getElement();
    return el ? el.text() : null;
  }

  async inputValue(): Promise<string> {
    const state = this.page.getElementState(this.selector, this.index);
    if (state?.value !== undefined) return state.value;
    const el = this.getElement();
    if (!el) return '';
    const v = el.val();
    if (Array.isArray(v)) return v[0] ?? '';
    return (v as string | undefined) || el.attr('value') || '';
  }

  async getAttribute(name: string): Promise<string | null> {
    const el = this.getElement();
    if (!el) return null;
    const val = el.attr(name);
    return val !== undefined ? val : null;
  }

  first(): BrowserLocator {
    return new FixtureLocator(this.page, this.selector, 0);
  }

  nth(index: number): BrowserLocator {
    return new FixtureLocator(this.page, this.selector, index);
  }
}

export class FixtureBrowserPage implements BrowserPage {
  private currentUrl = 'about:blank';
  private pageTitle = '';
  private html = '<html><body></body></html>';
  private cheerioDoc!: cheerio.CheerioAPI;
  private elementStates = new Map<string, ElementState>();
  private clickHistory: string[] = [];

  constructor(
    private readonly registeredPages: Map<string, string> = new Map(),
    private readonly submissionPages: Map<string, string> = new Map(),
  ) {
    this.setHtml(this.html);
  }

  public setHtml(html: string, url = 'http://localhost/test-form'): void {
    this.html = html;
    this.currentUrl = url;
    this.cheerioDoc = cheerio.load(html);
    this.elementStates.clear();
    this.pageTitle = this.cheerioDoc('title').text() || 'Mock ATS Application Form';
  }

  public get$(): cheerio.CheerioAPI {
    return this.cheerioDoc;
  }

  public setElementState(selector: string, index: number, state: Partial<ElementState>): void {
    const key = `${selector}:${index}`;
    const existing = this.elementStates.get(key) || {};
    this.elementStates.set(key, { ...existing, ...state });
  }

  public getElementState(selector: string, index: number): ElementState | undefined {
    return this.elementStates.get(`${selector}:${index}`);
  }

  public recordClick(selector: string): void {
    this.clickHistory.push(selector);
    if (selector.includes('submit'))
      for (const [key, html] of this.submissionPages)
        if (this.currentUrl.includes(key)) {
          this.setHtml(html, this.currentUrl);
          break;
        }
  }

  public getClicks(): string[] {
    return [...this.clickHistory];
  }

  async goto(
    url: string,
    _options?: { timeout?: number; waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' },
  ): Promise<void> {
    this.currentUrl = url;
    for (const [key, content] of this.registeredPages.entries()) {
      if (url.includes(key)) {
        this.setHtml(content, url);
        return;
      }
    }
    // Default placeholder
    this.setHtml(
      `<html><head><title>Page: ${url}</title></head><body><h1>Loaded ${url}</h1></body></html>`,
      url,
    );
  }

  url(): string {
    return this.currentUrl;
  }

  async title(): Promise<string> {
    return this.pageTitle;
  }

  async content(): Promise<string> {
    return this.cheerioDoc.html();
  }

  locator(selector: string): BrowserLocator {
    return new FixtureLocator(this, selector);
  }

  async $(selector: string): Promise<BrowserLocator | null> {
    const count = this.cheerioDoc(selector).length;
    return count > 0 ? new FixtureLocator(this, selector, 0) : null;
  }

  async $$(selector: string): Promise<BrowserLocator[]> {
    const count = this.cheerioDoc(selector).length;
    const locators: BrowserLocator[] = [];
    for (let i = 0; i < count; i++) {
      locators.push(new FixtureLocator(this, selector, i));
    }
    return locators;
  }

  async screenshot(_options?: { path?: string; fullPage?: boolean }): Promise<Buffer> {
    // Return dummy 1x1 valid PNG buffer
    return Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );
  }

  async waitForSelector(
    selector: string,
    _options?: { timeout?: number; state?: 'visible' | 'attached' },
  ): Promise<BrowserLocator | null> {
    const count = this.cheerioDoc(selector).length;
    return count > 0 ? new FixtureLocator(this, selector, 0) : null;
  }

  async waitForTimeout(_ms: number): Promise<void> {
    // Instant resolution in deterministic tests
  }

  async evaluate<T = unknown, R = unknown>(pageFunction: (arg: T) => R, arg?: T): Promise<R> {
    return pageFunction(arg as any);
  }

  async close(): Promise<void> {
    this.elementStates.clear();
    this.clickHistory = [];
  }
}

export class FixtureBrowserController implements BrowserController {
  private registeredPages = new Map<string, string>();
  private activePages: FixtureBrowserPage[] = [];
  private submissionPages = new Map<string, string>();
  public registerSubmission(urlSubstring: string, html: string): void {
    this.submissionPages.set(urlSubstring, html);
  }

  constructor() {
    this.registerDefaultMocks();
  }

  public registerPage(urlSubstring: string, htmlContent: string): void {
    this.registeredPages.set(urlSubstring, htmlContent);
  }

  async newPage(): Promise<BrowserPage> {
    const page = new FixtureBrowserPage(this.registeredPages, this.submissionPages);
    this.activePages.push(page);
    return page;
  }

  async close(): Promise<void> {
    for (const p of this.activePages) {
      await p.close();
    }
    this.activePages = [];
  }

  private registerDefaultMocks(): void {
    // 1. Greenhouse Mock Form
    this.registerPage(
      'greenhouse.io',
      `<!DOCTYPE html>
<html>
<head><title>Senior Distributed Systems Engineer - Starlight Labs (Greenhouse)</title></head>
<body>
  <div id="application">
    <div class="app-title">Apply for Senior Distributed Systems Engineer</div>
    <form id="application_form" action="/apply" method="POST">
      <div class="field">
        <label for="first_name">First Name <span class="asterisk">*</span></label>
        <input type="text" id="first_name" name="first_name" required autocomplete="given-name" />
      </div>
      <div class="field">
        <label for="last_name">Last Name <span class="asterisk">*</span></label>
        <input type="text" id="last_name" name="last_name" required autocomplete="family-name" />
      </div>
      <div class="field">
        <label for="email">Email <span class="asterisk">*</span></label>
        <input type="email" id="email" name="email" required autocomplete="email" />
      </div>
      <div class="field">
        <label for="phone">Phone <span class="asterisk">*</span></label>
        <input type="tel" id="phone" name="phone" required autocomplete="tel" />
      </div>
      <div class="field">
        <label for="resume">Resume/CV <span class="asterisk">*</span></label>
        <input type="file" id="resume" name="resume" required />
      </div>
      <div class="field">
        <label for="cover_letter">Cover Letter</label>
        <textarea id="cover_letter" name="cover_letter"></textarea>
      </div>
      <div class="field">
        <label for="job_application_answers_attributes_0_text_value">LinkedIn Profile</label>
        <input type="text" id="job_application_answers_attributes_0_text_value" name="job_application[answers_attributes][0][text_value]" data-label="LinkedIn Profile" />
      </div>
      <div class="field">
        <label for="job_application_answers_attributes_1_text_value">GitHub URL</label>
        <input type="text" id="job_application_answers_attributes_1_text_value" name="job_application[answers_attributes][1][text_value]" data-label="GitHub URL" />
      </div>
      <div class="field">
        <label for="job_application_answers_attributes_2_boolean_value">Are you legally authorized to work in this jurisdiction? <span class="asterisk">*</span></label>
        <select id="job_application_answers_attributes_2_boolean_value" name="job_application[answers_attributes][2][boolean_value]" required>
          <option value="">-- Please select --</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </div>
      <div class="actions">
        <button type="submit" id="submit_app">Submit Application</button>
      </div>
    </form>
  </div>
</body>
</html>`,
    );

    // 2. Lever Mock Form
    this.registerPage(
      'lever.co',
      `<!DOCTYPE html>
<html>
<head><title>Staff Platform Engineer - Acme Corp (Lever)</title></head>
<body>
  <div class="application-page">
    <h2>Apply for this job</h2>
    <form id="application-form">
      <div class="application-label">Resume/CV <span class="asterisk">*</span></div>
      <input type="file" name="resume" required />

      <div class="application-label">Full Name <span class="asterisk">*</span></div>
      <input type="text" name="name" required />

      <div class="application-label">Email <span class="asterisk">*</span></div>
      <input type="email" name="email" required />

      <div class="application-label">Phone <span class="asterisk">*</span></div>
      <input type="tel" name="phone" required />

      <div class="application-label">Current company</div>
      <input type="text" name="org" />

      <div class="application-label">LinkedIn URL</div>
      <input type="text" name="urls[LinkedIn]" />

      <div class="application-label">GitHub URL</div>
      <input type="text" name="urls[GitHub]" />

      <div class="application-label">Additional Information / Cover Letter</div>
      <textarea name="comments"></textarea>

      <div class="application-question">
        <div class="application-label">Will you now or in the future require visa sponsorship? <span class="asterisk">*</span></div>
        <select name="cards[sponsorship][field0]" required>
          <option value="">Select an option</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      </div>

      <button type="submit" class="template-btn-submit">Submit application</button>
    </form>
  </div>
</body>
</html>`,
    );

    // 3. Ashby Mock Form
    this.registerPage(
      'ashbyhq.com',
      `<!DOCTYPE html>
<html>
<head><title>Senior Backend Architect - Nova Technologies (Ashby)</title></head>
<body>
  <div id="ashby-job-posting-application">
    <h3>Apply for Senior Backend Architect</h3>
    <form id="ashby-application-form">
      <div class="ashby-field" data-field-name="name">
        <label>Name <span class="required">*</span></label>
        <input type="text" name="name" required />
      </div>
      <div class="ashby-field" data-field-name="email">
        <label>Email <span class="required">*</span></label>
        <input type="email" name="email" required />
      </div>
      <div class="ashby-field" data-field-name="phoneNumber">
        <label>Phone Number <span class="required">*</span></label>
        <input type="tel" name="phoneNumber" required />
      </div>
      <div class="ashby-field" data-field-name="resume">
        <label>Resume <span class="required">*</span></label>
        <input type="file" name="resume" required />
      </div>
      <div class="ashby-field" data-field-name="linkedIn">
        <label>LinkedIn</label>
        <input type="text" name="linkedIn" />
      </div>
      <div class="ashby-field" data-field-name="github">
        <label>GitHub</label>
        <input type="text" name="github" />
      </div>
      <div class="ashby-field" data-field-name="workAuthorization">
        <label>Are you authorized to work in the United States? <span class="required">*</span></label>
        <select name="workAuthorization" required>
          <option value="">Select...</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </div>
      <button type="submit" id="ashby-submit-btn">Submit Application</button>
    </form>
  </div>
</body>
</html>`,
    );

    // 4. CAPTCHA Challenge Mock Page
    this.registerPage(
      'captcha-test',
      `<!DOCTYPE html>
<html>
<head><title>Verify You Are Human</title></head>
<body>
  <h2>Security Verification</h2>
  <iframe src="https://www.google.com/recaptcha/api2/anchor" title="reCAPTCHA"></iframe>
  <form id="form-blocked">
    <input type="text" name="dummy" />
    <button type="submit">Continue</button>
  </form>
</body>
</html>`,
    );
  }
}
