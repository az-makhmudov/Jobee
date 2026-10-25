import { eq, and, desc, sql } from 'drizzle-orm';
import type { Database } from '@job-agent/database';
import {
  profileImportSessions,
  profileImportItems,
  candidateProfiles,
  candidateExperiences,
  candidateEducation,
  candidateSkills,
  candidateCertifications,
  candidateLanguages,
  candidateProjects,
  candidateLinks,
  candidateFacts,
  candidateDocuments,
  candidateAuditEvents,
  type ProfileImportSession,
  type ProfileImportItem,
  type ProfileImportClassification,
  type ProfileImportReviewStatus,
} from '@job-agent/database';
import {
  AppError,
  type FileStorageProvider,
  type ProfileImportSessionDto,
  type ProfileImportItemDto,
  type ProfileImportSourceType,
  type CommitImportSessionOptions,
  type CommitImportSessionResult,
  type ProfileImportConflictResolution,
} from '@job-agent/shared';
import { DocumentTextExtractor } from './document-text-extractor.js';
import { SmartProfileExtractor } from './smart-profile-extractor.js';
import {
  ProfileComparisonEngine,
  type ExistingCandidateBrainState,
} from './profile-comparison-engine.js';
import type { CandidateService } from '../candidate-service.js';

export class SmartProfileImportService {
  constructor(
    private readonly db: Database,
    private readonly storage: FileStorageProvider,
    private readonly candidateService: CandidateService,
    private readonly geminiApiKey?: string,
    private readonly aiModel?: string,
  ) {}

  /**
   * Uploads resume/LinkedIn document, saves to private storage, creates import session
   * Preserves existing Master CV unless replaceMasterCv is explicitly true.
   */
  public async createSession(
    userId: string,
    fileBuffer: Buffer,
    fileMeta: { originalFilename: string; mimeType: string },
    sourceType: ProfileImportSourceType = 'CV',
    options?: { replaceMasterCv?: boolean },
  ): Promise<ProfileImportSessionDto> {
    let storedKey: string | undefined;
    const session = await this.db
      .transaction(async (tx) => {
        // 1. Upload to storage
        await tx.execute(sql`SELECT id FROM users WHERE id=${userId} FOR UPDATE`);
        const saved = await tx
          .select({ id: candidateDocuments.id })
          .from(candidateDocuments)
          .where(eq(candidateDocuments.userId, userId))
          .limit(10);
        if (saved.length >= 10)
          throw AppError.badRequest(
            'You can save up to 10 documents. Delete a document before adding another.',
          );
        const storageResult = await this.storage.saveFile(fileBuffer, fileMeta);
        storedKey = storageResult.storageKey;

        // 2. Check for existing active Master CV
        const [existingMaster] = await tx
          .select({ id: candidateDocuments.id })
          .from(candidateDocuments)
          .where(
            and(
              eq(candidateDocuments.userId, userId),
              eq(candidateDocuments.isMaster, true),
              eq(candidateDocuments.isActive, true),
            ),
          )
          .limit(1);

        let isMaster = false;
        let documentType: 'MASTER_CV' | 'CV' | 'OTHER' = 'OTHER';

        if (sourceType === 'CV') {
          if (existingMaster) {
            if (options?.replaceMasterCv === true) {
              // Explicit opt-in to replace master CV: demote previous master
              await tx
                .update(candidateDocuments)
                .set({ isMaster: false, updatedAt: new Date() })
                .where(eq(candidateDocuments.id, existingMaster.id));
              isMaster = true;
              documentType = 'MASTER_CV';
            } else {
              // Preserve existing master CV: store this as supporting CV
              isMaster = false;
              documentType = 'CV';
            }
          } else {
            // No existing master CV: this becomes the master CV
            isMaster = true;
            documentType = 'MASTER_CV';
          }
        } else if (sourceType === 'LINKEDIN_PDF') {
          isMaster = false;
          documentType = 'OTHER';
        }

        // Register in Document Vault as a candidate document
        const [docRow] = await tx
          .insert(candidateDocuments)
          .values({
            userId,
            documentType,
            displayName: `${sourceType === 'LINKEDIN_PDF' ? 'LinkedIn Export' : isMaster ? 'Master CV' : 'CV'} - ${fileMeta.originalFilename}`,
            originalFilename: fileMeta.originalFilename,
            mimeType: fileMeta.mimeType,
            sizeBytes: storageResult.sizeBytes,
            storageKey: storageResult.storageKey,
            sha256Checksum: storageResult.sha256Checksum,
            version: '1.0',
            isActive: true,
            isMaster,
          })
          .returning();

        // 3. Create session record
        const [session] = await tx
          .insert(profileImportSessions)
          .values({
            userId,
            sourceType,
            status: 'PENDING',
            originalFilename: fileMeta.originalFilename,
            mimeType: fileMeta.mimeType,
            storageKey: storageResult.storageKey,
            documentId: docRow?.id || null,
            aiConsentGiven: false,
          })
          .returning();

        return session!;
      })
      .catch(async (error) => {
        if (storedKey) await this.storage.deleteFile(storedKey).catch(() => {});
        throw error;
      });

    return this.mapSessionDto(session!, []);
  }

  /**
   * Extracts text, runs AI or heuristic parser with consent, and compares with existing Candidate Brain
   */
  public async extractAndCompare(
    userId: string,
    sessionId: string,
    options: { aiConsent: boolean },
  ): Promise<ProfileImportSessionDto> {
    const session = await this.db.query.profileImportSessions.findFirst({
      where: and(eq(profileImportSessions.id, sessionId), eq(profileImportSessions.userId, userId)),
    });

    if (!session) {
      throw AppError.notFound(`Import session ${sessionId} not found`);
    }

    // Mark extracting
    await this.db
      .update(profileImportSessions)
      .set({
        status: 'EXTRACTING',
        aiConsentGiven: options.aiConsent,
        updatedAt: new Date(),
      })
      .where(eq(profileImportSessions.id, sessionId));

    try {
      // 1. Download file buffer
      const { buffer } = await this.storage.getFile(session.storageKey);

      // 2. Extract text from document
      const extractedDoc = await DocumentTextExtractor.extractText(
        buffer,
        session.originalFilename,
        session.mimeType,
      );

      // 3. Extract structured profile data (AI or heuristic)
      const { data: structuredData, extractorUsed } = await SmartProfileExtractor.extract(
        extractedDoc.normalizedText,
        {
          aiConsent: options.aiConsent,
          apiKey: this.geminiApiKey,
          model: this.aiModel,
        },
      );

      // 4. Load existing Candidate Brain state
      const existingState = await this.loadExistingCandidateBrain(userId);

      // 5. Run comparison and classification engine
      const comparisonResults = ProfileComparisonEngine.compare(structuredData, existingState);

      // 6. Delete any existing items for this session (restartable idempotency)
      await this.db.delete(profileImportItems).where(eq(profileImportItems.sessionId, sessionId));

      // 7. Insert new comparison items
      const insertedItems: ProfileImportItem[] = [];
      for (const item of comparisonResults) {
        const [inserted] = await this.db
          .insert(profileImportItems)
          .values({
            sessionId,
            userId,
            section: item.section,
            classification: item.classification,
            confidenceScore: item.confidenceScore,
            sourceReference: item.sourceReference,
            extractedPayload: item.extractedPayload,
            existingEntityId: item.existingEntityId,
            existingPayload: item.existingPayload,
            conflictDetails: item.conflictDetails,
            reviewStatus: 'PENDING',
          })
          .returning();
        if (inserted) insertedItems.push(inserted);
      }

      // 8. Update session to REVIEW_READY
      const [updatedSession] = await this.db
        .update(profileImportSessions)
        .set({
          status: 'REVIEW_READY',
          extractorUsed,
          rawTextSnippet: extractedDoc.normalizedText.slice(0, 1000),
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(profileImportSessions.id, sessionId))
        .returning();

      return this.mapSessionDto(updatedSession!, insertedItems);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await this.db
        .update(profileImportSessions)
        .set({
          status: 'FAILED',
          errorMessage: errMsg,
          updatedAt: new Date(),
        })
        .where(eq(profileImportSessions.id, sessionId));

      if (err instanceof AppError) {
        throw err;
      }
      throw AppError.internal(`Document extraction failed: ${errMsg}`);
    }
  }

  /**
   * Retrieves import session with all comparison items and aggregated status counts
   */
  public async getSession(userId: string, sessionId: string): Promise<ProfileImportSessionDto> {
    const session = await this.db.query.profileImportSessions.findFirst({
      where: and(eq(profileImportSessions.id, sessionId), eq(profileImportSessions.userId, userId)),
    });

    if (!session) {
      throw AppError.notFound(`Import session ${sessionId} not found`);
    }

    const items = await this.db.query.profileImportItems.findMany({
      where: and(
        eq(profileImportItems.sessionId, sessionId),
        eq(profileImportItems.userId, userId),
      ),
      orderBy: [profileImportItems.section, profileImportItems.createdAt],
    });

    return this.mapSessionDto(session, items);
  }

  /**
   * Lists recent import sessions for user
   */
  public async listSessions(userId: string): Promise<ProfileImportSessionDto[]> {
    const sessions = await this.db.query.profileImportSessions.findMany({
      where: eq(profileImportSessions.userId, userId),
      orderBy: [desc(profileImportSessions.createdAt)],
      limit: 20,
    });

    const result: ProfileImportSessionDto[] = [];
    for (const session of sessions) {
      const items = await this.db.query.profileImportItems.findMany({
        where: eq(profileImportItems.sessionId, session.id),
      });
      result.push(this.mapSessionDto(session, items));
    }

    return result;
  }

  /**
   * Updates an individual item's review status (APPROVE, REJECT, or EDIT)
   */
  public async updateItem(
    userId: string,
    sessionId: string,
    itemId: string,
    action: ProfileImportReviewStatus,
    userEditedPayload?: Record<string, unknown>,
    conflictResolution?: ProfileImportConflictResolution | null,
    explicitlyClearedFields?: string[],
  ): Promise<ProfileImportItemDto> {
    const existingItem = await this.db.query.profileImportItems.findFirst({
      where: and(
        eq(profileImportItems.id, itemId),
        eq(profileImportItems.sessionId, sessionId),
        eq(profileImportItems.userId, userId),
      ),
    });

    if (!existingItem) {
      throw AppError.notFound(`Import item ${itemId} not found`);
    }

    if (existingItem.section === 'PROFILE' && conflictResolution === 'ADD_AS_SEPARATE') {
      throw AppError.badRequest(
        'ADD_AS_SEPARATE is not permitted for personal profile records. Please select Keep Existing or Replace Existing.',
      );
    }

    if (action === 'APPROVED') {
      if (existingItem.classification === 'CONFLICT') {
        const resolution = conflictResolution || existingItem.conflictResolution;
        if (
          !resolution ||
          !['KEEP_EXISTING', 'REPLACE_EXISTING', 'ADD_AS_SEPARATE'].includes(resolution)
        ) {
          throw AppError.badRequest(
            'A conflict resolution (KEEP_EXISTING, REPLACE_EXISTING, or ADD_AS_SEPARATE) is required when approving a CONFLICT item.',
          );
        }
        if (existingItem.section === 'PROFILE' && resolution === 'ADD_AS_SEPARATE') {
          throw AppError.badRequest(
            'ADD_AS_SEPARATE is not permitted for personal profile records. Please select Keep Existing or Replace Existing.',
          );
        }
      } else if (
        existingItem.classification === 'POTENTIAL_MATCH' &&
        existingItem.section === 'PROFILE' &&
        conflictResolution === 'ADD_AS_SEPARATE'
      ) {
        throw AppError.badRequest(
          'Adding as a separate record is not permitted for personal profile records.',
        );
      }

      const payloadToCheck = (userEditedPayload ||
        existingItem.userEditedPayload ||
        existingItem.extractedPayload) as Record<string, any>;

      if (existingItem.section === 'EXPERIENCE') {
        if (
          !payloadToCheck.organization?.trim() ||
          !payloadToCheck.position?.trim() ||
          !payloadToCheck.startDate?.trim()
        ) {
          throw AppError.badRequest(
            'Cannot approve incomplete experience without organization, position, and start date. Please edit this item first.',
          );
        }
      } else if (existingItem.section === 'CERTIFICATION') {
        if (!payloadToCheck.name?.trim() || !payloadToCheck.issuingOrganization?.trim()) {
          throw AppError.badRequest(
            'Cannot approve incomplete certification without name and issuing organization. Please edit this item first.',
          );
        }
      } else if (existingItem.section === 'EDUCATION') {
        if (!payloadToCheck.institution?.trim()) {
          throw AppError.badRequest(
            'Cannot approve incomplete education without institution name. Please edit this item first.',
          );
        }
      } else if (existingItem.section === 'SKILL') {
        if (!payloadToCheck.name?.trim()) {
          throw AppError.badRequest(
            'Cannot approve incomplete skill without name. Please edit this item first.',
          );
        }
      } else if (existingItem.section === 'LANGUAGE') {
        if (!payloadToCheck.language?.trim()) {
          throw AppError.badRequest(
            'Cannot approve incomplete language without language name. Please edit this item first.',
          );
        }
      }
    }

    let updatedClassification = existingItem.classification;
    let updatedConflictDetails = existingItem.conflictDetails;

    if (userEditedPayload) {
      let isNowComplete = false;
      const sec = existingItem.section;
      if (sec === 'EXPERIENCE') {
        isNowComplete = Boolean(
          userEditedPayload.organization?.toString().trim() &&
          userEditedPayload.position?.toString().trim() &&
          userEditedPayload.startDate?.toString().trim(),
        );
      } else if (sec === 'CERTIFICATION') {
        isNowComplete = Boolean(
          userEditedPayload.name?.toString().trim() &&
          userEditedPayload.issuingOrganization?.toString().trim(),
        );
      } else if (sec === 'EDUCATION') {
        isNowComplete = Boolean(userEditedPayload.institution?.toString().trim());
      } else if (sec === 'SKILL') {
        isNowComplete = Boolean(userEditedPayload.name?.toString().trim());
      } else if (sec === 'LANGUAGE') {
        isNowComplete = Boolean(userEditedPayload.language?.toString().trim());
      } else if (sec === 'PROJECT') {
        isNowComplete = Boolean(userEditedPayload.name?.toString().trim());
      } else if (sec === 'LINK') {
        isNowComplete = Boolean(
          userEditedPayload.url?.toString().trim() && userEditedPayload.label?.toString().trim(),
        );
      } else if (sec === 'PROFILE') {
        isNowComplete = Boolean(userEditedPayload.fullName?.toString().trim());
      }

      if (isNowComplete && existingItem.classification === 'INCOMPLETE') {
        updatedClassification = 'NEW';
        updatedConflictDetails = null;
      } else if (
        existingItem.classification === 'POTENTIAL_MATCH' ||
        existingItem.classification === 'CONFLICT'
      ) {
        updatedConflictDetails = null;
      }
    }

    const updateData: Partial<typeof profileImportItems.$inferInsert> = {
      reviewStatus: action,
      classification: updatedClassification,
      conflictDetails: updatedConflictDetails,
      updatedAt: new Date(),
    };

    if (
      userEditedPayload !== undefined ||
      (explicitlyClearedFields && explicitlyClearedFields.length > 0)
    ) {
      const mergedPayload = {
        ...((userEditedPayload || existingItem.userEditedPayload || {}) as Record<string, unknown>),
      };
      if (explicitlyClearedFields && explicitlyClearedFields.length > 0) {
        mergedPayload._clearedFields = explicitlyClearedFields;
      }
      updateData.userEditedPayload = mergedPayload;
    }

    if (conflictResolution !== undefined) {
      updateData.conflictResolution = conflictResolution;
    }

    const [item] = await this.db
      .update(profileImportItems)
      .set(updateData)
      .where(
        and(
          eq(profileImportItems.id, itemId),
          eq(profileImportItems.sessionId, sessionId),
          eq(profileImportItems.userId, userId),
        ),
      )
      .returning();

    return this.mapItemDto(item!);
  }

  /**
   * Bulk updates review status across items in a session
   */
  public async bulkUpdateItems(
    userId: string,
    sessionId: string,
    action: 'APPROVE_ALL_NEW' | 'APPROVE_ALL' | 'REJECT_ALL',
  ): Promise<{ updatedCount: number }> {
    let whereClause = and(
      eq(profileImportItems.sessionId, sessionId),
      eq(profileImportItems.userId, userId),
    );

    if (action === 'APPROVE_ALL_NEW') {
      whereClause = and(
        eq(profileImportItems.sessionId, sessionId),
        eq(profileImportItems.userId, userId),
        eq(profileImportItems.classification, 'NEW'),
      );
    } else if (action === 'APPROVE_ALL') {
      // APPROVE_ALL approves valid items, but skips INCOMPLETE, CONFLICT, and POTENTIAL_MATCH items which require explicit human review/editing
      whereClause = and(
        eq(profileImportItems.sessionId, sessionId),
        eq(profileImportItems.userId, userId),
        sql`${profileImportItems.classification} NOT IN ('INCOMPLETE', 'CONFLICT', 'POTENTIAL_MATCH')`,
      );
    }

    const newStatus: ProfileImportReviewStatus = action === 'REJECT_ALL' ? 'REJECTED' : 'APPROVED';

    const result = await this.db
      .update(profileImportItems)
      .set({
        reviewStatus: newStatus,
        updatedAt: new Date(),
      })
      .where(whereClause)
      .returning();

    return { updatedCount: result.length };
  }

  /**
   * Atomically commits approved/edited items into Candidate Brain.
   * Invariant:
   * - Imported items default to verificationStatus: 'UNVERIFIED' (unless verifyOnCommit is true)
   * - Facts default to allowAiUse: false (unless allowAiOnCommit is true)
   * - Full audit events recorded in candidateAuditEvents
   */
  public async commitSession(
    userId: string,
    sessionId: string,
    options: CommitImportSessionOptions = {},
  ): Promise<CommitImportSessionResult> {
    const session = await this.db.query.profileImportSessions.findFirst({
      where: and(eq(profileImportSessions.id, sessionId), eq(profileImportSessions.userId, userId)),
    });

    if (!session) {
      throw AppError.notFound(`Import session ${sessionId} not found`);
    }

    if (session.status === 'COMMITTED') {
      throw AppError.badRequest('Session has already been committed');
    }

    const approvedItems = await this.db.query.profileImportItems.findMany({
      where: and(
        eq(profileImportItems.sessionId, sessionId),
        eq(profileImportItems.userId, userId),
        eq(profileImportItems.reviewStatus, 'APPROVED'),
      ),
    });

    if (approvedItems.length === 0) {
      throw AppError.badRequest('No approved items found to commit');
    }

    if (options.allowAiOnCommit && !options.verifyOnCommit) {
      throw AppError.badRequest(
        'allowAiUse=true requires verificationStatus=VERIFIED. Facts cannot be authorized for AI use without being verified.',
      );
    }

    const verificationStatus = options.verifyOnCommit ? 'VERIFIED' : 'UNVERIFIED';
    const allowAiUse = verificationStatus === 'VERIFIED' && Boolean(options.allowAiOnCommit);
    const sourceType = 'DOCUMENT';

    let profileUpdated = false;
    let experiencesCreated = 0;
    let educationCreated = 0;
    let skillsCreated = 0;
    let certificationsCreated = 0;
    let languagesCreated = 0;
    let projectsCreated = 0;
    let linksCreated = 0;
    let factsCreated = 0;

    // Execute atomic transaction for candidate brain enrichment
    await this.db.transaction(async (tx) => {
      for (const item of approvedItems) {
        const payload = (item.userEditedPayload || item.extractedPayload) as Record<string, any>;

        // Handle CONFLICT items with explicit conflict resolution
        if (item.classification === 'CONFLICT') {
          const resolution = item.conflictResolution;
          if (
            !resolution ||
            !['KEEP_EXISTING', 'REPLACE_EXISTING', 'ADD_AS_SEPARATE'].includes(resolution)
          ) {
            throw AppError.badRequest(
              `Cannot commit conflicting item "${item.id}" without an explicit conflict resolution (KEEP_EXISTING, REPLACE_EXISTING, or ADD_AS_SEPARATE).`,
            );
          }

          if (resolution === 'KEEP_EXISTING') {
            // 1. KEEP EXISTING:
            // Preserve existing record and verified values.
            // Record alternative source review in audit log without falsely claiming independent verification.
            // Zero database updates to the existing record; zero new records inserted.
            await this.recordAuditTx(tx, {
              userId,
              entityType: item.section,
              entityId: item.existingEntityId || userId,
              action: 'ALTERNATIVE_SOURCE_REVIEWED',
              changedFields: [],
              metadata: {
                conflictResolution: 'KEEP_EXISTING',
                source: session.sourceType,
                sessionId,
                conflictDetails: item.conflictDetails,
                existingPayload: item.existingPayload,
                importedPayload: payload,
              },
            });
            continue;
          }

          if (resolution === 'REPLACE_EXISTING') {
            // 2. REPLACE EXISTING:
            // Update existing entity using existingEntityId. Do not insert duplicates. Preserve audit trail and VERIFIED status.
            const targetVerificationStatus =
              (item.existingPayload as any)?.verificationStatus === 'VERIFIED'
                ? 'VERIFIED'
                : verificationStatus;

            await this.updateExistingEntity(
              tx,
              userId,
              item.section,
              item.existingEntityId || userId,
              payload,
              targetVerificationStatus,
              session,
              'CONFLICT_RESOLVED_REPLACE',
              item.existingPayload,
            );
            if (item.section === 'PROFILE') {
              profileUpdated = true;
            }
            continue;
          }

          // 3. ADD AS SEPARATE:
          if (item.section === 'PROFILE') {
            throw AppError.badRequest(
              'ADD_AS_SEPARATE is not permitted for personal profile records. Please select Keep Existing or Replace Existing.',
            );
          }

          // Fall through to insert branch below, creating a distinct new entity
          await this.recordAuditTx(tx, {
            userId,
            entityType: item.section,
            entityId: userId,
            action: 'CONFLICT_RESOLVED_ADD_SEPARATE',
            changedFields: Object.keys(payload),
            metadata: {
              conflictResolution: 'ADD_AS_SEPARATE',
              source: session.sourceType,
              sessionId,
              existingEntityId: item.existingEntityId,
            },
          });
        }

        // Issue 2 & Issue 6: Handle DUPLICATE, MATCHED, and POTENTIAL_MATCH records
        if (
          item.classification === 'MATCHED' ||
          item.classification === 'DUPLICATE' ||
          item.classification === 'POTENTIAL_MATCH'
        ) {
          if (item.conflictResolution === 'ADD_AS_SEPARATE') {
            if (item.section === 'PROFILE') {
              throw AppError.badRequest(
                'Adding as a separate record is not permitted for personal profile records.',
              );
            }
            await this.recordAuditTx(tx, {
              userId,
              entityType: item.section,
              entityId: userId,
              action: 'ADD_AS_SEPARATE',
              changedFields: Object.keys(payload),
              metadata: {
                source: session.sourceType,
                sessionId,
                existingEntityId: item.existingEntityId,
              },
            });
            // Fall through to insert branch
          } else if (!item.userEditedPayload) {
            // Already present in candidate brain; approved without edit: track supporting source provenance without creating duplicate records
            if (item.existingEntityId && tx.query?.candidateFacts) {
              const existingFacts = await tx.query.candidateFacts.findMany({
                where: and(
                  eq(candidateFacts.userId, userId),
                  eq(candidateFacts.sourceEntityId, item.existingEntityId),
                ),
              });
              for (const fact of existingFacts) {
                const existingVal = (fact.structuredValue || {}) as Record<string, unknown>;
                const sources: string[] = Array.isArray(existingVal.sources)
                  ? [...(existingVal.sources as string[])]
                  : [String(existingVal.documentSource || 'CV')];
                if (!sources.includes(session.sourceType)) {
                  sources.push(session.sourceType);
                }
                await tx
                  .update(candidateFacts)
                  .set({
                    structuredValue: {
                      ...existingVal,
                      sources,
                      lastConfirmedBySource: session.sourceType,
                      lastConfirmedSessionId: session.id,
                    },
                    updatedAt: new Date(),
                  })
                  .where(eq(candidateFacts.id, fact.id));
              }

              await this.recordAuditTx(tx, {
                userId,
                entityType: item.section,
                entityId: item.existingEntityId,
                action: 'CONFIRMED_BY_IMPORT',
                changedFields: ['sources'],
                metadata: {
                  source: session.sourceType,
                  sessionId,
                  documentId: session.documentId,
                },
              });
            }
            continue;
          } else if (item.userEditedPayload && item.existingEntityId) {
            // User explicitly approved their edited changes: update existing entity in database rather than inserting duplicate
            const targetVerificationStatus =
              (item.existingPayload as any)?.verificationStatus === 'VERIFIED'
                ? 'VERIFIED'
                : verificationStatus;

            await this.updateExistingEntity(
              tx,
              userId,
              item.section,
              item.existingEntityId,
              payload,
              targetVerificationStatus,
              session,
              'UPDATE',
              item.existingPayload,
            );
            if (item.section === 'PROFILE') {
              profileUpdated = true;
            }
            continue;
          }
        }

        switch (item.section) {
          case 'PROFILE': {
            let existingProfile: any = null;
            if (tx.query?.candidateProfiles) {
              existingProfile = await tx.query.candidateProfiles.findFirst({
                where: eq(candidateProfiles.userId, userId),
              });
            }
            if (existingProfile) {
              // Existing profile exists: perform field-aware merge, never overwrite existing full name with abbreviated name
              await this.updateExistingEntity(
                tx,
                userId,
                'PROFILE',
                existingProfile.id,
                payload,
                verificationStatus,
                session,
                'UPDATE',
                existingProfile,
              );
              profileUpdated = true;
              break;
            }

            // Candidate has no profile at all: insert new
            await tx.insert(candidateProfiles).values({
              userId,
              fullName: payload.fullName || null,
              preferredName: payload.preferredName || null,
              headline: payload.headline || null,
              email: payload.email || null,
              phone: payload.phone || null,
              city: payload.city || null,
              region: payload.region || null,
              country: payload.country || null,
              summary: payload.summary || null,
              availability: payload.availability || null,
            });

            await this.recordAuditTx(tx, {
              userId,
              entityType: 'PROFILE',
              entityId: userId,
              action: 'CREATE',
              changedFields: Object.keys(payload),
              metadata: { source: session.sourceType, sessionId },
            });
            profileUpdated = true;
            break;
          }

          case 'EXPERIENCE': {
            if (
              !payload.organization?.trim() ||
              !payload.position?.trim() ||
              !payload.startDate?.trim()
            ) {
              throw AppError.badRequest(
                'Cannot commit experience: missing required organization, position, or start date',
              );
            }

            // Deduplication check: do not insert duplicate experience
            const existingExp = await tx.query.candidateExperiences.findFirst({
              where: and(
                eq(candidateExperiences.userId, userId),
                sql`LOWER(TRIM(${candidateExperiences.organization})) = LOWER(TRIM(${payload.organization}))`,
                sql`LOWER(TRIM(${candidateExperiences.position})) = LOWER(TRIM(${payload.position}))`,
                sql`LOWER(TRIM(${candidateExperiences.startDate})) = LOWER(TRIM(${payload.startDate}))`,
              ),
            });
            if (existingExp) {
              continue;
            }

            const [exp] = await tx
              .insert(candidateExperiences)
              .values({
                userId,
                organization: payload.organization.trim(),
                position: payload.position.trim(),
                location: payload.location || null,
                employmentType: payload.employmentType || null,
                startDate: payload.startDate.trim(),
                endDate: payload.endDate || null,
                isCurrent: payload.isCurrent ?? false,
                description: payload.description || null,
                achievements: Array.isArray(payload.achievements) ? payload.achievements : [],
                verificationStatus,
              })
              .returning();

            if (exp) {
              experiencesCreated++;
              await this.recordAuditTx(tx, {
                userId,
                entityType: 'EXPERIENCE',
                entityId: exp.id,
                action: 'CREATE',
                changedFields: Object.keys(payload),
                metadata: { source: session.sourceType, sessionId },
              });

              // Create matching candidate fact
              await tx.insert(candidateFacts).values({
                userId,
                category: 'EXPERIENCE',
                factKey: `experience_${exp.id}`,
                statement: `${exp.position} at ${exp.organization} (${exp.startDate} - ${exp.endDate || 'present'})`,
                structuredValue: {
                  ...payload,
                  documentSource: session.sourceType,
                  sources: [session.sourceType],
                  documentId: session.documentId,
                  originalFilename: session.originalFilename,
                },
                sourceType,
                sourceEntityId: exp.id,
                verificationStatus,
                allowAiUse,
              });
              factsCreated++;
            }
            break;
          }

          case 'EDUCATION': {
            if (!payload.institution?.trim()) {
              throw AppError.badRequest(
                'Cannot commit education: missing required institution name',
              );
            }

            const existingEdu = await tx.query.candidateEducation.findFirst({
              where: and(
                eq(candidateEducation.userId, userId),
                sql`LOWER(TRIM(${candidateEducation.institution})) = LOWER(TRIM(${payload.institution}))`,
                payload.degree
                  ? sql`LOWER(TRIM(COALESCE(${candidateEducation.degree}, ''))) = LOWER(TRIM(${payload.degree}))`
                  : sql`1=1`,
              ),
            });
            if (existingEdu) {
              continue;
            }

            const [edu] = await tx
              .insert(candidateEducation)
              .values({
                userId,
                institution: payload.institution.trim(),
                degree: payload.degree || null,
                fieldOfStudy: payload.fieldOfStudy || null,
                startDate: payload.startDate || null,
                endDate: payload.endDate || null,
                isCurrent: payload.isCurrent ?? false,
                location: payload.location || null,
                description: payload.description || null,
                activities: payload.activities || null,
                verificationStatus,
              })
              .returning();

            if (edu) {
              educationCreated++;
              await this.recordAuditTx(tx, {
                userId,
                entityType: 'EDUCATION',
                entityId: edu.id,
                action: 'CREATE',
                changedFields: Object.keys(payload),
                metadata: { source: session.sourceType, sessionId },
              });

              await tx.insert(candidateFacts).values({
                userId,
                category: 'EDUCATION',
                factKey: `education_${edu.id}`,
                statement: `${edu.degree || 'Degree'} from ${edu.institution}${edu.endDate ? ` (${edu.endDate})` : ''}`,
                structuredValue: {
                  ...payload,
                  documentSource: session.sourceType,
                  sources: [session.sourceType],
                  documentId: session.documentId,
                  originalFilename: session.originalFilename,
                },
                sourceType,
                sourceEntityId: edu.id,
                verificationStatus,
                allowAiUse,
              });
              factsCreated++;
            }
            break;
          }

          case 'SKILL': {
            if (!payload.name?.trim()) {
              throw AppError.badRequest('Cannot commit skill: missing required skill name');
            }

            const normName = payload.name.trim().toLowerCase();
            const existingSkill = await tx.query.candidateSkills.findFirst({
              where: and(
                eq(candidateSkills.userId, userId),
                sql`LOWER(TRIM(${candidateSkills.name})) = ${normName}`,
              ),
            });
            if (existingSkill) {
              continue;
            }

            const [sk] = await tx
              .insert(candidateSkills)
              .values({
                userId,
                name: payload.name.trim(),
                category: payload.category || null,
                proficiency: payload.proficiency || null,
                yearsExperience: payload.yearsExperience ?? null,
                verificationStatus,
                isActive: true,
              })
              .returning();

            if (sk) {
              skillsCreated++;
              await this.recordAuditTx(tx, {
                userId,
                entityType: 'SKILL',
                entityId: sk.id,
                action: 'CREATE',
                changedFields: Object.keys(payload),
                metadata: { source: session.sourceType, sessionId },
              });

              await tx.insert(candidateFacts).values({
                userId,
                category: 'SKILL',
                factKey: `skill_${sk.id}`,
                statement: `Skill: ${sk.name}${sk.proficiency ? ` (${sk.proficiency})` : ''}`,
                structuredValue: {
                  ...payload,
                  documentSource: session.sourceType,
                  sources: [session.sourceType],
                  documentId: session.documentId,
                  originalFilename: session.originalFilename,
                },
                sourceType,
                sourceEntityId: sk.id,
                verificationStatus,
                allowAiUse,
              });
              factsCreated++;
            }
            break;
          }

          case 'CERTIFICATION': {
            if (!payload.name?.trim() || !payload.issuingOrganization?.trim()) {
              throw AppError.badRequest(
                'Cannot commit certification: missing required certification name or issuing organization',
              );
            }

            const existingCert = await tx.query.candidateCertifications.findFirst({
              where: and(
                eq(candidateCertifications.userId, userId),
                sql`LOWER(TRIM(${candidateCertifications.name})) = LOWER(TRIM(${payload.name}))`,
              ),
            });
            if (existingCert) {
              continue;
            }

            const [cert] = await tx
              .insert(candidateCertifications)
              .values({
                userId,
                name: payload.name.trim(),
                issuingOrganization: payload.issuingOrganization.trim(),
                issueDate: payload.issueDate || null,
                expirationDate: payload.expirationDate || null,
                credentialId: payload.credentialId || null,
                credentialUrl: payload.credentialUrl || null,
                verificationStatus,
              })
              .returning();

            if (cert) {
              certificationsCreated++;
              await this.recordAuditTx(tx, {
                userId,
                entityType: 'CERTIFICATION',
                entityId: cert.id,
                action: 'CREATE',
                changedFields: Object.keys(payload),
                metadata: { source: session.sourceType, sessionId },
              });

              await tx.insert(candidateFacts).values({
                userId,
                category: 'CERTIFICATION',
                factKey: `certification_${cert.id}`,
                statement: `Certified: ${cert.name} by ${cert.issuingOrganization}`,
                structuredValue: {
                  ...payload,
                  documentSource: session.sourceType,
                  sources: [session.sourceType],
                  documentId: session.documentId,
                  originalFilename: session.originalFilename,
                },
                sourceType,
                sourceEntityId: cert.id,
                verificationStatus,
                allowAiUse,
              });
              factsCreated++;
            }
            break;
          }

          case 'LANGUAGE': {
            if (!payload.language?.trim()) {
              throw AppError.badRequest('Cannot commit language: missing required language');
            }

            const existingLang = await tx.query.candidateLanguages.findFirst({
              where: and(
                eq(candidateLanguages.userId, userId),
                sql`LOWER(TRIM(${candidateLanguages.language})) = LOWER(TRIM(${payload.language}))`,
              ),
            });
            if (existingLang) {
              continue;
            }

            const [lang] = await tx
              .insert(candidateLanguages)
              .values({
                userId,
                language: payload.language.trim(),
                proficiency: payload.proficiency ? payload.proficiency.trim() : null,
                cefrLevel: payload.cefrLevel || null,
                notes: payload.notes || null,
                verificationStatus,
              })
              .returning();

            if (lang) {
              languagesCreated++;
              await this.recordAuditTx(tx, {
                userId,
                entityType: 'LANGUAGE',
                entityId: lang.id,
                action: 'CREATE',
                changedFields: Object.keys(payload),
                metadata: { source: session.sourceType, sessionId },
              });
            }
            break;
          }

          case 'PROJECT': {
            if (!payload.name?.trim()) {
              throw AppError.badRequest('Cannot commit project: missing required project name');
            }

            const existingProj = await tx.query.candidateProjects.findFirst({
              where: and(
                eq(candidateProjects.userId, userId),
                sql`LOWER(TRIM(${candidateProjects.name})) = LOWER(TRIM(${payload.name}))`,
              ),
            });
            if (existingProj) {
              continue;
            }

            const [proj] = await tx
              .insert(candidateProjects)
              .values({
                userId,
                name: payload.name.trim(),
                role: payload.role || null,
                description: payload.description || null,
                startDate: payload.startDate || null,
                endDate: payload.endDate || null,
                projectUrl: payload.projectUrl || null,
                skills: Array.isArray(payload.skills) ? payload.skills : [],
                achievements: Array.isArray(payload.achievements) ? payload.achievements : [],
                verificationStatus,
              })
              .returning();

            if (proj) {
              projectsCreated++;
              await this.recordAuditTx(tx, {
                userId,
                entityType: 'PROJECT',
                entityId: proj.id,
                action: 'CREATE',
                changedFields: Object.keys(payload),
                metadata: { source: session.sourceType, sessionId },
              });
            }
            break;
          }

          case 'LINK': {
            if (!payload.url?.trim()) {
              throw AppError.badRequest('Cannot commit link: missing required URL');
            }

            const existingLink = await tx.query.candidateLinks.findFirst({
              where: and(
                eq(candidateLinks.userId, userId),
                sql`LOWER(TRIM(${candidateLinks.url})) = LOWER(TRIM(${payload.url}))`,
              ),
            });
            if (existingLink) {
              continue;
            }

            const [lk] = await tx
              .insert(candidateLinks)
              .values({
                userId,
                label: payload.label || 'Portfolio',
                url: payload.url.trim(),
              })
              .returning();

            if (lk) {
              linksCreated++;
              await this.recordAuditTx(tx, {
                userId,
                entityType: 'LINK',
                entityId: lk.id,
                action: 'CREATE',
                changedFields: Object.keys(payload),
                metadata: { source: session.sourceType, sessionId },
              });
            }
            break;
          }
        }
      }

      // Mark session COMMITTED
      await tx
        .update(profileImportSessions)
        .set({
          status: 'COMMITTED',
          updatedAt: new Date(),
        })
        .where(eq(profileImportSessions.id, sessionId));
    });

    // Recalculate profile completeness
    const overview = await this.candidateService.getOverview(userId);

    return {
      sessionId,
      committedCounts: {
        profileUpdated,
        experiencesCreated,
        educationCreated,
        skillsCreated,
        certificationsCreated,
        languagesCreated,
        projectsCreated,
        linksCreated,
        factsCreated,
      },
      newProfileCompleteness: overview.completeness,
    };
  }

  /**
   * Discards an uncommitted session
   */
  public async discardSession(userId: string, sessionId: string): Promise<void> {
    await this.db
      .update(profileImportSessions)
      .set({
        status: 'DISCARDED',
        updatedAt: new Date(),
      })
      .where(
        and(eq(profileImportSessions.id, sessionId), eq(profileImportSessions.userId, userId)),
      );
  }

  // --- Helper Methods ---
  private async loadExistingCandidateBrain(userId: string): Promise<ExistingCandidateBrainState> {
    const [profile, experiences, education, skills, certifications, languages, projects, links] =
      await Promise.all([
        this.candidateService.getProfile(userId),
        this.candidateService.getExperiences(userId),
        this.candidateService.getEducation(userId),
        this.candidateService.getSkills(userId),
        this.candidateService.getCertifications(userId),
        this.candidateService.getLanguages(userId),
        this.candidateService.getProjects(userId),
        this.candidateService.getLinks(userId),
      ]);

    return {
      profile,
      experiences,
      education,
      skills,
      certifications,
      languages,
      projects,
      links,
    };
  }

  private async recordAuditTx(
    tx: any,
    options: {
      userId: string;
      entityType: string;
      entityId: string;
      action: string;
      changedFields: string[];
      metadata: Record<string, unknown>;
    },
  ): Promise<void> {
    try {
      await tx.insert(candidateAuditEvents).values({
        userId: options.userId,
        entityType: options.entityType,
        entityId: options.entityId,
        action: options.action,
        actor: 'USER',
        changedFields: options.changedFields,
        metadata: options.metadata,
      });
    } catch {
      // Non-blocking audit record
    }
  }

  private mapSessionDto(
    session: ProfileImportSession,
    items: ProfileImportItem[],
  ): ProfileImportSessionDto {
    const byClassification: Record<ProfileImportClassification, number> = {
      NEW: 0,
      DUPLICATE: 0,
      MATCHED: 0,
      POTENTIAL_MATCH: 0,
      CONFLICT: 0,
      INCOMPLETE: 0,
      LOW_CONFIDENCE: 0,
    };

    let approved = 0;
    let rejected = 0;
    let pending = 0;

    for (const it of items) {
      const cls = it.classification as ProfileImportClassification;
      if (byClassification[cls] !== undefined) {
        byClassification[cls]++;
      }
      if (it.reviewStatus === 'APPROVED') approved++;
      else if (it.reviewStatus === 'REJECTED') rejected++;
      else pending++;
    }

    return {
      id: session.id,
      userId: session.userId,
      sourceType: session.sourceType as ProfileImportSourceType,
      status: session.status as any,
      originalFilename: session.originalFilename,
      mimeType: session.mimeType,
      storageKey: session.storageKey,
      documentId: session.documentId,
      aiConsentGiven: session.aiConsentGiven,
      extractorUsed: session.extractorUsed as any,
      rawTextSnippet: session.rawTextSnippet,
      errorMessage: session.errorMessage,
      itemCounts: {
        total: items.length,
        approved,
        rejected,
        pending,
        byClassification,
      },
      items: items.map((i) => this.mapItemDto(i)),
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    };
  }

  public static isValueMissing(val: unknown): boolean {
    if (val === undefined || val === null) return true;
    if (typeof val === 'string' && val.trim() === '') return true;
    if (Array.isArray(val) && val.length === 0) return true;
    return false;
  }

  public static hasFieldValueChanged(existingVal: unknown, incomingVal: unknown): boolean {
    if (Array.isArray(existingVal) && Array.isArray(incomingVal)) {
      if (existingVal.length !== incomingVal.length) return true;
      return existingVal.some((item, idx) => item !== incomingVal[idx]);
    }
    if (typeof existingVal === 'string' || typeof incomingVal === 'string') {
      return String(existingVal ?? '').trim() !== String(incomingVal ?? '').trim();
    }
    if (typeof existingVal === 'boolean' || typeof incomingVal === 'boolean') {
      return Boolean(existingVal) !== Boolean(incomingVal);
    }
    if (typeof existingVal === 'number' || typeof incomingVal === 'number') {
      return Number(existingVal) !== Number(incomingVal);
    }
    return existingVal !== incomingVal;
  }

  public static mergeFieldsWithExisting(
    section: string,
    existing: Record<string, any>,
    incoming: Record<string, any>,
    options: { explicitlyClearedFields?: string[]; preserveAbbreviatedName?: boolean } = {},
  ): {
    merged: Record<string, any>;
    changedFields: string[];
    preservedFields: string[];
  } {
    const merged: Record<string, any> = { ...existing };
    const changedFields: string[] = [];
    const preservedFields: string[] = [];
    const clearedFields = new Set(options.explicitlyClearedFields || []);

    const allKeys = new Set([...Object.keys(existing), ...Object.keys(incoming)]);
    allKeys.delete('id');
    allKeys.delete('userId');
    allKeys.delete('createdAt');
    allKeys.delete('updatedAt');
    allKeys.delete('verificationStatus');
    allKeys.delete('_clearedFields');

    for (const key of allKeys) {
      const existingVal = existing[key];
      const incomingVal = incoming[key];

      // 1. Explicit clearing deliberate action
      if (clearedFields.has(key)) {
        merged[key] = Array.isArray(existingVal) ? [] : null;
        if (!SmartProfileImportService.isValueMissing(existingVal)) {
          changedFields.push(key);
        }
        continue;
      }

      // 2. Incoming value is missing / empty: NEVER treat missing imported information as a request to delete existing info
      if (SmartProfileImportService.isValueMissing(incomingVal)) {
        if (!SmartProfileImportService.isValueMissing(existingVal)) {
          merged[key] = existingVal;
          preservedFields.push(key);
        } else {
          merged[key] = incomingVal ?? existingVal ?? null;
        }
        continue;
      }

      // 3. Special rule for PROFILE full name: Abbreviated name must NEVER downgrade or overwrite verified full name
      if (section === 'PROFILE' && key === 'fullName') {
        const existingName = typeof existingVal === 'string' ? existingVal.trim() : '';
        const incomingName = typeof incomingVal === 'string' ? incomingVal.trim() : '';
        if (
          existingName &&
          incomingName &&
          existingName.toLowerCase() !== incomingName.toLowerCase() &&
          ProfileComparisonEngine.isAbbreviatedNameMatch(existingName, incomingName)
        ) {
          merged.fullName = existing.fullName;
          preservedFields.push('fullName');
          continue;
        }
      }

      // 4. Value comparison
      const hasChanged = SmartProfileImportService.hasFieldValueChanged(existingVal, incomingVal);
      if (hasChanged) {
        merged[key] = incomingVal;
        changedFields.push(key);
      } else {
        merged[key] = existingVal !== undefined ? existingVal : incomingVal;
      }
    }

    return { merged, changedFields, preservedFields };
  }

  private async updateExistingEntity(
    tx: any,
    userId: string,
    section: string,
    existingEntityId: string,
    payload: Record<string, any>,
    targetVerificationStatus: 'VERIFIED' | 'UNVERIFIED',
    session: { sourceType: string; id: string },
    auditAction: string = 'UPDATE',
    previousPayload?: Record<string, unknown> | null,
  ): Promise<void> {
    let existingRecord: Record<string, any> | null =
      (previousPayload as Record<string, any>) || null;

    if (!existingRecord && tx.query) {
      switch (section) {
        case 'PROFILE':
          if (tx.query.candidateProfiles) {
            existingRecord = await tx.query.candidateProfiles.findFirst({
              where: and(
                eq(candidateProfiles.id, existingEntityId),
                eq(candidateProfiles.userId, userId),
              ),
            });
            if (!existingRecord) {
              existingRecord = await tx.query.candidateProfiles.findFirst({
                where: eq(candidateProfiles.userId, userId),
              });
            }
          }
          break;
        case 'EXPERIENCE':
          if (tx.query.candidateExperiences) {
            existingRecord = await tx.query.candidateExperiences.findFirst({
              where: and(
                eq(candidateExperiences.id, existingEntityId),
                eq(candidateExperiences.userId, userId),
              ),
            });
          }
          break;
        case 'EDUCATION':
          if (tx.query.candidateEducation) {
            existingRecord = await tx.query.candidateEducation.findFirst({
              where: and(
                eq(candidateEducation.id, existingEntityId),
                eq(candidateEducation.userId, userId),
              ),
            });
          }
          break;
        case 'SKILL':
          if (tx.query.candidateSkills) {
            existingRecord = await tx.query.candidateSkills.findFirst({
              where: and(
                eq(candidateSkills.id, existingEntityId),
                eq(candidateSkills.userId, userId),
              ),
            });
          }
          break;
        case 'CERTIFICATION':
          if (tx.query.candidateCertifications) {
            existingRecord = await tx.query.candidateCertifications.findFirst({
              where: and(
                eq(candidateCertifications.id, existingEntityId),
                eq(candidateCertifications.userId, userId),
              ),
            });
          }
          break;
        case 'LANGUAGE':
          if (tx.query.candidateLanguages) {
            existingRecord = await tx.query.candidateLanguages.findFirst({
              where: and(
                eq(candidateLanguages.id, existingEntityId),
                eq(candidateLanguages.userId, userId),
              ),
            });
          }
          break;
        case 'PROJECT':
          if (tx.query.candidateProjects) {
            existingRecord = await tx.query.candidateProjects.findFirst({
              where: and(
                eq(candidateProjects.id, existingEntityId),
                eq(candidateProjects.userId, userId),
              ),
            });
          }
          break;
        case 'LINK':
          if (tx.query.candidateLinks) {
            existingRecord = await tx.query.candidateLinks.findFirst({
              where: and(
                eq(candidateLinks.id, existingEntityId),
                eq(candidateLinks.userId, userId),
              ),
            });
          }
          break;
      }
    }

    const clearedFields: string[] = Array.isArray(payload._clearedFields)
      ? payload._clearedFields
      : [];

    const { merged, changedFields, preservedFields } =
      SmartProfileImportService.mergeFieldsWithExisting(section, existingRecord || {}, payload, {
        explicitlyClearedFields: clearedFields,
      });

    switch (section) {
      case 'PROFILE': {
        const targetProfileId = existingRecord?.id || existingEntityId;
        await tx
          .update(candidateProfiles)
          .set({
            fullName: merged.fullName ?? null,
            preferredName: merged.preferredName ?? null,
            headline: merged.headline ?? null,
            email: merged.email ?? null,
            phone: merged.phone ?? null,
            city: merged.city ?? null,
            region: merged.region ?? null,
            country: merged.country ?? null,
            summary: merged.summary ?? null,
            availability: merged.availability ?? null,
            updatedAt: new Date(),
          })
          .where(
            and(eq(candidateProfiles.id, targetProfileId), eq(candidateProfiles.userId, userId)),
          );
        break;
      }
      case 'EXPERIENCE': {
        await tx
          .update(candidateExperiences)
          .set({
            organization: merged.organization,
            position: merged.position,
            location: merged.location || null,
            employmentType: merged.employmentType || null,
            startDate: merged.startDate,
            endDate: merged.endDate || null,
            isCurrent: merged.isCurrent ?? false,
            description: merged.description || null,
            achievements: Array.isArray(merged.achievements) ? merged.achievements : [],
            verificationStatus: targetVerificationStatus,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(candidateExperiences.id, existingEntityId),
              eq(candidateExperiences.userId, userId),
            ),
          );
        break;
      }
      case 'EDUCATION': {
        await tx
          .update(candidateEducation)
          .set({
            institution: merged.institution,
            degree: merged.degree || null,
            fieldOfStudy: merged.fieldOfStudy || null,
            startDate: merged.startDate || null,
            endDate: merged.endDate || null,
            isCurrent: merged.isCurrent ?? false,
            location: merged.location || null,
            description: merged.description || null,
            activities: merged.activities || null,
            verificationStatus: targetVerificationStatus,
            updatedAt: new Date(),
          })
          .where(
            and(eq(candidateEducation.id, existingEntityId), eq(candidateEducation.userId, userId)),
          );
        break;
      }
      case 'SKILL': {
        await tx
          .update(candidateSkills)
          .set({
            name: merged.name,
            category: merged.category || null,
            proficiency: merged.proficiency || null,
            yearsExperience: merged.yearsExperience ?? null,
            verificationStatus: targetVerificationStatus,
            updatedAt: new Date(),
          })
          .where(and(eq(candidateSkills.id, existingEntityId), eq(candidateSkills.userId, userId)));
        break;
      }
      case 'CERTIFICATION': {
        await tx
          .update(candidateCertifications)
          .set({
            name: merged.name,
            issuingOrganization: merged.issuingOrganization,
            issueDate: merged.issueDate || null,
            expirationDate: merged.expirationDate || null,
            credentialId: merged.credentialId || null,
            credentialUrl: merged.credentialUrl || null,
            verificationStatus: targetVerificationStatus,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(candidateCertifications.id, existingEntityId),
              eq(candidateCertifications.userId, userId),
            ),
          );
        break;
      }
      case 'LANGUAGE': {
        await tx
          .update(candidateLanguages)
          .set({
            language: merged.language,
            proficiency: merged.proficiency ? String(merged.proficiency).trim() : null,
            cefrLevel: merged.cefrLevel || null,
            notes: merged.notes || null,
            verificationStatus: targetVerificationStatus,
            updatedAt: new Date(),
          })
          .where(
            and(eq(candidateLanguages.id, existingEntityId), eq(candidateLanguages.userId, userId)),
          );
        break;
      }
      case 'PROJECT': {
        await tx
          .update(candidateProjects)
          .set({
            name: merged.name,
            role: merged.role || null,
            description: merged.description || null,
            startDate: merged.startDate || null,
            endDate: merged.endDate || null,
            projectUrl: merged.projectUrl || null,
            skills: Array.isArray(merged.skills) ? merged.skills : [],
            achievements: Array.isArray(merged.achievements) ? merged.achievements : [],
            verificationStatus: targetVerificationStatus,
            updatedAt: new Date(),
          })
          .where(
            and(eq(candidateProjects.id, existingEntityId), eq(candidateProjects.userId, userId)),
          );
        break;
      }
      case 'LINK': {
        await tx
          .update(candidateLinks)
          .set({
            label: merged.label,
            url: merged.url,
            updatedAt: new Date(),
          })
          .where(and(eq(candidateLinks.id, existingEntityId), eq(candidateLinks.userId, userId)));
        break;
      }
    }

    if (tx.query?.candidateFacts && existingEntityId) {
      const existingFacts = await tx.query.candidateFacts.findMany({
        where: and(
          eq(candidateFacts.userId, userId),
          eq(candidateFacts.sourceEntityId, existingEntityId),
        ),
      });
      for (const fact of existingFacts) {
        const existingVal = (fact.structuredValue || {}) as Record<string, unknown>;
        const sources: string[] = Array.isArray(existingVal.sources)
          ? [...(existingVal.sources as string[])]
          : [String(existingVal.documentSource || 'CV')];
        if (!sources.includes(session.sourceType)) {
          sources.push(session.sourceType);
        }
        await tx
          .update(candidateFacts)
          .set({
            structuredValue: {
              ...existingVal,
              ...merged,
              sources,
              lastConfirmedBySource: session.sourceType,
              lastConfirmedSessionId: session.id,
            },
            verificationStatus:
              fact.verificationStatus === 'VERIFIED' ? 'VERIFIED' : targetVerificationStatus,
            updatedAt: new Date(),
          })
          .where(eq(candidateFacts.id, fact.id));
      }
    }

    await this.recordAuditTx(tx, {
      userId,
      entityType: section,
      entityId: existingEntityId,
      action: auditAction,
      changedFields,
      metadata: {
        conflictResolution:
          auditAction === 'CONFLICT_RESOLVED_REPLACE' ? 'REPLACE_EXISTING' : undefined,
        source: session.sourceType,
        sessionId: session.id,
        ...(previousPayload || existingRecord
          ? { previousPayload: previousPayload || existingRecord }
          : {}),
        mergedPayload: merged,
        preservedFields,
      },
    });
  }

  private mapItemDto(item: ProfileImportItem): ProfileImportItemDto {
    const userEdited = item.userEditedPayload as Record<string, unknown> | null;
    const cleared = Array.isArray(userEdited?._clearedFields)
      ? (userEdited?._clearedFields as string[])
      : null;

    return {
      id: item.id,
      sessionId: item.sessionId,
      userId: item.userId,
      section: item.section as any,
      classification: item.classification as any,
      confidenceScore: item.confidenceScore,
      sourceReference: item.sourceReference,
      extractedPayload: item.extractedPayload,
      existingEntityId: item.existingEntityId,
      existingPayload: item.existingPayload,
      conflictDetails: item.conflictDetails,
      reviewStatus: item.reviewStatus as any,
      userEditedPayload: item.userEditedPayload,
      conflictResolution:
        (item.conflictResolution as ProfileImportConflictResolution | null) || null,
      explicitlyClearedFields: cleared,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
}
