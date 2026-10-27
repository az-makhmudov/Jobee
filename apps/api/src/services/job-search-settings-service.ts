import { z } from 'zod';
import { eq, jobSearchSettings, candidateDocuments, type Database, and } from '@job-agent/database';
import { DEFAULT_SEARCH_SETTINGS, AppError, type JobSearchSettings } from '@job-agent/shared';
export const searchSettingsSchema = z
  .object({
    sources: z
      .array(z.enum(['ARBEITNOW', 'GREENHOUSE', 'LEVER', 'ASHBY', 'SMARTRECRUITERS']))
      .min(1)
      .max(5),
    boards: z
      .array(
        z
          .object({
            source: z.enum(['GREENHOUSE', 'LEVER', 'ASHBY', 'SMARTRECRUITERS']),
            slug: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
          })
          .strict(),
      )
      .max(20),
    selectedCvId: z.string().uuid().nullable(),
    dailyDiscovery: z.boolean(),
    dailyPreparation: z.boolean(),
    dailyDigest: z.boolean(),
    dailyLimit: z.number().int().min(1).max(20),
  })
  .strict();
export class JobSearchSettingsService {
  constructor(private readonly db: Database) {}
  async get(userId: string): Promise<JobSearchSettings> {
    const [row] = await this.db
      .select()
      .from(jobSearchSettings)
      .where(eq(jobSearchSettings.userId, userId));
    const effective = { ...DEFAULT_SEARCH_SETTINGS, ...row?.settings };
    // Upgrade only the exact retired built-in catalog. Preserve explicitly customized sources/boards.
    const legacyBoards = [
      'GREENHOUSE:revolut',
      'GREENHOUSE:canonical',
      'GREENHOUSE:gitlab',
      'GREENHOUSE:stripe',
      'LEVER:spotify',
    ];
    const legacySources = ['ARBEITNOW', 'GREENHOUSE', 'LEVER', 'ASHBY'];
    const same = (a: string[], b: string[]) =>
      JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
    if (
      same(effective.sources, legacySources) &&
      same(
        effective.boards.map((board) => `${board.source}:${board.slug}`),
        legacyBoards,
      )
    ) {
      return {
        ...effective,
        sources: DEFAULT_SEARCH_SETTINGS.sources,
        boards: DEFAULT_SEARCH_SETTINGS.boards,
      };
    }
    return effective;
  }
  async save(userId: string, input: unknown) {
    const settings = searchSettingsSchema.parse(input);
    if (settings.dailyPreparation && !settings.dailyDiscovery)
      throw AppError.badRequest('Enable daily discovery before daily preparation.');
    if (settings.selectedCvId) {
      const [doc] = await this.db
        .select()
        .from(candidateDocuments)
        .where(
          and(
            eq(candidateDocuments.id, settings.selectedCvId),
            eq(candidateDocuments.userId, userId),
          ),
        );
      if (!doc || !doc.isActive || !['MASTER_CV', 'ROLE_CV'].includes(doc.documentType))
        throw AppError.badRequest('Choose an active CV from your documents.');
    }
    await this.db
      .insert(jobSearchSettings)
      .values({ userId, settings })
      .onConflictDoUpdate({
        target: jobSearchSettings.userId,
        set: { settings, updatedAt: new Date() },
      });
    return settings;
  }
}
