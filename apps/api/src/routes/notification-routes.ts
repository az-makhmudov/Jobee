import type { FastifyPluginAsync } from 'fastify';
import { getOrCreatePrimaryUser, type Database } from '@job-agent/database';
import { NotificationService } from '../services/notifications/notification-service.js';
import {
  listNotificationsQuerySchema,
  notificationParamsSchema,
  createNotificationSchema,
  updateNotificationPreferencesSchema,
} from './notification-schemas.js';

export interface NotificationRoutesOptions {
  db: Database;
}

export const notificationRoutes: FastifyPluginAsync<NotificationRoutesOptions> = async (
  fastify,
  opts,
) => {
  const service = new NotificationService(opts.db, fastify.log as any);

  const { getCurrentUserId } = await import('../plugins/auth-plugin.js');

  const getUserId = async (request: any): Promise<string> => {
    return getCurrentUserId() ?? request.userId ?? (await getOrCreatePrimaryUser(opts.db)).id;
  };

  // GET /api/notifications
  fastify.get('/', async (request, reply) => {
    const userId = await getUserId(request);
    const query = listNotificationsQuerySchema.parse(request.query);
    const result = await service.listNotifications(userId, query);

    return reply.status(200).send({
      status: 'ok',
      data: result,
    });
  });

  // POST /api/notifications (internal or manual dispatch)
  fastify.post('/', async (request, reply) => {
    const userId = await getUserId(request);
    const body = createNotificationSchema.parse(request.body);
    const notification = await service.createNotification(userId, body);

    return reply.status(201).send({
      status: 'ok',
      data: notification,
    });
  });

  // GET /api/notifications/unread-count
  fastify.get('/unread-count', async (request, reply) => {
    const userId = await getUserId(request);
    const count = await service.getUnreadCount(userId);

    return reply.status(200).send({
      status: 'ok',
      data: { unreadCount: count },
    });
  });

  // PATCH /api/notifications/:id/read
  fastify.patch('/:id/read', async (request, reply) => {
    const userId = await getUserId(request);
    const params = notificationParamsSchema.parse(request.params);
    const updated = await service.markAsRead(userId, params.id);

    return reply.status(200).send({
      status: 'ok',
      data: updated,
    });
  });

  // POST /api/notifications/read-all
  fastify.post('/read-all', async (request, reply) => {
    const userId = await getUserId(request);
    const result = await service.markAllAsRead(userId);

    return reply.status(200).send({
      status: 'ok',
      data: result,
    });
  });

  // DELETE /api/notifications/:id
  fastify.delete('/:id', async (request, reply) => {
    const userId = await getUserId(request);
    const params = notificationParamsSchema.parse(request.params);
    await service.dismissNotification(userId, params.id);

    return reply.status(200).send({
      status: 'ok',
      message: 'Notification dismissed',
    });
  });

  // GET /api/notifications/preferences
  fastify.get('/preferences', async (request, reply) => {
    const userId = await getUserId(request);
    const prefs = await service.getPreferences(userId);

    return reply.status(200).send({
      status: 'ok',
      data: prefs,
    });
  });

  // PUT /api/notifications/preferences
  fastify.put('/preferences', async (request, reply) => {
    const userId = await getUserId(request);
    const body = updateNotificationPreferencesSchema.parse(request.body);
    const updated = await service.updatePreferences(userId, body);

    return reply.status(200).send({
      status: 'ok',
      data: updated,
    });
  });
};
