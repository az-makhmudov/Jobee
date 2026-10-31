import type { ApplicationCapability } from './browser-worker.js';
export type JobState = 'NEW' | 'INGESTED' | 'NEEDS_REVIEW' | 'INVALID' | 'DUPLICATE' | 'ARCHIVED';

export type JobProvider =
  | 'GREENHOUSE'
  | 'LEVER'
  | 'ASHBY'
  | 'LINKEDIN'
  | 'ARBEITNOW'
  | 'SMARTRECRUITERS'
  | 'GOOGLE_JOBS'
  | 'GENERIC'
  | 'MANUAL';

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
  | 'INGESTION_FAILED'
  | 'JOB_ANALYSIS_STARTED'
  | 'JOB_ANALYSIS_COMPLETED'
  | 'JOB_ANALYSIS_FAILED'
  | 'JOB_ANALYSIS_STALE'
  | 'JOB_DECISION_CHANGED';

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
  applicationCapability?: ApplicationCapability;
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
  applicationCapability?: ApplicationCapability;
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
  lastCheckedDate?: string | null;
  isDuplicate: boolean;
  hasManualEdits: boolean;
  requirementCount: number;
  matchSummary?: JobMatchSummaryDto | null;
}

export interface JobListQuery {
  applicationMethod?: 'JOBEE' | 'EMPLOYER_SITE';
  page?: number;
  limit?: number;
  state?: JobState;
  provider?: JobProvider;
  workplaceType?: WorkplaceType;
  employmentType?: EmploymentType;
  company?: string;
  search?: string;
  includeArchived?: boolean;
  relevantOnly?: boolean;
  recommendationsOnly?: boolean;
  decision?: MatchDecision | 'UNANALYZED';
  minScore?: number;
  maxScore?: number;
  minConfidence?: number;
  isStale?: boolean;
  sortBy?: 'discoveredDate' | 'score' | 'confidence' | 'title' | 'company';
  sortOrder?: 'asc' | 'desc';
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
  totalAnalyzed: number;
  matchCount: number;
  reviewCount: number;
  skipCount: number;
  averageMatchScore: number;
  staleAnalysisCount: number;
  providerCounts: Record<string, number>;
  workplaceCounts: Record<string, number>;
  recentJobs: JobSummaryDto[];
}

// -------------------------------------------------------------
// Match Intelligence & Policy Decision Engine Types (JOB-P2-T02)
// -------------------------------------------------------------

export type MatchDecision = 'MATCH' | 'REVIEW' | 'SKIP';

export type RequirementEvaluationStatus =
  'MET' | 'PARTIAL' | 'NOT_MET' | 'UNKNOWN' | 'NOT_APPLICABLE';

export type EvaluationSource = 'DETERMINISTIC' | 'AI_ENRICHED';

export type DimensionType =
  | 'ROLE_FIT'
  | 'SKILLS_FIT'
  | 'EXPERIENCE_FIT'
  | 'EDUCATION_FIT'
  | 'LOCATION_FIT'
  | 'LANGUAGE_FIT'
  | 'COMPENSATION_FIT'
  | 'WORK_AUTHORIZATION_FIT';

export type DimensionStatus = 'SCORED' | 'UNKNOWN' | 'NOT_APPLICABLE';

export type MatchAnalysisMode = 'DETERMINISTIC_ONLY' | 'AI_ENRICHED';

export const MATCH_ALGORITHM_VERSION = '2.4.0';

export const DIMENSION_DEFAULT_WEIGHTS: Record<DimensionType, number> = {
  ROLE_FIT: 25,
  SKILLS_FIT: 25,
  EXPERIENCE_FIT: 20,
  EDUCATION_FIT: 10,
  LOCATION_FIT: 10,
  LANGUAGE_FIT: 10,
  COMPENSATION_FIT: 15,
  WORK_AUTHORIZATION_FIT: 20,
};

export const DecisionReasonCodes = {
  LOCATION_NOT_ALLOWED: 'LOCATION_NOT_ALLOWED',
  SENIORITY_NOT_ALLOWED: 'SENIORITY_NOT_ALLOWED',
  WORK_MODE_NOT_ALLOWED: 'WORK_MODE_NOT_ALLOWED',
  UNPAID_ROLE_REJECTED: 'UNPAID_ROLE_REJECTED',
  EXCLUDED_COMPANY: 'EXCLUDED_COMPANY',
  EXCLUDED_KEYWORD: 'EXCLUDED_KEYWORD',
  EMPLOYMENT_TYPE_NOT_ALLOWED: 'EMPLOYMENT_TYPE_NOT_ALLOWED',
  INTERNSHIP_NOT_ALLOWED: 'INTERNSHIP_NOT_ALLOWED',
  SALARY_BELOW_MINIMUM: 'SALARY_BELOW_MINIMUM',
  LANGUAGE_REQUIREMENT_NOT_MET: 'LANGUAGE_REQUIREMENT_NOT_MET',
  SPONSORSHIP_CONFLICT: 'SPONSORSHIP_CONFLICT',
  POLICY_INFORMATION_MISSING: 'POLICY_INFORMATION_MISSING',
  UNKNOWN_SENSITIVE_FACTS: 'UNKNOWN_SENSITIVE_FACTS',
  UNMET_MANDATORY_REQUIREMENTS: 'UNMET_MANDATORY_REQUIREMENTS',
  LOW_MATCH_SCORE: 'LOW_MATCH_SCORE',
  APPLICATION_SCORE_BELOW_THRESHOLD: 'APPLICATION_SCORE_BELOW_THRESHOLD',
  LOW_CONFIDENCE: 'LOW_CONFIDENCE',
  MATCH_THRESHOLD_MET: 'MATCH_THRESHOLD_MET',
  REVIEW_THRESHOLD_MET: 'REVIEW_THRESHOLD_MET',
} as const;

export type DecisionReasonCode = (typeof DecisionReasonCodes)[keyof typeof DecisionReasonCodes];

export interface CandidateEvidenceItemDto {
  id: string;
  type: string; // 'skill' | 'experience' | 'education' | 'language' | 'certification' | 'project' | 'fact'
  label: string; // E.g. "Skill — TypeScript (Advanced)"
}

export interface JobRequirementEvaluationDto {
  id: string;
  analysisId: string;
  jobRequirementId: string;
  jobId: string;
  userId: string;
  status: RequirementEvaluationStatus;
  source: EvaluationSource;
  evidenceIds: string[];
  evidenceItems: CandidateEvidenceItemDto[];
  reason: string;
  confidence: number;
  contributesToBlocker: boolean;
  createdAt: string;
  requirement?: JobRequirementDto;
}

export interface JobMatchDimensionDto {
  id: string;
  analysisId: string;
  jobId: string;
  dimension: DimensionType;
  score: number | null;
  weight: number;
  status: DimensionStatus;
  reason: string;
  createdAt: string;
}

export const CareerFitCategories = {
  STRONG_MATCH: 'STRONG_MATCH',
  GOOD_MATCH: 'GOOD_MATCH',
  TRANSFERABLE_SKILLS_MATCH: 'TRANSFERABLE_SKILLS_MATCH',
  GROWTH_OPPORTUNITY: 'GROWTH_OPPORTUNITY',
  NOT_CURRENTLY_ELIGIBLE: 'NOT_CURRENTLY_ELIGIBLE',
  LOW_RELEVANCE: 'LOW_RELEVANCE',
  INSUFFICIENT_INFORMATION: 'INSUFFICIENT_INFORMATION',
} as const;

export type CareerFitCategory = (typeof CareerFitCategories)[keyof typeof CareerFitCategories];

export interface JobMatchAnalysisDto {
  id: string;
  jobId: string;
  userId: string;
  overallScore: number;
  confidenceScore: number;
  decision: MatchDecision;
  careerFitCategory?: CareerFitCategory | null;
  autoApplyEligible: boolean;
  analysisMode: MatchAnalysisMode;
  algorithmVersion: string;
  inputFingerprint: string;
  isStale: boolean;
  aiProvider: string | null;
  aiModel: string | null;
  strengths: string[];
  gaps: string[];
  unknowns: string[];
  warnings: string[];
  hardBlockers: string[];
  transferableSkills?: string[];
  learnedRankingAdjustment?: number;
  learnedAdjustmentReason?: string | null;
  reasonCodes: string[];
  summaryExplanation: string;
  dimensions?: JobMatchDimensionDto[];
  evaluations?: JobRequirementEvaluationDto[];
  createdAt: string;
  updatedAt: string;
}

export interface JobMatchSummaryDto {
  summaryExplanation?: string;
  hardBlockers?: string[];
  unknowns?: string[];
  overallScore: number;
  confidenceScore: number;
  decision: MatchDecision;
  careerFitCategory?: CareerFitCategory | null;
  isStale: boolean;
  analysisMode: MatchAnalysisMode;
  analyzedAt: string;
}

export interface BatchAnalysisRequest {
  jobIds?: string[];
  limit?: number;
  force?: boolean;
  unanalyzedOnly?: boolean;
}

export interface BatchAnalysisResultDto {
  totalRequested: number;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  results: {
    jobId: string;
    success: boolean;
    decision?: MatchDecision;
    score?: number;
    error?: string;
  }[];
}

export interface RecommendationStatusDto {
  state: 'IDLE' | 'QUEUED' | 'ANALYZING' | 'FAILED';
  pending: number;
  ready: number;
  excluded: number;
  evaluated: number;
  processed: number;
  batchSize: number;
  locations: string[];
  levels: string[];
  message: string;
}
