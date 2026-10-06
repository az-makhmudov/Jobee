import { describe, it, expect } from 'vitest';
import {
  ApplicationAnalyticsEngine,
  type RawApplicationData,
  type RawLifecycleEventData,
} from './application-analytics-engine.js';
import { ApplicationLifecycleStatus, ApplicationEventType } from '@job-agent/shared';

describe('ApplicationAnalyticsEngine', () => {
  it('handles empty applications safely with zero denominators and null rates', () => {
    const analytics = ApplicationAnalyticsEngine.computeAnalytics([], []);

    expect(analytics.funnel.totalApplications).toBe(0);
    expect(analytics.funnel.applied).toBe(0);
    expect(analytics.funnel.conversions.appliedToScreening.rate).toBeNull();
    expect(analytics.funnel.conversions.appliedToInterview.rate).toBeNull();
    expect(analytics.funnel.conversions.appliedToOffer.rate).toBeNull();
    expect(analytics.funnel.conversions.interviewToOffer.rate).toBeNull();

    expect(analytics.timeMetrics.avgDaysToFirstResponse).toBeNull();
    expect(analytics.timeMetrics.avgDaysToInterview).toBeNull();
    expect(analytics.timeMetrics.avgDaysToOutcome).toBeNull();
    expect(analytics.timeMetrics.avgActiveAgingDays).toBeNull();
    expect(analytics.sourceDistribution).toEqual([]);
  });

  it('computes accurate conversion rates and funnel stages', () => {
    const now = new Date('2026-10-06T12:00:00Z');
    const appliedDate = new Date('2026-10-01T12:00:00Z'); // 5 days ago

    const apps: RawApplicationData[] = [
      {
        id: 'app-1',
        status: ApplicationLifecycleStatus.OFFER,
        source: 'DIRECT',
        submissionMethod: 'LEVER',
        appliedAt: appliedDate,
        closedAt: null,
        createdAt: appliedDate,
        updatedAt: now,
      },
      {
        id: 'app-2',
        status: ApplicationLifecycleStatus.INTERVIEW,
        source: 'DIRECT',
        submissionMethod: 'GREENHOUSE',
        appliedAt: appliedDate,
        closedAt: null,
        createdAt: appliedDate,
        updatedAt: now,
      },
      {
        id: 'app-3',
        status: ApplicationLifecycleStatus.REJECTED,
        source: 'DIRECT',
        submissionMethod: 'LEVER',
        appliedAt: appliedDate,
        closedAt: new Date('2026-10-04T12:00:00Z'),
        createdAt: appliedDate,
        updatedAt: now,
      },
      {
        id: 'app-4',
        status: ApplicationLifecycleStatus.READY_TO_APPLY,
        source: 'DIRECT',
        appliedAt: null,
        closedAt: null,
        createdAt: appliedDate,
        updatedAt: now,
      },
    ];

    const events: RawLifecycleEventData[] = [
      {
        applicationId: 'app-1',
        eventType: ApplicationEventType.SCREENING_STARTED,
        newStatus: ApplicationLifecycleStatus.SCREENING,
        createdAt: new Date('2026-10-02T12:00:00Z'), // 1 day after applied
      },
      {
        applicationId: 'app-1',
        eventType: ApplicationEventType.INTERVIEW_SCHEDULED_MANUALLY,
        newStatus: ApplicationLifecycleStatus.INTERVIEW,
        createdAt: new Date('2026-10-04T12:00:00Z'), // 3 days after applied
      },
      {
        applicationId: 'app-1',
        eventType: ApplicationEventType.OFFER_RECEIVED,
        newStatus: ApplicationLifecycleStatus.OFFER,
        createdAt: new Date('2026-10-06T12:00:00Z'), // 5 days after applied
      },
      {
        applicationId: 'app-2',
        eventType: ApplicationEventType.INTERVIEW_SCHEDULED_MANUALLY,
        newStatus: ApplicationLifecycleStatus.INTERVIEW,
        createdAt: new Date('2026-10-03T12:00:00Z'), // 2 days after applied
      },
      {
        applicationId: 'app-3',
        eventType: ApplicationEventType.REJECTED,
        newStatus: ApplicationLifecycleStatus.REJECTED,
        createdAt: new Date('2026-10-04T12:00:00Z'), // 3 days after applied
      },
    ];

    const analytics = ApplicationAnalyticsEngine.computeAnalytics(apps, events, now);

    expect(analytics.funnel.totalApplications).toBe(4);
    expect(analytics.funnel.readyToApply).toBe(1);
    expect(analytics.funnel.applied).toBe(3); // apps 1, 2, 3 have been applied
    expect(analytics.funnel.screening).toBe(2); // app 1 (reached offer) and app 2 (reached interview)
    expect(analytics.funnel.interview).toBe(2); // app 1 and app 2
    expect(analytics.funnel.offer).toBe(1); // app 1

    // Conversions:
    // appliedToScreening: 2 / 3 = 66.7%
    expect(analytics.funnel.conversions.appliedToScreening.rate).toBe(66.7);
    // appliedToInterview: 2 / 3 = 66.7%
    expect(analytics.funnel.conversions.appliedToInterview.rate).toBe(66.7);
    // appliedToOffer: 1 / 3 = 33.3%
    expect(analytics.funnel.conversions.appliedToOffer.rate).toBe(33.3);
    // interviewToOffer: 1 / 2 = 50.0%
    expect(analytics.funnel.conversions.interviewToOffer.rate).toBe(50.0);

    // Time metrics
    // firstResponseDays: app-1 (1 day), app-2 (2 days), app-3 (3 days) -> avg = (1 + 2 + 3) / 3 = 2.0
    expect(analytics.timeMetrics.avgDaysToFirstResponse).toBe(2);
    // interviewDays: app-1 (3 days), app-2 (2 days) -> avg = 2.5
    expect(analytics.timeMetrics.avgDaysToInterview).toBe(2.5);
    // outcomeDays: app-3 (3 days)
    expect(analytics.timeMetrics.avgDaysToOutcome).toBe(3);

    // Source distribution: LEVER (2 = 50%), GREENHOUSE (1 = 25%), OTHER (1 = 25%)
    expect(analytics.sourceDistribution[0]?.source).toBe('LEVER');
    expect(analytics.sourceDistribution[0]?.count).toBe(2);
    expect(analytics.sourceDistribution[0]?.percentage).toBe(50);
  });

  it('computes top-level dashboard metrics correctly', () => {
    const now = new Date('2026-10-06T12:00:00Z');
    const apps: RawApplicationData[] = [
      {
        id: '1',
        status: ApplicationLifecycleStatus.READY_TO_APPLY,
        source: 'DIRECT',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: '2',
        status: ApplicationLifecycleStatus.APPLIED,
        source: 'DIRECT',
        followUpAt: new Date('2026-10-05T12:00:00Z'), // Overdue!
        createdAt: now,
        updatedAt: now,
      },
      {
        id: '3',
        status: ApplicationLifecycleStatus.INTERVIEW,
        source: 'DIRECT',
        followUpAt: new Date('2026-10-06T18:00:00Z'), // Pending within 24h!
        createdAt: now,
        updatedAt: now,
      },
    ];

    const metrics = ApplicationAnalyticsEngine.computeMetrics(apps, now);
    expect(metrics.totalTracked).toBe(3);
    expect(metrics.readyToApply).toBe(1);
    expect(metrics.applied).toBe(1);
    expect(metrics.activeProcesses).toBe(1);
    expect(metrics.interviews).toBe(1);
    expect(metrics.overdueFollowUps).toBe(1);
    expect(metrics.pendingFollowUps).toBe(1);
  });
});
