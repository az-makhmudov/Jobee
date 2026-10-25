import { z } from 'zod';
const timezone = z.string().refine((value) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, 'Choose a valid IANA timezone');

export const googleAuthUrlSchema = z.object({
  scopeLevel: z.enum(['AVAILABILITY', 'EVENT_MANAGEMENT']).optional().default('AVAILABILITY'),
});

export const googleCallbackSchema = z
  .object({
    code: z.string().min(1, 'Authorization code is required').optional(),
    error: z.string().optional(),
    state: z.string().min(1, 'OAuth state is required'),
  })
  .refine(
    (value) => Boolean(value.code) !== Boolean(value.error),
    'Expected an authorization code or refusal',
  );

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

export const availabilityQuerySchema = z
  .object({
    windowStart: z.string().datetime(),
    windowEnd: z.string().datetime(),
    timezone: timezone.default('UTC'),
    calendarIds: z.array(z.string()).max(20).optional(),
  })
  .refine(
    (value) =>
      Date.parse(value.windowEnd) > Date.parse(value.windowStart) &&
      Date.parse(value.windowEnd) - Date.parse(value.windowStart) <= 31 * 86400_000,
    'Choose a positive availability window of at most 31 days',
  );

export const checkConflictSchema = z.object({
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().positive().default(60),
  timezone: timezone.default('UTC'),
  excludeInterviewId: z.string().uuid().optional(),
});

export const createCalendarEventSchema = z.object({
  userConfirmed: z.literal(true),
  createConference: z.boolean().default(false),
  calendarId: z.string().min(1, 'Calendar ID is required'),
  timezone: timezone.default('UTC'),
  includePreparationNotes: z.boolean().default(false),
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
