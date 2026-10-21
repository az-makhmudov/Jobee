import { eq, and, ilike } from 'drizzle-orm';
import {
  getDb,
  type Database,
  applications,
  jobs,
  applicationContacts,
  emailThreadLinks,
} from '@job-agent/database';
import type { NormalizedEmailMessage } from '@job-agent/shared';
import type { ClassificationResult } from './deterministic-email-classifier.js';

export type EntityMatchMethod =
  'EXTERNAL_REF' | 'THREAD_MEMORY' | 'CONTACT_EMAIL' | 'COMPANY_AND_ROLE' | 'COMPANY_ONLY' | 'NONE';

export interface EntityResolutionResult {
  applicationId?: string;
  jobId?: string;
  contactId?: string;
  confidence: number;
  matchMethod: EntityMatchMethod;
  matchedCompany?: string;
  matchedRole?: string;
}

export class EmailEntityResolver {
  public static async resolve(options: {
    userId: string;
    accountId: string;
    message: NormalizedEmailMessage;
    classification: ClassificationResult;
    db?: Database;
  }): Promise<EntityResolutionResult> {
    const { userId, accountId, message, classification } = options;
    const db = options.db ?? getDb();
    const extracted = classification.extractedDetails;

    // 1. External Reference ID match (Highest confidence: 1.0)
    if (extracted.externalReferenceId) {
      const matchedApps = await db
        .select({
          id: applications.id,
          jobId: applications.jobId,
          company: jobs.company,
          title: jobs.title,
        })
        .from(applications)
        .innerJoin(jobs, eq(applications.jobId, jobs.id))
        .where(
          and(
            eq(applications.userId, userId),
            eq(applications.externalReferenceId, extracted.externalReferenceId),
          ),
        )
        .limit(2);

      if (matchedApps.length === 1 && matchedApps[0]) {
        return {
          applicationId: matchedApps[0].id,
          jobId: matchedApps[0].jobId,
          confidence: 1.0,
          matchMethod: 'EXTERNAL_REF',
          matchedCompany: matchedApps[0].company,
          matchedRole: matchedApps[0].title,
        };
      }
    }

    // 2. Thread Memory Match (0.95 confidence)
    if (message.externalThreadId) {
      const threadLink = await db
        .select()
        .from(emailThreadLinks)
        .where(
          and(
            eq(emailThreadLinks.accountId, accountId),
            eq(emailThreadLinks.userId, userId),
            eq(emailThreadLinks.providerThreadId, message.externalThreadId),
          ),
        )
        .limit(1);

      if (threadLink.length > 0 && threadLink[0]) {
        const link = threadLink[0];
        const owned = link.applicationId
          ? await db
              .select({ id: applications.id })
              .from(applications)
              .where(and(eq(applications.id, link.applicationId), eq(applications.userId, userId)))
              .limit(1)
          : [];
        if (owned.length && ['USER', 'AUTO_VERIFIED'].includes(link.confirmedBy)) {
          return {
            applicationId: link.applicationId || undefined,
            jobId: link.jobId || undefined,
            confidence: 0.95,
            matchMethod: 'THREAD_MEMORY',
            matchedCompany: link.company || undefined,
          };
        }
      }
    }

    // 3. Known Contact Email Match (0.90 confidence)
    if (message.from.email) {
      const contactMatches = await db
        .select({
          contactId: applicationContacts.id,
          applicationId: applicationContacts.applicationId,
          company: applicationContacts.company,
        })
        .from(applicationContacts)
        .where(
          and(
            eq(applicationContacts.userId, userId),
            ilike(applicationContacts.email, message.from.email.toLowerCase()),
          ),
        )
        .limit(2);

      if (contactMatches.length === 1 && contactMatches[0]) {
        const c = contactMatches[0];
        return {
          applicationId: c.applicationId,
          contactId: c.contactId,
          confidence: 0.9,
          matchMethod: 'CONTACT_EMAIL',
          matchedCompany: c.company || undefined,
        };
      }
    }

    // 4. Company & Role or Company-only matching against candidate applications
    // Get candidate's active applications
    const activeApps = await db
      .select({
        id: applications.id,
        jobId: applications.jobId,
        company: jobs.company,
        title: jobs.title,
      })
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .where(eq(applications.userId, userId));

    const normalize = (str: string) =>
      str
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]/gu, '');

    const companyCandidate = extracted.company || '';
    const roleCandidate = extracted.role || '';

    if (companyCandidate) {
      const normalizedCompany = normalize(companyCandidate);

      // Check for exact / normalized company match
      const matchingCompanyApps = activeApps.filter((a) => {
        const appNormCompany = normalize(a.company);
        return (
          !!normalizedCompany &&
          !!appNormCompany &&
          (appNormCompany.includes(normalizedCompany) || normalizedCompany.includes(appNormCompany))
        );
      });

      if (matchingCompanyApps.length > 0) {
        // If role also matches, we have high confidence match
        if (roleCandidate) {
          const normalizedRole = normalize(roleCandidate);
          const exactMatches = matchingCompanyApps.filter(
            (a) =>
              !!normalizedRole &&
              normalize(a.company) === normalizedCompany &&
              normalize(a.title) === normalizedRole,
          );
          const bothMatch = exactMatches.length === 1 ? exactMatches[0] : undefined;
          if (bothMatch) {
            return {
              applicationId: bothMatch.id,
              jobId: bothMatch.jobId,
              confidence: 0.95,
              matchMethod: 'COMPANY_AND_ROLE',
              matchedCompany: bothMatch.company,
              matchedRole: bothMatch.title,
            };
          }
        }

        // If unique company match among candidate applications
        if (matchingCompanyApps.length === 1 && matchingCompanyApps[0]) {
          return {
            applicationId: matchingCompanyApps[0].id,
            jobId: matchingCompanyApps[0].jobId,
            confidence: 0.78,
            matchMethod: 'COMPANY_ONLY',
            matchedCompany: matchingCompanyApps[0].company,
            matchedRole: matchingCompanyApps[0].title,
          };
        }
      }
    }

    // Also check sender domain as company hint (e.g. from recruiter@acme.com)
    const domainMatch = message.from.email.match(/@([^.]+)\./);
    if (
      domainMatch &&
      !['gmail', 'yahoo', 'hotmail', 'outlook', 'protonmail', 'icloud'].includes(domainMatch[1]!)
    ) {
      const domainName = normalize(domainMatch[1]!);
      const domainMatchingApps = activeApps.filter((a) => {
        const appNormCompany = normalize(a.company);
        return appNormCompany.includes(domainName) || domainName.includes(appNormCompany);
      });

      if (domainMatchingApps.length === 1 && domainMatchingApps[0]) {
        return {
          applicationId: domainMatchingApps[0].id,
          jobId: domainMatchingApps[0].jobId,
          confidence: 0.75,
          matchMethod: 'COMPANY_ONLY',
          matchedCompany: domainMatchingApps[0].company,
          matchedRole: domainMatchingApps[0].title,
        };
      }
    }

    return {
      confidence: 0.0,
      matchMethod: 'NONE',
    };
  }
}
