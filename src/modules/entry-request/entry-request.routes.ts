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
import { validate } from '../../middlewares/validate.middleware';
import { createEntryRequestSchema, entryRequestQuerySchema, idParams } from '../../schemas';

const router = Router();

router.use(authenticate);
router.use(ensureSameSociety);

// Specific routes BEFORE parameterized routes
router.post('/', authorize('GUARD'), validate({ body: createEntryRequestSchema }), clearCacheAfter(['entry-requests:*']), createEntryRequest);
router.get('/pending-count', authorize('GUARD'), cache({ ttl: 10, keyPrefix: 'entry-requests', varyBy: ['userId'] }), getPendingCount);
router.get('/', validate({ query: entryRequestQuerySchema }), cache({ ttl: 20, keyPrefix: 'entry-requests', varyBy: ['societyId', 'userId'] }), getEntryRequests);

// Parameterized routes LAST
router.get('/:id', validate({ params: idParams }), cache({ ttl: 30, keyPrefix: 'entry-requests' }), getEntryRequestById);
router.get('/:id/photo', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), validate({ params: idParams }), getEntryRequestPhoto);
router.patch('/:id/approve', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), validate({ params: idParams }), clearCacheAfter(['entry-requests:*', 'entries:*']), approveEntryRequest);
router.patch('/:id/reject', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), validate({ params: idParams }), clearCacheAfter(['entry-requests:*']), rejectEntryRequest);

export default router;
