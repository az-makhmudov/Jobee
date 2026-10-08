import { describe, it, expect } from 'vitest';
import { DeterministicEmailClassifier } from './deterministic-email-classifier.js';
import { FixtureEmailProvider } from './fixture-email-provider.js';
import { EmailClassificationType } from '@job-agent/shared';
import { JobAlertParser } from './job-alert-parser.js';

describe('Email Classification & Job Alert Parsing Across All 11 Archetypes', () => {
  const fixtureProvider = new FixtureEmailProvider();

  it('correctly classifies Archetype 1: Job Alert email and extracts individual jobs', async () => {
    const msg = await fixtureProvider.getMessage({} as any, 'fixture-msg-101-job-alert');
    const result = DeterministicEmailClassifier.classify(msg);

    expect(result.classification).toBe(EmailClassificationType.JOB_ALERT);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);

    const alertJobs = JobAlertParser.parseAlertListings(msg);
    expect(alertJobs.length).toBe(3);
    expect(alertJobs[0]?.title).toBe('Senior Backend Engineer');
    expect(alertJobs[0]?.company).toBe('Acme Corp');
    expect(alertJobs[1]?.title).toBe('Staff Platform Engineer');
    expect(alertJobs[1]?.company).toBe('Globex Software');
    expect(alertJobs[2]?.title).toBe('Rust Systems Architect');
    expect(alertJobs[2]?.company).toBe('Initech Corp');
  });

  it('correctly classifies Archetype 2: Application Confirmation with external reference ID', async () => {
    const msg = await fixtureProvider.getMessage({} as any, 'fixture-msg-102-app-confirm');
    const result = DeterministicEmailClassifier.classify(msg);

    expect(result.classification).toBe(EmailClassificationType.APPLICATION_CONFIRMATION);
    expect(result.confidence).toBeGreaterThanOrEqual(0.95);
    expect(result.extractedDetails.externalReferenceId).toBe('APP-ACME-98421');
  });

  it('correctly classifies Archetype 3: Recruiter Cold Outreach with calendar meeting link', async () => {
    const msg = await fixtureProvider.getMessage({} as any, 'fixture-msg-103-recruiter-outreach');
    const result = DeterministicEmailClassifier.classify(msg);

    expect(result.classification).toBe(EmailClassificationType.RECRUITER_OUTREACH);
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    expect(result.extractedDetails.meetingUrl).toContain('calendly.com');
  });

  it('correctly classifies Archetype 4: Screening Request', async () => {
    const msg = await fixtureProvider.getMessage({} as any, 'fixture-msg-104-screening-request');
    const result = DeterministicEmailClassifier.classify(msg);

    expect(result.classification).toBe(EmailClassificationType.SCREENING_REQUEST);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('correctly classifies Archetype 5: Assessment Request with test provider and URL', async () => {
    const msg = await fixtureProvider.getMessage({} as any, 'fixture-msg-105-assessment-request');
    const result = DeterministicEmailClassifier.classify(msg);

    expect(result.classification).toBe(EmailClassificationType.ASSESSMENT_REQUEST);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.extractedDetails.assessmentUrl).toContain('hackerrank.com');
  });

  it('correctly classifies Archetype 6: Interview Request', async () => {
    const msg = await fixtureProvider.getMessage({} as any, 'fixture-msg-106-interview-request');
    const result = DeterministicEmailClassifier.classify(msg);

    expect([
      EmailClassificationType.SCREENING_REQUEST,
      EmailClassificationType.INTERVIEW_CONFIRMATION,
    ]).toContain(result.classification);
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('correctly classifies Archetype 7: Interview Confirmation with meeting link', async () => {
    const msg = await fixtureProvider.getMessage({} as any, 'fixture-msg-107-interview-confirm');
    const result = DeterministicEmailClassifier.classify(msg);

    expect(result.classification).toBe(EmailClassificationType.INTERVIEW_CONFIRMATION);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.extractedDetails.meetingUrl).toContain('meet.google.com');
  });

  it('correctly classifies Archetype 8: High-Confidence Application Rejection', async () => {
    const msg = await fixtureProvider.getMessage({} as any, 'fixture-msg-108-rejection');
    const result = DeterministicEmailClassifier.classify(msg);

    expect(result.classification).toBe(EmailClassificationType.APPLICATION_REJECTION);
    expect(result.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('correctly classifies Archetype 9: Job Offer Letter', async () => {
    const msg = await fixtureProvider.getMessage({} as any, 'fixture-msg-109-offer');
    const result = DeterministicEmailClassifier.classify(msg);

    expect(result.classification).toBe(EmailClassificationType.OFFER_RELATED);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('correctly classifies Archetype 10: Retail Marketing / Irrelevant Spam', async () => {
    const msg = await fixtureProvider.getMessage({} as any, 'fixture-msg-110-marketing');
    const result = DeterministicEmailClassifier.classify(msg);

    expect(result.classification).toBe(EmailClassificationType.IRRELEVANT);
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('correctly classifies Archetype 11: Ambiguous portal update as UNKNOWN with low confidence', async () => {
    const msg = await fixtureProvider.getMessage({} as any, 'fixture-msg-111-ambiguous-update');
    const result = DeterministicEmailClassifier.classify(msg);

    expect(result.classification).toBe(EmailClassificationType.UNKNOWN);
    expect(result.confidence).toBeLessThan(0.7);
  });
});
