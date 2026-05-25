import { Router } from 'express';
import { SocietyRegistrationController } from './society-registration.controller';
import { authenticate, authenticateResidentForOnboarding, authorize } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { cache, clearCacheAfter } from '../../middlewares/cache.middleware';
import {
  submitSocietyRegistrationSchema,
  rejectSocietyRegistrationSchema,
} from '../../schemas';

const router = Router();
const controller = new SocietyRegistrationController();

// RESIDENT — allow pre-approval/inactive users to request a new society
router.post(
  '/request',
  authenticateResidentForOnboarding,
  validate({ body: submitSocietyRegistrationSchema }),
  clearCacheAfter(['society-registration:*']),
  controller.submitRequest
);

router.get(
  '/my-status',
  authenticateResidentForOnboarding,
  cache({ ttl: 300, keyPrefix: 'society-registration', varyBy: ['userId'] }),
  controller.getMyStatus
);

// SUPER_ADMIN only
router.get(
  '/requests',
  authenticate,
  authorize('SUPER_ADMIN'),
  cache({ ttl: 120, keyPrefix: 'society-registration' }),
  controller.listRequests
);

router.get(
  '/requests/:id',
  authenticate,
  authorize('SUPER_ADMIN'),
  cache({ ttl: 300, keyPrefix: 'society-registration' }),
  controller.getRequestById
);

router.post(
  '/requests/:id/approve',
  authenticate,
  authorize('SUPER_ADMIN'),
  clearCacheAfter(['society-registration:*']),
  controller.approveRequest
);

router.post(
  '/requests/:id/reject',
  authenticate,
  authorize('SUPER_ADMIN'),
  validate({ body: rejectSocietyRegistrationSchema }),
  clearCacheAfter(['society-registration:*']),
  controller.rejectRequest
);

export default router;
