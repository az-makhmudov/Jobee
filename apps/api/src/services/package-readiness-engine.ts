import type {
  ApplicationPackage,
  ApplicationPackageVersion,
  ApplicationArtifact,
  ApplicationQuestion,
  ApprovalRequest,
} from '@job-agent/database';
import type { PackageReadinessResult } from '@job-agent/shared';

export class PackageReadinessEngine {
  /**
   * Deterministically evaluates package readiness for submission.
   */
  public static evaluateReadiness(params: {
    pkg: ApplicationPackage;
    version: ApplicationPackageVersion;
    artifacts: ApplicationArtifact[];
    questions: ApplicationQuestion[];
    approvals: ApprovalRequest[];
  }): PackageReadinessResult {
    const reasons: string[] = [];
    const blockingIssues: string[] = [];

    // 1. CV Artifact check
    const cvArtifact = params.artifacts.find((a) => a.artifactType === 'TAILORED_CV');
    if (!cvArtifact) {
      blockingIssues.push('Tailored CV document artifact has not been generated');
    } else {
      reasons.push('Tailored CV DOCX artifact successfully generated and stored');
    }

    if (
      params.version.coverLetterEnabled &&
      !params.artifacts.some((a) => a.artifactType === 'COVER_LETTER')
    )
      blockingIssues.push(
        'Requested cover letter is missing. Regenerate materials or explicitly turn it off.',
      );

    // 2. Policy Blocker check
    if (params.pkg.hasPolicyBlocker && !params.pkg.blockerOverridden) {
      blockingIssues.push(
        'Job matching has active hard policy blockers that have not been overridden by candidate',
      );
    } else if (params.pkg.hasPolicyBlocker && params.pkg.blockerOverridden) {
      reasons.push(
        `Hard policy blocker overridden with auditable justification: "${params.pkg.blockerOverrideReason}"`,
      );
    }

    // 3. Application Questions check
    const requiredQuestions = params.questions.filter((q) => q.isRequired);
    const unresolvedQuestions = requiredQuestions.filter(
      (q) => q.approvalState !== 'APPROVED' && q.approvalState !== 'RESOLVED',
    );
    if (unresolvedQuestions.length > 0) {
      blockingIssues.push(
        `${unresolvedQuestions.length} required application question(s) are unresolved or require candidate approval`,
      );
    } else if (requiredQuestions.length > 0) {
      reasons.push(
        `All ${requiredQuestions.length} required application question(s) resolved and approved`,
      );
    }

    // 4. Approvals check (Rejected, Pending, Reconfirmation, and Untrusted)
    const rejectedApprovals = params.approvals.filter((a) => a.status === 'REJECTED');
    const pendingApprovals = params.approvals.filter(
      (a) => a.status === 'PENDING' || a.status === 'NEEDS_USER_RECONFIRMATION',
    );
    const untrustedApprovals = params.approvals.filter(
      (a) =>
        (a.status === 'APPROVED' || a.status === 'RESOLVED') &&
        (!a.resolvedBy || a.resolvedBy !== 'USER'),
    );

    if (rejectedApprovals.length > 0) {
      blockingIssues.push(
        `${rejectedApprovals.length} approval request(s) were rejected by candidate and require resolution before submission`,
      );
    }

    if (pendingApprovals.length > 0) {
      const reconfirmCount = pendingApprovals.filter(
        (a) => a.status === 'NEEDS_USER_RECONFIRMATION',
      ).length;
      if (reconfirmCount > 0) {
        blockingIssues.push(
          `${reconfirmCount} approval request(s) require explicit user reconfirmation before submission`,
        );
      }
      const regularPending = pendingApprovals.length - reconfirmCount;
      if (regularPending > 0) {
        blockingIssues.push(
          `${regularPending} pending approval request(s) require human review and authorization`,
        );
      }
    }

    if (untrustedApprovals.length > 0) {
      blockingIssues.push(
        `${untrustedApprovals.length} approval request(s) were resolved by automation rather than human user and must be reconfirmed`,
      );
    }

    if (
      params.approvals.length > 0 &&
      rejectedApprovals.length === 0 &&
      pendingApprovals.length === 0 &&
      untrustedApprovals.length === 0
    ) {
      reasons.push(
        `All ${params.approvals.length} approval request(s) have been verified and approved by candidate`,
      );
    }

    // 5. Staleness check
    if (params.pkg.isStale) {
      blockingIssues.push(
        'Application package inputs have changed since last generation (package is stale)',
      );
    }

    const isReady = blockingIssues.length === 0;
    const status = isReady ? 'READY' : 'NEEDS_REVIEW';

    return {
      status,
      isReady,
      reasons,
      blockingIssues,
      pendingApprovalsCount:
        pendingApprovals.length + untrustedApprovals.length + rejectedApprovals.length,
      unresolvedQuestionsCount: unresolvedQuestions.length,
    };
  }
}
