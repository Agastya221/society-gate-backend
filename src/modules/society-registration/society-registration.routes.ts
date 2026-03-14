import { Router } from 'express';
import { SocietyRegistrationController } from './society-registration.controller';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  submitSocietyRegistrationSchema,
  rejectSocietyRegistrationSchema,
} from '../../schemas';

const router = Router();
const controller = new SocietyRegistrationController();

// RESIDENT — authenticated users only
router.post(
  '/request',
  authenticate,
  validate({ body: submitSocietyRegistrationSchema }),
  controller.submitRequest
);

router.get(
  '/my-status',
  authenticate,
  controller.getMyStatus
);

// SUPER_ADMIN only
router.get(
  '/requests',
  authenticate,
  authorize('SUPER_ADMIN'),
  controller.listRequests
);

router.get(
  '/requests/:id',
  authenticate,
  authorize('SUPER_ADMIN'),
  controller.getRequestById
);

router.post(
  '/requests/:id/approve',
  authenticate,
  authorize('SUPER_ADMIN'),
  controller.approveRequest
);

router.post(
  '/requests/:id/reject',
  authenticate,
  authorize('SUPER_ADMIN'),
  validate({ body: rejectSocietyRegistrationSchema }),
  controller.rejectRequest
);

export default router;
