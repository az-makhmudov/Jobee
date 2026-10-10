import type {
  SystemNotificationDto,
  NotificationPreferencesDto,
  UpdateNotificationPreferencesRequest,
  NotificationStatus,
} from '@job-agent/shared';

const API_BASE = '/api';

export class NotificationClient {
  static async list(
    query: { status?: NotificationStatus; limit?: number; offset?: number } = {},
  ): Promise<{
    notifications: SystemNotificationDto[];
    total: number;
  }> {
    const params = new URLSearchParams();
    if (query.status) params.append('status', query.status);
    if (query.limit) params.append('limit', String(query.limit));
    if (query.offset) params.append('offset', String(query.offset));

    const res = await fetch(`${API_BASE}/notifications?${params.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Failed to fetch notifications: HTTP ${res.status}`);
    }
    const json = await res.json();
    return json.data;
  }

  static async getUnreadCount(): Promise<number> {
    const res = await fetch(`${API_BASE}/notifications/unread-count`);
    if (!res.ok) {
      return 0;
    }
    const json = await res.json();
    return json.data?.unreadCount || 0;
  }

  static async markAsRead(id: string): Promise<SystemNotificationDto> {
    const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
      method: 'PATCH',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err?.error?.message || `Failed to mark notification as read: HTTP ${res.status}`,
      );
    }
    const json = await res.json();
    return json.data;
  }

  static async markAllAsRead(): Promise<number> {
    const res = await fetch(`${API_BASE}/notifications/read-all`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Failed to mark all as read: HTTP ${res.status}`);
    }
    const json = await res.json();
    return json.data?.count || 0;
  }

  static async dismiss(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/notifications/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Failed to dismiss notification: HTTP ${res.status}`);
    }
  }

  static async getPreferences(): Promise<NotificationPreferencesDto> {
    const res = await fetch(`${API_BASE}/notifications/preferences`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err?.error?.message || `Failed to fetch notification preferences: HTTP ${res.status}`,
      );
    }
    const json = await res.json();
    return json.data;
  }

  static async updatePreferences(
    update: UpdateNotificationPreferencesRequest,
  ): Promise<NotificationPreferencesDto> {
    const res = await fetch(`${API_BASE}/notifications/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err?.error?.message || `Failed to update notification preferences: HTTP ${res.status}`,
      );
    }
    const json = await res.json();
    return json.data;
  }
}
