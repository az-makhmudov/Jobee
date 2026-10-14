import { eq, desc, and, or, ilike, count, sql, inArray } from 'drizzle-orm';
import type { Database } from '@job-agent/database';
import {
  jobs,
  jobSources,
  jobRequirements,
  jobSections,
  jobEvents,
  jobMatchAnalyses,
  type Job,
  type NewJob,
} from '@job-agent/database';
import {
  AppError,
  type JobDto,
  type JobSummaryDto,
  type JobMatchSummaryDto,
  type JobListQuery,
  type JobPaginationResult,
  type IngestJobTextRequest,
  type IngestJobUrlRequest,
  type UpdateJobRequest,
  type JobDashboardMetricsDto,
  type JobState,
  type JobProvider,
  type WorkplaceType,
  type EmploymentType,
  type SeniorityLevel,
  type PayPeriod,
  type RequirementCategory,
  type RequirementStrength,
  type SectionType,
  type JobEventType,
  sanitizeJobHtml,
} from '@job-agent/shared';
import { HttpRetrievalService } from './http-retrieval-service.js';
import { ExtractorRegistry } from '../extractors/extractor-registry.js';
import { JobNormalizerService } from './job-normalizer-service.js';
import type { RawExtractedJob } from '../extractors/types.js';

export class JobService {
  private readonly retrievalService: HttpRetrievalService;
  private readonly extractorRegistry: ExtractorRegistry;
  private readonly normalizerService: JobNormalizerService;

  constructor(
    private readonly db: Database,
    options?: {
      retrievalService?: HttpRetrievalService;
      extractorRegistry?: ExtractorRegistry;
      normalizerService?: JobNormalizerService;
    },
  ) {
    this.retrievalService = options?.retrievalService ?? new HttpRetrievalService();
    this.extractorRegistry = options?.extractorRegistry ?? new ExtractorRegistry();
    this.normalizerService = options?.normalizerService ?? new JobNormalizerService();
  }

  // --- Primary User Resolution ---
  public async getPrimaryUserId(): Promise<string> {
    const { getOrCreatePrimaryUser } = await import('@job-agent/database');
    const user = await getOrCreatePrimaryUser(this.db);
    return user.id;
  }

  // --- Ingestion: Pasted Text ---
  public async ingestText(
    userId: string,
    req: IngestJobTextRequest & { provider?: JobProvider },
  ): Promise<{ job: JobDto; isDuplicate: boolean; message?: string }> {
    if (!req.text || req.text.trim().length < 20) {
      throw AppError.badRequest('Pasted job text must be at least 20 characters');
    }

    const provider: JobProvider = req.provider ?? 'MANUAL';

    const manualExtractor = this.extractorRegistry.getManualExtractor();
    const raw = manualExtractor.extract(req.text, {
      title: req.title,
      company: req.company,
      url: req.url,
    });

    const norm = this.normalizerService.normalize(raw);

    // Deduplication check
    const existing = await this.findDuplicateJob(userId, {
      contentHash: norm.contentHash,
      canonicalUrl: norm.canonicalUrl,
    });

    if (existing) {
      // Record duplicate source provenance
      await this.db.insert(jobSources).values({
        jobId: existing.id,
        userId,
        provider,
        ingestionMethod: 'PASTE_TEXT',
        sourceUrl: req.url || null,
        canonicalUrl: norm.canonicalUrl,
        rawTitle: raw.title || null,
        rawCompany: raw.company || null,
        rawLocation: raw.location || null,
        rawDescription: raw.descriptionText,
        contentHash: norm.contentHash,
        ingestionStatus: 'DUPLICATE',
        parserVersion: '1.0.0',
        retrievedAt: new Date(),
      });

      await this.recordJobEvent(userId, existing.id, 'JOB_DUPLICATE_DETECTED', [], {
        method: 'PASTE_TEXT',
        contentHash: norm.contentHash,
      });

      const fullDto = await this.getJobById(userId, existing.id);
      return {
        job: fullDto,
        isDuplicate: true,
        message: 'Identical job content already exists in Job Inbox',
      };
    }

    // Persist new canonical job
    const [createdJob] = await this.db
      .insert(jobs)
      .values({
        userId,
        state: 'INGESTED',
        title: norm.title,
        company: norm.company,
        description: raw.descriptionText,
        descriptionHtml: sanitizeJobHtml(
          raw.descriptionHtml || `<p>${raw.descriptionText.replace(/\n/g, '<br/>')}</p>`,
        ),
        locationText: norm.locationText,
        city: norm.city,
        region: norm.region,
        country: norm.country,
        workplaceType: norm.workplaceType,
        employmentType: norm.employmentType,
        seniority: norm.seniority,
        department: norm.department,
        minSalary: norm.minSalary,
        maxSalary: norm.maxSalary,
        currency: norm.currency,
        payPeriod: norm.payPeriod,
        compensationRaw: norm.compensationRaw,
        originalUrl: req.url || null,
        canonicalUrl: norm.canonicalUrl,
        provider,
        contentHash: norm.contentHash,
        isDuplicate: false,
      })
      .returning();

    // Persist source record
    const [createdSource] = await this.db
      .insert(jobSources)
      .values({
        jobId: createdJob!.id,
        userId,
        provider,
        ingestionMethod: 'PASTE_TEXT',
        sourceUrl: req.url || null,
        canonicalUrl: norm.canonicalUrl,
        rawTitle: raw.title || null,
        rawCompany: raw.company || null,
        rawLocation: raw.location || null,
        rawDescription: raw.descriptionText,
        rawPayload: null, // Raw HTML payload discarded; plain text and metadata retained
        contentHash: norm.contentHash,
        ingestionStatus: 'COMPLETED',
        parserVersion: '1.0.0',
        retrievedAt: new Date(),
      })
      .returning();

    // Persist requirements with source context
    if (raw.requirements && raw.requirements.length > 0) {
      await this.db.insert(jobRequirements).values(
        raw.requirements.map((r, i) => ({
          jobId: createdJob!.id,
          userId,
          sourceId: createdSource?.id || null,
          sourceSection: r.sourceSection || null,
          rawText: r.rawText,
          category: r.category || 'OTHER',
          requirementStrength: r.strength || 'UNKNOWN',
          displayOrder: i,
        })),
      );
    }

    // Persist sections
    if (raw.sections && raw.sections.length > 0) {
      await this.db.insert(jobSections).values(
        raw.sections.map((s, i) => ({
          jobId: createdJob!.id,
          userId,
          sectionType: s.type,
          title: s.title,
          content: s.content,
          displayOrder: i,
        })),
      );
    }

    await this.recordJobEvent(
      userId,
      createdJob!.id,
      'JOB_INGESTED',
      ['title', 'company', 'description'],
      { method: 'PASTE_TEXT', provider },
    );

    const fullDto = await this.getJobById(userId, createdJob!.id);
    return { job: fullDto, isDuplicate: false };
  }

  // --- Ingestion: URL Import ---
  public async ingestUrl(
    userId: string,
    req: IngestJobUrlRequest,
  ): Promise<{ job: JobDto; isDuplicate: boolean; message?: string }> {
    if (!req.url || !req.url.trim()) {
      throw AppError.badRequest('A valid job URL must be provided');
    }

    const targetUrl = req.url.trim();

    // 1. Fetch public page safely with SSRF protection
    let retrieved;
    try {
      retrieved = await this.retrievalService.fetchPublicPage(targetUrl);
    } catch (err) {
      // If the provider is known to require auth or block automated fetch (like LinkedIn),
      // gracefully fall back to needsManualText rather than crashing or failing as 500
      const directExtractor = this.extractorRegistry.getExtractor(targetUrl, '');
      if (directExtractor.canHandle(targetUrl, '')) {
        const rawFallback = await directExtractor.extract(targetUrl, '');
        if (rawFallback.needsManualText) {
          return this.handleManualTextFallback(userId, targetUrl, rawFallback);
        }
      }
      throw err;
    }

    // 2. Detect provider & get extractor
    const extractor = this.extractorRegistry.getExtractor(retrieved.finalUrl, retrieved.content);

    // 3. Extract raw structured job data
    const raw = await extractor.extract(retrieved.finalUrl, retrieved.content);

    // 4. Handle auth-wall or manual text fallback
    if (raw.needsManualText) {
      return this.handleManualTextFallback(userId, targetUrl, raw);
    }

    // 5. Normalize
    const norm = this.normalizerService.normalize(raw);

    // 6. Deduplication check
    const existing = await this.findDuplicateJob(userId, {
      provider: raw.provider,
      externalId: raw.externalId,
      canonicalUrl: norm.canonicalUrl,
      contentHash: norm.contentHash,
    });

    if (existing) {
      await this.db.insert(jobSources).values({
        jobId: existing.id,
        userId,
        provider: raw.provider,
        ingestionMethod: 'URL_IMPORT',
        sourceUrl: targetUrl,
        canonicalUrl: norm.canonicalUrl,
        externalJobId: raw.externalId || null,
        rawTitle: raw.title || null,
        rawCompany: raw.company || null,
        rawLocation: raw.location || null,
        rawDescription: raw.descriptionText,
        rawMetadata: raw.rawMetadata || null,
        rawPayload: null, // Raw HTML discarded
        contentHash: norm.contentHash,
        ingestionStatus: 'DUPLICATE',
        parserVersion: '1.0.0',
        retrievedAt: new Date(),
      });

      await this.recordJobEvent(userId, existing.id, 'JOB_DUPLICATE_DETECTED', [], {
        method: 'URL_IMPORT',
        url: targetUrl,
      });

      const fullDto = await this.getJobById(userId, existing.id);
      return {
        job: fullDto,
        isDuplicate: true,
        message: 'This job posting has already been ingested into your Job Inbox',
      };
    }

    // 7. Persist new Job
    const [createdJob] = await this.db
      .insert(jobs)
      .values({
        userId,
        state: 'INGESTED',
        title: norm.title,
        company: norm.company,
        description: raw.descriptionText,
        descriptionHtml: sanitizeJobHtml(
          raw.descriptionHtml || `<p>${raw.descriptionText.replace(/\n/g, '<br/>')}</p>`,
        ),
        locationText: norm.locationText,
        city: norm.city,
        region: norm.region,
        country: norm.country,
        workplaceType: norm.workplaceType,
        employmentType: norm.employmentType,
        seniority: norm.seniority,
        department: norm.department,
        minSalary: norm.minSalary,
        maxSalary: norm.maxSalary,
        currency: norm.currency,
        payPeriod: norm.payPeriod,
        compensationRaw: norm.compensationRaw,
        postedDate: raw.postedDate || null,
        expirationDate: raw.expirationDate || null,
        originalUrl: targetUrl,
        canonicalUrl: norm.canonicalUrl,
        applicationUrl: raw.applicationUrl || targetUrl,
        provider: raw.provider,
        sourceExternalId: raw.externalId || null,
        sourceCompanyId: raw.sourceCompanyId || null,
        contentHash: norm.contentHash,
        isDuplicate: false,
      })
      .returning();

    // Persist source record
    const [createdSource] = await this.db
      .insert(jobSources)
      .values({
        jobId: createdJob!.id,
        userId,
        provider: raw.provider,
        ingestionMethod: 'URL_IMPORT',
        sourceUrl: targetUrl,
        canonicalUrl: norm.canonicalUrl,
        externalJobId: raw.externalId || null,
        rawTitle: raw.title || null,
        rawCompany: raw.company || null,
        rawLocation: raw.location || null,
        rawDescription: raw.descriptionText,
        rawMetadata: raw.rawMetadata || null,
        rawPayload: null, // Raw HTML discarded upon successful extraction
        contentHash: norm.contentHash,
        ingestionStatus: 'COMPLETED',
        parserVersion: '1.0.0',
        retrievedAt: new Date(),
      })
      .returning();

    // Persist requirements with source context
    if (raw.requirements && raw.requirements.length > 0) {
      await this.db.insert(jobRequirements).values(
        raw.requirements.map((r, i) => ({
          jobId: createdJob!.id,
          userId,
          sourceId: createdSource?.id || null,
          sourceSection: r.sourceSection || null,
          rawText: r.rawText,
          category: r.category || 'OTHER',
          requirementStrength: r.strength || 'UNKNOWN',
          displayOrder: i,
        })),
      );
    }

    // Persist sections
    if (raw.sections && raw.sections.length > 0) {
      await this.db.insert(jobSections).values(
        raw.sections.map((s, i) => ({
          jobId: createdJob!.id,
          userId,
          sectionType: s.type,
          title: s.title,
          content: s.content,
          displayOrder: i,
        })),
      );
    }

    await this.recordJobEvent(
      userId,
      createdJob!.id,
      'JOB_INGESTED',
      ['title', 'company', 'originalUrl'],
      { method: 'URL_IMPORT', provider: raw.provider, externalId: raw.externalId },
    );

    const fullDto = await this.getJobById(userId, createdJob!.id);
    return { job: fullDto, isDuplicate: false };
  }

  // --- Deduplication Helper ---
  private async findDuplicateJob(
    userId: string,
    params: {
      provider?: JobProvider;
      externalId?: string;
      canonicalUrl?: string | null;
      contentHash?: string;
    },
  ): Promise<Job | null> {
    // 1. Same provider + external ID
    if (
      params.provider &&
      params.externalId &&
      params.provider !== 'GENERIC' &&
      params.provider !== 'MANUAL'
    ) {
      const match = await this.db.query.jobs.findFirst({
        where: and(
          eq(jobs.userId, userId),
          eq(jobs.provider, params.provider),
          eq(jobs.sourceExternalId, params.externalId),
        ),
      });
      if (match) return match;
    }

    // 2. Same canonical URL
    if (params.canonicalUrl) {
      const match = await this.db.query.jobs.findFirst({
        where: and(eq(jobs.userId, userId), eq(jobs.canonicalUrl, params.canonicalUrl)),
      });
      if (match) return match;
    }

    // 3. Same content hash
    if (params.contentHash) {
      const match = await this.db.query.jobs.findFirst({
        where: and(eq(jobs.userId, userId), eq(jobs.contentHash, params.contentHash)),
      });
      if (match) return match;
    }

    return null;
  }

  // --- Job Listing with Filtering & Pagination ---
  public async getJobs(
    userId: string,
    query: JobListQuery = {},
  ): Promise<JobPaginationResult<JobSummaryDto>> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const offset = (page - 1) * limit;

    const conditions = [eq(jobs.userId, userId)];

    if (query.state) {
      conditions.push(eq(jobs.state, query.state));
    } else if (!query.includeArchived) {
      conditions.push(sql`${jobs.state} != 'ARCHIVED'`);
    }

    if (query.provider) {
      conditions.push(eq(jobs.provider, query.provider));
    }

    if (query.workplaceType) {
      conditions.push(eq(jobs.workplaceType, query.workplaceType));
    }

    if (query.employmentType) {
      conditions.push(eq(jobs.employmentType, query.employmentType));
    }

    if (query.company) {
      conditions.push(ilike(jobs.company, `%${query.company.trim()}%`));
    }

    if (query.search && query.search.trim()) {
      const s = `%${query.search.trim()}%`;
      conditions.push(
        or(ilike(jobs.title, s), ilike(jobs.company, s), ilike(jobs.locationText, s))!,
      );
    }

    const whereClause = and(...conditions);

    // Query all matching jobs
    const allMatchingJobs = await this.db.query.jobs.findMany({
      where: whereClause,
      orderBy: [desc(jobs.discoveredDate)],
    });

    // Fetch latest match analysis for all returned jobs
    const allJobIds = allMatchingJobs.map((j) => j.id);
    const analyses =
      allJobIds.length > 0
        ? await this.db.query.jobMatchAnalyses.findMany({
            where: and(
              eq(jobMatchAnalyses.userId, userId),
              inArray(jobMatchAnalyses.jobId, allJobIds),
            ),
            orderBy: [desc(jobMatchAnalyses.createdAt)],
          })
        : [];

    const latestAnalysisMap = new Map<string, (typeof analyses)[0]>();
    for (const a of analyses) {
      if (!latestAnalysisMap.has(a.jobId)) {
        latestAnalysisMap.set(a.jobId, a);
      }
    }

    // Filter by match intelligence if requested
    const filteredJobs = allMatchingJobs.filter((r) => {
      const match = latestAnalysisMap.get(r.id);

      if (query.decision) {
        if (query.decision === 'UNANALYZED') {
          if (match) return false;
        } else {
          if (!match || match.decision !== query.decision) return false;
        }
      }

      if (query.minScore !== undefined) {
        if (!match || match.overallScore < query.minScore) return false;
      }

      if (query.maxScore !== undefined) {
        if (!match || match.overallScore > query.maxScore) return false;
      }

      if (query.minConfidence !== undefined) {
        if (!match || match.confidenceScore < query.minConfidence) return false;
      }

      if (query.isStale !== undefined) {
        if (!match || match.isStale !== query.isStale) return false;
      }

      return true;
    });

    // Sort
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    if (query.sortBy === 'score') {
      filteredJobs.sort((a, b) => {
        const scoreA = latestAnalysisMap.get(a.id)?.overallScore ?? -1;
        const scoreB = latestAnalysisMap.get(b.id)?.overallScore ?? -1;
        return (scoreA - scoreB) * sortOrder;
      });
    } else if (query.sortBy === 'confidence') {
      filteredJobs.sort((a, b) => {
        const confA = latestAnalysisMap.get(a.id)?.confidenceScore ?? -1;
        const confB = latestAnalysisMap.get(b.id)?.confidenceScore ?? -1;
        return (confA - confB) * sortOrder;
      });
    } else if (query.sortBy === 'title') {
      filteredJobs.sort((a, b) => a.title.localeCompare(b.title) * sortOrder);
    } else if (query.sortBy === 'company') {
      filteredJobs.sort((a, b) => a.company.localeCompare(b.company) * sortOrder);
    }

    const total = filteredJobs.length;
    const paginated = filteredJobs.slice(offset, offset + limit);

    // Get requirement counts
    const paginatedIds = paginated.map((p) => p.id);
    const reqCounts =
      paginatedIds.length > 0
        ? await this.db
            .select({ jobId: jobRequirements.jobId, val: count() })
            .from(jobRequirements)
            .where(inArray(jobRequirements.jobId, paginatedIds))
            .groupBy(jobRequirements.jobId)
        : [];
    const reqCountMap = new Map(reqCounts.map((rc) => [rc.jobId, Number(rc.val)]));

    const items: JobSummaryDto[] = paginated.map((r) => {
      const match = latestAnalysisMap.get(r.id);
      const matchSummary: JobMatchSummaryDto | null = match
        ? {
            overallScore: match.overallScore,
            confidenceScore: match.confidenceScore,
            decision: match.decision as any,
            isStale: match.isStale,
            analysisMode: match.analysisMode as any,
            analyzedAt: match.createdAt.toISOString(),
          }
        : null;

      return {
        id: r.id,
        state: r.state as JobState,
        title: r.title,
        company: r.company,
        locationText: r.locationText,
        city: r.city,
        country: r.country,
        workplaceType: r.workplaceType as WorkplaceType,
        employmentType: r.employmentType as EmploymentType,
        seniority: r.seniority as SeniorityLevel,
        provider: r.provider as JobProvider,
        department: r.department,
        minSalary: r.minSalary,
        maxSalary: r.maxSalary,
        currency: r.currency,
        payPeriod: r.payPeriod as PayPeriod | null,
        originalUrl: r.originalUrl,
        discoveredDate: r.discoveredDate.toISOString(),
        isDuplicate: r.isDuplicate,
        hasManualEdits: r.hasManualEdits,
        requirementCount: reqCountMap.get(r.id) ?? 0,
        matchSummary,
      };
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  // --- Job Detail ---
  public async getJobById(userId: string, id: string): Promise<JobDto> {
    const job = await this.db.query.jobs.findFirst({
      where: and(eq(jobs.id, id), eq(jobs.userId, userId)),
    });
    if (!job) throw AppError.notFound(`Job ${id} not found`);

    const reqs = await this.db.query.jobRequirements.findMany({
      where: eq(jobRequirements.jobId, id),
      orderBy: [jobRequirements.displayOrder],
    });

    const secs = await this.db.query.jobSections.findMany({
      where: eq(jobSections.jobId, id),
      orderBy: [jobSections.displayOrder],
    });

    const srcs = await this.db.query.jobSources.findMany({
      where: eq(jobSources.jobId, id),
      orderBy: [desc(jobSources.retrievedAt)],
    });

    const evts = await this.db.query.jobEvents.findMany({
      where: eq(jobEvents.jobId, id),
      orderBy: [desc(jobEvents.createdAt)],
    });

    return {
      id: job.id,
      userId: job.userId,
      state: job.state as JobState,
      title: job.title,
      company: job.company,
      companyUrl: job.companyUrl,
      description: job.description,
      descriptionHtml: job.descriptionHtml,
      locationText: job.locationText,
      city: job.city,
      region: job.region,
      country: job.country,
      workplaceType: job.workplaceType as WorkplaceType,
      employmentType: job.employmentType as EmploymentType,
      seniority: job.seniority as SeniorityLevel,
      department: job.department,
      minSalary: job.minSalary,
      maxSalary: job.maxSalary,
      currency: job.currency,
      payPeriod: job.payPeriod as PayPeriod | null,
      compensationRaw: job.compensationRaw,
      postedDate: job.postedDate?.toISOString() || null,
      expirationDate: job.expirationDate?.toISOString() || null,
      discoveredDate: job.discoveredDate.toISOString(),
      lastCheckedDate: job.lastCheckedDate?.toISOString() || null,
      originalUrl: job.originalUrl,
      canonicalUrl: job.canonicalUrl,
      applicationUrl: job.applicationUrl,
      provider: job.provider as JobProvider,
      sourceExternalId: job.sourceExternalId,
      sourceCompanyId: job.sourceCompanyId,
      contentHash: job.contentHash,
      isDuplicate: job.isDuplicate,
      duplicateOfId: job.duplicateOfId,
      hasManualEdits: job.hasManualEdits,
      manualEditFields: job.manualEditFields || [],
      requirements: reqs.map((r) => ({
        id: r.id,
        jobId: r.jobId,
        sourceId: r.sourceId,
        sourceSection: r.sourceSection,
        rawText: r.rawText,
        normalizedText: r.normalizedText,
        category: r.category as RequirementCategory,
        requirementStrength: r.requirementStrength as RequirementStrength,
        displayOrder: r.displayOrder,
        createdAt: r.createdAt.toISOString(),
      })),
      sections: secs.map((s) => ({
        id: s.id,
        jobId: s.jobId,
        sectionType: s.sectionType as SectionType,
        title: s.title,
        content: s.content,
        displayOrder: s.displayOrder,
        createdAt: s.createdAt.toISOString(),
      })),
      sources: srcs.map((src) => ({
        id: src.id,
        jobId: src.jobId,
        provider: src.provider as JobProvider,
        ingestionMethod: src.ingestionMethod as any,
        sourceUrl: src.sourceUrl,
        canonicalUrl: src.canonicalUrl,
        externalJobId: src.externalJobId,
        rawTitle: src.rawTitle,
        rawCompany: src.rawCompany,
        rawLocation: src.rawLocation,
        rawDescription: src.rawDescription,
        rawMetadata: src.rawMetadata,
        rawPayload: src.rawPayload,
        contentHash: src.contentHash,
        ingestionStatus: src.ingestionStatus as any,
        parserVersion: src.parserVersion,
        errorMessage: src.errorMessage,
        retrievedAt: src.retrievedAt.toISOString(),
        createdAt: src.createdAt.toISOString(),
      })),
      events: evts.map((e) => ({
        id: e.id,
        jobId: e.jobId,
        userId: e.userId,
        eventType: e.eventType as JobEventType,
        changedFields: e.changedFields || [],
        metadata: e.metadata,
        createdAt: e.createdAt.toISOString(),
      })),
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    };
  }

  // --- Manual Edit / Update ---
  public async updateJob(userId: string, id: string, updates: UpdateJobRequest): Promise<JobDto> {
    const existing = await this.db.query.jobs.findFirst({
      where: and(eq(jobs.id, id), eq(jobs.userId, userId)),
    });
    if (!existing) throw AppError.notFound(`Job ${id} not found`);

    const changedKeys = Object.keys(updates) as Array<keyof UpdateJobRequest>;
    const mergedManualFields = Array.from(
      new Set([...(existing.manualEditFields || []), ...changedKeys]),
    );

    const updateData: Partial<NewJob> = {
      ...updates,
      hasManualEdits: true,
      manualEditFields: mergedManualFields,
      updatedAt: new Date(),
    };

    if (updates.description) {
      updateData.descriptionHtml = sanitizeJobHtml(
        `<p>${updates.description.replace(/\n/g, '<br/>')}</p>`,
      );
    }

    await this.db
      .update(jobs)
      .set(updateData)
      .where(and(eq(jobs.id, id), eq(jobs.userId, userId)));

    // Invalidate match analysis if job content changed
    await this.db
      .update(jobMatchAnalyses)
      .set({ isStale: true })
      .where(and(eq(jobMatchAnalyses.jobId, id), eq(jobMatchAnalyses.userId, userId)));

    await this.recordJobEvent(userId, id, 'JOB_UPDATED', changedKeys as string[], {
      manualEdit: true,
    });
    await this.recordJobEvent(userId, id, 'JOB_ANALYSIS_STALE', ['manualEdit'], {
      reason: 'Manual edits modified job content',
    });

    return this.getJobById(userId, id);
  }

  // --- Archive Job ---
  public async archiveJob(userId: string, id: string, reason?: string): Promise<JobDto> {
    const existing = await this.db.query.jobs.findFirst({
      where: and(eq(jobs.id, id), eq(jobs.userId, userId)),
    });
    if (!existing) throw AppError.notFound(`Job ${id} not found`);

    await this.db
      .update(jobs)
      .set({ state: 'ARCHIVED', updatedAt: new Date() })
      .where(and(eq(jobs.id, id), eq(jobs.userId, userId)));

    await this.recordJobEvent(userId, id, 'JOB_ARCHIVED', ['state'], {
      previousState: existing.state,
      reason,
    });

    return this.getJobById(userId, id);
  }

  // --- Dashboard Ingestion & Matching Metrics ---
  public async getDashboardMetrics(userId: string): Promise<JobDashboardMetricsDto> {
    const allJobs = await this.db.query.jobs.findMany({
      where: eq(jobs.userId, userId),
    });

    let totalJobs = 0;
    let newJobs = 0;
    let ingestedJobs = 0;
    let needsReviewJobs = 0;
    let failedIngestions = 0;
    let archivedJobs = 0;
    const providerCounts: Record<string, number> = {};
    const workplaceCounts: Record<string, number> = {};

    for (const j of allJobs) {
      totalJobs++;
      if (j.state === 'NEW') newJobs++;
      else if (j.state === 'INGESTED') ingestedJobs++;
      else if (j.state === 'NEEDS_REVIEW') needsReviewJobs++;
      else if (j.state === 'INVALID') failedIngestions++;
      else if (j.state === 'ARCHIVED') archivedJobs++;

      providerCounts[j.provider] = (providerCounts[j.provider] || 0) + 1;
      workplaceCounts[j.workplaceType] = (workplaceCounts[j.workplaceType] || 0) + 1;
    }

    // Query matching metrics
    const allAnalyses = await this.db.query.jobMatchAnalyses.findMany({
      where: eq(jobMatchAnalyses.userId, userId),
      orderBy: [desc(jobMatchAnalyses.createdAt)],
    });

    const latestAnalysisByJob = new Map<string, (typeof allAnalyses)[0]>();
    for (const a of allAnalyses) {
      if (!latestAnalysisByJob.has(a.jobId)) {
        latestAnalysisByJob.set(a.jobId, a);
      }
    }

    let totalAnalyzed = 0;
    let matchCount = 0;
    let reviewCount = 0;
    let skipCount = 0;
    let totalScore = 0;
    let staleAnalysisCount = 0;

    for (const a of latestAnalysisByJob.values()) {
      totalAnalyzed++;
      if (a.decision === 'MATCH') matchCount++;
      else if (a.decision === 'REVIEW') reviewCount++;
      else if (a.decision === 'SKIP') skipCount++;

      totalScore += a.overallScore;
      if (a.isStale) staleAnalysisCount++;
    }

    const averageMatchScore = totalAnalyzed > 0 ? Math.round(totalScore / totalAnalyzed) : 0;

    const recent = await this.getJobs(userId, { limit: 5, includeArchived: true });

    return {
      totalJobs,
      newJobs,
      ingestedJobs,
      needsReviewJobs,
      failedIngestions,
      archivedJobs,
      totalAnalyzed,
      matchCount,
      reviewCount,
      skipCount,
      averageMatchScore,
      staleAnalysisCount,
      providerCounts,
      workplaceCounts,
      recentJobs: recent.items,
    };
  }

  // --- Event Recording Helper ---
  private async recordJobEvent(
    userId: string,
    jobId: string,
    eventType: JobEventType,
    changedFields: string[] = [],
    metadata: Record<string, unknown> | null = null,
  ): Promise<void> {
    try {
      await this.db.insert(jobEvents).values({
        userId,
        jobId,
        eventType,
        changedFields,
        metadata,
      });
    } catch {
      // Non-blocking event logging
    }
  }

  // --- Auth-Wall & Manual Text Fallback Helper ---
  private async handleManualTextFallback(
    userId: string,
    targetUrl: string,
    raw: RawExtractedJob,
  ): Promise<{ job: JobDto; isDuplicate: boolean; message?: string }> {
    const canonicalUrl = this.normalizerService.canonicalizeUrl(targetUrl);
    const contentHash = this.normalizerService.computeContentHash(
      raw.title || 'Untitled',
      raw.company || 'Unknown',
      raw.location || null,
      raw.descriptionText,
    );

    // Check duplicate by URL or external ID
    const existing = await this.findDuplicateJob(userId, {
      canonicalUrl,
      provider: raw.provider,
      externalId: raw.externalId,
    });

    if (existing) {
      const fullDto = await this.getJobById(userId, existing.id);
      return {
        job: fullDto,
        isDuplicate: true,
        message: 'Job URL already exists in Job Inbox',
      };
    }

    // Create a placeholder job in NEEDS_REVIEW state
    const [createdJob] = await this.db
      .insert(jobs)
      .values({
        userId,
        state: 'NEEDS_REVIEW',
        title: raw.title || 'Imported Job (Needs Description)',
        company: raw.company || 'Unknown Company',
        description: raw.descriptionText,
        descriptionHtml: `<p>${raw.descriptionText}</p>`,
        originalUrl: targetUrl,
        canonicalUrl,
        provider: raw.provider,
        sourceExternalId: raw.externalId || null,
        contentHash,
        isDuplicate: false,
      })
      .returning();

    await this.db.insert(jobSources).values({
      jobId: createdJob!.id,
      userId,
      provider: raw.provider,
      ingestionMethod: 'URL_IMPORT',
      sourceUrl: targetUrl,
      canonicalUrl,
      externalJobId: raw.externalId || null,
      rawTitle: raw.title || null,
      rawCompany: raw.company || null,
      rawDescription: raw.descriptionText,
      rawMetadata: raw.rawMetadata || null,
      rawPayload: null, // Raw HTML payload discarded
      contentHash,
      ingestionStatus: 'NEEDS_MANUAL_TEXT',
      parserVersion: '1.0.0',
      errorMessage: raw.warnings ? raw.warnings.join('; ') : 'Authentication wall detected',
      retrievedAt: new Date(),
    });

    await this.recordJobEvent(userId, createdJob!.id, 'JOB_INGESTED', ['state', 'originalUrl'], {
      method: 'URL_IMPORT',
      status: 'NEEDS_MANUAL_TEXT',
    });

    const fullDto = await this.getJobById(userId, createdJob!.id);
    return {
      job: fullDto,
      isDuplicate: false,
      message:
        'Provider requires manual text. The URL was recorded; please paste the job description to finalize extraction.',
    };
  }
}
