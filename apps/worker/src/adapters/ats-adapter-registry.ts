import type { BaseAtsAdapter } from './base-ats-adapter.js';
import { GreenhouseAdapter } from './greenhouse-adapter.js';
import { LeverAdapter } from './lever-adapter.js';
import { AshbyAdapter } from './ashby-adapter.js';
import { AtsProviderType } from '@job-agent/shared';

/**
 * Generic Fallback ATS Adapter
 */
class GenericAtsAdapter extends GreenhouseAdapter {
  override readonly provider: AtsProviderType = AtsProviderType.OTHER;

  override matches(): boolean {
    return true;
  }
}

/**
 * ATS Adapter Registry (JOB-P5-T01)
 *
 * Resolves the appropriate ATS adapter given target URL and/or page DOM content.
 */
export class AtsAdapterRegistry {
  private readonly adapters: BaseAtsAdapter[];
  private readonly genericAdapter: BaseAtsAdapter;

  constructor(customAdapters?: BaseAtsAdapter[]) {
    this.adapters = customAdapters ?? [
      new GreenhouseAdapter(),
      new LeverAdapter(),
      new AshbyAdapter(),
    ];
    this.genericAdapter = new GenericAtsAdapter();
  }

  /**
   * Resolves the matching adapter for a URL and optional page content.
   */
  resolveAdapter(url: string, content?: string): BaseAtsAdapter {
    for (const adapter of this.adapters) {
      if (adapter.matches(url, content)) {
        return adapter;
      }
    }
    return this.genericAdapter;
  }

  /**
   * Returns list of all registered standard adapters.
   */
  getRegisteredAdapters(): BaseAtsAdapter[] {
    return [...this.adapters];
  }
}
