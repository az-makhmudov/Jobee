import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { getConfig } from '@job-agent/config';
import {
  closeDbPool,
  getDb,
  users,
  sessions,
  accounts,
  pilotInvitations,
  candidateProfiles,
  jobPreferences,
  applicationPolicy,
  eq,
  inArray,
} from '@job-agent/database';
import { PilotInvitationStatus } from '@job-agent/shared';

describe('Better Auth, Multi-User Isolation & Private Pilot Integration Tests', () => {
  const config = getConfig();
  let app: ReturnType<typeof buildApp>;
  const db = getDb(config.DATABASE_URL);

  const createdUserIds: string[] = [];
  const createdInviteIds: string[] = [];
  const timestamp = Date.now();

  let adminUserId: string;

  beforeAll(async () => {
    app = buildApp({ config });
    await app.ready();

    // 1. Ensure admin user exists for test operations
    const [adminUser] = await db
      .insert(users)
      .values({
        name: 'Admin Tester',
        email: `admin_${timestamp}@example.com`,
        emailVerified: true,
        role: 'admin',
        systemKey: `admin_${timestamp}`,
      })
      .returning();
    if (!adminUser) throw new Error('Failed to insert adminUser');
    adminUserId = adminUser.id;
    createdUserIds.push(adminUserId);
  });

  afterAll(async () => {
    // Teardown created test entities
    if (createdInviteIds.length > 0) {
      await db.delete(pilotInvitations).where(inArray(pilotInvitations.id, createdInviteIds));
    }
    if (createdUserIds.length > 0) {
      await db.delete(candidateProfiles).where(inArray(candidateProfiles.userId, createdUserIds));
      await db.delete(jobPreferences).where(inArray(jobPreferences.userId, createdUserIds));
      await db.delete(applicationPolicy).where(inArray(applicationPolicy.userId, createdUserIds));
      await db.delete(sessions).where(inArray(sessions.userId, createdUserIds));
      await db.delete(accounts).where(inArray(accounts.userId, createdUserIds));
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }

    await app.close();
    await closeDbPool();
  });

  describe('1. Pilot Invitation Lifecycle & Access Control', () => {
    it('allows admin to create an invitation and non-admin is forbidden', async () => {
      // Non-admin attempt should be forbidden (403)
      const nonAdminRes = await app.inject({
        method: 'POST',
        url: '/api/pilot/invitations',
        headers: {
          'x-test-user-id': '00000000-0000-0000-0000-000000000099',
        },
        payload: {
          role: 'user',
        },
      });
      expect(nonAdminRes.statusCode).toBe(403);

      // Admin attempt should succeed (201)
      const adminRes = await app.inject({
        method: 'POST',
        url: '/api/pilot/invitations',
        headers: {
          'x-test-user-id': adminUserId,
          'x-test-user-role': 'admin',
        },
        payload: {
          role: 'user',
          expiresInDays: 7,
        },
      });
      expect(adminRes.statusCode).toBe(201);
      const body = JSON.parse(adminRes.body).data;
      expect(body.code).toMatch(/^pilot_/);
      expect(body.status).toBe(PilotInvitationStatus.PENDING);
      createdInviteIds.push(body.id);
    });

    it('verifies valid invitation code via public endpoint and rejects invalid codes', async () => {
      // 1. Create a known test invitation
      const [invite] = await db
        .insert(pilotInvitations)
        .values({
          code: `pilot_valid_${timestamp}`,
          inviterUserId: adminUserId,
          role: 'user',
          status: PilotInvitationStatus.PENDING,
          expiresAt: new Date(Date.now() + 86400000),
        })
        .returning();
      if (!invite) throw new Error('Failed to insert invite');
      createdInviteIds.push(invite.id);

      // 2. Public verification for valid code
      const validRes = await app.inject({
        method: 'GET',
        url: `/api/pilot/verify?code=${invite.code}`,
      });
      expect(validRes.statusCode).toBe(200);
      const validBody = JSON.parse(validRes.body).data;
      expect(validBody.valid).toBe(true);

      // 3. Verification for nonexistent code
      const invalidRes = await app.inject({
        method: 'GET',
        url: '/api/pilot/verify?code=nonexistent_code_123',
      });
      expect(invalidRes.statusCode).toBe(400);

      // 4. Verification for revoked code
      await db
        .update(pilotInvitations)
        .set({ status: PilotInvitationStatus.REVOKED })
        .where(eq(pilotInvitations.id, invite.id));

      const revokedRes = await app.inject({
        method: 'GET',
        url: `/api/pilot/verify?code=${invite.code}`,
      });
      expect(revokedRes.statusCode).toBe(403);
    });

    it('allows admin to list and revoke invitations', async () => {
      // Create an invitation to revoke
      const [invite] = await db
        .insert(pilotInvitations)
        .values({
          code: `pilot_to_revoke_${timestamp}`,
          inviterUserId: adminUserId,
          role: 'user',
          status: PilotInvitationStatus.PENDING,
          expiresAt: new Date(Date.now() + 86400000),
        })
        .returning();
      if (!invite) throw new Error('Failed to insert invite');
      createdInviteIds.push(invite.id);

      // List invitations as admin
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/pilot/invitations',
        headers: {
          'x-test-user-id': adminUserId,
          'x-test-user-role': 'admin',
        },
      });
      expect(listRes.statusCode).toBe(200);
      const list = JSON.parse(listRes.body).data;
      expect(list.some((i: any) => i.id === invite.id)).toBe(true);

      // Revoke invitation as admin
      const revokeRes = await app.inject({
        method: 'POST',
        url: `/api/pilot/invitations/${invite.id}/revoke`,
        headers: {
          'x-test-user-id': adminUserId,
          'x-test-user-role': 'admin',
        },
      });
      expect(revokeRes.statusCode).toBe(200);

      // Verify status updated in DB
      const [updated] = await db
        .select()
        .from(pilotInvitations)
        .where(eq(pilotInvitations.id, invite.id));
      if (!updated) throw new Error('Failed to fetch updated invite');
      expect(updated.status).toBe(PilotInvitationStatus.REVOKED);
    });
  });

  describe('2. Authentication Rejection & Unauthenticated Protection', () => {
    it('rejects unauthenticated requests to protected candidate overview endpoint', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/candidate/overview',
        headers: {
          'x-require-auth': 'true',
        },
      });
      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('error');
      expect(body.error.code).toBe('UNAUTHORIZED');

      // Check job routes reject unauthenticated
      const jobsRes = await app.inject({
        method: 'GET',
        url: '/api/jobs',
        headers: { 'x-require-auth': 'true' },
      });
      expect(jobsRes.statusCode).toBe(401);

      // Check application routes reject unauthenticated
      const appsRes = await app.inject({
        method: 'GET',
        url: '/api/applications',
        headers: { 'x-require-auth': 'true' },
      });
      expect(appsRes.statusCode).toBe(401);

      // Check email routes reject unauthenticated
      const emailRes = await app.inject({
        method: 'GET',
        url: '/api/email/accounts',
        headers: { 'x-require-auth': 'true' },
      });
      expect(emailRes.statusCode).toBe(401);

      // Check calendar routes reject unauthenticated
      const calRes = await app.inject({
        method: 'GET',
        url: '/api/calendar/accounts',
        headers: { 'x-require-auth': 'true' },
      });
      expect(calRes.statusCode).toBe(401);
    });

    it('allows public health and readiness checks without authentication', async () => {
      const healthRes = await app.inject({ method: 'GET', url: '/api/health' });
      expect(healthRes.statusCode).toBe(200);

      const readyRes = await app.inject({ method: 'GET', url: '/api/ready' });
      expect(readyRes.statusCode).toBe(200);
    });
  });

  describe('3. Multi-User Tenant Workspace Isolation', () => {
    it('isolates candidate profile and preferences between two different users', async () => {
      // Create User A
      const [userA] = await db
        .insert(users)
        .values({
          name: 'Alice Candidate',
          email: `alice_${timestamp}@example.com`,
          emailVerified: true,
          role: 'user',
          systemKey: `user_a_${timestamp}`,
        })
        .returning();
      if (!userA) throw new Error('Failed to insert userA');
      createdUserIds.push(userA.id);

      // Create User B
      const [userB] = await db
        .insert(users)
        .values({
          name: 'Bob Candidate',
          email: `bob_${timestamp}@example.com`,
          emailVerified: true,
          role: 'user',
          systemKey: `user_b_${timestamp}`,
        })
        .returning();
      if (!userB) throw new Error('Failed to insert userB');
      createdUserIds.push(userB.id);

      // User A updates her profile
      const updateARes = await app.inject({
        method: 'PUT',
        url: '/api/candidate/profile',
        headers: {
          'x-test-user-id': userA.id,
        },
        payload: {
          fullName: 'Alice Candidate A',
          email: `alice_${timestamp}@example.com`,
          headline: 'Senior Distributed Systems Engineer',
          city: 'Berlin',
          country: 'Germany',
        },
      });
      expect(updateARes.statusCode).toBe(200);

      // User B updates his profile
      const updateBRes = await app.inject({
        method: 'PUT',
        url: '/api/candidate/profile',
        headers: {
          'x-test-user-id': userB.id,
        },
        payload: {
          fullName: 'Bob Candidate B',
          email: `bob_${timestamp}@example.com`,
          headline: 'Lead Mobile Architect',
          city: 'Tokyo',
          country: 'Japan',
        },
      });
      expect(updateBRes.statusCode).toBe(200);

      // Fetch User A profile -> must return Alice
      const getARes = await app.inject({
        method: 'GET',
        url: '/api/candidate/profile',
        headers: {
          'x-test-user-id': userA.id,
        },
      });
      expect(getARes.statusCode).toBe(200);
      const profileA = JSON.parse(getARes.body).data;
      expect(profileA.fullName).toBe('Alice Candidate A');
      expect(profileA.headline).toBe('Senior Distributed Systems Engineer');
      expect(profileA.city).toBe('Berlin');

      // Fetch User B profile -> must return Bob
      const getBRes = await app.inject({
        method: 'GET',
        url: '/api/candidate/profile',
        headers: {
          'x-test-user-id': userB.id,
        },
      });
      expect(getBRes.statusCode).toBe(200);
      const profileB = JSON.parse(getBRes.body).data;
      expect(profileB.fullName).toBe('Bob Candidate B');
      expect(profileB.headline).toBe('Lead Mobile Architect');
      expect(profileB.city).toBe('Tokyo');
    });
  });

  describe('4. Owner Account & Data Isolation Verification', () => {
    it('verifies owner account bypasses invitation, receives admin role, and handles case-insensitivity', async () => {
      const { createBetterAuthInstance } = await import('../auth/better-auth-instance.js');
      const auth = createBetterAuthInstance(db, config);
      const userCreateBefore = (auth.options as any).databaseHooks?.user?.create?.before;
      expect(userCreateBefore).toBeDefined();

      // 1. Owner exact email
      const ownerUser = { email: 'asadbek.mzw@gmail.com' } as any;
      await expect(userCreateBefore(ownerUser)).resolves.not.toThrow();
      expect(ownerUser.role).toBe('admin');

      // 2. Owner uppercase email (case-insensitive recognition)
      const ownerUpperUser = { email: 'ASADBEK.MZW@GMAIL.COM' } as any;
      await expect(userCreateBefore(ownerUpperUser)).resolves.not.toThrow();
      expect(ownerUpperUser.role).toBe('admin');

      // 3. Non-owner without invitation must be forbidden
      const nonOwnerUser = { email: 'unauthorized_stranger@example.com' } as any;
      await expect(userCreateBefore(nonOwnerUser)).rejects.toThrow();
    });

    it('verifies owner account uniqueness, seed candidate linking, and multi-tenant data isolation', async () => {
      const { createBetterAuthInstance } = await import('../auth/better-auth-instance.js');
      const auth = createBetterAuthInstance(db, config);
      const userCreateAfter = (auth.options as any).databaseHooks?.user?.create?.after;
      expect(userCreateAfter).toBeDefined();

      const seedUserId = '00000000-0000-0000-0000-000000000001';

      // 1. Verify primary owner user exists in database with admin role
      const [existingOwner] = await db.select().from(users).where(eq(users.id, seedUserId));
      expect(existingOwner).toBeDefined();
      expect(existingOwner?.email).toBe('asadbek.mzw@gmail.com');
      expect(existingOwner?.role).toBe('admin');

      // 2. Verify candidate profile is linked to primary owner
      const [seedProfile] = await db
        .select()
        .from(candidateProfiles)
        .where(eq(candidateProfiles.userId, seedUserId));
      expect(seedProfile).toBeDefined();
      expect(seedProfile?.userId).toBe(seedUserId);

      // 3. Verify unique constraint prevents duplicate owner accounts
      const duplicateOwnerId = '22222222-2222-2222-2222-222222222222';
      await expect(
        db.insert(users).values({
          id: duplicateOwnerId,
          name: 'Fake Owner',
          email: 'asadbek.mzw@gmail.com',
          role: 'user',
          emailVerified: true,
        }),
      ).rejects.toThrow();

      // 4. Verify candidate profile 1:1 uniqueness constraint
      await expect(
        db.insert(candidateProfiles).values({
          userId: seedUserId,
          fullName: 'Duplicate Profile Attempt',
          email: 'duplicate@example.com',
        }),
      ).rejects.toThrow();

      // 5. Verify owner registration hook execution preserves existing profile
      await userCreateAfter({
        id: seedUserId,
        email: 'asadbek.mzw@gmail.com',
        name: 'Asadbek Makhmudov',
      });

      const [preservedProfile] = await db
        .select()
        .from(candidateProfiles)
        .where(eq(candidateProfiles.userId, seedUserId));
      expect(preservedProfile).toBeDefined();
      expect(preservedProfile?.id).toBe(seedProfile?.id);
      expect(preservedProfile?.email).toBe('asadbek.mzw@gmail.com');

      // 6. Test data isolation guard: non-seed user profile CANNOT be re-linked to another user
      const victimUserId = '44444444-4444-4444-4444-444444444444';
      const attackerUserId = '55555555-5555-5555-5555-555555555555';
      const victimEmail = `victim_${Date.now()}@example.com`;

      const [victimUser] = await db
        .insert(users)
        .values({
          id: victimUserId,
          name: 'Victim User',
          email: victimEmail,
          role: 'user',
          emailVerified: true,
        })
        .returning();
      createdUserIds.push(victimUser!.id);

      const [attackerUser] = await db
        .insert(users)
        .values({
          id: attackerUserId,
          name: 'Attacker User',
          email: `attacker_${Date.now()}@example.com`,
          role: 'user',
          emailVerified: true,
        })
        .returning();
      createdUserIds.push(attackerUser!.id);

      const [victimProfile] = await db
        .insert(candidateProfiles)
        .values({
          userId: victimUserId,
          fullName: 'Victim Profile',
          email: victimEmail,
        })
        .returning();

      // Attacker attempts to claim victim profile by presenting victimEmail in hook
      await userCreateAfter({
        id: attackerUserId,
        email: victimEmail,
        name: 'Attacker User',
      });

      // Verify victim profile userId remains strictly victimUserId (NEVER relinked to attacker)
      const [protectedProfile] = await db
        .select()
        .from(candidateProfiles)
        .where(eq(candidateProfiles.id, victimProfile!.id));
      expect(protectedProfile?.userId).toBe(victimUserId);

      // Clean up victim profile
      await db.delete(candidateProfiles).where(eq(candidateProfiles.id, victimProfile!.id));
    });
  });
});
