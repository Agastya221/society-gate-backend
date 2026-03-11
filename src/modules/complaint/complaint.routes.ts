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
import { validate } from '../../middlewares/validate.middleware';
import {
  createComplaintSchema,
  updateComplaintStatusSchema,
  assignComplaintSchema,
  resolveComplaintSchema,
  idParams,
} from '../../schemas';

const router = Router();

router.use(authenticate);
router.use(ensureSameSociety);

// Cached GET routes
router.get('/', cache({ ttl: 60, keyPrefix: 'complaints', varyBy: ['societyId', 'userId'] }), getComplaints);
router.get('/:id', validate({ params: idParams }), cache({ ttl: 120, keyPrefix: 'complaints' }), getComplaintById);

// Routes that invalidate cache
router.post('/', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), validate({ body: createComplaintSchema }), clearCacheAfter(['complaints:*']), createComplaint);
router.delete('/:id', validate({ params: idParams }), clearCacheAfter(['complaints:*']), deleteComplaint);
router.patch('/:id/status', authorize('ADMIN', 'SUPER_ADMIN'), validate({ params: idParams, body: updateComplaintStatusSchema }), clearCacheAfter(['complaints:*']), updateComplaintStatus);
router.patch('/:id/assign', authorize('ADMIN', 'SUPER_ADMIN'), validate({ params: idParams, body: assignComplaintSchema }), clearCacheAfter(['complaints:*']), assignComplaint);
router.patch('/:id/resolve', authorize('ADMIN', 'SUPER_ADMIN'), validate({ params: idParams, body: resolveComplaintSchema }), clearCacheAfter(['complaints:*']), resolveComplaint);

export default router;