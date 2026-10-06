import {
  RequirementCategory,
  RequirementStrength,
  RequirementEvaluationStatus,
} from '@job-agent/shared';

export interface AiCandidateContext {
  targetRoles: string[];
  experiences: {
    id: string; // e.g. "candidate_experience:<uuid>"
    position: string;
    organization: string;
    duration?: string;
    highlights: string[];
  }[];
  skills: {
    id: string; // e.g. "candidate_skill:<uuid>"
    name: string;
    proficiency?: string | null;
  }[];
  education: {
    id: string; // e.g. "candidate_education:<uuid>"
    institution: string;
    degree?: string | null;
    fieldOfStudy?: string | null;
  }[];
  languages: {
    id: string; // e.g. "candidate_language:<uuid>"
    language: string;
    proficiency: string;
    cefrLevel?: string | null;
  }[];
  certifications: {
    id: string; // e.g. "candidate_certification:<uuid>"
    name: string;
    issuingOrganization: string;
  }[];
  verifiedFacts: {
    id: string; // e.g. "candidate_fact:<uuid>"
    category: string;
    statement: string;
  }[];
}

export interface AiMatchContext {
  jobId: string;
  jobTitle: string;
  jobCompany: string;
  workplaceType: string;
  location?: string | null;
  descriptionSnippet: string;
  requirements: {
    id: string;
    rawText: string;
    category: RequirementCategory;
    strength: RequirementStrength;
  }[];
  candidateContext: AiCandidateContext;
}

export interface AiRequirementEvaluation {
  requirementId: string;
  status: RequirementEvaluationStatus;
  evidenceIds: string[];
  confidence: number; // 0 - 100
  reason: string;
}

export interface AiMatchResult {
  evaluations: AiRequirementEvaluation[];
  roleFitScore: number | null; // 0 - 100
  skillsFitScore: number | null; // 0 - 100
  strengths: string[];
  gaps: string[];
  semanticSummary: string;
  provider: string;
  model: string;
  tokensUsed?: number;
}

export interface AiProvider {
  readonly name: string;
  isAvailable(): boolean;
  analyzeMatch(context: AiMatchContext): Promise<AiMatchResult>;
}
