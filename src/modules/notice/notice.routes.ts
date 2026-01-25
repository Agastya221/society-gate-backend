import { Router } from 'express';
import {
  createNotice,
  getNotices,
  getNoticeById,
  updateNotice,
  deleteNotice,
  togglePinNotice,
} from './notice.controller';
import { authenticate, authorize, ensureSameSociety } from '../../middlewares/auth.middleware';
import { cache, clearCacheAfter } from '../../middlewares/cache.middleware';

const router = Router();

// Apply authentication and society isolation globally
router.use(authenticate);
router.use(ensureSameSociety);

// Cached GET routes (all authenticated users)
router.get('/', cache({ ttl: 120, keyPrefix: 'notices', varyBy: ['societyId'] }), getNotices);
router.get('/:id', cache({ ttl: 300, keyPrefix: 'notices' }), getNoticeById);

// Admin only routes that invalidate cache
router.post('/', authorize('ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['notices:*']), createNotice);
router.patch('/:id', authorize('ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['notices:*']), updateNotice);
router.delete('/:id', authorize('ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['notices:*']), deleteNotice);
router.patch('/:id/toggle-pin', authorize('ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['notices:*']), togglePinNotice);

export default router;
