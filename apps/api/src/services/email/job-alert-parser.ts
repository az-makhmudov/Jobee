import type { JobDto, NormalizedEmailMessage } from '@job-agent/shared';
import { JobService } from '../job-service.js';

export interface ExtractedAlertJob {
  title: string;
  company: string;
  url?: string;
  location?: string;
  textSnippet: string;
}

export class JobAlertParser {
  /**
   * Parses job listings out of job alert emails (e.g. LinkedIn, Indeed, etc.)
   */
  public static parseAlertListings(message: NormalizedEmailMessage): ExtractedAlertJob[] {
    const text = message.plainText || '';
    const results: ExtractedAlertJob[] = [];

    // Strategy 1: Numbered blocks (e.g., "1. Senior Backend Engineer\nAcme Corp — Zurich...")
    const numberedRegex =
      /(?:^|\n)(?:\d+[.)]|\*|-)\s+([^\n\r]+)\r?\n([^\n\r]+)(?:\r?\n(?:View job|Apply|Link):\s*([^\n\r]+))?/gi;
    let match: RegExpExecArray | null;

    while ((match = numberedRegex.exec(text)) !== null) {
      const line1 = match[1]?.trim() || '';
      const line2 = match[2]?.trim() || '';
      const url = match[3]?.trim();

      // Line 1 is typically title
      // Line 2 is typically "Company — Location" or "Company (Location)"
      let title = line1;
      let company = line2;
      let location: string | undefined;

      const sepMatch = line2.match(/^(.+?)\s*(?:—|-|\||,)\s*(.+)$/);
      if (sepMatch) {
        company = sepMatch[1]?.trim() || line2;
        location = sepMatch[2]?.trim();
      }

      // Check if line1 contains "at Company"
      const atMatch = line1.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);
      if (atMatch) {
        title = atMatch[1]?.trim() || line1;
        company = atMatch[2]?.trim() || company;
      }

      if (title.length > 3 && company.length > 1) {
        results.push({
          title,
          company,
          url,
          location,
          textSnippet: `Role: ${title}\nCompany: ${company}${location ? `\nLocation: ${location}` : ''}\nSource: Email Job Alert (${message.from.name || message.from.email})\nReceived: ${message.receivedAt.toISOString()}`,
        });
      }
    }

    // Strategy 2: If numbered blocks yielded nothing, try finding "Title at Company" lines
    if (results.length === 0) {
      const atLines = text.split('\n');
      for (const line of atLines) {
        const atMatch = line.match(
          /^\s*(?:[-*•]|\d+\.)?\s*([A-Z][A-Za-z0-9\s/]+(?:Engineer|Developer|Manager|Lead|Architect|Designer|Analyst|Consultant))\s+(?:at|@)\s+([A-Z][A-Za-z0-9\s&.-]+)/i,
        );
        if (atMatch && atMatch[1] && atMatch[2]) {
          const title = atMatch[1].trim();
          const company = atMatch[2].trim();
          results.push({
            title,
            company,
            textSnippet: `Role: ${title}\nCompany: ${company}\nSource: Email Job Alert (${message.from.name || message.from.email})`,
          });
        }
      }
    }

    // Fallback: If still no distinct jobs parsed, treat the whole alert as a single opportunity if it has a title
    if (results.length === 0 && message.subject.includes('"')) {
      const subjectQuotes = message.subject.match(/"([^"]+)"/);
      if (subjectQuotes && subjectQuotes[1]) {
        results.push({
          title: subjectQuotes[1],
          company: message.from.name || 'Job Alert Aggregator',
          textSnippet: text.slice(0, 1500),
        });
      }
    }

    return results;
  }

  /**
   * Ingests parsed alert jobs into JobService
   */
  public static async ingestAlertJobs(options: {
    userId: string;
    message: NormalizedEmailMessage;
    jobService: JobService;
  }): Promise<{
    jobsDiscovered: number;
    newJobsCount: number;
    duplicateJobsCount: number;
    jobs: JobDto[];
  }> {
    const { userId, message, jobService } = options;
    const listings = this.parseAlertListings(message);

    let newJobsCount = 0;
    let duplicateJobsCount = 0;
    const ingestedJobs: JobDto[] = [];

    for (const item of listings) {
      try {
        const res = await jobService.ingestText(userId, {
          title: item.title,
          company: item.company,
          url: item.url,
          text:
            item.textSnippet.length >= 20
              ? item.textSnippet
              : `${item.textSnippet}\nFull alert email from ${message.from.email}`,
          sourceNotes: `Discovered from Email Alert: "${message.subject}"`,
        });

        ingestedJobs.push(res.job);
        if (res.isDuplicate) {
          duplicateJobsCount++;
        } else {
          newJobsCount++;
        }
      } catch {
        // Continue if single job ingestion fails
      }
    }

    return {
      jobsDiscovered: listings.length,
      newJobsCount,
      duplicateJobsCount,
      jobs: ingestedJobs,
    };
  }
}
