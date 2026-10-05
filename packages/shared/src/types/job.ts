export type JobState = 'NEW' | 'INGESTED' | 'NEEDS_REVIEW' | 'INVALID' | 'DUPLICATE' | 'ARCHIVED';

export type JobProvider = 'GREENHOUSE' | 'LEVER' | 'ASHBY' | 'LINKEDIN' | 'GENERIC' | 'MANUAL';

export type WorkplaceType = 'REMOTE' | 'HYBRID' | 'ONSITE' | 'UNKNOWN';

export type EmploymentType =
  | 'FULL_TIME'
  | 'PART_TIME'
  | 'CONTRACT'
  | 'INTERNSHIP'
  | 'TEMPORARY'
  | 'APPRENTICESHIP'
  | 'VOLUNTEER'
  | 'OTHER'
  | 'UNKNOWN';

export type SeniorityLevel =
  | 'INTERNSHIP'
  | 'ENTRY'
  | 'JUNIOR'
  | 'MID'
  | 'SENIOR'
  | 'LEAD'
  | 'MANAGER'
  | 'DIRECTOR'
  | 'EXECUTIVE'
  | 'UNKNOWN';

export type PayPeriod = 'YEAR' | 'MONTH' | 'HOUR' | 'WEEK' | 'DAY' | 'UNKNOWN';

export type IngestionMethod = 'PASTE_TEXT' | 'URL_IMPORT' | 'API';

export type IngestionStatus =
  | 'PENDING'
  | 'FETCHING'
  | 'EXTRACTING'
  | 'NORMALIZING'
  | 'COMPLETED'
  | 'NEEDS_REVIEW'
  | 'FAILED'
  | 'DUPLICATE'
  | 'NEEDS_MANUAL_TEXT';

export type RequirementCategory =
  | 'EXPERIENCE'
  | 'SKILL'
  | 'EDUCATION'
  | 'LANGUAGE'
  | 'LOCATION'
  | 'WORK_AUTHORIZATION'
  | 'CERTIFICATION'
  | 'RESPONSIBILITY'
  | 'OTHER';

export type RequirementStrength = 'MANDATORY' | 'PREFERRED' | 'UNKNOWN';

export type SectionType =
  | 'RESPONSIBILITIES'
  | 'QUALIFICATIONS'
  | 'PREFERRED_QUALIFICATIONS'
  | 'BENEFITS'
  | 'ABOUT_COMPANY'
  | 'OTHER';

export type JobEventType =
  | 'JOB_INGESTED'
  | 'JOB_NORMALIZED'
  | 'JOB_DUPLICATE_DETECTED'
  | 'JOB_UPDATED'
  | 'JOB_ARCHIVED'
  | 'INGESTION_FAILED';

export interface JobRequirementDto {
  id: string;
  jobId: string;
  sourceId?: string | null;
  sourceSection?: string | null;
  rawText: string;
  normalizedText: string | null;
  category: RequirementCategory;
  requirementStrength: RequirementStrength;
  displayOrder: number;
  createdAt: string;
}

export interface JobSectionDto {
  id: string;
  jobId: string;
  sectionType: SectionType;
  title: string;
  content: string;
  displayOrder: number;
  createdAt: string;
}

export interface JobSourceDto {
  id: string;
  jobId: string;
  provider: JobProvider;
  ingestionMethod: IngestionMethod;
  sourceUrl: string | null;
  canonicalUrl: string | null;
  externalJobId: string | null;
  rawTitle: string | null;
  rawCompany: string | null;
  rawLocation: string | null;
  rawDescription: string;
  rawMetadata: Record<string, unknown> | null;
  rawPayload: string | null;
  contentHash: string;
  ingestionStatus: IngestionStatus;
  parserVersion: string;
  errorMessage: string | null;
  retrievedAt: string;
  createdAt: string;
}

export interface JobEventDto {
  id: string;
  jobId: string;
  userId: string;
  eventType: JobEventType;
  changedFields: string[];
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface JobDto {
  id: string;
  userId: string;
  state: JobState;
  title: string;
  company: string;
  companyUrl: string | null;
  description: string;
  descriptionHtml: string | null;
  locationText: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  workplaceType: WorkplaceType;
  employmentType: EmploymentType;
  seniority: SeniorityLevel;
  department: string | null;
  minSalary: number | null;
  maxSalary: number | null;
  currency: string | null;
  payPeriod: PayPeriod | null;
  compensationRaw: string | null;
  postedDate: string | null;
  expirationDate: string | null;
  discoveredDate: string;
  lastCheckedDate: string | null;
  originalUrl: string | null;
  canonicalUrl: string | null;
  applicationUrl: string | null;
  provider: JobProvider;
  sourceExternalId: string | null;
  sourceCompanyId: string | null;
  contentHash: string;
  isDuplicate: boolean;
  duplicateOfId: string | null;
  hasManualEdits: boolean;
  manualEditFields: string[];
  requirements?: JobRequirementDto[];
  sections?: JobSectionDto[];
  sources?: JobSourceDto[];
  events?: JobEventDto[];
  createdAt: string;
  updatedAt: string;
}

export interface JobSummaryDto {
  id: string;
  state: JobState;
  title: string;
  company: string;
  locationText: string | null;
  city: string | null;
  country: string | null;
  workplaceType: WorkplaceType;
  employmentType: EmploymentType;
  seniority: SeniorityLevel;
  provider: JobProvider;
  department?: string | null;
  minSalary: number | null;
  maxSalary: number | null;
  currency: string | null;
  payPeriod: PayPeriod | null;
  originalUrl: string | null;
  discoveredDate: string;
  isDuplicate: boolean;
  hasManualEdits: boolean;
  requirementCount: number;
}

export interface JobListQuery {
  page?: number;
  limit?: number;
  state?: JobState;
  provider?: JobProvider;
  workplaceType?: WorkplaceType;
  employmentType?: EmploymentType;
  company?: string;
  search?: string;
  includeArchived?: boolean;
}

export interface JobPaginationResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IngestJobTextRequest {
  text: string;
  title?: string;
  company?: string;
  url?: string;
  sourceNotes?: string;
}

export interface IngestJobUrlRequest {
  url: string;
}

export interface UpdateJobRequest {
  title?: string;
  company?: string;
  companyUrl?: string | null;
  locationText?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  workplaceType?: WorkplaceType;
  employmentType?: EmploymentType;
  seniority?: SeniorityLevel;
  department?: string | null;
  minSalary?: number | null;
  maxSalary?: number | null;
  currency?: string | null;
  payPeriod?: PayPeriod | null;
  applicationUrl?: string | null;
  description?: string;
}

export interface JobDashboardMetricsDto {
  totalJobs: number;
  newJobs: number;
  ingestedJobs: number;
  needsReviewJobs: number;
  failedIngestions: number;
  archivedJobs: number;
  providerCounts: Record<string, number>;
  workplaceCounts: Record<string, number>;
  recentJobs: JobSummaryDto[];
}
