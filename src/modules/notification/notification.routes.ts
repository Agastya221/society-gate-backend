import { Router } from 'express';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from './notification.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { cache, clearCacheAfter } from '../../middlewares/cache.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get user's notifications (cached for 1 minute, varies by user)
router.get('/', cache({ ttl: 60, keyPrefix: 'notifications', varyBy: ['userId'] }), getNotifications);

// Get unread count (cached for 30 seconds, varies by user)
router.get('/unread-count', cache({ ttl: 30, keyPrefix: 'notifications', varyBy: ['userId'] }), getUnreadCount);

// Mark all as read (clears notification cache for user)
router.patch('/read-all', clearCacheAfter(['notifications:*']), markAllAsRead);

// Mark single notification as read (clears notification cache for user)
router.patch('/:id/read', clearCacheAfter(['notifications:*']), markAsRead);

export default router;
