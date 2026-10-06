import type { CandidateDocument } from '@job-agent/database';
import type { Job } from '@job-agent/database';

export interface CvBaseSelectionResult {
  selectedDocumentId: string | null;
  selectedDocumentTitle: string | null;
  reason: string;
  roleFocus: string | null;
}

export class CvBaseSelector {
  public static selectBase(
    documents: CandidateDocument[],
    job: Job,
    manualDocumentId?: string | null,
  ): CvBaseSelectionResult {
    // 1. Manual user override
    if (manualDocumentId) {
      const manualDoc = documents.find((d) => d.id === manualDocumentId);
      if (manualDoc) {
        return {
          selectedDocumentId: manualDoc.id,
          selectedDocumentTitle: manualDoc.displayName,
          reason: `Manually chosen base CV: "${manualDoc.displayName}"`,
          roleFocus: manualDoc.roleFocus || null,
        };
      }
    }

    const activeDocs = documents.filter((d) => d.isActive);

    // 2. Role-specific CV matching job title or family
    const jobTitleLower = (job.title || '').toLowerCase();
    const roleCv = activeDocs.find((d) => {
      if (d.documentType !== 'ROLE_CV') return false;
      const targetRoleLower = (d.roleFocus || '').toLowerCase();
      if (!targetRoleLower) return false;
      return jobTitleLower.includes(targetRoleLower) || targetRoleLower.includes(jobTitleLower);
    });

    if (roleCv) {
      return {
        selectedDocumentId: roleCv.id,
        selectedDocumentTitle: roleCv.displayName,
        reason: `Matched active role-oriented CV for "${roleCv.roleFocus || roleCv.displayName}" based on job title "${job.title}"`,
        roleFocus: roleCv.roleFocus || null,
      };
    }

    // 3. Active Master CV
    const masterCv = activeDocs.find((d) => d.documentType === 'MASTER_CV' || d.isMaster);
    if (masterCv) {
      return {
        selectedDocumentId: masterCv.id,
        selectedDocumentTitle: masterCv.displayName,
        reason: 'Selected active Master CV as base template and role provenance',
        roleFocus: masterCv.roleFocus || null,
      };
    }

    // 4. Any active CV
    const anyCv = activeDocs.find((d) => ['MASTER_CV', 'ROLE_CV'].includes(d.documentType));
    if (anyCv) {
      return {
        selectedDocumentId: anyCv.id,
        selectedDocumentTitle: anyCv.displayName,
        reason: `Selected active candidate document "${anyCv.displayName}" (${anyCv.documentType})`,
        roleFocus: anyCv.roleFocus || null,
      };
    }

    // 5. Fallback: direct structured Candidate Brain compilation
    return {
      selectedDocumentId: null,
      selectedDocumentTitle: null,
      reason:
        'No base CV document selected; compiled structured CV directly from Candidate Brain facts',
      roleFocus: null,
    };
  }
}
