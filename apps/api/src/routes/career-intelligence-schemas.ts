import { z } from 'zod';
import { CandidateJobFeedbackTypes } from '@job-agent/shared';

export const clarifyIntelligenceSchema = z.object({
  field: z.string().min(1),
  value: z.unknown(),
});

export const runEnrichmentSchema = z.object({
  documentId: z.string().uuid().optional(),
});

export const jobFeedbackSchema = z.object({
  feedbackType: z.enum([
    CandidateJobFeedbackTypes.INTERESTED,
    CandidateJobFeedbackTypes.NOT_INTERESTED,
    CandidateJobFeedbackTypes.IRRELEVANT,
    CandidateJobFeedbackTypes.ALREADY_APPLIED,
    CandidateJobFeedbackTypes.TOO_SENIOR,
    CandidateJobFeedbackTypes.WRONG_LOCATION,
    CandidateJobFeedbackTypes.WRONG_INDUSTRY,
  ]),
  notes: z.string().max(1000).optional().nullable(),
});

export const updateLearnedPreferencesSchema = z.object({
  downvotedIndustries: z.array(z.string()).optional(),
  downvotedLocations: z.array(z.string()).optional(),
  downvotedCompanies: z.array(z.string()).optional(),
  tooSeniorCount: z.number().int().min(0).optional(),
  tooJuniorCount: z.number().int().min(0).optional(),
});
