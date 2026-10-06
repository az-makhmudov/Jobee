import type {
  AnswerLibrary,
  JobPreferences,
  ApplicationPolicy,
  CandidateFact,
} from '@job-agent/database';
import type { CandidateContext } from './tailoring-engine.js';
import type {
  QuestionCategory,
  QuestionType,
  AnswerSource,
  ApprovalStatus,
  ApprovalType,
  ApprovalRiskLevel,
} from '@job-agent/shared';

export interface ProposedQuestionResolution {
  proposedAnswer: string | null;
  answerSource: AnswerSource;
  sourceEntityId: string | null;
  approvalState: ApprovalStatus;
  needsApproval: boolean;
  approvalDetails?: {
    approvalType: ApprovalType;
    subject: string;
    proposedValue: string | null;
    reason: string;
    riskLevel: ApprovalRiskLevel;
    evidenceReferences: string[];
  };
}

export class ApplicationQuestionEngine {
  /**
   * Resolves an application question according to the strict 4-level hierarchy.
   */
  public static resolveQuestion(
    question: {
      questionText: string;
      category: QuestionCategory;
      questionType: QuestionType;
      options: string[];
      sensitivity: 'STANDARD' | 'SENSITIVE';
      isRequired: boolean;
    },
    context: {
      candidate: CandidateContext;
      answerLibrary: AnswerLibrary[];
      candidateFacts: CandidateFact[];
      preferences?: JobPreferences | null;
      policy?: ApplicationPolicy | null;
    },
  ): ProposedQuestionResolution {
    const qTextLower = question.questionText.toLowerCase().trim();
    const isSensitive =
      question.sensitivity === 'SENSITIVE' || this.isCategorySensitive(question.category);

    // ========================================================================
    // Level 1: Verified Answer Library
    // ========================================================================
    const matchingLibraryItem = context.answerLibrary.find((item) => {
      const promptLower = item.question.toLowerCase().trim();
      return (
        promptLower === qTextLower ||
        qTextLower.includes(promptLower) ||
        promptLower.includes(qTextLower) ||
        (item.category && item.category === question.category)
      );
    });

    if (matchingLibraryItem) {
      const answerVal = matchingLibraryItem.answer;
      const validAnswer = this.validateAgainstOptions(
        answerVal,
        question.questionType,
        question.options,
      );

      if (validAnswer) {
        if (matchingLibraryItem.automationLevel === 'AUTO' && !isSensitive) {
          return {
            proposedAnswer: validAnswer,
            answerSource: 'ANSWER_LIBRARY',
            sourceEntityId: matchingLibraryItem.id,
            approvalState: 'APPROVED',
            needsApproval: false,
          };
        }

        // REVIEW or sensitive AUTO requires human review
        return {
          proposedAnswer: validAnswer,
          answerSource: 'ANSWER_LIBRARY',
          sourceEntityId: matchingLibraryItem.id,
          approvalState: 'PENDING',
          needsApproval: true,
          approvalDetails: {
            approvalType: isSensitive ? 'SENSITIVE_ANSWER' : 'QUESTION_ANSWER',
            subject: `Proposed Answer for: "${question.questionText}"`,
            proposedValue: validAnswer,
            reason: isSensitive
              ? 'Sensitive question matched in Answer Library requires human authorization.'
              : `Answer Library item set to ${matchingLibraryItem.automationLevel} automation requires approval.`,
            riskLevel: isSensitive ? 'HIGH' : 'LOW',
            evidenceReferences: [`answer_library:${matchingLibraryItem.id}`],
          },
        };
      }
    }

    // ========================================================================
    // Level 2: Deterministic Candidate Brain Facts & Preferences
    // ========================================================================
    // 2a. Work authorization & Visa Sponsorship
    if (question.category === 'SPONSORSHIP' || qTextLower.includes('sponsor')) {
      if (
        context.preferences &&
        context.preferences.needsSponsorship !== null &&
        context.preferences.needsSponsorship !== undefined
      ) {
        const needsSponsorship = context.preferences.needsSponsorship;
        const answerStr = needsSponsorship ? 'Yes' : 'No';
        const validVal =
          this.validateAgainstOptions(answerStr, question.questionType, question.options) ||
          answerStr;

        return {
          proposedAnswer: validVal,
          answerSource: 'CANDIDATE_FACT',
          sourceEntityId: context.preferences.id,
          approvalState: 'PENDING', // Legal/sensitive fact requires approval
          needsApproval: true,
          approvalDetails: {
            approvalType: 'SENSITIVE_ANSWER',
            subject: `Visa Sponsorship Answer: "${question.questionText}"`,
            proposedValue: validVal,
            reason:
              'Visa sponsorship is a legal declaration requiring explicit human verification.',
            riskLevel: 'CRITICAL',
            evidenceReferences: [`job_preferences:${context.preferences.id}`],
          },
        };
      }
    }

    if (
      question.category === 'WORK_AUTHORIZATION' ||
      qTextLower.includes('legally authorized') ||
      qTextLower.includes('work authorization')
    ) {
      // Check verified facts for citizenship/residence
      const authFact = context.candidateFacts.find(
        (f) =>
          f.verificationStatus === 'VERIFIED' &&
          (f.category === 'CITIZENSHIP' ||
            f.category === 'WORK_AUTHORIZATION' ||
            f.factKey.includes('work_auth')),
      );

      if (authFact) {
        return {
          proposedAnswer: authFact.statement,
          answerSource: 'CANDIDATE_FACT',
          sourceEntityId: authFact.id,
          approvalState: 'PENDING',
          needsApproval: true,
          approvalDetails: {
            approvalType: 'SENSITIVE_ANSWER',
            subject: `Work Authorization Answer: "${question.questionText}"`,
            proposedValue: authFact.statement,
            reason: 'Work authorization answers require human confirmation before submission.',
            riskLevel: 'CRITICAL',
            evidenceReferences: [`candidate_fact:${authFact.id}`],
          },
        };
      }
    }

    // 2b. Salary questions
    if (
      question.category === 'SALARY' ||
      qTextLower.includes('salary') ||
      qTextLower.includes('compensation')
    ) {
      if (context.preferences?.minSalary) {
        const salaryVal = `${context.preferences.minSalary} ${context.preferences.currency || 'EUR'}`;
        return {
          proposedAnswer: salaryVal,
          answerSource: 'CANDIDATE_FACT',
          sourceEntityId: context.preferences.id,
          approvalState: 'PENDING',
          needsApproval: true,
          approvalDetails: {
            approvalType: 'QUESTION_ANSWER',
            subject: `Salary Expectation for: "${question.questionText}"`,
            proposedValue: salaryVal,
            reason:
              'Salary expectation proposed from candidate minimum preferences; requires approval.',
            riskLevel: 'HIGH',
            evidenceReferences: [`job_preferences:${context.preferences.id}`],
          },
        };
      }
    }

    // 2c. Relocation
    if (question.category === 'RELOCATION' || qTextLower.includes('relocat')) {
      if (
        context.preferences &&
        context.preferences.willingToRelocate !== null &&
        context.preferences.willingToRelocate !== undefined
      ) {
        const relocVal = context.preferences.willingToRelocate ? 'Yes' : 'No';
        const validVal =
          this.validateAgainstOptions(relocVal, question.questionType, question.options) ||
          relocVal;
        return {
          proposedAnswer: validVal,
          answerSource: 'CANDIDATE_FACT',
          sourceEntityId: context.preferences.id,
          approvalState: 'PENDING',
          needsApproval: true,
          approvalDetails: {
            approvalType: 'QUESTION_ANSWER',
            subject: `Relocation Answer: "${question.questionText}"`,
            proposedValue: validVal,
            reason: 'Relocation willingness proposed from preferences; requires review.',
            riskLevel: 'MEDIUM',
            evidenceReferences: [`job_preferences:${context.preferences.id}`],
          },
        };
      }
    }

    // 2d. Basic Contact Information (Safe Level 2 Facts)
    if (qTextLower.includes('email') || qTextLower === 'email address') {
      if (context.candidate.profile.email) {
        return {
          proposedAnswer: context.candidate.profile.email,
          answerSource: 'CANDIDATE_FACT',
          sourceEntityId: context.candidate.profile.id,
          approvalState: 'APPROVED',
          needsApproval: false,
        };
      }
    }

    if (qTextLower.includes('phone') || qTextLower === 'phone number') {
      if (context.candidate.profile.phone) {
        return {
          proposedAnswer: context.candidate.profile.phone,
          answerSource: 'CANDIDATE_FACT',
          sourceEntityId: context.candidate.profile.id,
          approvalState: 'APPROVED',
          needsApproval: false,
        };
      }
    }

    if (qTextLower.includes('linkedin') || qTextLower.includes('linkedin profile')) {
      const link = context.candidate.links.find(
        (l) => l.label.toLowerCase().includes('linkedin') || l.url.includes('linkedin.com'),
      );
      if (link) {
        return {
          proposedAnswer: link.url,
          answerSource: 'CANDIDATE_FACT',
          sourceEntityId: link.id,
          approvalState: 'APPROVED',
          needsApproval: false,
        };
      }
    }

    if (
      qTextLower.includes('portfolio') ||
      qTextLower.includes('github') ||
      qTextLower.includes('website')
    ) {
      const link = context.candidate.links.find(
        (l) =>
          l.label.toLowerCase().includes('github') ||
          l.label.toLowerCase().includes('portfolio') ||
          l.label.toLowerCase().includes('website'),
      );
      if (link) {
        return {
          proposedAnswer: link.url,
          answerSource: 'CANDIDATE_FACT',
          sourceEntityId: link.id,
          approvalState: 'APPROVED',
          needsApproval: false,
        };
      }
    }

    // ========================================================================
    // Level 3 & 4: Unknown / Human Input Required (Never Guess!)
    // ========================================================================
    return {
      proposedAnswer: null,
      answerSource: 'UNRESOLVED',
      sourceEntityId: null,
      approvalState: 'PENDING',
      needsApproval: true,
      approvalDetails: {
        approvalType: isSensitive ? 'SENSITIVE_ANSWER' : 'QUESTION_ANSWER',
        subject: `Candidate Input Required: "${question.questionText}"`,
        proposedValue: null,
        reason:
          'No authoritative Candidate Brain evidence or Answer Library rule exists. Human answer required.',
        riskLevel: isSensitive ? 'CRITICAL' : 'MEDIUM',
        evidenceReferences: [],
      },
    };
  }

  private static isCategorySensitive(category: QuestionCategory): boolean {
    return category === 'WORK_AUTHORIZATION' || category === 'SPONSORSHIP' || category === 'SALARY';
  }

  private static validateAgainstOptions(
    answer: string,
    questionType: QuestionType,
    options: string[],
  ): string | null {
    if (questionType === 'SINGLE_SELECT' || questionType === 'BOOLEAN') {
      if (options.length > 0) {
        const found = options.find(
          (opt) => opt.toLowerCase().trim() === answer.toLowerCase().trim(),
        );
        return found || null;
      }
    }
    return answer;
  }
}
