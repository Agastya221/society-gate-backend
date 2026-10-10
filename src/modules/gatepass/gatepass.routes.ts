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
import { validate } from '../../middlewares/validate.middleware';
import { createGatePassSchema, rejectGatePassSchema, scanGatePassSchema } from './gatepass.schemas';

const router = Router();

router.use(authenticate);
router.use(ensureSameSociety);

// Specific routes BEFORE parameterized routes
router.post('/', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), validate({ body: createGatePassSchema }), clearCacheAfter(['gatepasses:*']), createGatePass);
router.get('/', cache({ ttl: 60, keyPrefix: 'gatepasses', varyBy: ['userId'] }), getGatePasses);
router.post('/scan', authorize('GUARD'), validate({ body: scanGatePassSchema }), clearCacheAfter(['gatepasses:*']), scanGatePass);

// Parameterized routes LAST
// Vary by user: what a caller may see depends on their society and role/flat.
router.get('/:id', cache({ ttl: 120, keyPrefix: 'gatepasses', varyBy: ['userId'] }), getGatePassById);
router.get('/:id/qr', cache({ ttl: 300, keyPrefix: 'gatepasses', varyBy: ['userId'] }), getGatePassQR);
router.patch('/:id/approve', authorize('ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['gatepasses:*']), approveGatePass);
router.patch('/:id/reject', authorize('ADMIN', 'SUPER_ADMIN'), validate({ body: rejectGatePassSchema }), clearCacheAfter(['gatepasses:*']), rejectGatePass);
router.delete('/:id', clearCacheAfter(['gatepasses:*']), cancelGatePass);

export default router;