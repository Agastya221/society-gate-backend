import { Router, type Request, type Response, type NextFunction } from 'express';
import { SocietyController } from './society.controller';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { cache, clearCacheAfter } from '../../middlewares/cache.middleware';
import { AppError } from '../../utils/ResponseHandler';

const router = Router();
const societyController = new SocietyController();

router.use(authenticate);

/**
 * SUPER_ADMIN may act on any society; ADMIN only on their own active society.
 * Runs before cache() so a cached response for one society is never served to
 * an admin of another.
 */
const ensureSocietyAccess = (req: Request, _res: Response, next: NextFunction) => {
  const user = req.user;
  if (!user) return next(new AppError('Authentication required', 401));
  if (user.role === 'SUPER_ADMIN') return next();
  if (user.role === 'ADMIN' && user.societyId && user.societyId === String(req.params.id)) {
    return next();
  }
  return next(new AppError('Access denied. You can only access your own society.', 403));
};

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

router.post(
  '/:id/blocks',
  authorize('SUPER_ADMIN', 'ADMIN'),
  ensureSocietyAccess,
  clearCacheAfter(['society:*', 'onboarding:*']),
  societyController.createBlock
);

router.post(
  '/:id/flats',
  authorize('SUPER_ADMIN', 'ADMIN'),
  ensureSocietyAccess,
  clearCacheAfter(['society:*', 'onboarding:*']),
  societyController.createFlat
);

router.patch(
  '/:id/flats/:flatId',
  authorize('SUPER_ADMIN', 'ADMIN'),
  ensureSocietyAccess,
  clearCacheAfter(['society:*', 'onboarding:*']),
  societyController.updateFlat
);

router.delete(
  '/:id/flats/:flatId',
  authorize('SUPER_ADMIN', 'ADMIN'),
  ensureSocietyAccess,
  clearCacheAfter(['society:*', 'onboarding:*']),
  societyController.deactivateFlat
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
  ensureSocietyAccess,
  cache({ ttl: 300, keyPrefix: 'society', varyBy: ['societyId'] }),
  societyController.getSociety
);

router.patch(
  '/:id',
  authorize('SUPER_ADMIN', 'ADMIN'),
  ensureSocietyAccess,
  clearCacheAfter(['society:*']),
  societyController.updateSociety
);

router.get(
  '/:id/stats',
  authorize('SUPER_ADMIN', 'ADMIN'),
  ensureSocietyAccess,
  cache({ ttl: 180, keyPrefix: 'society', varyBy: ['societyId'] }),
  societyController.getSocietyStats
);

export default router;
