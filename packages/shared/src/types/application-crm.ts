import type { MatchDecision } from './job.js';

export const ApplicationLifecycleStatus = {
  DISCOVERED: 'DISCOVERED',
  ANALYZED: 'ANALYZED',
  MATCHED: 'MATCHED',
  SKIPPED: 'SKIPPED',
  READY_TO_APPLY: 'READY_TO_APPLY',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  APPLYING: 'APPLYING',
  APPLIED: 'APPLIED',
  CONFIRMATION_RECEIVED: 'CONFIRMATION_RECEIVED',
  SCREENING: 'SCREENING',
  ASSESSMENT: 'ASSESSMENT',
  INTERVIEW: 'INTERVIEW',
  FINAL_INTERVIEW: 'FINAL_INTERVIEW',
  OFFER: 'OFFER',
  REJECTED: 'REJECTED',
  WITHDRAWN: 'WITHDRAWN',
  EXPIRED: 'EXPIRED',
} as const;
export type ApplicationLifecycleStatus =
  (typeof ApplicationLifecycleStatus)[keyof typeof ApplicationLifecycleStatus];

export const TERMINAL_APPLICATION_STATUSES: readonly ApplicationLifecycleStatus[] = [
  'REJECTED',
  'WITHDRAWN',
  'EXPIRED',
] as const;

export const ACTIVE_APPLICATION_STATUSES: readonly ApplicationLifecycleStatus[] = [
  'READY_TO_APPLY',
  'NEEDS_REVIEW',
  'APPLYING',
  'APPLIED',
  'CONFIRMATION_RECEIVED',
  'SCREENING',
  'ASSESSMENT',
  'INTERVIEW',
  'FINAL_INTERVIEW',
  'OFFER',
] as const;

export const SubmissionMethod = {
  COMPANY_SITE: 'COMPANY_SITE',
  GREENHOUSE: 'GREENHOUSE',
  LEVER: 'LEVER',
  ASHBY: 'ASHBY',
  LINKEDIN: 'LINKEDIN',
  EMAIL: 'EMAIL',
  RECRUITER: 'RECRUITER',
  OTHER: 'OTHER',
} as const;
export type SubmissionMethod = (typeof SubmissionMethod)[keyof typeof SubmissionMethod];

export const NextActionType = {
  FOLLOW_UP: 'FOLLOW_UP',
  PREPARE_INTERVIEW: 'PREPARE_INTERVIEW',
  COMPLETE_ASSESSMENT: 'COMPLETE_ASSESSMENT',
  CHECK_PORTAL: 'CHECK_PORTAL',
  SUBMIT_DOCUMENTS: 'SUBMIT_DOCUMENTS',
  NEGOTIATE_OFFER: 'NEGOTIATE_OFFER',
  OTHER: 'OTHER',
} as const;
export type NextActionType = (typeof NextActionType)[keyof typeof NextActionType];

export const ApplicationEventType = {
  APPLICATION_CREATED: 'APPLICATION_CREATED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  MARKED_APPLIED: 'MARKED_APPLIED',
  SUBMISSION_RECORDED: 'SUBMISSION_RECORDED',
  CONFIRMATION_RECEIVED: 'CONFIRMATION_RECEIVED',
  SCREENING_STARTED: 'SCREENING_STARTED',
  ASSESSMENT_RECEIVED: 'ASSESSMENT_RECEIVED',
  INTERVIEW_SCHEDULED_MANUALLY: 'INTERVIEW_SCHEDULED_MANUALLY',
  OFFER_RECEIVED: 'OFFER_RECEIVED',
  REJECTED: 'REJECTED',
  WITHDRAWN: 'WITHDRAWN',
  EXPIRED: 'EXPIRED',
  NOTE_ADDED: 'NOTE_ADDED',
  CONTACT_LINKED: 'CONTACT_LINKED',
  FOLLOW_UP_SET: 'FOLLOW_UP_SET',
  STATUS_CORRECTION: 'STATUS_CORRECTION',
  APPLICATION_ARCHIVED: 'APPLICATION_ARCHIVED',
  APPLICATION_UNARCHIVED: 'APPLICATION_UNARCHIVED',
} as const;
export type ApplicationEventType = (typeof ApplicationEventType)[keyof typeof ApplicationEventType];

export const AssessmentType = {
  CODING_CHALLENGE: 'CODING_CHALLENGE',
  TAKE_HOME_PROJECT: 'TAKE_HOME_PROJECT',
  SYSTEM_DESIGN: 'SYSTEM_DESIGN',
  BEHAVIORAL: 'BEHAVIORAL',
  ONLINE_TEST: 'ONLINE_TEST',
  OTHER: 'OTHER',
} as const;
export type AssessmentType = (typeof AssessmentType)[keyof typeof AssessmentType];

export const AssessmentStatus = {
  RECEIVED: 'RECEIVED',
  IN_PROGRESS: 'IN_PROGRESS',
  SUBMITTED: 'SUBMITTED',
  PASSED: 'PASSED',
  FAILED: 'FAILED',
  EXPIRED: 'EXPIRED',
} as const;
export type AssessmentStatus = (typeof AssessmentStatus)[keyof typeof AssessmentStatus];

export const InterviewType = {
  PHONE_SCREEN: 'PHONE_SCREEN',
  TECHNICAL: 'TECHNICAL',
  SYSTEM_DESIGN: 'SYSTEM_DESIGN',
  BEHAVIORAL: 'BEHAVIORAL',
  HIRING_MANAGER: 'HIRING_MANAGER',
  FINAL_ROUND: 'FINAL_ROUND',
  OTHER: 'OTHER',
} as const;
export type InterviewType = (typeof InterviewType)[keyof typeof InterviewType];

export const InterviewStatus = {
  SCHEDULED: 'SCHEDULED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  RESCHEDULED: 'RESCHEDULED',
  NO_SHOW: 'NO_SHOW',
} as const;
export type InterviewStatus = (typeof InterviewStatus)[keyof typeof InterviewStatus];

export const OfferStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
  NEGOTIATING: 'NEGOTIATING',
  RESCINDED: 'RESCINDED',
} as const;
export type OfferStatus = (typeof OfferStatus)[keyof typeof OfferStatus];

// DTOs
export interface ApplicationSummaryDto {
  id: string;
  jobId: string;
  jobTitle: string;
  company: string;
  location?: string | null;
  workplaceType?: string | null;
  status: ApplicationLifecycleStatus;
  source: string;
  submissionMethod?: string | null;
  applicationUrl?: string | null;
  appliedAt?: string | null;
  lastStatusChangeAt: string;
  closedAt?: string | null;
  terminalReason?: string | null;
  terminalStage?: string | null;
  nextAction?: string | null;
  nextActionType?: string | null;
  followUpAt?: string | null;
  notes?: string | null;
  isFollowUpDue: boolean;
  isFollowUpOverdue: boolean;
  matchScore?: number | null;
  matchDecision?: MatchDecision | null;
  packageId?: string | null;
  submittedVersionNumber?: number | null;
  notesCount: number;
  contactsCount: number;
  interviewsCount: number;
  isArchived: boolean;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationEventDto {
  id: string;
  applicationId: string;
  eventType: ApplicationEventType | string;
  previousStatus?: string | null;
  newStatus?: string | null;
  actor: string;
  note?: string | null;
  safeMetadata: Record<string, unknown>;
  createdAt: string;
}

export interface ApplicationNoteDto {
  id: string;
  applicationId: string;
  content: string;
  author: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationContactDto {
  id: string;
  applicationId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  company?: string | null;
  linkedinUrl?: string | null;
  isPrimary: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationAssessmentDto {
  id: string;
  applicationId: string;
  title: string;
  assessmentType: string;
  provider?: string | null;
  status: string;
  receivedAt?: string | null;
  dueAt?: string | null;
  completedAt?: string | null;
  url?: string | null;
  score?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationInterviewDto {
  id: string;
  applicationId: string;
  roundTitle: string;
  interviewType: string;
  status: string;
  scheduledAt: string;
  durationMinutes?: number | null;
  timezone?: string | null;
  locationOrUrl?: string | null;
  interviewerName?: string | null;
  contactId?: string | null;
  contactName?: string | null;
  notes?: string | null;
  feedback?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationOfferDto {
  id: string;
  applicationId: string;
  baseSalary?: number | null;
  totalComp?: number | null;
  currency: string;
  employmentType?: string | null;
  proposedStartDate?: string | null;
  deadlineAt?: string | null;
  status: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubmittedArtifactRefDto {
  artifactId: string;
  artifactType: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256Checksum: string;
  downloadUrl: string;
}

export interface ApplicationDetailDto {
  application: ApplicationSummaryDto;
  job: {
    id: string;
    title: string;
    company: string;
    location?: string | null;
    workplaceType?: string | null;
    employmentType?: string | null;
    seniorityLevel?: string | null;
    sourceUrl?: string | null;
    provider?: string | null;
    rawText?: string | null;
  };
  matchAnalysis?: {
    id: string;
    overallScore: number;
    decision: MatchDecision;
    confidence: number;
    isStale: boolean;
  } | null;
  submittedPackage?: {
    packageId: string;
    versionNumber: number;
    versionId: string;
    cvArtifact?: SubmittedArtifactRefDto | null;
    coverLetterArtifact?: SubmittedArtifactRefDto | null;
    submittedAt: string;
    submissionMethod?: string | null;
    externalReferenceId?: string | null;
  } | null;
  currentPackage?: {
    packageId: string;
    status: string;
    currentVersionNumber: number;
    isStale: boolean;
  } | null;
  events: ApplicationEventDto[];
  contacts: ApplicationContactDto[];
  notes: ApplicationNoteDto[];
  assessments: ApplicationAssessmentDto[];
  interviews: ApplicationInterviewDto[];
  offer?: ApplicationOfferDto | null;
}

export interface ApplicationCrmMetricsDto {
  totalTracked: number;
  readyToApply: number;
  applied: number;
  activeProcesses: number;
  interviews: number;
  offers: number;
  rejected: number;
  withdrawn: number;
  expired: number;
  skipped: number;
  pendingFollowUps: number;
  overdueFollowUps: number;
}

export interface ConversionMetric {
  rate: number | null; // percentage 0-100, null if denominator is 0
  numerator: number;
  denominator: number;
}

export interface ApplicationCrmAnalyticsDto {
  funnel: {
    totalApplications: number;
    readyToApply: number;
    applied: number;
    screening: number;
    interview: number;
    offer: number;
    conversions: {
      appliedToScreening: ConversionMetric;
      appliedToInterview: ConversionMetric;
      appliedToOffer: ConversionMetric;
      interviewToOffer: ConversionMetric;
    };
  };
  timeMetrics: {
    avgDaysToFirstResponse: number | null;
    avgDaysToInterview: number | null;
    avgDaysToOutcome: number | null;
    avgActiveAgingDays: number | null;
    sampleSizes: {
      firstResponse: number;
      interview: number;
      outcome: number;
      active: number;
    };
  };
  sourceDistribution: Array<{
    source: string;
    count: number;
    percentage: number;
  }>;
  statusCounts: Record<ApplicationLifecycleStatus, number>;
}

// Request Models
export interface CreateApplicationRequest {
  jobId: string;
  packageId?: string;
  status?: ApplicationLifecycleStatus;
  source?: string;
  applicationUrl?: string;
  submissionMethod?: SubmissionMethod | string;
  externalReferenceId?: string;
  appliedAt?: string;
  notes?: string;
  nextAction?: string;
  nextActionType?: NextActionType | string;
  followUpAt?: string;
}

export interface MarkAppliedRequest {
  appliedAt?: string;
  packageVersionId?: string;
  cvArtifactId?: string;
  coverLetterArtifactId?: string;
  submissionMethod?: SubmissionMethod | string;
  externalReferenceId?: string;
  applicationUrl?: string;
  notes?: string;
}

export interface TransitionStatusRequest {
  targetStatus: ApplicationLifecycleStatus;
  reason?: string;
  actor?: string;
  note?: string;
  isCorrection?: boolean;
  correctionReason?: string;
}

export interface UpdateNextActionRequest {
  nextAction?: string | null;
  nextActionType?: NextActionType | string | null;
  followUpAt?: string | null;
}

export interface AddNoteRequest {
  content: string;
  author?: string;
}

export interface CreateContactRequest {
  name: string;
  email?: string;
  phone?: string;
  title?: string;
  company?: string;
  linkedinUrl?: string;
  isPrimary?: boolean;
  notes?: string;
}

export interface UpdateContactRequest {
  name?: string;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  company?: string | null;
  linkedinUrl?: string | null;
  isPrimary?: boolean;
  notes?: string | null;
}

export interface CreateAssessmentRequest {
  title: string;
  assessmentType: AssessmentType | string;
  provider?: string;
  status?: AssessmentStatus | string;
  receivedAt?: string;
  dueAt?: string;
  completedAt?: string;
  url?: string;
  score?: string;
  notes?: string;
}

export interface UpdateAssessmentRequest {
  title?: string;
  assessmentType?: AssessmentType | string;
  provider?: string | null;
  status?: AssessmentStatus | string;
  receivedAt?: string | null;
  dueAt?: string | null;
  completedAt?: string | null;
  url?: string | null;
  score?: string | null;
  notes?: string | null;
}

export interface CreateInterviewRequest {
  roundTitle: string;
  interviewType: InterviewType | string;
  status?: InterviewStatus | string;
  scheduledAt: string;
  durationMinutes?: number;
  timezone?: string;
  locationOrUrl?: string;
  interviewerName?: string;
  contactId?: string;
  notes?: string;
  feedback?: string;
}

export interface UpdateInterviewRequest {
  roundTitle?: string;
  interviewType?: InterviewType | string;
  status?: InterviewStatus | string;
  scheduledAt?: string;
  durationMinutes?: number | null;
  timezone?: string | null;
  locationOrUrl?: string | null;
  interviewerName?: string | null;
  contactId?: string | null;
  notes?: string | null;
  feedback?: string | null;
}

export interface UpdateOfferRequest {
  baseSalary?: number | null;
  totalComp?: number | null;
  currency?: string;
  employmentType?: string | null;
  proposedStartDate?: string | null;
  deadlineAt?: string | null;
  status?: OfferStatus | string;
  notes?: string | null;
}

export interface ListApplicationsQuery {
  status?: ApplicationLifecycleStatus | string;
  search?: string;
  company?: string;
  source?: string;
  isArchived?: boolean;
  hasFollowUp?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'lastActivity' | 'appliedAt' | 'createdAt' | 'followUpAt' | 'company' | 'title';
  sortOrder?: 'asc' | 'desc';
}
