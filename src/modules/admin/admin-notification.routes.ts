import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { cache, clearCacheAfter } from '../../middlewares/cache.middleware';
import {
  getAdminNotifications,
  getAdminUnreadCount,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
  deleteAdminNotification,
  getAdminNotificationStats,
} from './admin-notification.controller';

const router = Router();

// All routes require admin auth
router.use(authenticate);
router.use(authorize('ADMIN', 'SUPER_ADMIN'));

// GET /admin/notifications
// Paginated, filterable list of admin's notifications
router.get(
  '/',
  cache({ ttl: 30, keyPrefix: 'admin:notif', varyBy: ['userId'] }),
  getAdminNotifications,
);

// GET /admin/notifications/unread-count
router.get(
  '/unread-count',
  cache({ ttl: 15, keyPrefix: 'admin:notif:count', varyBy: ['userId'] }),
  getAdminUnreadCount,
);

// GET /admin/notifications/stats
// Summary: unread by category (helpdesk, onboarding, billing, etc.)
router.get(
  '/stats',
  cache({ ttl: 30, keyPrefix: 'admin:notif:stats', varyBy: ['userId'] }),
  getAdminNotificationStats,
);

// PATCH /admin/notifications/:id/read
router.patch(
  '/:id/read',
  clearCacheAfter(['api:admin:notif*']),
  markAdminNotificationRead,
);

// PATCH /admin/notifications/read-all
router.patch(
  '/read-all',
  clearCacheAfter(['api:admin:notif*']),
  markAllAdminNotificationsRead,
);

// DELETE /admin/notifications/:id
router.delete(
  '/:id',
  clearCacheAfter(['api:admin:notif*']),
  deleteAdminNotification,
);

export default router;
