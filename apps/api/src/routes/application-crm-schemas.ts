import { z } from 'zod';
import {
  ApplicationLifecycleStatus,
  SubmissionMethod,
  NextActionType,
  AssessmentType,
  AssessmentStatus,
  InterviewType,
  InterviewStatus,
  OfferStatus,
} from '@job-agent/shared';

export const createApplicationSchema = z.object({
  jobId: z.string().uuid(),
  packageId: z.string().uuid().optional(),
  status: z.nativeEnum(ApplicationLifecycleStatus).optional(),
  source: z.string().optional(),
  applicationUrl: z.string().url().or(z.string().length(0)).optional(),
  submissionMethod: z.string().optional(),
  externalReferenceId: z.string().optional(),
  appliedAt: z.string().datetime().optional(),
  notes: z.string().optional(),
  nextAction: z.string().optional(),
  nextActionType: z.string().optional(),
  followUpAt: z.string().datetime().optional(),
});

export const markAppliedSchema = z.object({
  appliedAt: z.string().datetime().optional(),
  packageVersionId: z.string().uuid().optional(),
  cvArtifactId: z.string().uuid().optional(),
  coverLetterArtifactId: z.string().uuid().optional(),
  submissionMethod: z.nativeEnum(SubmissionMethod).or(z.string()).optional(),
  externalReferenceId: z.string().optional(),
  applicationUrl: z.string().url().or(z.string().length(0)).optional(),
  notes: z.string().optional(),
});

export const transitionStatusSchema = z.object({
  targetStatus: z.nativeEnum(ApplicationLifecycleStatus),
  reason: z.string().optional(),
  actor: z.string().optional(),
  note: z.string().optional(),
  isCorrection: z.boolean().optional(),
  correctionReason: z.string().optional(),
});

export const updateNextActionSchema = z.object({
  nextAction: z.string().nullable().optional(),
  nextActionType: z.nativeEnum(NextActionType).or(z.string()).nullable().optional(),
  followUpAt: z.string().datetime().nullable().optional(),
});

export const addNoteSchema = z.object({
  content: z.string().min(1, 'Note content cannot be empty'),
  author: z.string().optional(),
});

export const createContactSchema = z.object({
  name: z.string().min(1, 'Contact name is required'),
  email: z.string().email().or(z.string().length(0)).optional(),
  phone: z.string().optional(),
  title: z.string().optional(),
  company: z.string().optional(),
  linkedinUrl: z.string().url().or(z.string().length(0)).optional(),
  isPrimary: z.boolean().optional(),
  notes: z.string().optional(),
});

export const updateContactSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().or(z.string().length(0)).nullable().optional(),
  phone: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  linkedinUrl: z.string().url().or(z.string().length(0)).nullable().optional(),
  isPrimary: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

export const createAssessmentSchema = z.object({
  title: z.string().min(1, 'Assessment title is required'),
  assessmentType: z.nativeEnum(AssessmentType).or(z.string()),
  provider: z.string().optional(),
  status: z.nativeEnum(AssessmentStatus).or(z.string()).optional(),
  receivedAt: z.string().datetime().optional(),
  dueAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  url: z.string().url().or(z.string().length(0)).optional(),
  score: z.string().optional(),
  notes: z.string().optional(),
});

export const updateAssessmentSchema = z.object({
  title: z.string().min(1).optional(),
  assessmentType: z.nativeEnum(AssessmentType).or(z.string()).optional(),
  provider: z.string().nullable().optional(),
  status: z.nativeEnum(AssessmentStatus).or(z.string()).optional(),
  receivedAt: z.string().datetime().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
  url: z.string().url().or(z.string().length(0)).nullable().optional(),
  score: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const createInterviewSchema = z.object({
  roundTitle: z.string().min(1, 'Round title is required'),
  interviewType: z.nativeEnum(InterviewType).or(z.string()),
  status: z.nativeEnum(InterviewStatus).or(z.string()).optional(),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().positive().optional(),
  timezone: z.string().optional(),
  locationOrUrl: z.string().optional(),
  interviewerName: z.string().optional(),
  contactId: z.string().uuid().optional(),
  notes: z.string().optional(),
  feedback: z.string().optional(),
});

export const updateInterviewSchema = z.object({
  roundTitle: z.string().min(1).optional(),
  interviewType: z.nativeEnum(InterviewType).or(z.string()).optional(),
  status: z.nativeEnum(InterviewStatus).or(z.string()).optional(),
  scheduledAt: z.string().datetime().optional(),
  durationMinutes: z.number().int().positive().nullable().optional(),
  timezone: z.string().nullable().optional(),
  locationOrUrl: z.string().nullable().optional(),
  interviewerName: z.string().nullable().optional(),
  contactId: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  feedback: z.string().nullable().optional(),
});

export const updateOfferSchema = z.object({
  baseSalary: z.number().int().nullable().optional(),
  totalComp: z.number().int().nullable().optional(),
  currency: z.string().default('USD').optional(),
  employmentType: z.string().nullable().optional(),
  proposedStartDate: z.string().nullable().optional(),
  deadlineAt: z.string().datetime().nullable().optional(),
  status: z.nativeEnum(OfferStatus).or(z.string()).optional(),
  notes: z.string().nullable().optional(),
});

export const listApplicationsQuerySchema = z.object({
  status: z.nativeEnum(ApplicationLifecycleStatus).or(z.string()).optional(),
  search: z.string().optional(),
  company: z.string().optional(),
  source: z.string().optional(),
  isArchived: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  hasFollowUp: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50).optional(),
  offset: z.coerce.number().int().min(0).default(0).optional(),
  sortBy: z
    .enum(['lastActivity', 'appliedAt', 'createdAt', 'followUpAt', 'company', 'title'])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc').optional(),
});
