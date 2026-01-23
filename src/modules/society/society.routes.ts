import { Router } from 'express';
import { SocietyController } from './society.controller';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { cache, clearCacheAfter } from '../../middlewares/cache.middleware';

const router = Router();
const societyController = new SocietyController();

router.use(authenticate);

// SUPER_ADMIN only
router.post(
  '/',
  authorize('SUPER_ADMIN'),
  clearCacheAfter(['society:*']),
  societyController.createSociety
);

router.get(
  '/',
  authorize('SUPER_ADMIN'),
  cache({ ttl: 120, keyPrefix: 'society' }),
  societyController.getSocieties
);

router.patch(
  '/:id/payment-paid',
  authorize('SUPER_ADMIN'),
  clearCacheAfter(['society:*']),
  societyController.markPaymentPaid
);

// SUPER_ADMIN and ADMIN
router.get(
  '/:id',
  authorize('SUPER_ADMIN', 'ADMIN'),
  cache({ ttl: 300, keyPrefix: 'society', varyBy: ['societyId'] }),
  societyController.getSociety
);

router.patch(
  '/:id',
  authorize('SUPER_ADMIN', 'ADMIN'),
  clearCacheAfter(['society:*']),
  societyController.updateSociety
);

router.get(
  '/:id/stats',
  authorize('SUPER_ADMIN', 'ADMIN'),
  cache({ ttl: 180, keyPrefix: 'society', varyBy: ['societyId'] }),
  societyController.getSocietyStats
);

export default router;