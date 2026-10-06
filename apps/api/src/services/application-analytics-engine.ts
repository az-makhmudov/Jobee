import {
  ApplicationLifecycleStatus,
  ApplicationEventType,
  type ApplicationCrmAnalyticsDto,
  type ApplicationCrmMetricsDto,
  type ConversionMetric,
} from '@job-agent/shared';

export interface RawApplicationData {
  id: string;
  status: string;
  source: string;
  submissionMethod?: string | null;
  appliedAt?: Date | null;
  closedAt?: Date | null;
  followUpAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RawLifecycleEventData {
  applicationId: string;
  eventType: string;
  previousStatus?: string | null;
  newStatus?: string | null;
  createdAt: Date;
}

export class ApplicationAnalyticsEngine {
  /**
   * Helper to safely compute conversion metric with zero-denominator handling.
   */
  private static calculateConversion(numerator: number, denominator: number): ConversionMetric {
    if (denominator <= 0) {
      return {
        rate: null,
        numerator: 0,
        denominator: 0,
      };
    }
    const rate = Math.round((numerator / denominator) * 1000) / 10;
    return {
      rate,
      numerator,
      denominator,
    };
  }

  /**
   * Calculate top-level dashboard metrics from raw applications.
   */
  static computeMetrics(
    applications: RawApplicationData[],
    now: Date = new Date(),
  ): ApplicationCrmMetricsDto {
    let readyToApply = 0;
    let applied = 0;
    let activeProcesses = 0;
    let interviews = 0;
    let offers = 0;
    let rejected = 0;
    let withdrawn = 0;
    let expired = 0;
    let skipped = 0;
    let pendingFollowUps = 0;
    let overdueFollowUps = 0;

    for (const app of applications) {
      const status = app.status as ApplicationLifecycleStatus;

      if (status === ApplicationLifecycleStatus.READY_TO_APPLY) {
        readyToApply++;
      } else if (
        status === ApplicationLifecycleStatus.APPLIED ||
        status === ApplicationLifecycleStatus.CONFIRMATION_RECEIVED
      ) {
        applied++;
      } else if (
        status === ApplicationLifecycleStatus.SCREENING ||
        status === ApplicationLifecycleStatus.ASSESSMENT
      ) {
        activeProcesses++;
      } else if (
        status === ApplicationLifecycleStatus.INTERVIEW ||
        status === ApplicationLifecycleStatus.FINAL_INTERVIEW
      ) {
        activeProcesses++;
        interviews++;
      } else if (status === ApplicationLifecycleStatus.OFFER) {
        offers++;
      } else if (status === ApplicationLifecycleStatus.REJECTED) {
        rejected++;
      } else if (status === ApplicationLifecycleStatus.WITHDRAWN) {
        withdrawn++;
      } else if (status === ApplicationLifecycleStatus.EXPIRED) {
        expired++;
      } else if (status === ApplicationLifecycleStatus.SKIPPED) {
        skipped++;
      }

      // Check follow-ups
      if (app.followUpAt && !app.closedAt) {
        const followUpTime = app.followUpAt.getTime();
        const nowTime = now.getTime();
        if (followUpTime < nowTime) {
          overdueFollowUps++;
        } else if (followUpTime <= nowTime + 24 * 60 * 60 * 1000) {
          pendingFollowUps++;
        }
      }
    }

    return {
      totalTracked: applications.length,
      readyToApply,
      applied,
      activeProcesses,
      interviews,
      offers,
      rejected,
      withdrawn,
      expired,
      skipped,
      pendingFollowUps,
      overdueFollowUps,
    };
  }

  /**
   * Calculate comprehensive personal ATS CRM analytics.
   */
  static computeAnalytics(
    applications: RawApplicationData[],
    events: RawLifecycleEventData[],
    now: Date = new Date(),
  ): ApplicationCrmAnalyticsDto {
    // 1. Initialize status counts for all canonical statuses
    const statusCounts: Record<ApplicationLifecycleStatus, number> = {
      [ApplicationLifecycleStatus.DISCOVERED]: 0,
      [ApplicationLifecycleStatus.ANALYZED]: 0,
      [ApplicationLifecycleStatus.MATCHED]: 0,
      [ApplicationLifecycleStatus.SKIPPED]: 0,
      [ApplicationLifecycleStatus.READY_TO_APPLY]: 0,
      [ApplicationLifecycleStatus.NEEDS_REVIEW]: 0,
      [ApplicationLifecycleStatus.APPLYING]: 0,
      [ApplicationLifecycleStatus.APPLIED]: 0,
      [ApplicationLifecycleStatus.CONFIRMATION_RECEIVED]: 0,
      [ApplicationLifecycleStatus.SCREENING]: 0,
      [ApplicationLifecycleStatus.ASSESSMENT]: 0,
      [ApplicationLifecycleStatus.INTERVIEW]: 0,
      [ApplicationLifecycleStatus.FINAL_INTERVIEW]: 0,
      [ApplicationLifecycleStatus.OFFER]: 0,
      [ApplicationLifecycleStatus.REJECTED]: 0,
      [ApplicationLifecycleStatus.WITHDRAWN]: 0,
      [ApplicationLifecycleStatus.EXPIRED]: 0,
    };

    // 2. Index events by application ID
    const eventsByAppId = new Map<string, RawLifecycleEventData[]>();
    for (const ev of events) {
      let list = eventsByAppId.get(ev.applicationId);
      if (!list) {
        list = [];
        eventsByAppId.set(ev.applicationId, list);
      }
      list.push(ev);
    }

    // Sort events by timestamp ascending for each app
    for (const [, list] of eventsByAppId) {
      list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }

    // 3. Process funnel metrics
    let totalReadyToApply = 0;
    let totalApplied = 0;
    let totalReachedScreening = 0;
    let totalReachedInterview = 0;
    let totalReachedOffer = 0;

    // Time samples (in days)
    const firstResponseDays: number[] = [];
    const interviewDays: number[] = [];
    const outcomeDays: number[] = [];
    const activeAgingDays: number[] = [];

    // Source distribution map
    const sourceMap = new Map<string, number>();

    for (const app of applications) {
      const status = app.status as ApplicationLifecycleStatus;
      if (status in statusCounts) {
        statusCounts[status]++;
      }

      // Record source / submission method
      const sourceKey = app.submissionMethod || app.source || 'OTHER';
      sourceMap.set(sourceKey, (sourceMap.get(sourceKey) || 0) + 1);

      const appEvents = eventsByAppId.get(app.id) || [];
      const allStatusesReached = new Set<string>();
      allStatusesReached.add(app.status);

      for (const ev of appEvents) {
        if (ev.newStatus) allStatusesReached.add(ev.newStatus);
        if (ev.previousStatus) allStatusesReached.add(ev.previousStatus);
      }

      const hasBeenApplied =
        app.appliedAt != null ||
        allStatusesReached.has(ApplicationLifecycleStatus.APPLIED) ||
        appEvents.some(
          (e) =>
            e.eventType === ApplicationEventType.MARKED_APPLIED ||
            e.eventType === ApplicationEventType.SUBMISSION_RECORDED,
        );

      if (allStatusesReached.has(ApplicationLifecycleStatus.READY_TO_APPLY)) {
        totalReadyToApply++;
      }

      if (hasBeenApplied) {
        totalApplied++;

        // Funnel stages reached
        const reachedScreening =
          allStatusesReached.has(ApplicationLifecycleStatus.SCREENING) ||
          allStatusesReached.has(ApplicationLifecycleStatus.ASSESSMENT) ||
          allStatusesReached.has(ApplicationLifecycleStatus.INTERVIEW) ||
          allStatusesReached.has(ApplicationLifecycleStatus.FINAL_INTERVIEW) ||
          allStatusesReached.has(ApplicationLifecycleStatus.OFFER);

        const reachedInterview =
          allStatusesReached.has(ApplicationLifecycleStatus.INTERVIEW) ||
          allStatusesReached.has(ApplicationLifecycleStatus.FINAL_INTERVIEW) ||
          allStatusesReached.has(ApplicationLifecycleStatus.OFFER);

        const reachedOffer = allStatusesReached.has(ApplicationLifecycleStatus.OFFER);

        if (reachedScreening) totalReachedScreening++;
        if (reachedInterview) totalReachedInterview++;
        if (reachedOffer) totalReachedOffer++;

        // Time analytics: only compute if appliedAt is known
        if (app.appliedAt) {
          const appliedTime = app.appliedAt.getTime();

          // 1. First response event
          const firstResponseEvent = appEvents.find(
            (e) =>
              e.newStatus === ApplicationLifecycleStatus.CONFIRMATION_RECEIVED ||
              e.newStatus === ApplicationLifecycleStatus.SCREENING ||
              e.newStatus === ApplicationLifecycleStatus.ASSESSMENT ||
              e.newStatus === ApplicationLifecycleStatus.INTERVIEW ||
              e.newStatus === ApplicationLifecycleStatus.REJECTED,
          );
          if (firstResponseEvent && firstResponseEvent.createdAt.getTime() >= appliedTime) {
            const diffDays =
              (firstResponseEvent.createdAt.getTime() - appliedTime) / (1000 * 60 * 60 * 24);
            firstResponseDays.push(diffDays);
          }

          // 2. Interview event
          const firstInterviewEvent = appEvents.find(
            (e) =>
              e.newStatus === ApplicationLifecycleStatus.INTERVIEW ||
              e.newStatus === ApplicationLifecycleStatus.FINAL_INTERVIEW,
          );
          if (firstInterviewEvent && firstInterviewEvent.createdAt.getTime() >= appliedTime) {
            const diffDays =
              (firstInterviewEvent.createdAt.getTime() - appliedTime) / (1000 * 60 * 60 * 24);
            interviewDays.push(diffDays);
          }

          // 3. Outcome event
          if (app.closedAt && app.closedAt.getTime() >= appliedTime) {
            const diffDays = (app.closedAt.getTime() - appliedTime) / (1000 * 60 * 60 * 24);
            outcomeDays.push(diffDays);
          }

          // 4. Active application aging
          if (!app.closedAt && now.getTime() >= appliedTime) {
            const diffDays = (now.getTime() - appliedTime) / (1000 * 60 * 60 * 24);
            activeAgingDays.push(diffDays);
          }
        }
      }
    }

    // Helper for computing averages
    const calcAvg = (arr: number[]): number | null => {
      if (arr.length === 0) return null;
      const sum = arr.reduce((acc, v) => acc + v, 0);
      return Math.round((sum / arr.length) * 10) / 10;
    };

    // Calculate conversions
    const conversions = {
      appliedToScreening: this.calculateConversion(totalReachedScreening, totalApplied),
      appliedToInterview: this.calculateConversion(totalReachedInterview, totalApplied),
      appliedToOffer: this.calculateConversion(totalReachedOffer, totalApplied),
      interviewToOffer: this.calculateConversion(totalReachedOffer, totalReachedInterview),
    };

    // Source distribution
    const totalApps = applications.length;
    const sourceDistribution = Array.from(sourceMap.entries())
      .map(([source, count]) => ({
        source,
        count,
        percentage: totalApps > 0 ? Math.round((count / totalApps) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      funnel: {
        totalApplications: applications.length,
        readyToApply: totalReadyToApply,
        applied: totalApplied,
        screening: totalReachedScreening,
        interview: totalReachedInterview,
        offer: totalReachedOffer,
        conversions,
      },
      timeMetrics: {
        avgDaysToFirstResponse: calcAvg(firstResponseDays),
        avgDaysToInterview: calcAvg(interviewDays),
        avgDaysToOutcome: calcAvg(outcomeDays),
        avgActiveAgingDays: calcAvg(activeAgingDays),
        sampleSizes: {
          firstResponse: firstResponseDays.length,
          interview: interviewDays.length,
          outcome: outcomeDays.length,
          active: activeAgingDays.length,
        },
      },
      sourceDistribution,
      statusCounts,
    };
  }
}
