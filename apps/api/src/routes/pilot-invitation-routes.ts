import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AppError } from '@job-agent/shared';
import type { Database } from '@job-agent/database';
import { PilotInvitationService } from '../services/auth/pilot-invitation-service.js';

export interface PilotInvitationRoutesOptions {
  db: Database;
  invitationService?: PilotInvitationService;
}

const createInviteSchema = z.object({
  invitedEmail: z.string().email().optional(),
  role: z.enum(['user', 'admin']).optional(),
  expiresInDays: z.number().int().min(1).max(90).optional(),
});

const verifyInviteQuerySchema = z.object({
  code: z.string().min(1, 'Invitation code is required'),
  email: z.string().email().optional(),
});

export const pilotInvitationRoutes: FastifyPluginAsync<PilotInvitationRoutesOptions> = async (
  fastify,
  options,
) => {
  const invitationService = options.invitationService ?? new PilotInvitationService(options.db);

  // 1. Public route: verify invitation code
  fastify.get('/verify', async (req, reply) => {
    const parseResult = verifyInviteQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      throw AppError.badRequest(parseResult.error.errors[0]?.message ?? 'Invalid query parameters');
    }

    const { code, email } = parseResult.data;
    const invitation = await invitationService.verifyInvitation(code, email);

    return reply.status(200).send({
      status: 'success',
      data: {
        valid: true,
        invitedEmail: invitation.invitedEmail,
        role: invitation.role,
        expiresAt: invitation.expiresAt.toISOString(),
      },
    });
  });

  // 2. Admin route: generate new invitation
  fastify.post(
    '/invitations',
    {
      preHandler: fastify.requireAdmin,
    },
    async (req, reply) => {
      const parseResult = createInviteSchema.safeParse(req.body ?? {});
      if (!parseResult.success) {
        throw AppError.badRequest(parseResult.error.errors[0]?.message ?? 'Invalid request body');
      }

      const adminUserId = req.user!.id;
      const invitation = await invitationService.createInvitation({
        inviterUserId: adminUserId,
        ...parseResult.data,
      });

      return reply.status(201).send({
        status: 'success',
        data: invitation,
      });
    },
  );

  // 3. Admin route: list all invitations
  fastify.get(
    '/invitations',
    {
      preHandler: fastify.requireAdmin,
    },
    async (req, reply) => {
      const adminUserId = req.user!.id;
      const invitations = await invitationService.listInvitations(adminUserId);

      return reply.status(200).send({
        status: 'success',
        data: invitations,
      });
    },
  );

  // 4. Admin route: revoke invitation
  fastify.post<{ Params: { id: string } }>(
    '/invitations/:id/revoke',
    {
      preHandler: fastify.requireAdmin,
    },
    async (req, reply) => {
      const { id } = req.params;
      const adminUserId = req.user!.id;

      await invitationService.revokeInvitation(adminUserId, id);

      return reply.status(200).send({
        status: 'success',
        message: 'Invitation revoked successfully',
      });
    },
  );
};
