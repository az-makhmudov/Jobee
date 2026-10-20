import { DynamicAiProvider } from './ai/dynamic-ai-provider.js';
import { matchingFingerprint, currentMatchingInputs } from './matching-inputs.js';
import { validateAndSanitizeAiOutput } from './ai/validator.js';
import { eq, and, desc, inArray, notInArray } from 'drizzle-orm';
import type { Database } from '../client.js';
import * as schema from '../schema/index.js';
import {
  jobs,
  jobRequirements,
  jobMatchAnalyses,
  jobRequirementEvaluations,
  jobMatchDimensions,
  jobEvents,
} from '../schema/index.js';
import {
  AppError,
  ErrorCodes,
  JobMatchAnalysisDto,
  JobRequirementEvaluationDto,
  JobMatchDimensionDto,
  BatchAnalysisRequest,
  BatchAnalysisResultDto,
  MATCH_ALGORITHM_VERSION,
  MatchAnalysisMode,
  DimensionType,
  RequirementEvaluationStatus,
} from '@job-agent/shared';
import { MatchingContextBuilder, CandidateMatchingContext } from './matching-context-builder.js';
import {
  CandidateEvidenceResolver,
  DeterministicEvaluationResult,
} from './candidate-evidence-resolver.js';
import { HardPolicyEngine } from './hard-policy-engine.js';
import { MatchingScoringEngine } from './matching-scoring-engine.js';
import { AiProvider, AiMatchContext, AiMatchResult } from './ai/types.js';

export class MatchService {
  private readonly contextBuilder: MatchingContextBuilder;
  private readonly evidenceResolver: CandidateEvidenceResolver;
  private readonly hardPolicyEngine: HardPolicyEngine;
  private readonly scoringEngine: MatchingScoringEngine;

  constructor(
    private readonly db: Database,
    private readonly aiProvider: AiProvider,
  ) {
    this.contextBuilder = new MatchingContextBuilder(db);
    this.evidenceResolver = new CandidateEvidenceResolver();
    this.hardPolicyEngine = new HardPolicyEngine();
    this.scoringEngine = new MatchingScoringEngine();
  }

  async analyzeJob(
    jobId: string,
    userId: string,
    options: { force?: boolean } = {},
  ): Promise<JobMatchAnalysisDto> {
    const job = await this.db.query.jobs.findFirst({
      where: and(eq(jobs.id, jobId), eq(jobs.userId, userId)),
    });

    if (!job) {
      throw new AppError({
        code: ErrorCodes.NOT_FOUND,
        message: `Job ${jobId} not found`,
        statusCode: 404,
      });
    }

    const requirements = await this.db.query.jobRequirements.findMany({
      where: and(
        eq(jobRequirements.jobId, jobId),
        eq(jobRequirements.userId, userId),
        eq(jobRequirements.isCurrent, true),
      ),
      orderBy: (reqs, { asc }) => [asc(reqs.displayOrder)],
    });

    const context = await this.contextBuilder.buildContext(userId);

    // Compute input fingerprint
    const inputFingerprint = matchingFingerprint(
      job,
      requirements,
      context.candidateStateHash,
      MATCH_ALGORITHM_VERSION,
    );

    // Check existing analysis if not forced
    if (!options.force) {
      const existing = await this.db.query.jobMatchAnalyses.findFirst({
        where: and(
          eq(jobMatchAnalyses.jobId, jobId),
          eq(jobMatchAnalyses.userId, userId),
          eq(jobMatchAnalyses.isStale, false),
          eq(jobMatchAnalyses.inputFingerprint, inputFingerprint),
        ),
        orderBy: [desc(jobMatchAnalyses.createdAt)],
      });

      if (existing) {
        return this.loadFullAnalysisDto(existing.id);
      }
    }

    // Record analysis started audit event
    await this.recordJobEvent(jobId, userId, 'JOB_ANALYSIS_STARTED', {
      algorithmVersion: MATCH_ALGORITHM_VERSION,
      forced: Boolean(options.force),
    });

    // 1. Evaluate deterministic requirements
    const deterministicEvals: DeterministicEvaluationResult[] = requirements.map((req) =>
      this.evidenceResolver.evaluateRequirement(req, context, job),
    );

    // 2. Evaluate hard policy
    const hardPolicy = this.hardPolicyEngine.evaluate(job, context);

    // 3. Optional AI semantic enrichment
    let aiResult: AiMatchResult | null = null;
    let analysisMode: MatchAnalysisMode = 'DETERMINISTIC_ONLY';

    const aiProvider =
      this.aiProvider instanceof DynamicAiProvider
        ? this.aiProvider.forPolicy(context.policy)
        : this.aiProvider;
    if (aiProvider.isAvailable()) {
      try {
        const aiContext: AiMatchContext = {
          jobId: job.id,
          jobTitle: job.title,
          jobCompany: job.company,
          workplaceType: job.workplaceType,
          location: job.locationText,
          descriptionSnippet: job.description.slice(0, 1500),
          requirements: requirements.map((r) => ({
            id: r.id,
            rawText: r.rawText,
            category: r.category as any,
            strength: r.requirementStrength as any,
          })),
          candidateContext: context.aiContext,
        };

        const rawResult = await aiProvider.analyzeMatch(aiContext);
        aiResult = validateAndSanitizeAiOutput(
          rawResult,
          aiContext,
          rawResult.provider,
          rawResult.model,
          rawResult.tokensUsed,
        );
        analysisMode = 'AI_ENRICHED';
      } catch {
        // AI failure degrades gracefully to deterministic
        analysisMode = 'DETERMINISTIC_ONLY';
      }
    }

    // Merge AI evaluations into deterministic evaluations where appropriate
    const sensitiveIds = new Set(
      requirements
        .filter((req) =>
          ['WORK_AUTHORIZATION', 'LOCATION', 'EDUCATION', 'CERTIFICATION'].includes(req.category),
        )
        .map((req) => req.id),
    );
    if (aiResult)
      aiResult.evaluations = aiResult.evaluations.filter(
        (evaluation) => !sensitiveIds.has(evaluation.requirementId),
      );
    const finalEvaluations = this.mergeEvaluations(deterministicEvals, aiResult, context);

    // 4. Calculate dimensions, overall score, confidence, decision
    const scoringResult = this.scoringEngine.calculate(
      job,
      context,
      hardPolicy,
      finalEvaluations,
      aiResult,
    );

    // 5. Persist analysis in a transaction
    const analysisId = await this.db.transaction(async (tx) => {
      // Mark any prior analyses as stale
      await tx
        .update(jobMatchAnalyses)
        .set({ isStale: true, autoApplyEligible: false })
        .where(and(eq(jobMatchAnalyses.jobId, jobId), eq(jobMatchAnalyses.userId, userId)));

      // Insert new analysis
      const [insertedAnalysis] = await tx
        .insert(jobMatchAnalyses)
        .values({
          jobId,
          userId,
          overallScore: scoringResult.overallScore,
          confidenceScore: scoringResult.confidenceScore,
          decision: scoringResult.decision,
          careerFitCategory: scoringResult.careerFitCategory,
          autoApplyEligible: scoringResult.autoApplyEligible,
          analysisMode,
          algorithmVersion: scoringResult.algorithmVersion,
          inputFingerprint,
          isStale: false,
          aiProvider: aiResult ? aiResult.provider : null,
          aiModel: aiResult ? aiResult.model : null,
          strengths: scoringResult.strengths,
          gaps: scoringResult.gaps,
          unknowns: scoringResult.unknowns,
          warnings: scoringResult.warnings,
          hardBlockers: scoringResult.hardBlockers,
          transferableSkills: scoringResult.transferableSkills,
          learnedRankingAdjustment: scoringResult.learnedRankingAdjustment,
          learnedAdjustmentReason: scoringResult.learnedAdjustmentReason,
          reasonCodes: scoringResult.reasonCodes,
          summaryExplanation: scoringResult.summaryExplanation,
        })
        .returning({ id: jobMatchAnalyses.id });

      if (!insertedAnalysis) {
        throw AppError.internal('Failed to persist match analysis');
      }

      // Insert requirement evaluations
      if (finalEvaluations.length > 0) {
        await tx.insert(jobRequirementEvaluations).values(
          finalEvaluations.map((ev) => ({
            analysisId: insertedAnalysis.id,
            jobRequirementId: ev.requirementId,
            jobId,
            userId,
            status: ev.status,
            source: analysisMode,
            evidenceIds: ev.evidenceIds,
            evidenceItems: ev.evidenceItems,
            reason: ev.reason,
            confidence: ev.confidence,
            contributesToBlocker: ev.contributesToBlocker,
          })),
        );
      }

      // Insert match dimensions
      if (scoringResult.dimensions.length > 0) {
        await tx.insert(jobMatchDimensions).values(
          scoringResult.dimensions.map((dim) => ({
            analysisId: insertedAnalysis.id,
            jobId,
            dimension: dim.dimension,
            score: dim.score,
            weight: dim.weight,
            status: dim.status,
            reason: dim.reason,
          })),
        );
      }

      return insertedAnalysis.id;
    });

    // Record analysis completed audit event
    await this.recordJobEvent(jobId, userId, 'JOB_ANALYSIS_COMPLETED', {
      analysisId,
      overallScore: scoringResult.overallScore,
      decision: scoringResult.decision,
      mode: analysisMode,
      reasonCodes: scoringResult.reasonCodes,
    });

    return this.loadFullAnalysisDto(analysisId);
  }

  async getJobAnalysis(jobId: string, userId: string): Promise<JobMatchAnalysisDto | null> {
    const analysis = await this.db.query.jobMatchAnalyses.findFirst({
      where: and(eq(jobMatchAnalyses.jobId, jobId), eq(jobMatchAnalyses.userId, userId)),
      orderBy: [desc(jobMatchAnalyses.createdAt)],
    });

    if (!analysis) {
      return null;
    }

    // Check staleness against live fingerprint
    const job = await this.db.query.jobs.findFirst({
      where: and(eq(jobs.id, jobId), eq(jobs.userId, userId)),
    });

    if (job) {
      const requirements = await this.db.query.jobRequirements.findMany({
        where: and(
          eq(jobRequirements.jobId, jobId),
          eq(jobRequirements.userId, userId),
          eq(jobRequirements.isCurrent, true),
        ),
      });
      const context = await this.contextBuilder.buildContext(userId);
      const isVersionMismatch = analysis.algorithmVersion !== MATCH_ALGORITHM_VERSION;
      const currentFingerprint = matchingFingerprint(
        job,
        requirements,
        context.candidateStateHash,
        MATCH_ALGORITHM_VERSION,
      );

      if (
        (currentFingerprint !== analysis.inputFingerprint || isVersionMismatch) &&
        !analysis.isStale
      ) {
        await this.db
          .update(jobMatchAnalyses)
          .set({ isStale: true, autoApplyEligible: false })
          .where(eq(jobMatchAnalyses.id, analysis.id));

        await this.recordJobEvent(jobId, userId, 'JOB_ANALYSIS_STALE', {
          analysisId: analysis.id,
          reason: isVersionMismatch ? 'Algorithm version changed' : 'Input fingerprint changed',
        });

        analysis.isStale = true;
      }
    }

    return this.loadFullAnalysisDto(analysis.id);
  }

  async batchAnalyzeJobs(
    userId: string,
    options: BatchAnalysisRequest = {},
  ): Promise<BatchAnalysisResultDto> {
    const limit = Math.min(50, Math.max(1, options.limit ?? 10));
    let targetJobs: schema.Job[] = [];

    if (options.jobIds && options.jobIds.length > 0) {
      targetJobs = await this.db
        .select()
        .from(jobs)
        .where(and(eq(jobs.userId, userId), inArray(jobs.id, options.jobIds)))
        .limit(limit);
    } else {
      const candidates = await this.db
        .select()
        .from(jobs)
        .where(
          and(
            eq(jobs.userId, userId),
            notInArray(jobs.state, ['ARCHIVED', 'INVALID', 'DUPLICATE']),
          ),
        )
        .orderBy(desc(jobs.discoveredDate));
      const inputs = await currentMatchingInputs(this.db, userId, candidates);
      targetJobs = candidates
        .filter((job) => {
          const analysis = inputs.analysesByJob.get(job.id);
          return options.force || !analysis || (!options.unanalyzedOnly && analysis.isStale);
        })
        .slice(0, limit);
    }

    const results: BatchAnalysisResultDto['results'] = [];
    let succeeded = 0;
    let failed = 0;

    for (const job of targetJobs) {
      try {
        const analysis = await this.analyzeJob(job.id, userId, { force: options.force });
        results.push({
          jobId: job.id,
          success: true,
          decision: analysis.decision,
          score: analysis.overallScore,
        });
        succeeded += 1;
      } catch (err: unknown) {
        results.push({
          jobId: job.id,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
        failed += 1;
      }
    }

    return {
      totalRequested: targetJobs.length,
      processed: targetJobs.length,
      succeeded,
      failed,
      skipped: 0,
      results,
    };
  }

  private mergeEvaluations(
    deterministicEvals: DeterministicEvaluationResult[],
    aiResult: AiMatchResult | null,
    context: CandidateMatchingContext,
  ): DeterministicEvaluationResult[] {
    if (!aiResult) return deterministicEvals;

    const aiEvalMap = new Map(aiResult.evaluations.map((e) => [e.requirementId, e]));

    return deterministicEvals.map((det) => {
      const aiEv = aiEvalMap.get(det.requirementId);
      if (!aiEv) return det;

      // Deterministic blockers cannot be overridden by AI
      if (det.contributesToBlocker && det.status === 'NOT_MET') {
        return det;
      }

      // If deterministic found concrete evidence, keep deterministic status unless AI provides additional verified evidence
      if (det.status === 'MET') {
        return det;
      }

      // If AI found verified evidence for an UNKNOWN or PARTIAL requirement, enrich it
      if (aiEv.evidenceIds.length > 0 && (det.status === 'UNKNOWN' || det.status === 'PARTIAL')) {
        const newEvidenceItems = aiEv.evidenceIds
          .map((id) => context.evidenceMap.get(id))
          .filter((item): item is NonNullable<typeof item> => Boolean(item));

        return {
          ...det,
          status: aiEv.status,
          evidenceIds: Array.from(new Set([...det.evidenceIds, ...aiEv.evidenceIds])),
          evidenceItems: [...det.evidenceItems, ...newEvidenceItems],
          reason: `AI semantic assessment references verified evidence: ${newEvidenceItems.map((item) => item.label).join('; ')}`,
          confidence: Math.round((det.confidence + aiEv.confidence) / 2),
        };
      }

      return det;
    });
  }

  private async loadFullAnalysisDto(analysisId: string): Promise<JobMatchAnalysisDto> {
    const analysis = await this.db.query.jobMatchAnalyses.findFirst({
      where: eq(jobMatchAnalyses.id, analysisId),
    });

    if (!analysis) {
      throw new AppError({
        code: ErrorCodes.NOT_FOUND,
        message: `Match analysis ${analysisId} not found`,
        statusCode: 404,
      });
    }

    const [dimRows, evalRows] = await Promise.all([
      this.db.query.jobMatchDimensions.findMany({
        where: eq(jobMatchDimensions.analysisId, analysisId),
      }),
      this.db.query.jobRequirementEvaluations.findMany({
        where: eq(jobRequirementEvaluations.analysisId, analysisId),
      }),
    ]);

    // Load requirement texts for evaluations
    const reqIds = evalRows.map((e) => e.jobRequirementId);
    const reqRows =
      reqIds.length > 0
        ? await this.db.select().from(jobRequirements).where(inArray(jobRequirements.id, reqIds))
        : [];
    const reqMap = new Map(reqRows.map((r) => [r.id, r]));

    const dimensions: JobMatchDimensionDto[] = dimRows.map((d) => ({
      id: d.id,
      analysisId: d.analysisId,
      jobId: d.jobId,
      dimension: d.dimension as DimensionType,
      score: d.score,
      weight: d.weight,
      status: d.status as any,
      reason: d.reason,
      createdAt: d.createdAt.toISOString(),
    }));

    const evaluations: JobRequirementEvaluationDto[] = evalRows.map((e) => {
      const rawReq = reqMap.get(e.jobRequirementId);
      return {
        id: e.id,
        analysisId: e.analysisId,
        jobRequirementId: e.jobRequirementId,
        jobId: e.jobId,
        userId: e.userId,
        status: e.status as RequirementEvaluationStatus,
        source: e.source as any,
        evidenceIds: (e.evidenceIds as string[]) || [],
        evidenceItems: (e.evidenceItems as any[]) || [],
        reason: e.reason,
        confidence: e.confidence,
        contributesToBlocker: e.contributesToBlocker,
        createdAt: e.createdAt.toISOString(),
        requirement: rawReq
          ? {
              id: rawReq.id,
              jobId: rawReq.jobId,
              sourceId: rawReq.sourceId,
              sourceSection: rawReq.sourceSection,
              rawText: rawReq.rawText,
              normalizedText: rawReq.normalizedText,
              category: rawReq.category as any,
              requirementStrength: rawReq.requirementStrength as any,
              displayOrder: rawReq.displayOrder,
              createdAt: rawReq.createdAt.toISOString(),
            }
          : undefined,
      };
    });

    return {
      id: analysis.id,
      jobId: analysis.jobId,
      userId: analysis.userId,
      overallScore: analysis.overallScore,
      confidenceScore: analysis.confidenceScore,
      decision: analysis.decision as any,
      careerFitCategory: (analysis.careerFitCategory as any) || null,
      autoApplyEligible: analysis.autoApplyEligible,
      analysisMode: analysis.analysisMode as any,
      algorithmVersion: analysis.algorithmVersion,
      inputFingerprint: analysis.inputFingerprint,
      isStale: analysis.isStale,
      aiProvider: analysis.aiProvider,
      aiModel: analysis.aiModel,
      strengths: (analysis.strengths as string[]) || [],
      gaps: (analysis.gaps as string[]) || [],
      unknowns: (analysis.unknowns as string[]) || [],
      warnings: (analysis.warnings as string[]) || [],
      hardBlockers: (analysis.hardBlockers as string[]) || [],
      transferableSkills: (analysis.transferableSkills as string[]) || [],
      learnedRankingAdjustment: analysis.learnedRankingAdjustment || 0,
      learnedAdjustmentReason: analysis.learnedAdjustmentReason || null,
      reasonCodes: (analysis.reasonCodes as any[]) || [],
      summaryExplanation: analysis.summaryExplanation,
      dimensions,
      evaluations,
      createdAt: analysis.createdAt.toISOString(),
      updatedAt: analysis.updatedAt.toISOString(),
    };
  }

  async findMatchedJobs(userId: string, limit = 10): Promise<schema.Job[]> {
    const candidates = await this.db
      .select()
      .from(jobs)
      .where(
        and(eq(jobs.userId, userId), notInArray(jobs.state, ['ARCHIVED', 'INVALID', 'DUPLICATE'])),
      );
    const { analysesByJob } = await currentMatchingInputs(this.db, userId, candidates);
    return candidates
      .filter((job) => {
        const analysis = analysesByJob.get(job.id);
        return analysis && !analysis.isStale && analysis.decision === 'MATCH';
      })
      .sort(
        (a, b) =>
          (analysesByJob.get(b.id)?.overallScore ?? 0) -
          (analysesByJob.get(a.id)?.overallScore ?? 0),
      )
      .slice(0, limit);
  }

  private async recordJobEvent(
    jobId: string,
    userId: string,
    eventType: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.db.insert(jobEvents).values({
      jobId,
      userId,
      eventType,
      changedFields: [],
      metadata,
    });
  }
}
