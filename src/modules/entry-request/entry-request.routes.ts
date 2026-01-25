import { Router } from 'express';
import {
  createEntryRequest,
  getEntryRequests,
  getEntryRequestById,
  getEntryRequestPhoto,
  approveEntryRequest,
  rejectEntryRequest,
  getPendingCount,
} from './entry-request.controller';
import { authenticate, authorize, ensureSameSociety } from '../../middlewares/auth.middleware';
import { cache, clearCacheAfter } from '../../middlewares/cache.middleware';

const router = Router();

router.use(authenticate);
router.use(ensureSameSociety);

// Specific routes BEFORE parameterized routes
router.post('/', authorize('GUARD'), clearCacheAfter(['entry-requests:*']), createEntryRequest);
router.get('/pending-count', authorize('GUARD'), cache({ ttl: 10, keyPrefix: 'entry-requests', varyBy: ['userId'] }), getPendingCount);
router.get('/', cache({ ttl: 20, keyPrefix: 'entry-requests', varyBy: ['societyId', 'userId'] }), getEntryRequests);

// Parameterized routes LAST
router.get('/:id', cache({ ttl: 30, keyPrefix: 'entry-requests' }), getEntryRequestById);
router.get('/:id/photo', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), getEntryRequestPhoto);
router.patch('/:id/approve', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['entry-requests:*', 'entries:*']), approveEntryRequest);
router.patch('/:id/reject', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['entry-requests:*']), rejectEntryRequest);

export default router;
