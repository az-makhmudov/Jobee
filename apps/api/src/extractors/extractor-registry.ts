import type { JobProvider } from '@job-agent/shared';
import type { JobExtractor } from './types.js';
import { GreenhouseExtractor } from './greenhouse-extractor.js';
import { LeverExtractor } from './lever-extractor.js';
import { AshbyExtractor } from './ashby-extractor.js';
import { LinkedInExtractor } from './linkedin-extractor.js';
import { GenericExtractor } from './generic-extractor.js';
import { ManualTextExtractor } from './manual-text-extractor.js';

export class ExtractorRegistry {
  private readonly extractors: JobExtractor[];
  private readonly manualExtractor: ManualTextExtractor;

  constructor() {
    this.extractors = [
      new GreenhouseExtractor(),
      new LeverExtractor(),
      new AshbyExtractor(),
      new LinkedInExtractor(),
      new GenericExtractor(), // Fallback
    ];
    this.manualExtractor = new ManualTextExtractor();
  }

  public detectProvider(url: string | null, content: string = ''): JobProvider {
    if (!url) return 'MANUAL';

    const lowerUrl = url.toLowerCase();
    const safeContent = content || '';
    if (lowerUrl.includes('greenhouse.io') || safeContent.includes('id="grnhse_app"')) {
      return 'GREENHOUSE';
    }
    if (lowerUrl.includes('lever.co') || safeContent.includes('lever-job')) {
      return 'LEVER';
    }
    if (lowerUrl.includes('ashbyhq.com') || safeContent.includes('ashbyhq')) {
      return 'ASHBY';
    }
    if (lowerUrl.includes('linkedin.com')) {
      return 'LINKEDIN';
    }

    return 'GENERIC';
  }

  public getExtractor(url: string | null, content: string): JobExtractor {
    for (const extractor of this.extractors) {
      if (extractor.canHandle(url, content)) {
        return extractor;
      }
    }
    return new GenericExtractor();
  }

  public getManualExtractor(): ManualTextExtractor {
    return this.manualExtractor;
  }
}
