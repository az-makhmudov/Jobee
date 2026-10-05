import type {
  JobProvider,
  WorkplaceType,
  EmploymentType,
  SeniorityLevel,
  PayPeriod,
  RequirementCategory,
  RequirementStrength,
  SectionType,
} from '@job-agent/shared';

export interface RawExtractedRequirement {
  rawText: string;
  category?: RequirementCategory;
  strength?: RequirementStrength;
  sourceSection?: string;
}

export interface RawExtractedSection {
  type: SectionType;
  title: string;
  content: string;
}

export interface RawExtractedJob {
  provider: JobProvider;
  externalId?: string;
  sourceCompanyId?: string;
  title?: string;
  company?: string;
  location?: string;
  descriptionText: string;
  descriptionHtml?: string;
  workplaceType?: WorkplaceType;
  employmentType?: EmploymentType;
  seniority?: SeniorityLevel;
  department?: string;
  minSalary?: number;
  maxSalary?: number;
  currency?: string;
  payPeriod?: PayPeriod;
  compensationRaw?: string;
  postedDate?: Date;
  expirationDate?: Date;
  canonicalUrl?: string;
  applicationUrl?: string;
  sections?: RawExtractedSection[];
  requirements?: RawExtractedRequirement[];
  rawMetadata?: Record<string, unknown>;
  warnings?: string[];
  needsManualText?: boolean;
}

export interface JobExtractor {
  canHandle(url: string | null, htmlOrText: string): boolean;
  extract(url: string | null, content: string): Promise<RawExtractedJob> | RawExtractedJob;
}
