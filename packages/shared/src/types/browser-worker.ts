/**
 * Browser Application Worker & ATS Adapters Types (JOB-P5-T01)
 *
 * Execution contracts, form schemas, challenge detection, and audit logging.
 */

export const AtsProviderType = {
  GREENHOUSE: 'GREENHOUSE',
  LEVER: 'LEVER',
  ASHBY: 'ASHBY',
  OTHER: 'OTHER',
  UNKNOWN: 'UNKNOWN',
} as const;
export type AtsProviderType = (typeof AtsProviderType)[keyof typeof AtsProviderType];

export const BrowserRunMode = {
  DRY_RUN: 'DRY_RUN',
  PREFILL_ONLY: 'PREFILL_ONLY',
  SUBMIT: 'SUBMIT',
} as const;
export type BrowserRunMode = (typeof BrowserRunMode)[keyof typeof BrowserRunMode];

export const BrowserRunStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  SUCCESS: 'SUCCESS',
  STOPPED_CAPTCHA: 'STOPPED_CAPTCHA',
  STOPPED_MANUAL_REVIEW: 'STOPPED_MANUAL_REVIEW',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  FAILED: 'FAILED',
} as const;
export type BrowserRunStatus = (typeof BrowserRunStatus)[keyof typeof BrowserRunStatus];

export const AtsFormFieldType = {
  TEXT: 'TEXT',
  EMAIL: 'EMAIL',
  PHONE: 'PHONE',
  TEXTAREA: 'TEXTAREA',
  SELECT: 'SELECT',
  RADIO: 'RADIO',
  CHECKBOX: 'CHECKBOX',
  FILE_RESUME: 'FILE_RESUME',
  FILE_COVER_LETTER: 'FILE_COVER_LETTER',
  CUSTOM: 'CUSTOM',
} as const;
export type AtsFormFieldType = (typeof AtsFormFieldType)[keyof typeof AtsFormFieldType];

export interface AtsFormField {
  id: string;
  name: string;
  label: string;
  type: AtsFormFieldType;
  required: boolean;
  selector: string;
  options?: string[];
  currentValue?: string;
  mappedConcept?: string; // e.g. 'firstName', 'lastName', 'email', 'phone', 'linkedin', 'github', 'resume'
}

export interface AtsFormSchema {
  provider: AtsProviderType;
  pageTitle: string;
  jobTitle?: string;
  company?: string;
  fields: AtsFormField[];
  hasCaptcha: boolean;
  hasResumeUpload: boolean;
}

export interface BrowserRunStepLog {
  step: string;
  action: string;
  timestamp: string;
  status: 'OK' | 'WARNING' | 'ERROR';
  selector?: string;
  details?: string;
}

export interface ChallengeDetectionResult {
  detected: boolean;
  type: 'NONE' | 'RECAPTCHA' | 'HCAPTCHA' | 'CLOUDFLARE_TURNSTILE' | 'GEETEST' | 'OTHER';
  selector?: string;
  message?: string;
}

export interface ApplicationSubmissionPayload {
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone?: string;
  location?: string;
  urls: Record<string, string>; // e.g. { linkedin: '...', github: '...', portfolio: '...' }
  resumeFilePath?: string;
  resumeBuffer?: string; // base64 encoded
  resumeFileName?: string;
  coverLetterText?: string;
  coverLetterFilePath?: string;
  coverLetterFileName?: string;
  answers: Record<
    string,
    { answerText: string; isSensitive?: boolean; verificationStatus?: string }
  >;
  eeo?: {
    gender?: string;
    race?: string;
    veteranStatus?: string;
    disabilityStatus?: string;
  };
}

export interface AtsFillResult {
  filledFields: string[];
  skippedOptionalFields: string[];
  unmatchedRequiredFields: AtsFormField[];
  challengesDetected: ChallengeDetectionResult;
}

export interface AtsValidationResult {
  isValid: boolean;
  errors: string[];
  missingRequiredFields: string[];
}

export interface AtsSubmissionResult {
  success: boolean;
  confirmationReference?: string;
  confirmationUrl?: string;
  error?: string;
}

export interface BrowserApplicationRunDto {
  id: string;
  applicationId: string;
  userId: string;
  packageVersionId?: string | null;
  atsProvider: AtsProviderType;
  targetUrl: string;
  mode: BrowserRunMode;
  status: BrowserRunStatus;
  fieldsDetectedCount: number;
  fieldsFilledCount: number;
  unmatchedRequiredFields: unknown[];
  stepLogs: BrowserRunStepLog[];
  screenshotPaths: string[];
  confirmationReference?: string | null;
  errorMessage?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StartBrowserRunRequest {
  targetUrl?: string;
  mode?: BrowserRunMode;
  packageVersionId?: string;
  headless?: boolean;
}
