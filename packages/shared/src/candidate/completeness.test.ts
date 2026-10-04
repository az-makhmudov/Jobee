import { describe, it, expect } from 'vitest';
import { calculateProfileCompleteness } from './completeness.js';
import type {
  CandidateProfileDto,
  CandidateExperienceDto,
  CandidateEducationDto,
  CandidateSkillDto,
  CandidateLanguageDto,
  CandidateDocumentDto,
  JobPreferencesDto,
} from '../types/candidate.js';

describe('calculateProfileCompleteness', () => {
  it('returns 0 score and all missing categories for completely empty profile', () => {
    const result = calculateProfileCompleteness({
      profile: null,
      experiences: [],
      education: [],
      skills: [],
      languages: [],
      documents: [],
      preferences: null,
    });

    expect(result.score).toBe(0);
    expect(result.missingItems.length).toBe(7);
  });

  it('calculates 100 score when all 7 categories are satisfied', () => {
    const mockProfile: CandidateProfileDto = {
      id: '1',
      userId: 'u1',
      fullName: 'Bek Test',
      email: 'bek@example.com',
      headline: 'Senior Project Manager',
      summary: 'Experienced manager with 5+ years track record',
      preferredName: 'Bek',
      phone: null,
      city: 'Berlin',
      region: null,
      country: 'Germany',
      availability: 'Immediate',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mockExperience: CandidateExperienceDto = {
      id: 'e1',
      userId: 'u1',
      organization: 'Tech Corp',
      position: 'Project Coordinator',
      location: 'Berlin',
      employmentType: 'full-time',
      startDate: '2022-01',
      endDate: null,
      isCurrent: true,
      description: 'Led projects',
      achievements: ['Delivered on time'],
      displayOrder: 0,
      verificationStatus: 'VERIFIED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mockEducation: CandidateEducationDto = {
      id: 'ed1',
      userId: 'u1',
      institution: 'Technical University',
      degree: 'B.Sc.',
      fieldOfStudy: 'Computer Science',
      startDate: '2018',
      endDate: '2021',
      isCurrent: false,
      location: null,
      description: null,
      activities: null,
      displayOrder: 0,
      verificationStatus: 'VERIFIED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mockSkills: CandidateSkillDto[] = [
      {
        id: 's1',
        userId: 'u1',
        name: 'Agile',
        category: 'Methodology',
        proficiency: 'Advanced',
        yearsExperience: 4,
        isActive: true,
        verificationStatus: 'VERIFIED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 's2',
        userId: 'u1',
        name: 'Scrum',
        category: 'Methodology',
        proficiency: 'Advanced',
        yearsExperience: 4,
        isActive: true,
        verificationStatus: 'VERIFIED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 's3',
        userId: 'u1',
        name: 'Jira',
        category: 'Tools',
        proficiency: 'Expert',
        yearsExperience: 5,
        isActive: true,
        verificationStatus: 'VERIFIED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const mockLanguages: CandidateLanguageDto[] = [
      {
        id: 'l1',
        userId: 'u1',
        language: 'English',
        proficiency: 'Fluent',
        cefrLevel: 'C1',
        notes: null,
        verificationStatus: 'VERIFIED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const mockDocuments: CandidateDocumentDto[] = [
      {
        id: 'd1',
        userId: 'u1',
        documentType: 'MASTER_CV',
        displayName: 'Master CV 2026',
        originalFilename: 'cv.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        storageKey: 'key.pdf',
        sha256Checksum: null,
        roleFocus: null,
        version: '1.0',
        isActive: true,
        isMaster: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const mockPreferences: JobPreferencesDto = {
      id: 'p1',
      userId: 'u1',
      targetTitles: ['Project Manager'],
      targetCategories: ['Operations'],
      preferredLocations: ['Berlin', 'Remote'],
      workModes: ['remote'],
      employmentTypes: ['full-time'],
      seniorityLevels: ['mid'],
      minSalary: 70000,
      maxSalary: 95000,
      currency: 'EUR',
      preferredLanguages: ['English'],
      excludedCompanies: [],
      excludedKeywords: [],
      acceptUnpaid: false,
      willingToRelocate: false,
      needsSponsorship: false,
      customPreferences: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = calculateProfileCompleteness({
      profile: mockProfile,
      experiences: [mockExperience],
      education: [mockEducation],
      skills: mockSkills,
      languages: mockLanguages,
      documents: mockDocuments,
      preferences: mockPreferences,
    });

    expect(result.score).toBe(100);
    expect(result.missingItems).toHaveLength(0);
  });
});
