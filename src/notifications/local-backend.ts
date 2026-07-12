/**
 * On-device notifications: empty. The derived sources (comments, cross-user
 * follows) are Supabase-only in this app, so without a configured backend there
 * is nothing to surface. Keeps the seam swappable and the screen crash-free in
 * zero-config checkouts.
 */

import type { AppNotification, NotificationsBackend } from './types';

export class LocalNotificationsBackend implements NotificationsBackend {
  async listFor(): Promise<AppNotification[]> {
    return [];
  }
}
