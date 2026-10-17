export const ProfileImportSourceTypeEnum = {
  CV: 'CV',
  LINKEDIN_PDF: 'LINKEDIN_PDF',
  LINKEDIN_ARCHIVE: 'LINKEDIN_ARCHIVE',
} as const;

export type ProfileImportSourceType =
  (typeof ProfileImportSourceTypeEnum)[keyof typeof ProfileImportSourceTypeEnum];

export const ProfileImportSessionStatusEnum = {
  PENDING: 'PENDING',
  EXTRACTING: 'EXTRACTING',
  REVIEW_READY: 'REVIEW_READY',
  COMMITTED: 'COMMITTED',
  DISCARDED: 'DISCARDED',
  FAILED: 'FAILED',
} as const;

export type ProfileImportSessionStatus =
  (typeof ProfileImportSessionStatusEnum)[keyof typeof ProfileImportSessionStatusEnum];

export const ProfileImportSectionEnum = {
  PROFILE: 'PROFILE',
  EXPERIENCE: 'EXPERIENCE',
  EDUCATION: 'EDUCATION',
  SKILL: 'SKILL',
  CERTIFICATION: 'CERTIFICATION',
  LANGUAGE: 'LANGUAGE',
  PROJECT: 'PROJECT',
  LINK: 'LINK',
} as const;

export type ProfileImportSection =
  (typeof ProfileImportSectionEnum)[keyof typeof ProfileImportSectionEnum];

export const ProfileImportClassificationEnum = {
  NEW: 'NEW',
  DUPLICATE: 'DUPLICATE',
  MATCHED: 'MATCHED',
  POTENTIAL_MATCH: 'POTENTIAL_MATCH',
  CONFLICT: 'CONFLICT',
  INCOMPLETE: 'INCOMPLETE',
  LOW_CONFIDENCE: 'LOW_CONFIDENCE',
} as const;

export type ProfileImportClassification =
  (typeof ProfileImportClassificationEnum)[keyof typeof ProfileImportClassificationEnum];

export const ProfileImportReviewStatusEnum = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EDITED: 'EDITED',
} as const;

export type ProfileImportReviewStatus =
  (typeof ProfileImportReviewStatusEnum)[keyof typeof ProfileImportReviewStatusEnum];

export const ProfileImportConflictResolutionEnum = {
  KEEP_EXISTING: 'KEEP_EXISTING',
  REPLACE_EXISTING: 'REPLACE_EXISTING',
  ADD_AS_SEPARATE: 'ADD_AS_SEPARATE',
} as const;

export type ProfileImportConflictResolution =
  (typeof ProfileImportConflictResolutionEnum)[keyof typeof ProfileImportConflictResolutionEnum];

// Structured extracted entity models
export interface ExtractedPersonalProfile {
  preferredName?: string | null;
  fullName?: string | null;
  headline?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  summary?: string | null;
  availability?: string | null;
}

export interface ExtractedExperience {
  organization: string;
  position: string;
  location?: string | null;
  employmentType?: string | null;
  startDate: string;
  endDate?: string | null;
  isCurrent?: boolean;
  description?: string | null;
  achievements?: string[];
}

export interface ExtractedEducation {
  institution: string;
  degree?: string | null;
  fieldOfStudy?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isCurrent?: boolean;
  location?: string | null;
  description?: string | null;
  activities?: string | null;
}

export interface ExtractedSkill {
  name: string;
  category?: string | null;
  proficiency?: string | null;
  yearsExperience?: number | null;
}

export interface ExtractedCertification {
  name: string;
  issuingOrganization: string;
  issueDate?: string | null;
  expirationDate?: string | null;
  credentialId?: string | null;
  credentialUrl?: string | null;
}

export interface ExtractedLanguage {
  language: string;
  proficiency?: string | null;
  cefrLevel?: string | null;
  notes?: string | null;
}

export interface ExtractedProject {
  name: string;
  role?: string | null;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  projectUrl?: string | null;
  skills?: string[];
  achievements?: string[];
}

export interface ExtractedLink {
  label: string;
  url: string;
}

export interface ExtractedProfileData {
  profile?: ExtractedPersonalProfile | null;
  experiences: Array<ExtractedExperience & { sourceReference: string; confidence: number }>;
  education: Array<ExtractedEducation & { sourceReference: string; confidence: number }>;
  skills: Array<ExtractedSkill & { sourceReference: string; confidence: number }>;
  certifications: Array<ExtractedCertification & { sourceReference: string; confidence: number }>;
  languages: Array<ExtractedLanguage & { sourceReference: string; confidence: number }>;
  projects: Array<ExtractedProject & { sourceReference: string; confidence: number }>;
  links: Array<ExtractedLink & { sourceReference: string; confidence: number }>;
}

export interface ProfileImportItemDto {
  id: string;
  sessionId: string;
  userId: string;
  section: ProfileImportSection;
  classification: ProfileImportClassification;
  confidenceScore: number;
  sourceReference: string;
  extractedPayload: Record<string, unknown>;
  existingEntityId: string | null;
  existingPayload: Record<string, unknown> | null;
  conflictDetails: string | null;
  reviewStatus: ProfileImportReviewStatus;
  userEditedPayload: Record<string, unknown> | null;
  conflictResolution?: ProfileImportConflictResolution | null;
  explicitlyClearedFields?: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileImportSessionDto {
  id: string;
  userId: string;
  sourceType: ProfileImportSourceType;
  status: ProfileImportSessionStatus;
  originalFilename: string;
  mimeType: string;
  storageKey: string;
  documentId: string | null;
  aiConsentGiven: boolean;
  extractorUsed: 'GEMINI_AI' | 'HEURISTIC_PARSER' | null;
  rawTextSnippet: string | null;
  errorMessage: string | null;
  itemCounts: {
    total: number;
    approved: number;
    rejected: number;
    pending: number;
    byClassification: Record<ProfileImportClassification, number>;
  };
  items?: ProfileImportItemDto[];
  createdAt: string;
  updatedAt: string;
}

export interface CommitImportSessionOptions {
  verifyOnCommit?: boolean;
  allowAiOnCommit?: boolean;
}

import type { ProfileCompletenessResult } from './candidate.js';

export interface CommitImportSessionResult {
  sessionId: string;
  committedCounts: {
    profileUpdated: boolean;
    experiencesCreated: number;
    educationCreated: number;
    skillsCreated: number;
    certificationsCreated: number;
    languagesCreated: number;
    projectsCreated: number;
    linksCreated: number;
    factsCreated: number;
  };
  newProfileCompleteness: ProfileCompletenessResult;
}
