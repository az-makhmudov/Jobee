import { chromium, type Browser, type Page as PwPage, type Locator as PwLocator } from 'playwright';
import type { BrowserController, BrowserPage, BrowserLocator } from './browser-controller.js';

class PlaywrightLocatorAdapter implements BrowserLocator {
  constructor(private readonly pwLocator: PwLocator) {}

  async fill(value: string): Promise<void> {
    await this.pwLocator.fill(value);
  }

  async click(): Promise<void> {
    await this.pwLocator.click();
  }

  async selectOption(
    values: string | string[] | { value?: string; label?: string; index?: number },
  ): Promise<string[]> {
    return this.pwLocator.selectOption(values);
  }

  async check(): Promise<void> {
    await this.pwLocator.check();
  }

  async uncheck(): Promise<void> {
    await this.pwLocator.uncheck();
  }

  async setInputFiles(
    files:
      | string
      | string[]
      | { name: string; mimeType: string; buffer: Buffer }
      | Array<{ name: string; mimeType: string; buffer: Buffer }>,
  ): Promise<void> {
    await this.pwLocator.setInputFiles(files as any);
  }

  async isVisible(): Promise<boolean> {
    return this.pwLocator.isVisible();
  }

  async count(): Promise<number> {
    return this.pwLocator.count();
  }

  async textContent(): Promise<string | null> {
    return this.pwLocator.textContent();
  }

  async inputValue(): Promise<string> {
    return this.pwLocator.inputValue();
  }

  async getAttribute(name: string): Promise<string | null> {
    return this.pwLocator.getAttribute(name);
  }

  first(): BrowserLocator {
    return new PlaywrightLocatorAdapter(this.pwLocator.first());
  }

  nth(index: number): BrowserLocator {
    return new PlaywrightLocatorAdapter(this.pwLocator.nth(index));
  }
}

class PlaywrightPageAdapter implements BrowserPage {
  constructor(private readonly pwPage: PwPage) {}

  async goto(
    url: string,
    options?: { timeout?: number; waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' },
  ): Promise<void> {
    await this.pwPage.goto(url, options);
  }

  url(): string {
    return this.pwPage.url();
  }

  async title(): Promise<string> {
    return this.pwPage.title();
  }

  async content(): Promise<string> {
    return this.pwPage.content();
  }

  locator(selector: string): BrowserLocator {
    return new PlaywrightLocatorAdapter(this.pwPage.locator(selector));
  }

  async $(selector: string): Promise<BrowserLocator | null> {
    const loc = this.pwPage.locator(selector);
    const count = await loc.count();
    return count > 0 ? new PlaywrightLocatorAdapter(loc.first()) : null;
  }

  async $$(selector: string): Promise<BrowserLocator[]> {
    const loc = this.pwPage.locator(selector);
    const count = await loc.count();
    const result: BrowserLocator[] = [];
    for (let i = 0; i < count; i++) {
      result.push(new PlaywrightLocatorAdapter(loc.nth(i)));
    }
    return result;
  }

  async screenshot(options?: { path?: string; fullPage?: boolean }): Promise<Buffer> {
    return this.pwPage.screenshot(options);
  }

  async waitForSelector(
    selector: string,
    options?: { timeout?: number; state?: 'visible' | 'attached' },
  ): Promise<BrowserLocator | null> {
    const el = await this.pwPage.waitForSelector(selector, options as any);
    return el ? new PlaywrightLocatorAdapter(this.pwPage.locator(selector)) : null;
  }

  async waitForTimeout(ms: number): Promise<void> {
    await this.pwPage.waitForTimeout(ms);
  }

  async evaluate<T = unknown, R = unknown>(pageFunction: (arg: T) => R, arg?: T): Promise<R> {
    return this.pwPage.evaluate(pageFunction as any, arg);
  }

  async close(): Promise<void> {
    await this.pwPage.close();
  }
}

export interface PlaywrightControllerOptions {
  headless?: boolean;
  slowMo?: number;
}

export class PlaywrightBrowserController implements BrowserController {
  private browser: Browser | null = null;

  constructor(private readonly options: PlaywrightControllerOptions = { headless: true }) {}

  async newPage(): Promise<BrowserPage> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: this.options.headless ?? true,
        slowMo: this.options.slowMo,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });
    }

    const context = await this.browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
    });

    const page = await context.newPage();
    return new PlaywrightPageAdapter(page);
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
