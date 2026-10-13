import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { getConfig } from '@job-agent/config';
import { getDb, pilotInvitations, PilotInvitationStatus, type Database } from '@job-agent/database';
import { eq } from 'drizzle-orm';
import { PilotInvitationService } from '../services/auth/pilot-invitation-service.js';
import { TransactionalEmailService } from '../services/email/transactional-email-service.js';

describe('Pilot Invitation & Deep-Link Onboarding Integration Tests (BL-03)', () => {
  const config = getConfig();
  let db: Database;
  let app: ReturnType<typeof buildApp>;
  let invitationService: PilotInvitationService;
  let emailService: TransactionalEmailService;

  const testAdminId = '00000000-0000-0000-0000-000000000001'; // Asadbek Makhmudov (admin)
  let testInviteId: string;
  let testInviteCode: string;
  const invitedTesterEmail = `tester.pilot.${Date.now()}@example.com`;

  beforeAll(async () => {
    db = getDb(config.DATABASE_URL);
    invitationService = new PilotInvitationService(db);
    emailService = new TransactionalEmailService(config);

    app = buildApp({
      config,
      db,
      pilotInvitationService: invitationService,
      transactionalEmailService: emailService,
    });
    await app.ready();
  });

  afterAll(async () => {
    if (testInviteId) {
      await db.delete(pilotInvitations).where(eq(pilotInvitations.id, testInviteId));
    }
    await app.close();
  });

  describe('1. PilotInvitationService Unit & Invariant Tests', () => {
    it('creates a valid pilot invitation for an admin', async () => {
      const invite = await invitationService.createInvitation({
        inviterUserId: testAdminId,
        invitedEmail: invitedTesterEmail,
        role: 'user',
        expiresInDays: 7,
      });

      expect(invite.id).toBeDefined();
      expect(invite.code).toMatch(/^pilot_/);
      expect(invite.invitedEmail).toBe(invitedTesterEmail.toLowerCase());
      expect(invite.status).toBe(PilotInvitationStatus.PENDING);

      testInviteId = invite.id;
      testInviteCode = invite.code;
    });

    it('finds valid pending invitation by email', async () => {
      const found = await invitationService.findValidInvitationByEmail(invitedTesterEmail);
      expect(found).not.toBeNull();
      expect(found?.code).toBe(testInviteCode);
    });

    it('returns null for an uninvited email', async () => {
      const notFound =
        await invitationService.findValidInvitationByEmail('nonexistent@example.com');
      expect(notFound).toBeNull();
    });

    it('verifies invitation code successfully', async () => {
      const verified = await invitationService.verifyInvitation(testInviteCode, invitedTesterEmail);
      expect(verified.code).toBe(testInviteCode);
    });

    it('rejects invitation when verified with mismatched email', async () => {
      await expect(
        invitationService.verifyInvitation(testInviteCode, 'someoneelse@example.com'),
      ).rejects.toThrow(/specifically/);
    });
  });

  describe('2. Transactional Email Dispatch', () => {
    it('dispatches invitation email with link and code without error', async () => {
      let emailDispatched = false;
      const originalSend = emailService.sendEmail.bind(emailService);
      emailService.sendEmail = async (opts) => {
        expect(opts.to).toBe(invitedTesterEmail);
        expect(opts.subject).toContain('Jobee Private Pilot');
        expect(opts.html).toContain(testInviteCode);
        expect(opts.html).toContain('?invite=');
        emailDispatched = true;
        return { success: true, messageId: 'test-msg-id' };
      };

      await emailService.sendInvitationEmail(
        invitedTesterEmail,
        testInviteCode,
        `https://app.jobee.work/?invite=${testInviteCode}`,
        'Asadbek Makhmudov',
      );

      expect(emailDispatched).toBe(true);
      emailService.sendEmail = originalSend;
    });
  });

  describe('3. HTTP API Endpoints & Onboarding Verification', () => {
    it('public GET /api/pilot/verify validates an invitation code', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/pilot/verify?code=${testInviteCode}&email=${encodeURIComponent(invitedTesterEmail)}`,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('success');
      expect(body.data.valid).toBe(true);
      expect(body.data.invitedEmail).toBe(invitedTesterEmail);
    });

    it('public GET /api/pilot/verify rejects an invalid code', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/pilot/verify?code=invalid_bogus_code_123`,
      });

      expect(res.statusCode).toBe(400);
    });

    it('admin POST /api/pilot/invitations generates new invite and triggers email dispatch', async () => {
      const newTesterEmail = `auto.tester.${Date.now()}@example.com`;
      let emailSent = false;
      const originalSend = emailService.sendEmail.bind(emailService);
      emailService.sendEmail = async (opts) => {
        if (opts.to === newTesterEmail) {
          emailSent = true;
        }
        return { success: true };
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/pilot/invitations',
        headers: { 'x-test-user-id': testAdminId },
        payload: {
          invitedEmail: newTesterEmail,
          role: 'user',
          expiresInDays: 14,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('success');
      expect(body.data.code).toMatch(/^pilot_/);
      expect(emailSent).toBe(true);

      // Clean up newly created invite
      await db.delete(pilotInvitations).where(eq(pilotInvitations.id, body.data.id));
      emailService.sendEmail = originalSend;
    });

    it('blocks non-admin users from creating invitations', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/pilot/invitations',
        headers: { 'x-test-user-id': '00000000-0000-0000-0000-999999999999' },
        payload: {
          invitedEmail: 'unauthorized@example.com',
        },
      });

      expect(res.statusCode).toBe(403);
    });
  });
});
