import type { MatchDecision } from './job.js';

export const ApplicationPackageStatus = {
  DRAFT: 'DRAFT',
  GENERATING: 'GENERATING',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  READY: 'READY',
  FAILED: 'FAILED',
  ARCHIVED: 'ARCHIVED',
} as const;
export type ApplicationPackageStatus =
  (typeof ApplicationPackageStatus)[keyof typeof ApplicationPackageStatus];

export const PackageVersionStatus = {
  DRAFT: 'DRAFT',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  READY: 'READY',
  ARCHIVED: 'ARCHIVED',
} as const;
export type PackageVersionStatus = (typeof PackageVersionStatus)[keyof typeof PackageVersionStatus];

export const ApplicationArtifactType = {
  TAILORED_CV: 'TAILORED_CV',
  COVER_LETTER: 'COVER_LETTER',
  OTHER_SUPPORTING_DOCUMENT: 'OTHER_SUPPORTING_DOCUMENT',
} as const;
export type ApplicationArtifactType =
  (typeof ApplicationArtifactType)[keyof typeof ApplicationArtifactType];

export const QuestionType = {
  TEXT: 'TEXT',
  TEXTAREA: 'TEXTAREA',
  BOOLEAN: 'BOOLEAN',
  SINGLE_SELECT: 'SINGLE_SELECT',
  MULTI_SELECT: 'MULTI_SELECT',
  NUMBER: 'NUMBER',
  DATE: 'DATE',
} as const;
export type QuestionType = (typeof QuestionType)[keyof typeof QuestionType];

export const QuestionCategory = {
  WORK_AUTHORIZATION: 'WORK_AUTHORIZATION',
  SPONSORSHIP: 'SPONSORSHIP',
  RELOCATION: 'RELOCATION',
  SALARY: 'SALARY',
  AVAILABILITY: 'AVAILABILITY',
  EXPERIENCE_YEARS: 'EXPERIENCE_YEARS',
  LANGUAGE: 'LANGUAGE',
  PORTFOLIO: 'PORTFOLIO',
  TRAVEL: 'TRAVEL',
  MOTIVATION: 'MOTIVATION',
  GENERAL: 'GENERAL',
} as const;
export type QuestionCategory = (typeof QuestionCategory)[keyof typeof QuestionCategory];

export const AnswerSource = {
  ANSWER_LIBRARY: 'ANSWER_LIBRARY',
  CANDIDATE_FACT: 'CANDIDATE_FACT',
  AI_INTERPRETATION: 'AI_INTERPRETATION',
  MANUAL_USER: 'MANUAL_USER',
  UNRESOLVED: 'UNRESOLVED',
} as const;
export type AnswerSource = (typeof AnswerSource)[keyof typeof AnswerSource];

export const ApprovalType = {
  QUESTION_ANSWER: 'QUESTION_ANSWER',
  SENSITIVE_ANSWER: 'SENSITIVE_ANSWER',
  CV_CONTENT: 'CV_CONTENT',
  COVER_LETTER: 'COVER_LETTER',
  POLICY_OVERRIDE: 'POLICY_OVERRIDE',
  OTHER: 'OTHER',
} as const;
export type ApprovalType = (typeof ApprovalType)[keyof typeof ApprovalType];

export const ApprovalStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  RESOLVED: 'RESOLVED',
  CANCELLED: 'CANCELLED',
  NEEDS_USER_RECONFIRMATION: 'NEEDS_USER_RECONFIRMATION',
} as const;
export type ApprovalStatus = (typeof ApprovalStatus)[keyof typeof ApprovalStatus];

export const ApprovalRiskLevel = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;
export type ApprovalRiskLevel = (typeof ApprovalRiskLevel)[keyof typeof ApprovalRiskLevel];

// Structured CV Representation
export interface TailoredCvHeader {
  fullName: string;
  headline?: string;
  email?: string;
  phone?: string;
  location?: string;
  links: Array<{ label: string; url: string }>;
}

export interface TailoredCvBullet {
  text: string;
  evidenceIds: string[];
  sourceEntityType: string;
  sourceEntityId: string;
}

export interface TailoredCvExperience {
  id: string;
  title: string;
  organization: string;
  location?: string;
  startDate: string;
  endDate?: string;
  isCurrent: boolean;
  bullets: TailoredCvBullet[];
}

export interface TailoredCvEducation {
  id: string;
  institution: string;
  degree: string;
  fieldOfStudy?: string;
  startDate?: string;
  endDate?: string;
  bullets?: TailoredCvBullet[];
}

export interface TailoredCvSkill {
  id: string;
  name: string;
  category?: string;
  proficiencyLevel?: string;
  isHighlighted: boolean;
}

export interface TailoredCvLanguage {
  id: string;
  language: string;
  proficiencyLevel: string;
  cefrLevel?: string;
}

export interface TailoredCvCertification {
  id: string;
  name: string;
  issuer: string;
  issueDate?: string;
}

export interface TailoredCvProject {
  id: string;
  title: string;
  role?: string;
  url?: string;
  bullets: TailoredCvBullet[];
}

export interface TailoredCv {
  header: TailoredCvHeader;
  summary: string;
  summaryEvidenceIds: string[];
  experiences: TailoredCvExperience[];
  education: TailoredCvEducation[];
  skills: TailoredCvSkill[];
  languages: TailoredCvLanguage[];
  certifications: TailoredCvCertification[];
  projects: TailoredCvProject[];
  changeExplanation: string[];
}

export interface PackageReadinessResult {
  status: ApplicationPackageStatus;
  isReady: boolean;
  reasons: string[];
  blockingIssues: string[];
  pendingApprovalsCount: number;
  unresolvedQuestionsCount: number;
}

// API DTOs
export interface ApplicationPackageDto {
  id: string;
  jobId: string;
  userId: string;
  matchAnalysisId?: string | null;
  status: ApplicationPackageStatus;
  currentVersionNumber: number;
  hasPolicyBlocker: boolean;
  blockerOverridden: boolean;
  blockerOverrideReason?: string | null;
  blockerOverriddenAt?: string | null;
  isStale: boolean;
  readinessReason?: string | null;
  createdAt: string;
  updatedAt: string;
  jobTitle?: string;
  jobCompany?: string;
  jobLocation?: string;
  matchScore?: number | null;
  matchConfidence?: number | null;
  matchDecision?: MatchDecision | null;
}

export interface ApplicationPackageVersionDto {
  id: string;
  packageId: string;
  versionNumber: number;
  status: PackageVersionStatus;
  inputFingerprint: string;
  baseDocumentId?: string | null;
  baseSelectionReason?: string | null;
  tailoredCvContent?: TailoredCv | null;
  coverLetterContent?: string | null;
  coverLetterEnabled: boolean;
  coverLetterApproved: boolean;
  changeSummary: string[];
  generationMode: string;
  aiModel?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationArtifactDto {
  id: string;
  packageId: string;
  versionId: string;
  artifactType: ApplicationArtifactType;
  storageKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256Checksum: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ApplicationQuestionDto {
  id: string;
  packageId: string;
  versionId: string;
  questionText: string;
  category: QuestionCategory;
  questionType: QuestionType;
  isRequired: boolean;
  options: string[];
  sensitivity: 'STANDARD' | 'SENSITIVE';
  answerSource: AnswerSource;
  sourceEntityId?: string | null;
  proposedAnswer?: string | null;
  humanEditedAnswer?: string | null;
  finalAnswer?: string | null;
  approvalState: ApprovalStatus;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalRequestDto {
  id: string;
  packageId: string;
  versionId: string;
  userId: string;
  questionId?: string | null;
  approvalType: ApprovalType;
  status: ApprovalStatus;
  subject: string;
  proposedValue?: string | null;
  userEditedValue?: string | null;
  reason: string;
  riskLevel: ApprovalRiskLevel;
  evidenceReferences: string[];
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  jobTitle?: string;
  jobCompany?: string;
}

export interface ApplicationStudioMetricsDto {
  packagesInPreparation: number;
  packagesNeedingReview: number;
  packagesReady: number;
  pendingApprovals: number;
}
