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
   */
  public async createSession(
    userId: string,
    fileBuffer: Buffer,
    fileMeta: { originalFilename: string; mimeType: string },
    sourceType: ProfileImportSourceType = 'CV',
  ): Promise<ProfileImportSessionDto> {
    // 1. Upload to storage
    const storageResult = await this.storage.saveFile(fileBuffer, fileMeta);

    // 2. Also register in Document Vault as a candidate document
    const isMaster = sourceType === 'CV';
    const [docRow] = await this.db
      .insert(candidateDocuments)
      .values({
        userId,
        documentType: sourceType === 'LINKEDIN_PDF' ? 'OTHER' : 'MASTER_CV',
        displayName: `${sourceType === 'LINKEDIN_PDF' ? 'LinkedIn Export' : 'CV'} - ${fileMeta.originalFilename}`,
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
    const [session] = await this.db
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
  ): Promise<ProfileImportItemDto> {
    const [item] = await this.db
      .update(profileImportItems)
      .set({
        reviewStatus: action,
        userEditedPayload: userEditedPayload ?? undefined,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(profileImportItems.id, itemId),
          eq(profileImportItems.sessionId, sessionId),
          eq(profileImportItems.userId, userId),
        ),
      )
      .returning();

    if (!item) {
      throw AppError.notFound(`Import item ${itemId} not found`);
    }

    return this.mapItemDto(item);
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
        sql`${profileImportItems.reviewStatus} IN ('APPROVED', 'EDITED')`,
      ),
    });

    if (approvedItems.length === 0) {
      throw AppError.badRequest('No approved items found to commit');
    }

    const verificationStatus = options.verifyOnCommit ? 'VERIFIED' : 'UNVERIFIED';
    const allowAiUse = options.allowAiOnCommit ?? false;
    const sourceType = session.sourceType === 'LINKEDIN_PDF' ? 'DOCUMENT' : 'DOCUMENT';

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

        switch (item.section) {
          case 'PROFILE': {
            await tx
              .insert(candidateProfiles)
              .values({
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
              })
              .onConflictDoUpdate({
                target: [candidateProfiles.userId],
                set: {
                  fullName: payload.fullName || sql`candidate_profiles.full_name`,
                  headline: payload.headline || sql`candidate_profiles.headline`,
                  email: payload.email || sql`candidate_profiles.email`,
                  phone: payload.phone || sql`candidate_profiles.phone`,
                  city: payload.city || sql`candidate_profiles.city`,
                  region: payload.region || sql`candidate_profiles.region`,
                  country: payload.country || sql`candidate_profiles.country`,
                  summary: payload.summary || sql`candidate_profiles.summary`,
                  updatedAt: new Date(),
                },
              });

            await this.recordAuditTx(tx, {
              userId,
              entityType: 'PROFILE',
              entityId: userId,
              action: 'UPDATE',
              changedFields: Object.keys(payload),
              metadata: { source: session.sourceType, sessionId },
            });
            profileUpdated = true;
            break;
          }

          case 'EXPERIENCE': {
            const [exp] = await tx
              .insert(candidateExperiences)
              .values({
                userId,
                organization: payload.organization || 'Organization',
                position: payload.position || 'Role',
                location: payload.location || null,
                employmentType: payload.employmentType || null,
                startDate: payload.startDate || '2020',
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
                structuredValue: payload,
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
            const [edu] = await tx
              .insert(candidateEducation)
              .values({
                userId,
                institution: payload.institution || 'Institution',
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
                structuredValue: payload,
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
            const [sk] = await tx
              .insert(candidateSkills)
              .values({
                userId,
                name: payload.name || 'Skill',
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
                structuredValue: payload,
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
            const [cert] = await tx
              .insert(candidateCertifications)
              .values({
                userId,
                name: payload.name || 'Certification',
                issuingOrganization: payload.issuingOrganization || 'Issuing Body',
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
                structuredValue: payload,
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
            const [lang] = await tx
              .insert(candidateLanguages)
              .values({
                userId,
                language: payload.language || 'Language',
                proficiency: payload.proficiency || 'Professional',
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
            const [proj] = await tx
              .insert(candidateProjects)
              .values({
                userId,
                name: payload.name || 'Project',
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
            const [lk] = await tx
              .insert(candidateLinks)
              .values({
                userId,
                label: payload.label || 'Link',
                url: payload.url || 'https://',
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
      if (it.reviewStatus === 'APPROVED' || it.reviewStatus === 'EDITED') approved++;
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

  private mapItemDto(item: ProfileImportItem): ProfileImportItemDto {
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
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
}
