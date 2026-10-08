import type { ApplicationLifecycleStatus } from './application-crm.js';

export const EmailClassificationType = {
  JOB_ALERT: 'JOB_ALERT',
  APPLICATION_CONFIRMATION: 'APPLICATION_CONFIRMATION',
  APPLICATION_REJECTION: 'APPLICATION_REJECTION',
  RECRUITER_OUTREACH: 'RECRUITER_OUTREACH',
  SCREENING_REQUEST: 'SCREENING_REQUEST',
  ASSESSMENT_REQUEST: 'ASSESSMENT_REQUEST',
  INTERVIEW_REQUEST: 'INTERVIEW_REQUEST',
  INTERVIEW_CONFIRMATION: 'INTERVIEW_CONFIRMATION',
  OFFER_RELATED: 'OFFER_RELATED',
  APPLICATION_UPDATE: 'APPLICATION_UPDATE',
  OTHER_JOB_RELATED: 'OTHER_JOB_RELATED',
  IRRELEVANT: 'IRRELEVANT',
  UNKNOWN: 'UNKNOWN',
} as const;
export type EmailClassificationType =
  (typeof EmailClassificationType)[keyof typeof EmailClassificationType];

export const EmailAccountStatus = {
  CONNECTED: 'CONNECTED',
  DISCONNECTED: 'DISCONNECTED',
  REAUTH_REQUIRED: 'REAUTH_REQUIRED',
  SYNC_ERROR: 'SYNC_ERROR',
} as const;
export type EmailAccountStatus = (typeof EmailAccountStatus)[keyof typeof EmailAccountStatus];

export const EmailProcessingStatus = {
  PENDING: 'PENDING',
  AUTO_SYNCED: 'AUTO_SYNCED',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  REVIEWED: 'REVIEWED',
  IRRELEVANT: 'IRRELEVANT',
  FAILED: 'FAILED',
} as const;
export type EmailProcessingStatus =
  (typeof EmailProcessingStatus)[keyof typeof EmailProcessingStatus];

export const EmailReviewStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  RESOLVED: 'RESOLVED',
  IGNORED: 'IGNORED',
} as const;
export type EmailReviewStatus = (typeof EmailReviewStatus)[keyof typeof EmailReviewStatus];

export const EmailProposedAction = {
  SYNC_STATUS: 'SYNC_STATUS',
  CREATE_JOB: 'CREATE_JOB',
  LINK_CONTACT: 'LINK_CONTACT',
  CREATE_ASSESSMENT: 'CREATE_ASSESSMENT',
  PROPOSE_INTERVIEW: 'PROPOSE_INTERVIEW',
  NONE: 'NONE',
} as const;
export type EmailProposedAction = (typeof EmailProposedAction)[keyof typeof EmailProposedAction];

export const EmailRiskLevel = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
} as const;
export type EmailRiskLevel = (typeof EmailRiskLevel)[keyof typeof EmailRiskLevel];

export const EmailSyncTrigger = {
  MANUAL: 'MANUAL',
  SCHEDULED: 'SCHEDULED',
  FIXTURE: 'FIXTURE',
} as const;
export type EmailSyncTrigger = (typeof EmailSyncTrigger)[keyof typeof EmailSyncTrigger];

export const EmailSyncRunStatus = {
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;
export type EmailSyncRunStatus = (typeof EmailSyncRunStatus)[keyof typeof EmailSyncRunStatus];

// Normalized Email representation
export interface NormalizedEmailMessage {
  externalId: string;
  externalThreadId: string;
  from: {
    email: string;
    name?: string;
  };
  to: string[];
  cc?: string[];
  subject: string;
  receivedAt: Date;
  snippet: string;
  plainText: string;
  sanitizedHtml?: string;
  labels: string[];
  provider: 'GMAIL' | 'FIXTURE' | 'OUTLOOK';
  providerMetadata?: Record<string, unknown>;
  hasAttachments?: boolean;
}

// DTOs
export interface EmailAccountDto {
  id: string;
  provider: string;
  emailAddress: string;
  status: EmailAccountStatus;
  lastSyncAt: string | null;
  syncCursor: string | null;
  tokenExpiresAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmailMessageDto {
  id: string;
  accountId: string;
  providerMessageId: string;
  providerThreadId: string;
  senderEmail: string;
  senderName: string | null;
  recipientEmail: string | null;
  subject: string;
  receivedAt: string;
  snippet: string | null;
  bodyText: string;
  classification: EmailClassificationType;
  confidence: number | null;
  classificationReason: string | null;
  processingStatus: EmailProcessingStatus;
  linkedJobId: string | null;
  linkedApplicationId: string | null;
  linkedContactId: string | null;
  linkedJobTitle?: string | null;
  linkedCompanyName?: string | null;
  contentHash: string;
  rawMetadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface EmailReviewItemDto {
  id: string;
  messageId: string;
  messageSubject: string;
  senderEmail: string;
  senderName: string | null;
  receivedAt: string;
  snippet: string | null;
  classification: EmailClassificationType;
  confidence: number;
  proposedAction: EmailProposedAction;
  proposedTargetStatus: ApplicationLifecycleStatus | null;
  proposedApplicationId: string | null;
  proposedJobId: string | null;
  proposedJobTitle?: string | null;
  proposedCompanyName?: string | null;
  currentApplicationStatus?: ApplicationLifecycleStatus | null;
  explanation: string;
  extractedDetails: {
    company?: string;
    role?: string;
    recruiterName?: string;
    recruiterEmail?: string;
    assessmentProvider?: string;
    assessmentUrl?: string;
    dueDate?: string;
    interviewDate?: string;
    interviewTimezone?: string;
    meetingUrl?: string;
    [key: string]: unknown;
  };
  riskLevel: EmailRiskLevel;
  status: EmailReviewStatus;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmailSyncRunDto {
  id: string;
  accountId: string;
  trigger: EmailSyncTrigger;
  status: EmailSyncRunStatus;
  messagesFound: number;
  messagesIngested: number;
  autoSyncedCount: number;
  reviewItemsCreated: number;
  jobsDiscoveredCount: number;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface EmailSyncStatsDto {
  connectedAccountsCount: number;
  totalMessagesIngested: number;
  pendingReviewCount: number;
  autoSyncedUpdatesCount: number;
  jobsDiscoveredCount: number;
  lastSyncAt: string | null;
}

// Request Models
export interface SyncEmailAccountRequest {
  lookbackDays?: number;
  forceFull?: boolean;
}

export interface ResolveReviewItemRequest {
  resolutionNote?: string;
  overrideTargetStatus?: ApplicationLifecycleStatus;
  overrideApplicationId?: string;
}
