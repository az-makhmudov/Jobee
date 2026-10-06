import { z } from 'zod';

export const createPackageSchema = z.object({
  manualBaseDocumentId: z.string().uuid().optional().nullable(),
});

export const regeneratePackageSchema = z.object({
  manualBaseDocumentId: z.string().uuid().optional().nullable(),
});

export const updateCvSchema = z.object({
  summary: z.string().min(1, 'Professional summary cannot be empty'),
});

export const updateCoverLetterSchema = z.object({
  content: z.string().min(1, 'Cover letter content cannot be empty'),
});

export const addQuestionSchema = z.object({
  questionText: z.string().min(3, 'Question text must be at least 3 characters'),
  category: z
    .enum([
      'WORK_AUTHORIZATION',
      'SPONSORSHIP',
      'RELOCATION',
      'SALARY',
      'AVAILABILITY',
      'EXPERIENCE_YEARS',
      'LANGUAGE',
      'PORTFOLIO',
      'TRAVEL',
      'MOTIVATION',
      'GENERAL',
    ])
    .default('GENERAL'),
  questionType: z.enum([
    'TEXT',
    'TEXTAREA',
    'BOOLEAN',
    'SINGLE_SELECT',
    'MULTI_SELECT',
    'NUMBER',
    'DATE',
  ]),
  options: z.array(z.string()).default([]),
  isRequired: z.boolean().default(true),
  sensitivity: z.enum(['STANDARD', 'SENSITIVE']).default('STANDARD'),
});

export const answerQuestionSchema = z.object({
  answerText: z.string().min(1, 'Answer text cannot be empty'),
});

export const approveRequestSchema = z.object({
  userEditedValue: z.string().optional(),
});

export const overrideBlockerSchema = z.object({
  reason: z.string().min(5, 'A meaningful justification of at least 5 characters is required'),
});
