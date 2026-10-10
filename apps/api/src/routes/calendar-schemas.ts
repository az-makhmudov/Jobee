import { z } from 'zod';

export const googleAuthUrlSchema = z.object({
  scopeLevel: z.enum(['AVAILABILITY', 'EVENT_MANAGEMENT']).optional().default('EVENT_MANAGEMENT'),
});

export const googleCallbackSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().min(1, 'OAuth state is required'),
});

export const fixtureConnectSchema = z
  .object({
    emailAddress: z.string().email().optional(),
    defaultTimezone: z.string().optional(),
  })
  .optional();

export const calendarSelectionSchema = z.object({
  selectedCalendarIds: z.array(z.string()),
  defaultCalendarId: z.string().optional(),
});

export const availabilityQuerySchema = z.object({
  windowStart: z.string().datetime(),
  windowEnd: z.string().datetime(),
  timezone: z.string().default('UTC'),
  calendarIds: z.array(z.string()).optional(),
});

export const checkConflictSchema = z.object({
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().positive().default(60),
  timezone: z.string().default('UTC'),
  excludeInterviewId: z.string().uuid().optional(),
});

export const createCalendarEventSchema = z.object({
  calendarId: z.string().min(1, 'Calendar ID is required'),
  timezone: z.string().default('UTC'),
  includePreparationNotes: z.boolean().default(true),
});

export const generatePreparationSchema = z
  .object({
    forceRegenerate: z.boolean().default(false),
  })
  .optional();

export const updateHumanNotesSchema = z.object({
  humanNotes: z.string(),
});

export const updateChecklistSchema = z.object({
  checklist: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      isCompleted: z.boolean(),
      notes: z.string().nullable().optional(),
      order: z.number(),
    }),
  ),
});

export const updateDebriefSchema = z.object({
  questionsAsked: z.string().optional(),
  topicsDiscussed: z.string().optional(),
  candidateObservations: z.string().optional(),
  followUpCommitments: z.string().optional(),
  concerns: z.string().optional(),
  expectedNextStep: z.string().optional(),
  expectedResponseDate: z.string().datetime().nullable().optional(),
  privateNotes: z.string().optional(),
});
