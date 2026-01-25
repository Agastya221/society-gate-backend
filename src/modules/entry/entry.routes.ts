import { Router } from 'express';
import { EntryController } from './entry.controller';
import { authenticate, authorize, ensureSameSociety } from '../../middlewares/auth.middleware';
import { cache, clearCacheAfter } from '../../middlewares/cache.middleware';

const router = Router();
const entryController = new EntryController();

router.use(authenticate);
router.use(ensureSameSociety);

// Cached GET routes (short TTL since entries change frequently)
router.get('/', cache({ ttl: 30, keyPrefix: 'entries', varyBy: ['societyId'] }), entryController.getEntries);
router.get('/pending', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), cache({ ttl: 15, keyPrefix: 'entries', varyBy: ['societyId', 'userId'] }), entryController.getPendingApprovals);
router.get('/today', authorize('GUARD'), cache({ ttl: 30, keyPrefix: 'entries', varyBy: ['societyId'] }), entryController.getTodayEntries);

// Routes that invalidate cache
router.post('/', authorize('GUARD'), clearCacheAfter(['entries:*']), entryController.createEntry);
router.patch('/:id/approve', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['entries:*']), entryController.approveEntry);
router.patch('/:id/reject', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['entries:*']), entryController.rejectEntry);
router.patch('/:id/checkout', authorize('GUARD'), clearCacheAfter(['entries:*']), entryController.checkoutEntry);

export default router;