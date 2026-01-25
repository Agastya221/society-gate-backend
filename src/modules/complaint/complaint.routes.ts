import { Router } from 'express';
import {
  createComplaint,
  getComplaints,
  getComplaintById,
  updateComplaintStatus,
  assignComplaint,
  resolveComplaint,
  deleteComplaint,
} from './complaint.controller';
import { authenticate, authorize, ensureSameSociety } from '../../middlewares/auth.middleware';
import { cache, clearCacheAfter } from '../../middlewares/cache.middleware';

const router = Router();

router.use(authenticate);
router.use(ensureSameSociety);

// Cached GET routes
router.get('/', cache({ ttl: 60, keyPrefix: 'complaints', varyBy: ['societyId', 'userId'] }), getComplaints);
router.get('/:id', cache({ ttl: 120, keyPrefix: 'complaints' }), getComplaintById);

// Routes that invalidate cache
router.post('/', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['complaints:*']), createComplaint);
router.delete('/:id', clearCacheAfter(['complaints:*']), deleteComplaint);
router.patch('/:id/status', authorize('ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['complaints:*']), updateComplaintStatus);
router.patch('/:id/assign', authorize('ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['complaints:*']), assignComplaint);
router.patch('/:id/resolve', authorize('ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['complaints:*']), resolveComplaint);

export default router;