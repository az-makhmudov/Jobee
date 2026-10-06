import { z } from 'zod';

export const ingestTextSchema = z.object({
  text: z.string().min(20, 'Job description must be at least 20 characters'),
  title: z.string().trim().optional(),
  company: z.string().trim().optional(),
  url: z.string().url('Invalid URL format').optional().or(z.literal('')),
});

export const ingestUrlSchema = z.object({
  url: z.string().url('A valid HTTP or HTTPS URL must be provided'),
});

export const updateJobSchema = z.object({
  title: z.string().trim().min(1, 'Title cannot be empty').optional(),
  company: z.string().trim().min(1, 'Company cannot be empty').optional(),
  companyUrl: z.string().url().nullable().optional().or(z.literal('')),
  locationText: z.string().trim().nullable().optional(),
  city: z.string().trim().nullable().optional(),
  region: z.string().trim().nullable().optional(),
  country: z.string().trim().nullable().optional(),
  workplaceType: z.enum(['REMOTE', 'HYBRID', 'ONSITE', 'UNKNOWN']).optional(),
  employmentType: z
    .enum([
      'FULL_TIME',
      'PART_TIME',
      'CONTRACT',
      'INTERNSHIP',
      'TEMPORARY',
      'APPRENTICESHIP',
      'VOLUNTEER',
      'OTHER',
      'UNKNOWN',
    ])
    .optional(),
  seniority: z
    .enum([
      'INTERNSHIP',
      'ENTRY',
      'JUNIOR',
      'MID',
      'SENIOR',
      'LEAD',
      'MANAGER',
      'DIRECTOR',
      'EXECUTIVE',
      'UNKNOWN',
    ])
    .optional(),
  department: z.string().trim().nullable().optional(),
  minSalary: z.number().int().positive().nullable().optional(),
  maxSalary: z.number().int().positive().nullable().optional(),
  currency: z.string().trim().max(10).nullable().optional(),
  payPeriod: z.enum(['YEAR', 'MONTH', 'HOUR', 'WEEK', 'DAY', 'UNKNOWN']).nullable().optional(),
  applicationUrl: z.string().url().nullable().optional().or(z.literal('')),
  description: z.string().min(10, 'Description must be at least 10 characters').optional(),
});

export const jobListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  state: z.enum(['NEW', 'INGESTED', 'NEEDS_REVIEW', 'INVALID', 'DUPLICATE', 'ARCHIVED']).optional(),
  provider: z.enum(['GREENHOUSE', 'LEVER', 'ASHBY', 'LINKEDIN', 'GENERIC', 'MANUAL']).optional(),
  workplaceType: z.enum(['REMOTE', 'HYBRID', 'ONSITE', 'UNKNOWN']).optional(),
  employmentType: z
    .enum([
      'FULL_TIME',
      'PART_TIME',
      'CONTRACT',
      'INTERNSHIP',
      'TEMPORARY',
      'APPRENTICESHIP',
      'VOLUNTEER',
      'OTHER',
      'UNKNOWN',
    ])
    .optional(),
  company: z.string().trim().optional(),
  search: z.string().trim().optional(),
  includeArchived: z.coerce.boolean().optional().default(false),
  decision: z.enum(['MATCH', 'REVIEW', 'SKIP', 'UNANALYZED']).optional(),
  minScore: z.coerce.number().int().min(0).max(100).optional(),
  maxScore: z.coerce.number().int().min(0).max(100).optional(),
  minConfidence: z.coerce.number().int().min(0).max(100).optional(),
  isStale: z.coerce.boolean().optional(),
  sortBy: z
    .enum(['discoveredDate', 'score', 'confidence', 'title', 'company'])
    .optional()
    .default('discoveredDate'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const analyzeJobSchema = z.object({
  force: z.boolean().optional().default(false),
});

export const batchAnalyzeSchema = z.object({
  jobIds: z.array(z.string().uuid()).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
  force: z.boolean().optional().default(false),
  unanalyzedOnly: z.boolean().optional().default(false),
});
