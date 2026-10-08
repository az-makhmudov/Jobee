import { z } from 'zod';
import { EmailClassificationType, EmailProcessingStatus } from '@job-agent/shared';

export const connectUrlSchema = z.object({
  provider: z.enum(['GMAIL', 'FIXTURE']).default('GMAIL'),
});

export const fixtureConnectSchema = z.object({
  emailAddress: z.string().email().optional(),
});

export const syncAccountSchema = z.object({
  lookbackDays: z.number().int().min(1).max(365).optional(),
});

export const listMessagesQuerySchema = z.object({
  accountId: z.string().uuid().optional(),
  classification: z.nativeEnum(EmailClassificationType).optional(),
  processingStatus: z.nativeEnum(EmailProcessingStatus).optional(),
  linkedApplicationId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const resolveReviewItemSchema = z.object({
  resolution: z.enum(['APPROVED', 'DISMISSED', 'REJECTED']),
  resolutionNote: z.string().optional(),
  overrideTargetStatus: z.string().optional(),
  overrideApplicationId: z.string().uuid().optional(),
});
