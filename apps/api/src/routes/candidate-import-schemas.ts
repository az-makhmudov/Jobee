import { z } from 'zod';
import { ProfileImportSourceTypeEnum, ProfileImportReviewStatusEnum } from '@job-agent/shared';

export const extractProfileImportSchema = z.object({
  aiConsent: z.boolean().default(false),
});

export const updateProfileImportItemSchema = z.object({
  action: z.enum([
    ProfileImportReviewStatusEnum.APPROVED,
    ProfileImportReviewStatusEnum.REJECTED,
    ProfileImportReviewStatusEnum.EDITED,
  ]),
  userEditedPayload: z.record(z.unknown()).optional(),
});

export const bulkUpdateProfileImportItemsSchema = z.object({
  action: z.enum(['APPROVE_ALL_NEW', 'APPROVE_ALL', 'REJECT_ALL']),
});

export const commitProfileImportSchema = z
  .object({
    verifyOnCommit: z.boolean().optional().default(false),
    allowAiOnCommit: z.boolean().optional().default(false),
  })
  .refine((data) => !(data.allowAiOnCommit && !data.verifyOnCommit), {
    message:
      'allowAiUse=true requires verificationStatus=VERIFIED. Facts cannot be authorized for AI use without being verified.',
    path: ['allowAiOnCommit'],
  });

export const uploadProfileImportQuerySchema = z.object({
  sourceType: z
    .enum([
      ProfileImportSourceTypeEnum.CV,
      ProfileImportSourceTypeEnum.LINKEDIN_PDF,
      ProfileImportSourceTypeEnum.LINKEDIN_ARCHIVE,
    ])
    .optional()
    .default(ProfileImportSourceTypeEnum.CV),
  replaceMasterCv: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
});
