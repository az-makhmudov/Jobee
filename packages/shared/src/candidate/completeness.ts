import type {
  CandidateProfileDto,
  CandidateExperienceDto,
  CandidateEducationDto,
  CandidateSkillDto,
  CandidateLanguageDto,
  CandidateDocumentDto,
  JobPreferencesDto,
  ProfileCompletenessResult,
  ProfileCompletenessCategory,
} from '../types/candidate.js';

export interface CompletenessInputData {
  profile: CandidateProfileDto | null;
  experiences: CandidateExperienceDto[];
  education: CandidateEducationDto[];
  skills: CandidateSkillDto[];
  languages: CandidateLanguageDto[];
  documents: CandidateDocumentDto[];
  preferences: JobPreferencesDto | null;
}

/**
 * Deterministically computes profile completeness without AI inference.
 *
 * Weight allocation (100% total):
 * 1. Basic Profile (20%): Requires full name, email, headline, and summary.
 * 2. Professional Experience (20%): Requires at least 1 experience record.
 * 3. Education (15%): Requires at least 1 education record.
 * 4. Skills (15%): Requires at least 3 active skills.
 * 5. Languages (10%): Requires at least 1 language.
 * 6. Master CV (10%): Requires at least 1 active master CV document.
 * 7. Job Preferences (10%): Requires target titles and preferred locations.
 */
export function calculateProfileCompleteness(
  data: CompletenessInputData,
): ProfileCompletenessResult {
  const categories: ProfileCompletenessCategory[] = [];
  const missingItems: string[] = [];

  // 1. Basic Profile (20%)
  const hasBasic =
    !!data.profile &&
    !!data.profile.fullName?.trim() &&
    !!data.profile.email?.trim() &&
    !!data.profile.headline?.trim() &&
    !!data.profile.summary?.trim();

  categories.push({
    category: 'profile',
    label: 'Basic Professional Profile',
    weight: 20,
    completed: hasBasic,
    missingDetails: hasBasic
      ? undefined
      : 'Provide full name, email, professional headline, and summary.',
  });
  if (!hasBasic) {
    missingItems.push('Complete basic profile (headline, email, summary)');
  }

  // 2. Experience (20%)
  const hasExperience = data.experiences.length > 0;
  categories.push({
    category: 'experience',
    label: 'Professional Experience',
    weight: 20,
    completed: hasExperience,
    missingDetails: hasExperience ? undefined : 'Add at least one professional work experience.',
  });
  if (!hasExperience) {
    missingItems.push('Add at least one work experience');
  }

  // 3. Education (15%)
  const hasEducation = data.education.length > 0;
  categories.push({
    category: 'education',
    label: 'Education & Training',
    weight: 15,
    completed: hasEducation,
    missingDetails: hasEducation
      ? undefined
      : 'Add at least one educational qualification or degree.',
  });
  if (!hasEducation) {
    missingItems.push('Add an education entry');
  }

  // 4. Skills (15%)
  const activeSkillsCount = data.skills.filter((s) => s.isActive).length;
  const hasSkills = activeSkillsCount >= 3;
  categories.push({
    category: 'skills',
    label: 'Core Skills',
    weight: 15,
    completed: hasSkills,
    missingDetails: hasSkills
      ? undefined
      : `Add at least 3 core skills (currently ${activeSkillsCount}/3).`,
  });
  if (!hasSkills) {
    missingItems.push(`Add ${3 - activeSkillsCount} more skill(s) (minimum 3 required)`);
  }

  // 5. Languages (10%)
  const hasLanguages = data.languages.some((l) => !!l.language?.trim());
  categories.push({
    category: 'languages',
    label: 'Languages',
    weight: 10,
    completed: hasLanguages,
    missingDetails: hasLanguages ? undefined : 'Add at least one language.',
  });
  if (!hasLanguages) {
    missingItems.push('Add at least one language');
  }

  // 6. Master CV (10%)
  const hasMasterCv = data.documents.some(
    (d) => d.documentType === 'MASTER_CV' && d.isActive && d.isMaster,
  );
  categories.push({
    category: 'master_cv',
    label: 'Active Master CV',
    weight: 10,
    completed: hasMasterCv,
    missingDetails: hasMasterCv ? undefined : 'Upload and set an active Master CV document.',
  });
  if (!hasMasterCv) {
    missingItems.push('Upload an active Master CV document');
  }

  // 7. Job Preferences (10%)
  const hasPreferences =
    !!data.preferences &&
    data.preferences.targetTitles.length > 0 &&
    data.preferences.preferredLocations.length > 0;
  categories.push({
    category: 'preferences',
    label: 'Job Search Preferences',
    weight: 10,
    completed: hasPreferences,
    missingDetails: hasPreferences
      ? undefined
      : 'Configure target job titles and preferred locations.',
  });
  if (!hasPreferences) {
    missingItems.push('Configure target titles and locations in Preferences');
  }

  // Calculate total score
  const score = categories.reduce((total, cat) => total + (cat.completed ? cat.weight : 0), 0);

  return {
    score,
    categories,
    missingItems,
  };
}
