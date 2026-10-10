/**
 * Browser Controller & Page Abstraction (JOB-P5-T01)
 *
 * Provider-neutral browser execution contract decoupling Playwright from ATS adapters.
 * Enables real Chromium headless execution and deterministic in-memory fixture simulation.
 */

export interface BrowserLocator {
  fill(value: string): Promise<void>;
  click(): Promise<void>;
  selectOption(
    values: string | string[] | { value?: string; label?: string; index?: number },
  ): Promise<string[]>;
  check(): Promise<void>;
  uncheck(): Promise<void>;
  setInputFiles(
    files:
      | string
      | string[]
      | { name: string; mimeType: string; buffer: Buffer }
      | Array<{ name: string; mimeType: string; buffer: Buffer }>,
  ): Promise<void>;
  isVisible(): Promise<boolean>;
  count(): Promise<number>;
  textContent(): Promise<string | null>;
  inputValue(): Promise<string>;
  getAttribute(name: string): Promise<string | null>;
  first(): BrowserLocator;
  nth(index: number): BrowserLocator;
}

export interface BrowserPage {
  goto(
    url: string,
    options?: { timeout?: number; waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' },
  ): Promise<void>;
  url(): string;
  title(): Promise<string>;
  content(): Promise<string>;
  locator(selector: string): BrowserLocator;
  $(selector: string): Promise<BrowserLocator | null>;
  $$(selector: string): Promise<BrowserLocator[]>;
  screenshot(options?: { path?: string; fullPage?: boolean }): Promise<Buffer>;
  waitForSelector(
    selector: string,
    options?: { timeout?: number; state?: 'visible' | 'attached' },
  ): Promise<BrowserLocator | null>;
  waitForTimeout(ms: number): Promise<void>;
  evaluate<T = unknown, R = unknown>(pageFunction: (arg: T) => R, arg?: T): Promise<R>;
  close(): Promise<void>;
}

export interface BrowserController {
  newPage(): Promise<BrowserPage>;
  close(): Promise<void>;
}
