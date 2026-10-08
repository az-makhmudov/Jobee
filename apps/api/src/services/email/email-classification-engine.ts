import type { NormalizedEmailMessage } from '@job-agent/shared';
import {
  DeterministicEmailClassifier,
  type ClassificationResult,
} from './deterministic-email-classifier.js';
import { AiEmailClassifier } from './ai-email-classifier.js';

export class EmailClassificationEngine {
  private aiClassifier: AiEmailClassifier;

  constructor(aiApiKey?: string) {
    this.aiClassifier = new AiEmailClassifier(aiApiKey);
  }

  public async classifyMessage(message: NormalizedEmailMessage): Promise<ClassificationResult> {
    const deterministic = DeterministicEmailClassifier.classify(message);

    // If deterministic matched with high confidence (>= 0.85), trust deterministic rules
    if (deterministic.confidence >= 0.85) {
      return deterministic;
    }

    // Try AI classifier if available
    if (this.aiClassifier.isAvailable) {
      const aiResult = await this.aiClassifier.classify(message);
      if (aiResult && aiResult.confidence > deterministic.confidence) {
        return {
          ...aiResult,
          extractedDetails: {
            ...deterministic.extractedDetails,
            ...aiResult.extractedDetails,
          },
        };
      }
    }

    return deterministic;
  }
}
