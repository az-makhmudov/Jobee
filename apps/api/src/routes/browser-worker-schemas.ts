import { z } from 'zod';
import { BrowserRunMode } from '@job-agent/shared';

export const startBrowserRunSchema = z.object({
  targetUrl: z.string().url().optional(),
  mode: z
    .enum([BrowserRunMode.DRY_RUN, BrowserRunMode.PREFILL_ONLY, BrowserRunMode.SUBMIT])
    .optional()
    .default(BrowserRunMode.DRY_RUN),
  packageVersionId: z.string().uuid().optional(),
  headless: z.boolean().optional().default(true),
  userConfirmed: z.boolean().optional(),
  submissionToken: z.string().optional(),
});

export const applicationRunParamsSchema = z.object({
  id: z.string().uuid('Invalid application ID format'),
});

export const browserRunParamsSchema = z.object({
  runId: z.string().uuid('Invalid run ID format'),
});
