import { z } from 'zod';
import { OrchestrationTaskTypes } from '@job-agent/shared';

export const triggerOrchestrationSchema = z.object({
  taskType: z
    .enum([
      OrchestrationTaskTypes.DISCOVERY,
      OrchestrationTaskTypes.MATCHING,
      OrchestrationTaskTypes.PREPARATION,
      OrchestrationTaskTypes.AUTO_APPLY,
      OrchestrationTaskTypes.EMAIL_SYNC,
      OrchestrationTaskTypes.REMINDERS,
      OrchestrationTaskTypes.PIPELINE_CYCLE,
    ])
    .optional()
    .default(OrchestrationTaskTypes.PIPELINE_CYCLE),
  force: z.boolean().optional().default(false),
});

export const listOrchestrationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const orchestrationParamsSchema = z.object({
  id: z.string().uuid('Invalid orchestration run ID format'),
});
