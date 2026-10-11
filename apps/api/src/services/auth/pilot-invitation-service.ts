import { eq, desc } from 'drizzle-orm';
import crypto from 'node:crypto';
import type { Database } from '@job-agent/database';
import {
  pilotInvitations,
  users,
  PilotInvitationStatus,
  type PilotInvitation,
} from '@job-agent/database';
import { AppError } from '@job-agent/shared';

export interface CreateInvitationInput {
  inviterUserId: string;
  invitedEmail?: string;
  role?: 'user' | 'admin';
  expiresInDays?: number;
}

export interface PilotInvitationDto {
  id: string;
  code: string;
  inviterUserId: string;
  invitedEmail: string | null;
  role: string;
  status: string;
  acceptedByUserId: string | null;
  acceptedAt: string | null;
  expiresAt: string;
  createdAt: string;
}

export class PilotInvitationService {
  constructor(private readonly db: Database) {}

  /**
   * Create a new pilot invitation code. Only admins can generate invitations.
   */
  async createInvitation(input: CreateInvitationInput): Promise<PilotInvitationDto> {
    const { inviterUserId, invitedEmail, role = 'user', expiresInDays = 7 } = input;

    // Verify inviter permissions
    const [inviter] = await this.db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, inviterUserId))
      .limit(1);

    if (!inviter || inviter.role !== 'admin') {
      throw AppError.forbidden('Only administrators can create pilot invitations');
    }

    const code = `pilot_${crypto.randomBytes(12).toString('base64url')}`;
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    const [inserted] = await this.db
      .insert(pilotInvitations)
      .values({
        code,
        inviterUserId,
        invitedEmail: invitedEmail ? invitedEmail.toLowerCase().trim() : null,
        role,
        status: PilotInvitationStatus.PENDING,
        expiresAt,
      })
      .returning();

    if (!inserted) {
      throw AppError.internal('Failed to generate pilot invitation');
    }

    return this.mapToDto(inserted);
  }

  /**
   * Verify an invitation code. Throws AppError if invalid.
   */
  async verifyInvitation(code: string, candidateEmail?: string): Promise<PilotInvitation> {
    const cleanCode = code.trim();
    const [invitation] = await this.db
      .select()
      .from(pilotInvitations)
      .where(eq(pilotInvitations.code, cleanCode))
      .limit(1);

    if (!invitation) {
      throw AppError.badRequest('Invalid invitation code');
    }

    if (invitation.status === PilotInvitationStatus.REVOKED) {
      throw AppError.forbidden('This invitation code has been revoked');
    }

    if (invitation.status === PilotInvitationStatus.ACCEPTED) {
      throw AppError.badRequest('This invitation code has already been redeemed');
    }

    if (new Date() > invitation.expiresAt) {
      await this.db
        .update(pilotInvitations)
        .set({ status: PilotInvitationStatus.EXPIRED, updatedAt: new Date() })
        .where(eq(pilotInvitations.id, invitation.id));
      throw AppError.badRequest('This invitation code has expired');
    }

    if (
      invitation.invitedEmail &&
      candidateEmail &&
      invitation.invitedEmail.toLowerCase() !== candidateEmail.toLowerCase().trim()
    ) {
      throw AppError.forbidden(
        `This invitation was issued specifically for ${invitation.invitedEmail}`,
      );
    }

    return invitation;
  }

  /**
   * Mark an invitation as redeemed by the newly created user.
   */
  async redeemInvitation(code: string, newUserId: string): Promise<void> {
    const invitation = await this.verifyInvitation(code);

    await this.db
      .update(pilotInvitations)
      .set({
        status: PilotInvitationStatus.ACCEPTED,
        acceptedByUserId: newUserId,
        acceptedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(pilotInvitations.id, invitation.id));
  }

  /**
   * List all pilot invitations.
   */
  async listInvitations(adminUserId: string): Promise<PilotInvitationDto[]> {
    const [user] = await this.db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, adminUserId))
      .limit(1);

    if (!user || user.role !== 'admin') {
      throw AppError.forbidden('Only administrators can list invitations');
    }

    const rows = await this.db
      .select()
      .from(pilotInvitations)
      .orderBy(desc(pilotInvitations.createdAt));

    return rows.map((r) => this.mapToDto(r));
  }

  /**
   * Revoke an invitation code.
   */
  async revokeInvitation(adminUserId: string, invitationId: string): Promise<void> {
    const [user] = await this.db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, adminUserId))
      .limit(1);

    if (!user || user.role !== 'admin') {
      throw AppError.forbidden('Only administrators can revoke invitations');
    }

    await this.db
      .update(pilotInvitations)
      .set({ status: PilotInvitationStatus.REVOKED, updatedAt: new Date() })
      .where(eq(pilotInvitations.id, invitationId));
  }

  private mapToDto(r: PilotInvitation): PilotInvitationDto {
    return {
      id: r.id,
      code: r.code,
      inviterUserId: r.inviterUserId,
      invitedEmail: r.invitedEmail,
      role: r.role,
      status: r.status,
      acceptedByUserId: r.acceptedByUserId,
      acceptedAt: r.acceptedAt ? r.acceptedAt.toISOString() : null,
      expiresAt: r.expiresAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
    };
  }
}
