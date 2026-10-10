import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../app.js';
import { getConfig } from '@job-agent/config';
import { getDb, users, systemNotifications, eq } from '@job-agent/database';
import { FastifyInstance } from 'fastify';

describe('Notification Routes Integration Tests', () => {
  let app: FastifyInstance;
  let testUserId: string;
  const config = getConfig();
  const db = getDb(config.DATABASE_URL);

  beforeEach(async () => {
    app = buildApp({ config, db });
    await app.ready();

    // Ensure a test user exists
    const [testUser] = await db
      .insert(users)
      .values({
        systemKey: `test_notif_${Date.now()}`,
      })
      .returning();
    testUserId = testUser!.id;
  });

  afterEach(async () => {
    if (testUserId) {
      await db.delete(systemNotifications).where(eq(systemNotifications.userId, testUserId));
      await db.delete(users).where(eq(users.id, testUserId));
    }
    await app.close();
  });

  it('POST /api/notifications creates a notification and GET /api/notifications retrieves it', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/notifications',
      payload: {
        type: 'SYSTEM_ALERT',
        title: 'System Maintenance Window',
        message: 'Scheduled maintenance in 2 hours.',
        severity: 'INFO',
      },
    });

    expect(createRes.statusCode).toBe(201);
    const createBody = JSON.parse(createRes.body);
    expect(createBody.status).toBe('ok');
    expect(createBody.data.title).toBe('System Maintenance Window');
    const notificationId = createBody.data.id;

    // GET /api/notifications/unread-count
    const countRes = await app.inject({
      method: 'GET',
      url: '/api/notifications/unread-count',
    });
    expect(countRes.statusCode).toBe(200);
    const countBody = JSON.parse(countRes.body);
    expect(countBody.data.unreadCount).toBeGreaterThanOrEqual(1);

    // PATCH /api/notifications/:id/read
    const markReadRes = await app.inject({
      method: 'PATCH',
      url: `/api/notifications/${notificationId}/read`,
    });
    expect(markReadRes.statusCode).toBe(200);
    const markReadBody = JSON.parse(markReadRes.body);
    expect(markReadBody.data.status).toBe('READ');
    expect(markReadBody.data.readAt).toBeDefined();

    // DELETE /api/notifications/:id
    const dismissRes = await app.inject({
      method: 'DELETE',
      url: `/api/notifications/${notificationId}`,
    });
    expect(dismissRes.statusCode).toBe(200);
  });

  it('GET and PUT /api/notifications/preferences manages user preferences', async () => {
    const getRes = await app.inject({
      method: 'GET',
      url: '/api/notifications/preferences',
    });
    expect(getRes.statusCode).toBe(200);
    const getBody = JSON.parse(getRes.body);
    expect(getBody.data.emailNotificationsEnabled).toBe(true);

    const updateRes = await app.inject({
      method: 'PUT',
      url: '/api/notifications/preferences',
      payload: {
        dailyDigestEnabled: true,
        notifyOnCaptchaHalt: true,
      },
    });
    expect(updateRes.statusCode).toBe(200);
    const updateBody = JSON.parse(updateRes.body);
    expect(updateBody.data.dailyDigestEnabled).toBe(true);
  });
});
