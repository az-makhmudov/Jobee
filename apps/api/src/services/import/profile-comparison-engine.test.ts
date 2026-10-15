import { describe, it, expect } from 'vitest';
import {
  ProfileComparisonEngine,
  type ExistingCandidateBrainState,
} from './profile-comparison-engine.js';
import type { ExtractedProfileData } from '@job-agent/shared';

describe('ProfileComparisonEngine', () => {
  const mockExistingState: ExistingCandidateBrainState = {
    profile: {
      id: 'profile-1',
      userId: 'user-1',
      fullName: 'Asadbek Makhmudov',
      preferredName: 'Asadbek',
      headline: 'Software Engineer',
      email: 'asadbek@example.com',
      phone: '+1234567890',
      city: 'Berlin',
      region: 'Berlin',
      country: 'Germany',
      summary: 'Experienced software engineer',
      availability: 'Immediate',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    experiences: [
      {
        id: 'exp-1',
        userId: 'user-1',
        organization: 'Acme Corp',
        position: 'Backend Developer',
        location: 'Berlin',
        employmentType: 'Full-time',
        startDate: '2021-01',
        endDate: '2023-01',
        isCurrent: false,
        description: 'Built microservices',
        achievements: ['Increased throughput by 40%'],
        displayOrder: 0,
        verificationStatus: 'VERIFIED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    education: [
      {
        id: 'edu-1',
        userId: 'user-1',
        institution: 'Technical University',
        degree: 'Bachelor of Science',
        fieldOfStudy: 'Computer Science',
        startDate: '2016',
        endDate: '2020',
        isCurrent: false,
        location: 'Berlin',
        description: null,
        activities: null,
        displayOrder: 0,
        verificationStatus: 'VERIFIED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    skills: [
      {
        id: 'skill-1',
        userId: 'user-1',
        name: 'TypeScript',
        category: 'Languages',
        proficiency: 'Advanced',
        yearsExperience: 4,
        isActive: true,
        verificationStatus: 'VERIFIED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'skill-2',
        userId: 'user-1',
        name: 'React',
        category: 'Frameworks',
        proficiency: 'Intermediate',
        yearsExperience: 3,
        isActive: true,
        verificationStatus: 'VERIFIED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    certifications: [],
    languages: [],
    projects: [],
    links: [],
  };

  it('classifies exact verified matches as MATCHED', () => {
    const extracted: ExtractedProfileData = {
      profile: null,
      experiences: [
        {
          organization: 'Acme Corp',
          position: 'Backend Developer',
          startDate: '2021-01',
          endDate: '2023-01',
          sourceReference: 'Backend Developer at Acme Corp (2021-01 - 2023-01)',
          confidence: 0.95,
        },
      ],
      education: [],
      skills: [
        {
          name: 'TypeScript',
          sourceReference: 'Skills: TypeScript',
          confidence: 0.95,
        },
      ],
      certifications: [],
      languages: [],
      projects: [],
      links: [],
    };

    const results = ProfileComparisonEngine.compare(extracted, mockExistingState);

    const expResult = results.find((r) => r.section === 'EXPERIENCE');
    expect(expResult?.classification).toBe('MATCHED');
    expect(expResult?.existingEntityId).toBe('exp-1');

    const skillResult = results.find((r) => r.section === 'SKILL');
    expect(skillResult?.classification).toBe('MATCHED');
    expect(skillResult?.existingEntityId).toBe('skill-1');
  });

  it('classifies minor synonyms/formatting differences as DUPLICATE', () => {
    const extracted: ExtractedProfileData = {
      profile: null,
      experiences: [],
      education: [],
      skills: [
        {
          name: 'React.js', // Existing has "React"
          sourceReference: 'Skills: React.js',
          confidence: 0.9,
        },
      ],
      certifications: [],
      languages: [],
      projects: [],
      links: [],
    };

    const results = ProfileComparisonEngine.compare(extracted, mockExistingState);
    const skillResult = results.find((r) => r.section === 'SKILL');

    expect(skillResult?.classification).toBe('DUPLICATE');
    expect(skillResult?.existingEntityId).toBe('skill-2');
  });

  it('classifies new items not in Candidate Brain as NEW', () => {
    const extracted: ExtractedProfileData = {
      profile: null,
      experiences: [
        {
          organization: 'Novel Startup',
          position: 'Lead AI Engineer',
          startDate: '2023-02',
          endDate: null,
          isCurrent: true,
          sourceReference: 'Lead AI Engineer at Novel Startup (2023-Present)',
          confidence: 0.9,
        },
      ],
      education: [],
      skills: [
        {
          name: 'Cloudflare R2',
          sourceReference: 'Tools: Cloudflare R2',
          confidence: 0.95,
        },
      ],
      certifications: [],
      languages: [
        {
          language: 'German',
          proficiency: 'Full professional proficiency',
          sourceReference: 'Languages: German (Fluent)',
          confidence: 0.9,
        },
      ],
      projects: [],
      links: [],
    };

    const results = ProfileComparisonEngine.compare(extracted, mockExistingState);

    const expResult = results.find((r) => r.section === 'EXPERIENCE');
    expect(expResult?.classification).toBe('NEW');

    const skillResult = results.find((r) => r.section === 'SKILL');
    expect(skillResult?.classification).toBe('NEW');

    const langResult = results.find((r) => r.section === 'LANGUAGE');
    expect(langResult?.classification).toBe('NEW');
  });

  it('detects date or title discrepancies for the same employer as CONFLICT', () => {
    const extracted: ExtractedProfileData = {
      profile: null,
      experiences: [
        {
          organization: 'Acme Corp',
          position: 'Backend Developer',
          startDate: '2021-01',
          endDate: '2024-05', // Existing has endDate: '2023-01'
          sourceReference: 'Acme Corp 2021 - 2024',
          confidence: 0.9,
        },
      ],
      education: [],
      skills: [],
      certifications: [],
      languages: [],
      projects: [],
      links: [],
    };

    const results = ProfileComparisonEngine.compare(extracted, mockExistingState);
    const expResult = results.find((r) => r.section === 'EXPERIENCE');

    expect(expResult?.classification).toBe('CONFLICT');
    expect(expResult?.conflictDetails).toContain('Date mismatch');
    expect(expResult?.existingEntityId).toBe('exp-1');
  });

  it('classifies records with missing critical fields as INCOMPLETE', () => {
    const extracted: ExtractedProfileData = {
      profile: null,
      experiences: [
        {
          organization: '', // Missing organization
          position: 'Developer',
          startDate: '2020',
          sourceReference: 'Developer (2020)',
          confidence: 0.7,
        },
      ],
      education: [
        {
          institution: '', // Missing institution
          degree: 'B.Sc.',
          sourceReference: 'B.Sc. 2018',
          confidence: 0.6,
        },
      ],
      skills: [],
      certifications: [],
      languages: [],
      projects: [],
      links: [],
    };

    const results = ProfileComparisonEngine.compare(extracted, mockExistingState);

    const expResult = results.find((r) => r.section === 'EXPERIENCE');
    expect(expResult?.classification).toBe('INCOMPLETE');

    const eduResult = results.find((r) => r.section === 'EDUCATION');
    expect(eduResult?.classification).toBe('INCOMPLETE');
  });

  it('flags extractions with confidence < 0.6 as LOW_CONFIDENCE', () => {
    const extracted: ExtractedProfileData = {
      profile: null,
      experiences: [
        {
          organization: 'Fuzzy Venture',
          position: 'Contributor',
          startDate: '2019',
          sourceReference: 'Fuzzy venture contributor around 2019 maybe',
          confidence: 0.45, // < 0.6
        },
      ],
      education: [],
      skills: [],
      certifications: [],
      languages: [],
      projects: [],
      links: [],
    };

    const results = ProfileComparisonEngine.compare(extracted, mockExistingState);
    const expResult = results.find((r) => r.section === 'EXPERIENCE');

    expect(expResult?.classification).toBe('LOW_CONFIDENCE');
  });
});
