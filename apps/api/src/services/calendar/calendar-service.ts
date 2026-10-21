import { eq, and, desc, inArray } from 'drizzle-orm';
import {
  type Database,
  calendarAccounts,
  interviewCalendarLinks,
  applicationInterviews,
  interviewPreparationBriefs,
  applications,
  jobs,
  applicationLifecycleEvents,
  type CalendarAccount,
} from '@job-agent/database';
import {
  AppError,
  createLogger,
  type Logger,
  CalendarProviderType,
  CalendarAccountStatus,
  CalendarScopeLevel,
  AvailabilityStatus,
  ConflictSeverity,
  InterviewSchedulingStatus,
  type CalendarAccountDto,
  type CalendarInfo,
  type BusySlot,
  type AvailabilityResult,
  type CalendarEventDto,
  type CreateCalendarEventRequest,
  type ConflictResult,
  type ConflictItem,
  type InterviewCalendarLinkDto,
  type InterviewDashboardMetrics,
  type AvailabilityQueryRequest,
  type CreateCalendarEventForInterviewRequest,
  type CalendarAccountSelectionRequest,
  type ScheduledInterviewWorkspaceItemDto,
  type ChecklistItem,
} from '@job-agent/shared';
import type { CalendarProvider, CalendarOAuthTokens } from './calendar-provider.js';
import type { TokenCryptoService } from '../email/token-crypto-service.js';

export interface CalendarServiceOptions {
  db: Database;
  cryptoService: TokenCryptoService;
  googleProvider: CalendarProvider;
  fixtureProvider: CalendarProvider;
  logger?: Logger;
}

export class CalendarService {
  private db: Database;
  private cryptoService: TokenCryptoService;
  private googleProvider: CalendarProvider;
  private fixtureProvider: CalendarProvider;
  private logger: Logger;

  constructor(options: CalendarServiceOptions) {
    this.db = options.db;
    this.cryptoService = options.cryptoService;
    this.googleProvider = options.googleProvider;
    this.fixtureProvider = options.fixtureProvider;
    this.logger = options.logger ?? createLogger({ service: 'api:calendar' });
  }

  private getProvider(provider: CalendarProviderType): CalendarProvider {
    if (provider === CalendarProviderType.FIXTURE) {
      return this.fixtureProvider;
    }
    return this.googleProvider;
  }

  private mapAccountDto(row: CalendarAccount): CalendarAccountDto {
    return {
      id: row.id,
      provider: row.provider as CalendarProviderType,
      emailAddress: row.emailAddress,
      status: row.status as CalendarAccountStatus,
      scopeLevel: row.scopeLevel as CalendarScopeLevel,
      selectedCalendarIds: row.selectedCalendarIds as string[],
      defaultCalendarId: row.defaultCalendarId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  // ─── OAuth & Connection Management ─────────────────────────────────────

  public getAuthorizationUrl(
    provider: CalendarProviderType,
    state: string,
    scopeLevel: 'AVAILABILITY' | 'EVENT_MANAGEMENT' = 'EVENT_MANAGEMENT',
  ): string {
    const prov = this.getProvider(provider);
    if (provider === CalendarProviderType.GOOGLE && !prov.isConfigured) {
      throw AppError.badRequest('Google Calendar OAuth credentials are not configured');
    }
    return prov.getAuthorizationUrl(state, scopeLevel);
  }

  public async connectAccount(
    userId: string,
    provider: CalendarProviderType,
    code: string,
    scopeLevel: 'AVAILABILITY' | 'EVENT_MANAGEMENT' = 'EVENT_MANAGEMENT',
  ): Promise<CalendarAccountDto> {
    const prov = this.getProvider(provider);
    const exchange = await prov.exchangeCodeForTokens(code);

    const encryptedTokens = this.cryptoService.encrypt(
      exchange.tokens as unknown as Record<string, unknown>,
    );

    if (
      scopeLevel === 'EVENT_MANAGEMENT' &&
      !exchange.grantedScopes.includes('https://www.googleapis.com/auth/calendar.events')
    )
      throw AppError.forbidden('Calendar event-management scope was not granted.');
    // Fetch user's calendars to establish default selection
    let defaultCalendarId: string | null = null;
    let availableCalendarIds: string[] = [];
    try {
      const cals =
        scopeLevel === 'EVENT_MANAGEMENT' &&
        (provider === 'FIXTURE' ||
          exchange.grantedScopes.some((scope) =>
            [
              'https://www.googleapis.com/auth/calendar.readonly',
              'https://www.googleapis.com/auth/calendar',
              'https://www.googleapis.com/auth/calendar.calendarlist',
              'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
            ].includes(scope),
          ))
          ? await prov.getCalendars(exchange.tokens)
          : [];
      availableCalendarIds = cals.map((c) => c.id);
      const primaryCal = cals.find((c) => c.primary) || cals[0];
      if (primaryCal) {
        defaultCalendarId = primaryCal.id;
      }
    } catch {
      this.logger.warn('Failed to pre-fetch calendars on connect', {});
    }

    if (!defaultCalendarId) {
      defaultCalendarId = 'primary';
      availableCalendarIds = ['primary'];
    }
    // Check if account already exists
    const [existing] = await this.db
      .select()
      .from(calendarAccounts)
      .where(
        and(
          eq(calendarAccounts.userId, userId),
          eq(calendarAccounts.emailAddress, exchange.emailAddress),
        ),
      )
      .limit(1);

    if (existing) {
      const [updated] = await this.db
        .update(calendarAccounts)
        .set({
          provider,
          encryptedTokens,
          grantedScopes: exchange.grantedScopes,
          scopeLevel,
          status: CalendarAccountStatus.CONNECTED,
          tokenExpiresAt: exchange.tokenExpiresAt ?? null,
          selectedCalendarIds:
            existing.provider === provider && existing.selectedCalendarIds.length > 0
              ? existing.selectedCalendarIds
              : availableCalendarIds,
          defaultCalendarId:
            existing.provider === provider
              ? existing.defaultCalendarId || defaultCalendarId
              : defaultCalendarId,
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(calendarAccounts.id, existing.id))
        .returning();

      if (!updated) {
        throw AppError.internal('Failed to update calendar account');
      }

      this.logger.info('Calendar account reconnected', {
        accountId: updated.id,
        provider,
      });
      return this.mapAccountDto(updated);
    }

    const [created] = await this.db
      .insert(calendarAccounts)
      .values({
        userId,
        provider,
        emailAddress: exchange.emailAddress,
        encryptedTokens,
        grantedScopes: exchange.grantedScopes,
        scopeLevel,
        status: CalendarAccountStatus.CONNECTED,
        tokenExpiresAt: exchange.tokenExpiresAt ?? null,
        selectedCalendarIds: availableCalendarIds,
        defaultCalendarId,
        errorMessage: null,
      })
      .returning();

    if (!created) {
      throw AppError.internal('Failed to create calendar account');
    }

    this.logger.info('New calendar account connected', {
      accountId: created.id,
      provider,
    });
    return this.mapAccountDto(created);
  }

  public async listAccounts(userId: string): Promise<CalendarAccountDto[]> {
    const rows = await this.db
      .select()
      .from(calendarAccounts)
      .where(eq(calendarAccounts.userId, userId))
      .orderBy(desc(calendarAccounts.createdAt));

    return rows.map((r) => this.mapAccountDto(r));
  }

  public async getAccount(id: string, userId: string): Promise<CalendarAccountDto> {
    const [row] = await this.db
      .select()
      .from(calendarAccounts)
      .where(and(eq(calendarAccounts.id, id), eq(calendarAccounts.userId, userId)))
      .limit(1);

    if (!row) {
      throw AppError.notFound(`Calendar account ${id} not found`);
    }

    return this.mapAccountDto(row);
  }

  public async disconnectAccount(id: string, userId: string, purge = false): Promise<void> {
    const [account] = await this.db
      .select()
      .from(calendarAccounts)
      .where(and(eq(calendarAccounts.id, id), eq(calendarAccounts.userId, userId)))
      .limit(1);

    if (!account) {
      throw AppError.notFound(`Calendar account ${id} not found`);
    }

    if (purge) {
      await this.db.delete(calendarAccounts).where(eq(calendarAccounts.id, id));
      this.logger.info('Calendar account purged', { accountId: id });
    } else {
      const neutralized = this.cryptoService.encrypt({ disconnected: true });
      await this.db
        .update(calendarAccounts)
        .set({
          status: CalendarAccountStatus.DISCONNECTED,
          encryptedTokens: neutralized,
          updatedAt: new Date(),
        })
        .where(eq(calendarAccounts.id, id));

      this.logger.info('Calendar account marked disconnected', { accountId: id });
    }
  }

  private async getValidTokens(
    account: CalendarAccount,
  ): Promise<{ tokens: CalendarOAuthTokens; prov: CalendarProvider }> {
    const [current] = await this.db
      .select()
      .from(calendarAccounts)
      .where(and(eq(calendarAccounts.id, account.id), eq(calendarAccounts.userId, account.userId)));
    if (
      !current ||
      current.status !== CalendarAccountStatus.CONNECTED ||
      current.encryptedTokens !== account.encryptedTokens
    )
      throw AppError.forbidden('Calendar authorization changed. Reconnect before continuing.');
    const prov = this.getProvider(account.provider as CalendarProviderType);
    let tokens: CalendarOAuthTokens;
    try {
      tokens = this.cryptoService.decrypt<CalendarOAuthTokens>(account.encryptedTokens);
    } catch {
      await this.db
        .update(calendarAccounts)
        .set({
          status: CalendarAccountStatus.REAUTH_REQUIRED,
          errorMessage: 'Token decryption failed',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(calendarAccounts.id, account.id),
            eq(calendarAccounts.userId, account.userId),
            eq(calendarAccounts.status, 'CONNECTED'),
            eq(calendarAccounts.encryptedTokens, account.encryptedTokens),
          ),
        );
      throw AppError.unauthorized('Calendar credentials require re-authentication');
    }

    // Refresh if expired
    if (
      account.tokenExpiresAt &&
      new Date(account.tokenExpiresAt).getTime() <= Date.now() + 60000
    ) {
      try {
        const refreshed = await prov.refreshTokens(tokens);
        tokens = refreshed.tokens;
        const reEncrypted = this.cryptoService.encrypt(
          tokens as unknown as Record<string, unknown>,
        );
        const refreshedRows = await this.db
          .update(calendarAccounts)
          .set({
            encryptedTokens: reEncrypted,
            tokenExpiresAt: refreshed.tokenExpiresAt ?? null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(calendarAccounts.id, account.id),
              eq(calendarAccounts.userId, account.userId),
              eq(calendarAccounts.status, 'CONNECTED'),
              eq(calendarAccounts.encryptedTokens, account.encryptedTokens),
            ),
          )
          .returning();
        if (!refreshedRows.length)
          throw AppError.forbidden('Calendar authorization changed during refresh.');
      } catch {
        await this.db
          .update(calendarAccounts)
          .set({
            status: CalendarAccountStatus.REAUTH_REQUIRED,
            errorMessage: 'Calendar authorization expired. Reconnect to continue.',
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(calendarAccounts.id, account.id),
              eq(calendarAccounts.userId, account.userId),
              eq(calendarAccounts.status, 'CONNECTED'),
              eq(calendarAccounts.encryptedTokens, account.encryptedTokens),
            ),
          );
        throw AppError.unauthorized('Calendar credentials expired; re-authentication required');
      }
    }

    return { tokens, prov };
  }

  public async getCalendarsForAccount(id: string, userId: string): Promise<CalendarInfo[]> {
    const [account] = await this.db
      .select()
      .from(calendarAccounts)
      .where(and(eq(calendarAccounts.id, id), eq(calendarAccounts.userId, userId)))
      .limit(1);

    if (!account) {
      throw AppError.notFound(`Calendar account ${id} not found`);
    }

    if (account.status !== CalendarAccountStatus.CONNECTED) {
      throw AppError.badRequest(`Calendar account is ${account.status}`);
    }

    if (
      account.provider === 'GOOGLE' &&
      !account.grantedScopes.some((scope) =>
        [
          'https://www.googleapis.com/auth/calendar.readonly',
          'https://www.googleapis.com/auth/calendar',
          'https://www.googleapis.com/auth/calendar.calendarlist',
          'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
        ].includes(scope),
      )
    )
      throw AppError.forbidden(
        'Calendar-list access was not granted. Use the primary calendar or an explicitly selected calendar ID.',
      );
    const { tokens, prov } = await this.getValidTokens(account);
    return prov.getCalendars(tokens);
  }

  public async updateCalendarSelection(
    id: string,
    userId: string,
    req: CalendarAccountSelectionRequest,
  ): Promise<CalendarAccountDto> {
    const [account] = await this.db
      .select()
      .from(calendarAccounts)
      .where(and(eq(calendarAccounts.id, id), eq(calendarAccounts.userId, userId)))
      .limit(1);

    if (!account) {
      throw AppError.notFound(`Calendar account ${id} not found`);
    }

    const [updated] = await this.db
      .update(calendarAccounts)
      .set({
        selectedCalendarIds: req.selectedCalendarIds,
        defaultCalendarId: req.defaultCalendarId || account.defaultCalendarId,
        updatedAt: new Date(),
      })
      .where(eq(calendarAccounts.id, id))
      .returning();

    if (!updated) {
      throw AppError.internal('Failed to update calendar selection');
    }

    return this.mapAccountDto(updated);
  }

  // ─── Availability & Conflict Detection ─────────────────────────────────

  public async getCombinedAvailability(
    userId: string,
    req: AvailabilityQueryRequest,
  ): Promise<AvailabilityResult> {
    const connectedAccounts = await this.db
      .select()
      .from(calendarAccounts)
      .where(
        and(
          eq(calendarAccounts.userId, userId),
          eq(calendarAccounts.status, CalendarAccountStatus.CONNECTED),
        ),
      );

    const allBusySlots: BusySlot[] = [];
    const queriedCalendars: string[] = [];
    const failedCalendars: string[] = [];

    for (const account of connectedAccounts) {
      try {
        const { tokens, prov } = await this.getValidTokens(account);
        const calendarIds =
          req.calendarIds && req.calendarIds.length > 0
            ? req.calendarIds
            : account.selectedCalendarIds.length > 0
              ? account.selectedCalendarIds
              : [account.defaultCalendarId || 'primary'];

        queriedCalendars.push(...calendarIds);
        const result = await prov.getAvailability(
          tokens,
          calendarIds,
          req.windowStart,
          req.windowEnd,
          req.timezone,
        );

        allBusySlots.push(...result.busySlots);
        failedCalendars.push(...result.failedCalendars);
      } catch {
        this.logger.warn('Failed to query availability for account', {
          accountId: account.id,
        });
        failedCalendars.push(account.emailAddress);
      }
    }

    // Sort busy slots chronologically
    allBusySlots.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    // Deduplicate or merge overlapping slots
    const mergedBusySlots: BusySlot[] = [];
    for (const slot of allBusySlots) {
      const last = mergedBusySlots[mergedBusySlots.length - 1];
      if (last && new Date(slot.start).getTime() <= new Date(last.end).getTime()) {
        if (new Date(slot.end).getTime() > new Date(last.end).getTime()) {
          last.end = slot.end;
        }
      } else {
        mergedBusySlots.push({ ...slot });
      }
    }

    return {
      status: mergedBusySlots.length > 0 ? AvailabilityStatus.BUSY : AvailabilityStatus.AVAILABLE,
      busySlots: mergedBusySlots,
      queriedCalendars,
      failedCalendars,
      isPartial: failedCalendars.length > 0,
      timezone: req.timezone,
      windowStart: req.windowStart,
      windowEnd: req.windowEnd,
    };
  }

  public async checkInterviewConflict(
    userId: string,
    scheduledAt: Date,
    durationMinutes = 60,
    timezone = 'UTC',
    excludeInterviewId?: string,
  ): Promise<ConflictResult> {
    const windowStart = scheduledAt.toISOString();
    const windowEnd = new Date(scheduledAt.getTime() + durationMinutes * 60000).toISOString();
    const conflicts: ConflictItem[] = [];
    const warnings: string[] = [];

    // 1. Check external calendar busy slots
    const avail = await this.getCombinedAvailability(userId, {
      windowStart,
      windowEnd,
      timezone,
    });

    const startMs = scheduledAt.getTime();
    const endMs = startMs + durationMinutes * 60000;

    for (const busy of avail.busySlots) {
      const bStart = new Date(busy.start).getTime();
      const bEnd = new Date(busy.end).getTime();
      if (bStart < endMs && bEnd > startMs) {
        conflicts.push({
          type: 'CALENDAR_EVENT',
          description: `Conflict with calendar commitment from ${busy.start} to ${busy.end}`,
          conflictStart: busy.start,
          conflictEnd: busy.end,
        });
      }
    }

    // 2. Check other tracked interviews in CRM for this candidate
    const userApplications = await this.db
      .select({ id: applications.id })
      .from(applications)
      .where(eq(applications.userId, userId));

    const appIds = userApplications.map((a) => a.id);
    if (appIds.length > 0) {
      const existingInterviews = await this.db
        .select()
        .from(applicationInterviews)
        .where(
          and(
            inArray(applicationInterviews.applicationId, appIds),
            eq(applicationInterviews.status, 'SCHEDULED'),
          ),
        );

      for (const item of existingInterviews) {
        if (excludeInterviewId && item.id === excludeInterviewId) continue;
        const itemStart = new Date(item.scheduledAt).getTime();
        const itemDur = item.durationMinutes || 60;
        const itemEnd = itemStart + itemDur * 60000;

        if (itemStart < endMs && itemEnd > startMs) {
          conflicts.push({
            type: 'TRACKED_INTERVIEW',
            description: `Conflict with existing interview "${item.roundTitle}" (${item.scheduledAt.toISOString()})`,
            conflictStart: item.scheduledAt.toISOString(),
            conflictEnd: new Date(itemEnd).toISOString(),
          });
        }
      }
    }

    // 3. Propose alternative slots if conflicts found
    const hasConflict = conflicts.length > 0;
    const alternatives = hasConflict
      ? [
          {
            start: new Date(endMs + 30 * 60000).toISOString(),
            end: new Date(endMs + (30 + durationMinutes) * 60000).toISOString(),
          },
          {
            start: new Date(scheduledAt.getTime() + 86400 * 1000).toISOString(),
            end: new Date(
              scheduledAt.getTime() + 86400 * 1000 + durationMinutes * 60000,
            ).toISOString(),
          },
        ]
      : undefined;

    return {
      hasConflict,
      severity: hasConflict ? ConflictSeverity.CONFLICT : ConflictSeverity.NONE,
      conflicts,
      warnings,
      availableAlternatives: alternatives,
    };
  }

  // ─── Interview Calendar Event Booking ──────────────────────────────────

  public async assertInterviewOwnership(
    userId: string,
    applicationId: string,
    interviewId: string,
  ) {
    const [row] = await this.db
      .select({ id: applicationInterviews.id })
      .from(applicationInterviews)
      .innerJoin(applications, eq(applicationInterviews.applicationId, applications.id))
      .where(
        and(
          eq(applicationInterviews.id, interviewId),
          eq(applications.id, applicationId),
          eq(applications.userId, userId),
          eq(applicationInterviews.userId, userId),
        ),
      );
    if (!row) throw AppError.notFound('Interview not found in this application.');
  }
  private assertCalendarWrite(account: CalendarAccount) {
    if (
      account.status !== 'CONNECTED' ||
      account.scopeLevel !== 'EVENT_MANAGEMENT' ||
      !account.grantedScopes.includes('https://www.googleapis.com/auth/calendar.events')
    )
      throw AppError.forbidden(
        'Calendar event-management permission is required. Availability access cannot change events.',
      );
  }
  public async reconcileCalendarCreation(
    userId: string,
    applicationId: string,
    interviewId: string,
    reason: string,
  ) {
    if (!reason.trim())
      throw AppError.badRequest('Record why the calendar was verified before retrying.');
    await this.assertInterviewOwnership(userId, applicationId, interviewId);
    await this.db.transaction(async (tx) => {
      const [interview] = await tx
        .select()
        .from(applicationInterviews)
        .where(eq(applicationInterviews.id, interviewId))
        .for('update');
      const [link] = await tx
        .select()
        .from(interviewCalendarLinks)
        .where(eq(interviewCalendarLinks.interviewId, interviewId));
      if (
        interview?.schedulingStatus === 'EVENT_PENDING' &&
        interview.updatedAt.getTime() > Date.now() - 15 * 60_000
      )
        throw AppError.conflict(
          'Calendar write may still be in progress. Wait for the outcome before reconciling.',
        );
      if (link || !['EVENT_PENDING', 'EVENT_UNCERTAIN'].includes(interview!.schedulingStatus))
        throw AppError.conflict(
          'Only an unlinked uncertain creation can be reconciled as not created.',
        );
      await tx
        .update(applicationInterviews)
        .set({ schedulingStatus: 'NEEDS_CONFIRMATION', updatedAt: new Date() })
        .where(eq(applicationInterviews.id, interviewId));
      await tx.insert(applicationLifecycleEvents).values({
        userId,
        applicationId,
        eventType: 'NOTE_ADDED',
        actor: 'USER',
        note: reason,
        safeMetadata: { interviewId, action: 'CALENDAR_NOT_CREATED_RECONCILED' },
      });
    });
  }

  public async createCalendarEventForInterview(
    userId: string,
    applicationId: string,
    interviewId: string,
    req: CreateCalendarEventForInterviewRequest,
  ): Promise<{ link: InterviewCalendarLinkDto; event: CalendarEventDto }> {
    if (req.userConfirmed !== true)
      throw AppError.forbidden('Confirm this calendar write before continuing.');
    try {
      new Intl.DateTimeFormat('en', { timeZone: req.timezone });
    } catch {
      throw AppError.badRequest('Choose a valid IANA timezone.');
    }
    // 1. Validate application and interview
    const [appRow] = await this.db
      .select({ app: applications, job: jobs })
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))
      .limit(1);

    if (!appRow) {
      throw AppError.notFound(`Application ${applicationId} not found`);
    }

    const [interview] = await this.db
      .select()
      .from(applicationInterviews)
      .where(
        and(
          eq(applicationInterviews.id, interviewId),
          eq(applicationInterviews.applicationId, applicationId),
        ),
      )
      .limit(1);

    if (!interview) {
      throw AppError.notFound(`Interview ${interviewId} not found`);
    }

    // 2. Check if already linked
    const [existingLink] = await this.db
      .select()
      .from(interviewCalendarLinks)
      .where(eq(interviewCalendarLinks.interviewId, interviewId))
      .limit(1);

    if (existingLink) {
      const [account] = await this.db
        .select()
        .from(calendarAccounts)
        .where(
          and(
            eq(calendarAccounts.id, existingLink.calendarAccountId),
            eq(calendarAccounts.userId, userId),
          ),
        )
        .limit(1);

      if (account) {
        this.assertCalendarWrite(account);
        const { tokens, prov } = await this.getValidTokens(account);
        const existingEvent = await prov.getEvent(
          tokens,
          existingLink.calendarId,
          existingLink.externalEventId,
        );
        if (existingEvent) {
          return {
            link: {
              id: existingLink.id,
              interviewId: existingLink.interviewId,
              calendarAccountId: existingLink.calendarAccountId,
              calendarId: existingLink.calendarId,
              externalEventId: existingLink.externalEventId,
              eventUrl: existingLink.eventUrl,
              etag: existingLink.etag,
              lastSyncedAt: existingLink.lastSyncedAt.toISOString(),
              createdAt: existingLink.createdAt.toISOString(),
            },
            event: existingEvent,
          };
        }
      }
    }

    if (existingLink)
      throw AppError.conflict(
        'The linked event is unavailable. Verify the calendar before creating another event.',
      );
    // 3. Find connected account
    const [account] = await this.db
      .select()
      .from(calendarAccounts)
      .where(
        and(
          eq(calendarAccounts.userId, userId),
          eq(calendarAccounts.status, CalendarAccountStatus.CONNECTED),
          eq(calendarAccounts.scopeLevel, 'EVENT_MANAGEMENT'),
        ),
      )
      .orderBy(desc(calendarAccounts.createdAt))
      .limit(1);

    if (!account) {
      throw AppError.badRequest(
        'No connected calendar account found. Please connect calendar first.',
      );
    }

    this.assertCalendarWrite(account);
    const { tokens, prov } = await this.getValidTokens(account);
    const duration = interview.durationMinutes || 60;
    const startIso = interview.scheduledAt.toISOString();
    const endIso = new Date(interview.scheduledAt.getTime() + duration * 60000).toISOString();

    let description = `Role: ${appRow.job.title}\nCompany: ${appRow.job.company}\nRound: ${interview.roundTitle}\nType: ${interview.interviewType}`;
    if (interview.interviewerName) {
      description += `\nInterviewer: ${interview.interviewerName}`;
    }
    if (req.includePreparationNotes && interview.notes) {
      description += `\nNotes: ${interview.notes}`;
    }

    if (req.includePreparationNotes) {
      const [prepBrief] = await this.db
        .select()
        .from(interviewPreparationBriefs)
        .where(eq(interviewPreparationBriefs.interviewId, interviewId))
        .limit(1);
      if (prepBrief && prepBrief.roleSummary) {
        description += `\n\n--- Preparation Summary ---\n${prepBrief.roleSummary}`;
      }
    }

    const createReq: CreateCalendarEventRequest = {
      calendarId: req.calendarId || account.defaultCalendarId || 'primary',
      summary: `Interview: ${appRow.job.company} — ${appRow.job.title} (${interview.roundTitle})`,
      description,
      start: startIso,
      end: endIso,
      timezone: req.timezone || interview.timezone || 'UTC',
      location: interview.locationOrUrl || undefined,
      meetingUrl: interview.meetingUrl || undefined,
      createConference: req.createConference === true && !interview.meetingUrl,
    };

    await this.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(applicationInterviews)
        .where(eq(applicationInterviews.id, interviewId))
        .for('update');
      const [linked] = await tx
        .select()
        .from(interviewCalendarLinks)
        .where(eq(interviewCalendarLinks.interviewId, interviewId));
      if (
        !current ||
        linked ||
        ['EVENT_PENDING', 'EVENT_UNCERTAIN'].includes(current.schedulingStatus)
      )
        throw AppError.conflict('Calendar outcome requires verification before another write.');
      if (
        current.updatedAt.getTime() !== interview.updatedAt.getTime() ||
        !['SCHEDULED', 'RESCHEDULED'].includes(current.status)
      )
        throw AppError.conflict('Interview changed. Review the current details before booking.');
      const [activeAccount] = await tx
        .select()
        .from(calendarAccounts)
        .where(and(eq(calendarAccounts.id, account.id), eq(calendarAccounts.userId, userId)));
      if (!activeAccount) throw AppError.notFound('Calendar account not found.');
      this.assertCalendarWrite(activeAccount);
      await tx
        .update(applicationInterviews)
        .set({ schedulingStatus: 'EVENT_PENDING', updatedAt: new Date() })
        .where(eq(applicationInterviews.id, interviewId));
      await tx.insert(applicationLifecycleEvents).values({
        userId,
        applicationId,
        eventType: 'NOTE_ADDED',
        actor: 'USER',
        note: 'Authorized private calendar event creation',
        safeMetadata: {
          interviewId,
          calendarAccountId: account.id,
          calendarId: createReq.calendarId,
        },
      });
    });
    try {
      const event = await prov.createEvent(tokens, createReq.calendarId, createReq);

      // Save link
      const [link] = await this.db
        .insert(interviewCalendarLinks)
        .values({
          interviewId,
          calendarAccountId: account.id,
          calendarId: createReq.calendarId,
          externalEventId: event.externalEventId,
          eventUrl: event.eventUrl ?? null,
          etag: event.etag ?? null,
        })
        .returning();

      if (!link) {
        throw AppError.internal('Failed to create interview calendar link');
      }

      // Update interview record
      await this.db
        .update(applicationInterviews)
        .set({
          schedulingStatus: InterviewSchedulingStatus.CONFIRMED,
          meetingUrl: event.meetingUrl || interview.meetingUrl,
          updatedAt: new Date(),
        })
        .where(eq(applicationInterviews.id, interviewId));

      // Audit log event in application history
      await this.db.insert(applicationLifecycleEvents).values({
        applicationId,
        userId,
        eventType: 'NOTE_ADDED',
        actor: 'SYSTEM',
        note: `Interview synced to calendar (${event.summary})`,
        safeMetadata: {
          interviewId,
          calendarAccountId: account.id,
          externalEventId: event.externalEventId,
          eventUrl: event.eventUrl,
        },
      });

      this.logger.info('Interview synced to calendar event', {
        interviewId,
        externalEventId: event.externalEventId,
      });

      return {
        link: {
          id: link.id,
          interviewId: link.interviewId,
          calendarAccountId: link.calendarAccountId,
          calendarId: link.calendarId,
          externalEventId: link.externalEventId,
          eventUrl: link.eventUrl,
          etag: link.etag,
          lastSyncedAt: link.lastSyncedAt.toISOString(),
          createdAt: link.createdAt.toISOString(),
        },
        event,
      };
    } catch {
      await this.db
        .update(applicationInterviews)
        .set({ schedulingStatus: 'EVENT_UNCERTAIN', updatedAt: new Date() })
        .where(eq(applicationInterviews.id, interviewId));
      throw AppError.conflict(
        'Calendar creation may have occurred. Verify the calendar before retrying.',
      );
    }
  }

  public async getInterviewCalendarLink(
    interviewId: string,
    userId: string,
  ): Promise<{ link: InterviewCalendarLinkDto; event: CalendarEventDto } | null> {
    const [row] = await this.db
      .select({ link: interviewCalendarLinks, account: calendarAccounts })
      .from(interviewCalendarLinks)
      .innerJoin(
        applicationInterviews,
        eq(applicationInterviews.id, interviewCalendarLinks.interviewId),
      )
      .innerJoin(applications, eq(applications.id, applicationInterviews.applicationId))
      .innerJoin(
        calendarAccounts,
        eq(interviewCalendarLinks.calendarAccountId, calendarAccounts.id),
      )
      .where(
        and(
          eq(interviewCalendarLinks.interviewId, interviewId),
          eq(calendarAccounts.userId, userId),
          eq(applications.userId, userId),
          eq(applicationInterviews.userId, userId),
        ),
      )
      .limit(1);

    if (!row) return null;

    this.assertCalendarWrite(row.account);
    const { tokens, prov } = await this.getValidTokens(row.account);
    const event = await prov.getEvent(tokens, row.link.calendarId, row.link.externalEventId);
    if (!event) return null;

    return {
      link: {
        id: row.link.id,
        interviewId: row.link.interviewId,
        calendarAccountId: row.link.calendarAccountId,
        calendarId: row.link.calendarId,
        externalEventId: row.link.externalEventId,
        eventUrl: row.link.eventUrl,
        etag: row.link.etag,
        lastSyncedAt: row.link.lastSyncedAt.toISOString(),
        createdAt: row.link.createdAt.toISOString(),
      },
      event,
    };
  }

  public async deleteInterviewCalendarEvent(
    interviewId: string,
    userId: string,
    userConfirmed = false,
  ): Promise<void> {
    if (!userConfirmed)
      throw AppError.forbidden('Confirm this calendar deletion before continuing.');
    const [row] = await this.db
      .select({ link: interviewCalendarLinks, account: calendarAccounts })
      .from(interviewCalendarLinks)
      .innerJoin(
        applicationInterviews,
        eq(applicationInterviews.id, interviewCalendarLinks.interviewId),
      )
      .innerJoin(applications, eq(applications.id, applicationInterviews.applicationId))
      .innerJoin(
        calendarAccounts,
        eq(interviewCalendarLinks.calendarAccountId, calendarAccounts.id),
      )
      .where(
        and(
          eq(interviewCalendarLinks.interviewId, interviewId),
          eq(calendarAccounts.userId, userId),
          eq(applications.userId, userId),
          eq(applicationInterviews.userId, userId),
        ),
      )
      .limit(1);

    if (!row) {
      throw AppError.notFound(`No calendar link found for interview ${interviewId}`);
    }

    this.assertCalendarWrite(row.account);
    const { tokens, prov } = await this.getValidTokens(row.account);
    await prov.deleteEvent(tokens, row.link.calendarId, row.link.externalEventId);
    await this.db.delete(interviewCalendarLinks).where(eq(interviewCalendarLinks.id, row.link.id));

    await this.db
      .update(applicationInterviews)
      .set({
        schedulingStatus: InterviewSchedulingStatus.CANCELLED,
        updatedAt: new Date(),
      })
      .where(eq(applicationInterviews.id, interviewId));

    this.logger.info('Interview calendar event deleted and unlinked', { interviewId });
  }

  // ─── Dashboard Metrics ──────────────────────────────────────────────────

  public async getDashboardMetrics(userId: string): Promise<InterviewDashboardMetrics> {
    const now = new Date();
    const oneWeekFromNow = new Date(now.getTime() + 7 * 86400 * 1000);

    const userApps = await this.db
      .select({ id: applications.id })
      .from(applications)
      .where(eq(applications.userId, userId));

    const appIds = userApps.map((a) => a.id);
    if (appIds.length === 0) {
      const [connected] = await this.db
        .select()
        .from(calendarAccounts)
        .where(
          and(
            eq(calendarAccounts.userId, userId),
            eq(calendarAccounts.status, CalendarAccountStatus.CONNECTED),
          ),
        )
        .limit(1);

      return {
        upcomingInterviews: 0,
        interviewsThisWeek: 0,
        preparationNeeded: 0,
        schedulingConflicts: 0,
        pendingConfirmations: 0,
        overdueFollowUps: 0,
        interviewsCompleted: 0,
        calendarConnected: Boolean(connected),
      };
    }

    const allInterviews = await this.db
      .select()
      .from(applicationInterviews)
      .where(inArray(applicationInterviews.applicationId, appIds));

    let upcomingInterviews = 0;
    let interviewsThisWeek = 0;
    let pendingConfirmations = 0;
    let overdueFollowUps = 0;
    let interviewsCompleted = 0;

    const upcomingInterviewIds: string[] = [];

    for (const item of allInterviews) {
      const schedTime = new Date(item.scheduledAt).getTime();
      if (item.status === 'COMPLETED') {
        interviewsCompleted++;
        if (
          item.debriefExpectedResponseDate &&
          new Date(item.debriefExpectedResponseDate).getTime() < now.getTime()
        ) {
          overdueFollowUps++;
        }
      } else if (item.status === 'SCHEDULED' && schedTime >= now.getTime()) {
        upcomingInterviews++;
        upcomingInterviewIds.push(item.id);
        if (schedTime <= oneWeekFromNow.getTime()) {
          interviewsThisWeek++;
        }
        if (
          item.schedulingStatus === InterviewSchedulingStatus.PROPOSED ||
          item.schedulingStatus === InterviewSchedulingStatus.NEEDS_CONFIRMATION
        ) {
          pendingConfirmations++;
        }
      }
    }

    // Prep needed: upcoming interviews without brief or with isStale = true
    let preparationNeeded = 0;
    if (upcomingInterviewIds.length > 0) {
      const briefs = await this.db
        .select()
        .from(interviewPreparationBriefs)
        .where(inArray(interviewPreparationBriefs.interviewId, upcomingInterviewIds));

      const briefMap = new Map(briefs.map((b) => [b.interviewId, b]));
      for (const id of upcomingInterviewIds) {
        const brief = briefMap.get(id);
        if (!brief || brief.isStale) {
          preparationNeeded++;
        }
      }
    }

    const [connectedAccount] = await this.db
      .select()
      .from(calendarAccounts)
      .where(
        and(
          eq(calendarAccounts.userId, userId),
          eq(calendarAccounts.status, CalendarAccountStatus.CONNECTED),
        ),
      )
      .limit(1);

    return {
      upcomingInterviews,
      interviewsThisWeek,
      preparationNeeded,
      schedulingConflicts: 0, // dynamic query
      pendingConfirmations,
      overdueFollowUps,
      interviewsCompleted,
      calendarConnected: Boolean(connectedAccount),
    };
  }

  // ─── List Scheduled Interviews Workspace ─────────────────────────────────

  async listInterviews(
    userId: string,
    applicationId?: string,
  ): Promise<ScheduledInterviewWorkspaceItemDto[]> {
    const userApplications = await this.db
      .select({
        id: applications.id,
        jobId: applications.jobId,
        company: jobs.company,
        title: jobs.title,
      })
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .where(
        and(
          eq(applications.userId, userId),
          applicationId ? eq(applications.id, applicationId) : undefined,
        ),
      );

    if (userApplications.length === 0) {
      return [];
    }

    const appIds = userApplications.map((a) => a.id);
    const appMap = new Map(userApplications.map((a) => [a.id, a]));

    const interviewRows = await this.db
      .select()
      .from(applicationInterviews)
      .where(inArray(applicationInterviews.applicationId, appIds))
      .orderBy(desc(applicationInterviews.scheduledAt));

    if (interviewRows.length === 0) {
      return [];
    }

    const interviewIds = interviewRows.map((r) => r.id);

    const [links, briefs] = await Promise.all([
      this.db
        .select()
        .from(interviewCalendarLinks)
        .where(inArray(interviewCalendarLinks.interviewId, interviewIds)),
      this.db
        .select()
        .from(interviewPreparationBriefs)
        .where(inArray(interviewPreparationBriefs.interviewId, interviewIds)),
    ]);

    const linkMap = new Map(
      links.map((l) => [
        l.interviewId,
        {
          id: l.id,
          interviewId: l.interviewId,
          calendarAccountId: l.calendarAccountId,
          calendarId: l.calendarId,
          externalEventId: l.externalEventId,
          eventUrl: l.eventUrl,
          etag: l.etag,
          lastSyncedAt: l.lastSyncedAt.toISOString(),
          createdAt: l.createdAt.toISOString(),
        },
      ]),
    );
    const briefMap = new Map(briefs.map((b) => [b.interviewId, b]));

    return interviewRows.map((interview) => {
      const app = appMap.get(interview.applicationId)!;
      const link = linkMap.get(interview.id) || null;
      const briefRow = briefMap.get(interview.id);

      let prepBriefDto = null;
      if (briefRow) {
        const checklist = (briefRow.preparationChecklist as ChecklistItem[]) || [];
        const completed = checklist.filter((item) => item.isCompleted).length;
        prepBriefDto = {
          id: briefRow.id,
          isStale: briefRow.isStale,
          createdAt: briefRow.createdAt.toISOString(),
          checklistProgress: {
            total: checklist.length,
            completed,
          },
        };
      }

      return {
        interview: {
          id: interview.id,
          applicationId: interview.applicationId,
          roundTitle: interview.roundTitle,
          interviewType: interview.interviewType,
          status: interview.status,
          schedulingStatus: interview.schedulingStatus,
          scheduledAt: interview.scheduledAt.toISOString(),
          durationMinutes: interview.durationMinutes,
          timezone: interview.timezone,
          locationOrUrl: interview.locationOrUrl,
          meetingUrl: interview.meetingUrl,
          interviewerName: interview.interviewerName,
          contactId: interview.contactId,
          notes: interview.notes,
          feedback: interview.feedback,
          debriefQuestionsAsked: interview.debriefQuestionsAsked,
          debriefTopicsDiscussed: interview.debriefTopicsDiscussed,
          debriefObservations: interview.debriefObservations,
          debriefFollowUpCommitments: interview.debriefFollowUpCommitments,
          debriefConcerns: interview.debriefConcerns,
          debriefExpectedNextStep: interview.debriefExpectedNextStep,
          debriefExpectedResponseDate: interview.debriefExpectedResponseDate
            ? interview.debriefExpectedResponseDate.toISOString()
            : null,
          debriefPrivateNotes: interview.debriefPrivateNotes,
          createdAt: interview.createdAt.toISOString(),
          updatedAt: interview.updatedAt.toISOString(),
        },
        application: {
          id: app.id,
          companyName: app.company,
          jobTitle: app.title,
          jobId: app.jobId,
        },
        calendarLink: link,
        preparationBrief: prepBriefDto,
      };
    });
  }
}
