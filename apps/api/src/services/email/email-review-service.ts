import { eq, and, desc } from 'drizzle-orm';
import {
  getDb,
  emailReviewItems,
  emailMessages,
  emailThreadLinks,
  applications,
  jobs,
  type Database,
} from '@job-agent/database';
import {
  AppError,
  EmailProcessingStatus,
  EmailProposedAction,
  EmailReviewStatus,
  type EmailReviewItemDto,
  type ResolveReviewItemRequest,
  type ApplicationLifecycleStatus,
} from '@job-agent/shared';
import { ApplicationCrmService } from '../application-crm-service.js';

export class EmailReviewService {
  private db: Database;

  constructor(db?: Database) {
    this.db = db ?? getDb();
  }

  public async listReviewItems(
    userId: string,
    query: { status?: string } = {},
  ): Promise<EmailReviewItemDto[]> {
    const statusFilter = query.status || EmailReviewStatus.PENDING;

    const rows = await this.db
      .select({
        reviewItem: emailReviewItems,
        message: emailMessages,
        jobTitle: jobs.title,
        jobCompany: jobs.company,
        appStatus: applications.status,
      })
      .from(emailReviewItems)
      .innerJoin(emailMessages, eq(emailReviewItems.messageId, emailMessages.id))
      .leftJoin(applications, eq(emailReviewItems.proposedApplicationId, applications.id))
      .leftJoin(jobs, eq(applications.jobId, jobs.id))
      .where(and(eq(emailReviewItems.userId, userId), eq(emailReviewItems.status, statusFilter)))
      .orderBy(desc(emailReviewItems.createdAt));

    return rows.map(({ reviewItem, message, jobTitle, jobCompany, appStatus }) => ({
      id: reviewItem.id,
      messageId: reviewItem.messageId,
      messageSubject: message.subject,
      senderEmail: message.senderEmail,
      senderName: message.senderName,
      receivedAt: message.receivedAt.toISOString(),
      snippet: message.snippet,
      classification: reviewItem.classification as any,
      confidence: reviewItem.confidence,
      proposedAction: reviewItem.proposedAction as any,
      proposedTargetStatus: reviewItem.proposedTargetStatus as any,
      proposedApplicationId: reviewItem.proposedApplicationId,
      proposedJobId: reviewItem.proposedJobId,
      proposedJobTitle: jobTitle,
      proposedCompanyName: jobCompany,
      currentApplicationStatus: (appStatus as ApplicationLifecycleStatus) || null,
      explanation: reviewItem.explanation,
      extractedDetails: reviewItem.extractedDetails,
      riskLevel: reviewItem.riskLevel as any,
      status: reviewItem.status as any,
      resolutionNote: reviewItem.resolutionNote,
      resolvedAt: reviewItem.resolvedAt ? reviewItem.resolvedAt.toISOString() : null,
      createdAt: reviewItem.createdAt.toISOString(),
      updatedAt: reviewItem.updatedAt.toISOString(),
    }));
  }

  public async resolveReviewItem(
    userId: string,
    reviewItemId: string,
    resolution: 'APPROVED' | 'DISMISSED' | 'REJECTED',
    req: ResolveReviewItemRequest = {},
  ): Promise<EmailReviewItemDto> {
    const [item] = await this.db
      .select()
      .from(emailReviewItems)
      .where(and(eq(emailReviewItems.id, reviewItemId), eq(emailReviewItems.userId, userId)))
      .limit(1);

    if (!item) {
      throw AppError.notFound(`Email review item ${reviewItemId} not found`);
    }

    if (item.status !== EmailReviewStatus.PENDING) {
      throw AppError.badRequest(`Review item is already in status ${item.status}`);
    }

    const [msg] = await this.db
      .select()
      .from(emailMessages)
      .where(eq(emailMessages.id, item.messageId))
      .limit(1);

    const targetAppId = req.overrideApplicationId || item.proposedApplicationId;
    const targetStatus = (req.overrideTargetStatus ||
      item.proposedTargetStatus) as ApplicationLifecycleStatus | null;

    if (resolution === 'APPROVED') {
      // Execute the approved action
      if (item.proposedAction === EmailProposedAction.SYNC_STATUS && targetAppId && targetStatus) {
        await ApplicationCrmService.transitionStatus(userId, targetAppId, {
          targetStatus,
          actor: 'USER',
          note: req.resolutionNote || item.explanation,
        });
      }

      // If approved and threadId exists, record thread link confirmed by user
      if (msg && msg.providerThreadId && targetAppId) {
        await this.db
          .insert(emailThreadLinks)
          .values({
            accountId: msg.accountId,
            userId,
            providerThreadId: msg.providerThreadId,
            applicationId: targetAppId,
            jobId: item.proposedJobId,
            confirmedBy: 'USER',
          })
          .onConflictDoUpdate({
            target: [emailThreadLinks.accountId, emailThreadLinks.providerThreadId],
            set: {
              applicationId: targetAppId,
              confirmedBy: 'USER',
              updatedAt: new Date(),
            },
          });
      }
    }

    // Update review item
    const [updated] = await this.db
      .update(emailReviewItems)
      .set({
        status: resolution,
        resolutionNote: req.resolutionNote || null,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(emailReviewItems.id, reviewItemId))
      .returning();

    // Update message processing status
    await this.db
      .update(emailMessages)
      .set({
        processingStatus: EmailProcessingStatus.REVIEWED,
        linkedApplicationId: targetAppId,
        updatedAt: new Date(),
      })
      .where(eq(emailMessages.id, item.messageId));

    const [fullItem] = await this.listReviewItems(userId, { status: resolution });
    if (fullItem) {
      return fullItem;
    }

    return {
      id: updated!.id,
      messageId: updated!.messageId,
      messageSubject: msg?.subject || '',
      senderEmail: msg?.senderEmail || '',
      senderName: msg?.senderName || null,
      receivedAt: msg?.receivedAt.toISOString() || new Date().toISOString(),
      snippet: msg?.snippet || null,
      classification: updated!.classification as any,
      confidence: updated!.confidence,
      proposedAction: updated!.proposedAction as any,
      proposedTargetStatus: updated!.proposedTargetStatus as any,
      proposedApplicationId: updated!.proposedApplicationId,
      proposedJobId: updated!.proposedJobId,
      explanation: updated!.explanation,
      extractedDetails: updated!.extractedDetails,
      riskLevel: updated!.riskLevel as any,
      status: updated!.status as any,
      resolutionNote: updated!.resolutionNote,
      resolvedAt: updated!.resolvedAt ? updated!.resolvedAt.toISOString() : null,
      createdAt: updated!.createdAt.toISOString(),
      updatedAt: updated!.updatedAt.toISOString(),
    };
  }
}
