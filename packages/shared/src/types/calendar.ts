import type { ApplicationInterviewDto } from './application-crm.js';

/**
 * Calendar Integration & Interview Preparation Types (JOB-P4-T02)
 *
 * Provider-neutral calendar types and interview scheduling/preparation DTOs.
 */

// ─── Calendar Account ────────────────────────────────────────────────────

export const CalendarProviderType = {
  GOOGLE: 'GOOGLE',
  FIXTURE: 'FIXTURE',
} as const;
export type CalendarProviderType = (typeof CalendarProviderType)[keyof typeof CalendarProviderType];

export const CalendarAccountStatus = {
  CONNECTED: 'CONNECTED',
  REAUTH_REQUIRED: 'REAUTH_REQUIRED',
  ERROR: 'ERROR',
  DISCONNECTED: 'DISCONNECTED',
} as const;
export type CalendarAccountStatus =
  (typeof CalendarAccountStatus)[keyof typeof CalendarAccountStatus];

export const CalendarScopeLevel = {
  NONE: 'NONE',
  AVAILABILITY: 'AVAILABILITY',
  EVENT_MANAGEMENT: 'EVENT_MANAGEMENT',
} as const;
export type CalendarScopeLevel = (typeof CalendarScopeLevel)[keyof typeof CalendarScopeLevel];

export interface CalendarAccountDto {
  id: string;
  provider: CalendarProviderType;
  emailAddress: string;
  status: CalendarAccountStatus;
  scopeLevel: CalendarScopeLevel;
  selectedCalendarIds: string[];
  defaultCalendarId?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Calendar Info ───────────────────────────────────────────────────────

export interface CalendarInfo {
  id: string;
  summary: string;
  description?: string;
  primary: boolean;
  accessRole: string;
  backgroundColor?: string;
  timeZone?: string;
}

// ─── Availability ────────────────────────────────────────────────────────

export const AvailabilityStatus = {
  AVAILABLE: 'AVAILABLE',
  BUSY: 'BUSY',
  UNKNOWN: 'UNKNOWN',
} as const;
export type AvailabilityStatus = (typeof AvailabilityStatus)[keyof typeof AvailabilityStatus];

export interface BusySlot {
  start: string; // ISO datetime
  end: string; // ISO datetime
  calendarId?: string;
}

export interface AvailabilityResult {
  status: AvailabilityStatus;
  busySlots: BusySlot[];
  queriedCalendars: string[];
  failedCalendars: string[];
  isPartial: boolean; // true if some calendars failed
  timezone: string;
  windowStart: string;
  windowEnd: string;
}

// ─── Calendar Events ─────────────────────────────────────────────────────

export interface CalendarEventDto {
  provider: CalendarProviderType;
  calendarId: string;
  externalEventId: string;
  eventUrl?: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  timezone: string;
  location?: string;
  meetingUrl?: string;
  status: string;
  etag?: string;
  syncedAt: string;
}

export interface CreateCalendarEventRequest {
  calendarId: string;
  summary: string;
  description?: string;
  start: string; // ISO datetime
  end: string; // ISO datetime
  timezone: string;
  location?: string;
  meetingUrl?: string;
  createConference?: boolean;
}

export interface UpdateCalendarEventRequest {
  summary?: string;
  description?: string;
  start?: string;
  end?: string;
  timezone?: string;
  location?: string;
  meetingUrl?: string;
}

// ─── Conflict Detection ──────────────────────────────────────────────────

export const ConflictSeverity = {
  NONE: 'NONE',
  WARNING: 'WARNING',
  CONFLICT: 'CONFLICT',
} as const;
export type ConflictSeverity = (typeof ConflictSeverity)[keyof typeof ConflictSeverity];

export interface ConflictResult {
  hasConflict: boolean;
  severity: ConflictSeverity;
  conflicts: ConflictItem[];
  warnings: string[];
  availableAlternatives?: AlternativeSlot[];
}

export interface ConflictItem {
  type: 'CALENDAR_EVENT' | 'TRACKED_INTERVIEW' | 'PREP_BUFFER' | 'TRAVEL_BUFFER';
  description: string;
  conflictStart: string;
  conflictEnd: string;
}

export interface AlternativeSlot {
  start: string;
  end: string;
}

export interface SchedulingPreferences {
  prepBufferMinutes: number;
  recoveryBufferMinutes: number;
  travelBufferMinutes: number; // for onsite
}

// ─── Interview Scheduling ────────────────────────────────────────────────

export const InterviewSchedulingStatus = {
  PROPOSED: 'PROPOSED',
  NEEDS_CONFIRMATION: 'NEEDS_CONFIRMATION',
  CONFIRMED: 'CONFIRMED',
  RESCHEDULED: 'RESCHEDULED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
} as const;
export type InterviewSchedulingStatus =
  (typeof InterviewSchedulingStatus)[keyof typeof InterviewSchedulingStatus];

export interface InterviewCalendarLinkDto {
  id: string;
  interviewId: string;
  calendarAccountId: string;
  calendarId: string;
  externalEventId: string;
  eventUrl?: string | null;
  etag?: string | null;
  lastSyncedAt: string;
  createdAt: string;
}

// ─── Interview Preparation ───────────────────────────────────────────────

export const PreparationGenerationMode = {
  DETERMINISTIC: 'DETERMINISTIC',
  AI_ENHANCED: 'AI_ENHANCED',
} as const;
export type PreparationGenerationMode =
  (typeof PreparationGenerationMode)[keyof typeof PreparationGenerationMode];

export const PreparationStalenessReason = {
  CANDIDATE_UPDATED: 'CANDIDATE_UPDATED',
  JOB_UPDATED: 'JOB_UPDATED',
  MATCH_UPDATED: 'MATCH_UPDATED',
  INTERVIEW_UPDATED: 'INTERVIEW_UPDATED',
  MANUAL_REGENERATION: 'MANUAL_REGENERATION',
} as const;
export type PreparationStalenessReason =
  (typeof PreparationStalenessReason)[keyof typeof PreparationStalenessReason];

export interface PreparationBriefDto {
  id: string;
  interviewId: string;
  applicationId: string;
  version: number;
  generationMode: PreparationGenerationMode;
  isStale: boolean;
  stalenessReason?: PreparationStalenessReason | null;

  roleSummary: string;
  companyContext: string;
  keyRequirements: string[];
  candidateStrengths: PreparationEvidenceRef[];
  candidateGaps: string[];
  likelyQuestions: PreparationQuestion[];
  suggestedAnswerFrameworks: StarFramework[];
  questionsToAsk: string[];
  preparationChecklist: ChecklistItem[];

  humanNotes?: string | null;
  sourceFingerprint: string;
  aiModelUsed?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PreparationEvidenceRef {
  evidenceType: string; // e.g. 'experience', 'skill', 'project'
  evidenceId: string;
  evidenceTitle: string;
  relevantRequirement: string;
  recommendation: string;
}

export interface PreparationQuestion {
  category: string; // e.g. 'technical', 'behavioral', 'role-specific', 'company'
  question: string;
  relevance: string;
}

export interface StarFramework {
  question: string;
  situation?: string | null; // null = needs candidate detail
  task?: string | null;
  action?: string | null;
  result?: string | null;
  sourceEvidenceId?: string | null;
  missingFields: string[];
}

export interface ChecklistItem {
  id: string;
  label: string;
  isCompleted: boolean;
  notes?: string | null;
  order: number;
}

// ─── Debrief ─────────────────────────────────────────────────────────────

export interface InterviewDebriefDto {
  questionsAsked?: string | null;
  topicsDiscussed?: string | null;
  candidateObservations?: string | null;
  followUpCommitments?: string | null;
  concerns?: string | null;
  expectedNextStep?: string | null;
  expectedResponseDate?: string | null;
  privateNotes?: string | null;
}

// ─── Dashboard Metrics ───────────────────────────────────────────────────

export interface InterviewDashboardMetrics {
  upcomingInterviews: number;
  interviewsThisWeek: number;
  preparationNeeded: number;
  schedulingConflicts: number;
  pendingConfirmations: number;
  overdueFollowUps: number;
  interviewsCompleted: number;
  calendarConnected: boolean;
}

// ─── Request Types ───────────────────────────────────────────────────────

export interface CreateInterviewSchedulingRequest {
  applicationId: string;
  roundTitle: string;
  interviewType: string;
  scheduledAt: string;
  durationMinutes?: number;
  timezone: string;
  locationOrUrl?: string;
  meetingUrl?: string;
  interviewerName?: string;
  contactId?: string;
  notes?: string;
  sourceEmailMessageId?: string;
}

export interface RescheduleInterviewRequest {
  newScheduledAt: string;
  newTimezone?: string;
  newDurationMinutes?: number;
  newLocationOrUrl?: string;
  reason: string;
}

export interface AvailabilityQueryRequest {
  windowStart: string; // ISO datetime
  windowEnd: string; // ISO datetime
  timezone: string;
  calendarIds?: string[];
}

export interface CreateCalendarEventForInterviewRequest {
  calendarId: string;
  timezone: string;
  includePreparationNotes?: boolean;
}

export interface CalendarAccountSelectionRequest {
  selectedCalendarIds: string[];
  defaultCalendarId?: string;
}

export interface GeneratePreparationRequest {
  interviewType?: string;
  forceRegenerate?: boolean;
}

export interface UpdateInterviewDebriefRequest {
  questionsAsked?: string;
  topicsDiscussed?: string;
  candidateObservations?: string;
  followUpCommitments?: string;
  concerns?: string;
  expectedNextStep?: string;
  expectedResponseDate?: string | null;
  privateNotes?: string;
}

export interface UpdatePreparationBriefNotesRequest {
  humanNotes: string;
}

export interface ScheduledInterviewWorkspaceItemDto {
  interview: ApplicationInterviewDto & {
    schedulingStatus: string;
    meetingUrl?: string | null;
    debriefQuestionsAsked?: string | null;
    debriefTopicsDiscussed?: string | null;
    debriefObservations?: string | null;
    debriefFollowUpCommitments?: string | null;
    debriefConcerns?: string | null;
    debriefExpectedNextStep?: string | null;
    debriefExpectedResponseDate?: string | null;
    debriefPrivateNotes?: string | null;
  };
  application: {
    id: string;
    companyName: string;
    jobTitle: string;
    jobId: string;
  };
  calendarLink: InterviewCalendarLinkDto | null;
  preparationBrief: {
    id: string;
    isStale: boolean;
    createdAt: string;
    checklistProgress: {
      total: number;
      completed: number;
    };
  } | null;
}
