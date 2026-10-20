import { z } from 'zod';
import { VerificationStatuses, AutomationLevelEnum } from '@job-agent/shared';

export const upsertProfileSchema = z.object({
  preferredName: z.string().max(100).optional().nullable(),
  fullName: z.string().max(200).optional().nullable(),
  headline: z.string().max(300).optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  region: z.string().max(100).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  summary: z.string().max(5000).optional().nullable(),
  availability: z.string().max(200).optional().nullable(),
});

export const createExperienceSchema = z.object({
  organization: z.string().min(1).max(200),
  position: z.string().min(1).max(200),
  location: z.string().max(200).optional().nullable(),
  employmentType: z.string().max(100).optional().nullable(),
  startDate: z.string().min(1).max(50),
  endDate: z.string().max(50).optional().nullable(),
  isCurrent: z.boolean().optional(),
  description: z.string().max(5000).optional().nullable(),
  achievements: z.array(z.string().max(1000)).optional(),
  displayOrder: z.number().int().optional(),
  verificationStatus: z
    .enum([
      VerificationStatuses.UNVERIFIED,
      VerificationStatuses.VERIFIED,
      VerificationStatuses.REJECTED,
    ])
    .optional(),
});

export const updateExperienceSchema = createExperienceSchema.partial();

export const createEducationSchema = z.object({
  institution: z.string().min(1).max(200),
  degree: z.string().max(200).optional().nullable(),
  fieldOfStudy: z.string().max(200).optional().nullable(),
  startDate: z.string().max(50).optional().nullable(),
  endDate: z.string().max(50).optional().nullable(),
  isCurrent: z.boolean().optional(),
  location: z.string().max(200).optional().nullable(),
  description: z.string().max(3000).optional().nullable(),
  activities: z.string().max(2000).optional().nullable(),
  displayOrder: z.number().int().optional(),
  verificationStatus: z
    .enum([
      VerificationStatuses.UNVERIFIED,
      VerificationStatuses.VERIFIED,
      VerificationStatuses.REJECTED,
    ])
    .optional(),
});

export const updateEducationSchema = createEducationSchema.partial();

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  role: z.string().max(200).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  startDate: z.string().max(50).optional().nullable(),
  endDate: z.string().max(50).optional().nullable(),
  projectUrl: z.string().url().max(500).optional().nullable(),
  skills: z.array(z.string().max(100)).optional(),
  achievements: z.array(z.string().max(1000)).optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
  verificationStatus: z
    .enum([
      VerificationStatuses.UNVERIFIED,
      VerificationStatuses.VERIFIED,
      VerificationStatuses.REJECTED,
    ])
    .optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

export const createSkillSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.string().max(100).optional().nullable(),
  proficiency: z.string().max(50).optional().nullable(),
  yearsExperience: z.number().int().min(0).max(50).optional().nullable(),
  isActive: z.boolean().optional(),
  verificationStatus: z
    .enum([
      VerificationStatuses.UNVERIFIED,
      VerificationStatuses.VERIFIED,
      VerificationStatuses.REJECTED,
    ])
    .optional(),
});

export const updateSkillSchema = createSkillSchema.partial();

export const createLanguageSchema = z.object({
  language: z.string().min(1).max(100),
  proficiency: z.string().max(50).optional().nullable(),
  cefrLevel: z.string().max(10).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  verificationStatus: z
    .enum([
      VerificationStatuses.UNVERIFIED,
      VerificationStatuses.VERIFIED,
      VerificationStatuses.REJECTED,
    ])
    .optional(),
});

export const updateLanguageSchema = createLanguageSchema.partial();

export const createCertificationSchema = z.object({
  name: z.string().min(1).max(200),
  issuingOrganization: z.string().min(1).max(200),
  issueDate: z.string().max(50).optional().nullable(),
  expirationDate: z.string().max(50).optional().nullable(),
  credentialId: z.string().max(200).optional().nullable(),
  credentialUrl: z.string().url().max(500).optional().nullable(),
  verificationStatus: z
    .enum([
      VerificationStatuses.UNVERIFIED,
      VerificationStatuses.VERIFIED,
      VerificationStatuses.REJECTED,
    ])
    .optional(),
});

export const updateCertificationSchema = createCertificationSchema.partial();

export const createLinkSchema = z.object({
  label: z.string().min(1).max(100),
  url: z.string().url().max(500),
  displayOrder: z.number().int().optional(),
});

export const updateLinkSchema = createLinkSchema.partial();

export const createFactSchema = z.object({
  category: z.string().min(1).max(100),
  factKey: z.string().min(1).max(100),
  statement: z.string().min(1).max(1000),
  structuredValue: z.unknown().optional(),
  sourceType: z.string().max(50).optional(),
  sourceEntityId: z.string().max(100).optional().nullable(),
  verificationStatus: z
    .enum([
      VerificationStatuses.UNVERIFIED,
      VerificationStatuses.VERIFIED,
      VerificationStatuses.REJECTED,
    ])
    .optional(),
  allowAiUse: z.boolean().optional(),
});

export const updateFactSchema = createFactSchema.partial();

export const createAnswerSchema = z
  .object({
    question: z.string().min(1).max(500),
    category: z.string().min(1).max(100).optional(),
    answer: z.string().min(1).max(5000),
    notes: z.string().max(1000).optional().nullable(),
    automationLevel: z
      .enum([AutomationLevelEnum.AUTO, AutomationLevelEnum.REVIEW, AutomationLevelEnum.MANUAL])
      .optional(),
    verificationStatus: z
      .enum([
        VerificationStatuses.UNVERIFIED,
        VerificationStatuses.VERIFIED,
        VerificationStatuses.REJECTED,
      ])
      .optional(),
    isSensitive: z.boolean().optional(),
    conditions: z.unknown().optional(),
  })
  .refine(
    (data) => {
      if (
        data.isSensitive &&
        data.automationLevel === AutomationLevelEnum.AUTO &&
        data.verificationStatus !== VerificationStatuses.VERIFIED
      ) {
        return false;
      }
      return true;
    },
    {
      message: 'Sensitive answers cannot have AUTO automation level unless explicitly VERIFIED',
      path: ['automationLevel'],
    },
  );

export const updateAnswerSchema = z
  .object({
    question: z.string().min(1).max(500).optional(),
    category: z.string().min(1).max(100).optional(),
    answer: z.string().min(1).max(5000).optional(),
    notes: z.string().max(1000).optional().nullable(),
    automationLevel: z
      .enum([AutomationLevelEnum.AUTO, AutomationLevelEnum.REVIEW, AutomationLevelEnum.MANUAL])
      .optional(),
    verificationStatus: z
      .enum([
        VerificationStatuses.UNVERIFIED,
        VerificationStatuses.VERIFIED,
        VerificationStatuses.REJECTED,
      ])
      .optional(),
    isSensitive: z.boolean().optional(),
    conditions: z.unknown().optional(),
  })
  .refine(
    (data) => {
      if (
        data.isSensitive &&
        data.automationLevel === AutomationLevelEnum.AUTO &&
        data.verificationStatus !== VerificationStatuses.VERIFIED
      ) {
        return false;
      }
      return true;
    },
    {
      message: 'Sensitive answers cannot have AUTO automation level unless explicitly VERIFIED',
      path: ['automationLevel'],
    },
  );

export const upsertPreferencesSchema = z.object({
  targetTitles: z.array(z.string().max(100)).optional(),
  targetCategories: z.array(z.string().max(100)).optional(),
  preferredLocations: z.array(z.string().max(100)).optional(),
  workModes: z.array(z.string().max(50)).optional(),
  employmentTypes: z.array(z.string().max(50)).optional(),
  seniorityLevels: z.array(z.string().max(50)).optional(),
  minSalary: z.number().int().positive().optional().nullable(),
  maxSalary: z.number().int().positive().optional().nullable(),
  currency: z.string().max(10).optional(),
  preferredLanguages: z.array(z.string().max(50)).optional(),
  excludedCompanies: z.array(z.string().max(200)).optional(),
  excludedKeywords: z.array(z.string().max(100)).optional(),
  acceptUnpaid: z.boolean().optional(),
  willingToRelocate: z.boolean().optional().nullable(),
  needsSponsorship: z.boolean().optional().nullable(),
  workAuthorizationCountries: z.array(z.string().trim().min(1).max(100)).max(100).optional(),
  internshipEligible: z.boolean().optional().nullable(),
  availability: z.string().trim().max(200).optional().nullable(),
  customPreferences: z.unknown().optional(),
});

export const updatePolicySchema = z.object({
  autoApplyEnabled: z.boolean().optional(),
  minScoreForReview: z.number().int().min(0).max(100).optional(),
  autoApplyMinScore: z.number().int().min(0).max(100).optional(),
  maxApplicationsPerDay: z.number().int().min(1).max(100).optional(),
  blockOnUnresolvedReview: z.boolean().optional(),
  blockOnManual: z.boolean().optional(),
  blockOnUnknownSensitive: z.boolean().optional(),
});
