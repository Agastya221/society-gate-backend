import { Router } from 'express';
import {
  createGatePass,
  approveGatePass,
  rejectGatePass,
  scanGatePass,
  getGatePasses,
  getGatePassById,
  getGatePassQR,
  cancelGatePass,
} from './gatepass.controller';
import { authenticate, authorize, ensureSameSociety } from '../../middlewares/auth.middleware';
import { cache, clearCacheAfter } from '../../middlewares/cache.middleware';

const router = Router();

router.use(authenticate);
router.use(ensureSameSociety);

// Specific routes BEFORE parameterized routes
router.post('/', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['gatepasses:*']), createGatePass);
router.get('/', cache({ ttl: 60, keyPrefix: 'gatepasses', varyBy: ['societyId'] }), getGatePasses);
router.post('/scan', authorize('GUARD'), clearCacheAfter(['gatepasses:*']), scanGatePass);

// Parameterized routes LAST
router.get('/:id', cache({ ttl: 120, keyPrefix: 'gatepasses' }), getGatePassById);
router.get('/:id/qr', cache({ ttl: 300, keyPrefix: 'gatepasses' }), getGatePassQR);
router.patch('/:id/approve', authorize('ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['gatepasses:*']), approveGatePass);
router.patch('/:id/reject', authorize('ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['gatepasses:*']), rejectGatePass);
router.delete('/:id', clearCacheAfter(['gatepasses:*']), cancelGatePass);

export default router;