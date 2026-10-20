export const VerificationStatuses = {
  UNVERIFIED: 'UNVERIFIED',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
} as const;

export type VerificationStatus = (typeof VerificationStatuses)[keyof typeof VerificationStatuses];

export const DocumentTypeEnum = {
  MASTER_CV: 'MASTER_CV',
  ROLE_CV: 'ROLE_CV',
  COVER_LETTER_TEMPLATE: 'COVER_LETTER_TEMPLATE',
  CERTIFICATE: 'CERTIFICATE',
  PORTFOLIO: 'PORTFOLIO',
  OTHER: 'OTHER',
} as const;

export type DocumentType = (typeof DocumentTypeEnum)[keyof typeof DocumentTypeEnum];

export const AutomationLevelEnum = {
  AUTO: 'AUTO',
  REVIEW: 'REVIEW',
  MANUAL: 'MANUAL',
} as const;

export type AutomationLevel = (typeof AutomationLevelEnum)[keyof typeof AutomationLevelEnum];

export interface CandidateProfileDto {
  id: string;
  userId: string;
  preferredName: string | null;
  fullName: string | null;
  headline: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  summary: string | null;
  availability: string | null;
  careerStage?: string | null;
  targetSalary?: number | null;
  targetSalaryCurrency?: string | null;
  transferableCapabilities?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CandidateExperienceDto {
  id: string;
  userId: string;
  organization: string;
  position: string;
  location: string | null;
  employmentType: string | null;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  description: string | null;
  achievements: string[];
  responsibilities?: string[];
  skills?: string[];
  industry?: string | null;
  transferableCapabilities?: string[];
  displayOrder: number;
  verificationStatus: VerificationStatus;
  sourceReference?: string | null;
  sourceEntityId?: string | null;
  allowAiUse?: boolean;
  confidence?: number | null;
  lastConfirmedAt?: string | null;
  hasContradiction?: boolean;
  contradictionDetails?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateEducationDto {
  id: string;
  userId: string;
  institution: string;
  degree: string | null;
  fieldOfStudy: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  location: string | null;
  description: string | null;
  activities: string | null;
  honors?: string | null;
  displayOrder: number;
  verificationStatus: VerificationStatus;
  sourceReference?: string | null;
  sourceEntityId?: string | null;
  allowAiUse?: boolean;
  confidence?: number | null;
  lastConfirmedAt?: string | null;
  hasContradiction?: boolean;
  contradictionDetails?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateProjectDto {
  id: string;
  userId: string;
  name: string;
  role: string | null;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  projectUrl: string | null;
  skills: string[];
  achievements: string[];
  isActive: boolean;
  displayOrder: number;
  verificationStatus: VerificationStatus;
  sourceReference?: string | null;
  sourceEntityId?: string | null;
  allowAiUse?: boolean;
  confidence?: number | null;
  lastConfirmedAt?: string | null;
  hasContradiction?: boolean;
  contradictionDetails?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateSkillDto {
  id: string;
  userId: string;
  name: string;
  category: string | null;
  proficiency: string | null;
  yearsExperience: number | null;
  isActive: boolean;
  isTool?: boolean;
  transferableCapabilities?: string[];
  verificationStatus: VerificationStatus;
  sourceReference?: string | null;
  sourceEntityId?: string | null;
  allowAiUse?: boolean;
  confidence?: number | null;
  lastConfirmedAt?: string | null;
  hasContradiction?: boolean;
  contradictionDetails?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateLanguageDto {
  id: string;
  userId: string;
  language: string;
  proficiency: string | null;
  cefrLevel: string | null;
  notes: string | null;
  verificationStatus: VerificationStatus;
  sourceReference?: string | null;
  sourceEntityId?: string | null;
  allowAiUse?: boolean;
  confidence?: number | null;
  lastConfirmedAt?: string | null;
  hasContradiction?: boolean;
  contradictionDetails?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateCertificationDto {
  id: string;
  userId: string;
  name: string;
  issuingOrganization: string;
  issueDate: string | null;
  expirationDate: string | null;
  credentialId: string | null;
  credentialUrl: string | null;
  verificationStatus: VerificationStatus;
  sourceReference?: string | null;
  sourceEntityId?: string | null;
  allowAiUse?: boolean;
  confidence?: number | null;
  lastConfirmedAt?: string | null;
  hasContradiction?: boolean;
  contradictionDetails?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateLinkDto {
  id: string;
  userId: string;
  label: string;
  url: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateFactDto {
  id: string;
  userId: string;
  category: string;
  factKey: string;
  statement: string;
  structuredValue: unknown | null;
  sourceType: string;
  sourceEntityId: string | null;
  verificationStatus: VerificationStatus;
  allowAiUse: boolean;
  confidence?: number | null;
  lastConfirmedAt?: string | null;
  hasContradiction?: boolean;
  contradictionDetails?: string | null;
  sources?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CandidateDocumentDto {
  id: string;
  userId: string;
  documentType: DocumentType;
  displayName: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  sha256Checksum: string | null;
  roleFocus: string | null;
  version: string;
  isActive: boolean;
  isMaster: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AnswerLibraryEntryDto {
  id: string;
  userId: string;
  question: string;
  category: string;
  answer: string;
  notes: string | null;
  automationLevel: AutomationLevel;
  verificationStatus: VerificationStatus;
  isSensitive: boolean;
  conditions: unknown | null;
  createdAt: string;
  updatedAt: string;
}

export interface LearnedPreferencesDto {
  downvotedIndustries: string[];
  downvotedLocations: string[];
  downvotedCompanies: string[];
  tooSeniorCount: number;
  tooJuniorCount: number;
  feedbackCounts: Record<string, number>;
  lastUpdated?: string;
}

export interface JobPreferencesDto {
  id: string;
  userId: string;
  targetTitles: string[];
  targetCategories: string[];
  adjacentRoles?: string[];
  preferredIndustries?: string[];
  careerTransitions?: string[];
  longTermGoals?: string | null;
  developmentPriorities?: string[];
  preferredLocations: string[];
  workModes: string[];
  employmentTypes: string[];
  seniorityLevels: string[];
  minSalary: number | null;
  maxSalary: number | null;
  salaryPayPeriod: 'YEAR' | 'MONTH' | 'WEEK' | 'DAY' | 'HOUR' | null;
  currency: string;
  preferredLanguages: string[];
  excludedCompanies: string[];
  excludedKeywords: string[];
  acceptUnpaid: boolean;
  willingToRelocate: boolean | null;
  needsSponsorship: boolean | null;
  workAuthorizationCountries?: string[];
  internshipEligible?: boolean | null;
  availability?: string | null;
  customPreferences: unknown | null;
  learnedPreferences?: LearnedPreferencesDto | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationPolicyDto {
  id: string;
  userId: string;
  autoApplyEnabled: boolean;
  minScoreForReview: number;
  autoApplyMinScore: number;
  maxApplicationsPerDay: number;
  blockOnUnresolvedReview: boolean;
  blockOnManual: boolean;
  blockOnUnknownSensitive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileCompletenessCategory {
  category: string;
  label: string;
  weight: number;
  completed: boolean;
  missingDetails?: string;
}

export interface ProfileCompletenessResult {
  score: number; // 0 to 100
  categories: ProfileCompletenessCategory[];
  missingItems: string[];
}

export interface CandidateOverviewDto {
  profile: CandidateProfileDto | null;
  experienceCount: number;
  educationCount: number;
  skillCount: number;
  languageCount: number;
  factCount: number;
  verifiedFactCount: number;
  answerCount: number;
  documentCount: number;
  hasActiveMasterCv: boolean;
  roleCvCount: number;
  completeness: ProfileCompletenessResult;
}

export interface CandidateAuditEventDto {
  id: string;
  userId: string;
  entityType: string;
  entityId: string;
  action: string;
  actor: string;
  changedFields: string[];
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export const CandidateJobFeedbackTypes = {
  INTERESTED: 'INTERESTED',
  NOT_INTERESTED: 'NOT_INTERESTED',
  IRRELEVANT: 'IRRELEVANT',
  ALREADY_APPLIED: 'ALREADY_APPLIED',
  TOO_SENIOR: 'TOO_SENIOR',
  WRONG_LOCATION: 'WRONG_LOCATION',
  WRONG_INDUSTRY: 'WRONG_INDUSTRY',
} as const;

export type CandidateJobFeedbackType =
  (typeof CandidateJobFeedbackTypes)[keyof typeof CandidateJobFeedbackTypes];

export interface CandidateJobFeedbackDto {
  id: string;
  userId: string;
  jobId: string;
  feedbackType: CandidateJobFeedbackType;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export const CandidateIntelligenceSuggestionTypes = {
  TRANSFERABLE_SKILL: 'TRANSFERABLE_SKILL',
  CAREER_PATH: 'CAREER_PATH',
  MISSING_DETAIL: 'MISSING_DETAIL',
  ACHIEVEMENT: 'ACHIEVEMENT',
  INCONSISTENCY: 'INCONSISTENCY',
  PREFERENCE_UPDATE: 'PREFERENCE_UPDATE',
} as const;

export type CandidateIntelligenceSuggestionType =
  (typeof CandidateIntelligenceSuggestionTypes)[keyof typeof CandidateIntelligenceSuggestionTypes];

export const CandidateIntelligenceSuggestionStatuses = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  DISMISSED: 'DISMISSED',
} as const;

export type CandidateIntelligenceSuggestionStatus =
  (typeof CandidateIntelligenceSuggestionStatuses)[keyof typeof CandidateIntelligenceSuggestionStatuses];

export interface CandidateIntelligenceSuggestionDto {
  id: string;
  userId: string;
  suggestionType: CandidateIntelligenceSuggestionType;
  title: string;
  description: string;
  payload: Record<string, unknown>;
  evidence?: string | null;
  sourceDocumentId?: string | null;
  confidence?: number | null;
  status: CandidateIntelligenceSuggestionStatus;
  appliedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateIntelligenceSummaryDto {
  whatJobeeKnows: {
    verifiedSkills: string[];
    verifiedExperiences: { position: string; organization: string; duration: string }[];
    verifiedEducation: { institution: string; degree: string | null }[];
    workAuthorization: string[];
    industries: string[];
    transferableCapabilities: string[];
  };
  whatNeedsClarification: {
    category: string;
    question: string;
    field: string;
    impact: 'HIGH' | 'MEDIUM' | 'LOW';
    suggestedValues?: string[];
  }[];
  verifiedCount: number;
  aiSuggestedCount: number;
  suitableCareerPaths: {
    primaryRoles: string[];
    adjacentRoles: string[];
    careerTransitions: string[];
    transferableCapabilities: string[];
  };
  matchingConstraints: {
    workModes: string[];
    locations: string[];
    minSalary: number | null;
    excludedCompanies: string[];
    excludedKeywords: string[];
    sponsorshipNeeded: boolean | null;
  };
  learnedPreferences: LearnedPreferencesDto;
}

export function isAnswerSafeForAutomation(answer: {
  automationLevel: AutomationLevel;
  verificationStatus: VerificationStatus;
  isSensitive: boolean;
}): boolean {
  if (answer.automationLevel !== 'AUTO') return false;
  if (answer.isSensitive && answer.verificationStatus !== 'VERIFIED') return false;
  return true;
}

export function isFactAuthorizedForAi(fact: {
  verificationStatus: VerificationStatus;
  allowAiUse: boolean;
}): boolean {
  return fact.verificationStatus === 'VERIFIED' && fact.allowAiUse === true;
}
