import { Router } from 'express';
import { SocietyController } from './society.controller';
import { authenticate, authorize } from '../../middlewares/auth.middleware';

const router = Router();
const societyController = new SocietyController();

router.use(authenticate);

// SUPER_ADMIN only
router.post(
  '/',
  authorize('SUPER_ADMIN'),
  societyController.createSociety
);

router.get(
  '/',
  authorize('SUPER_ADMIN'),
  societyController.getSocieties
);

router.patch(
  '/:id/payment-paid',
  authorize('SUPER_ADMIN'),
  societyController.markPaymentPaid
);

// SUPER_ADMIN and ADMIN
router.get(
  '/:id',
  authorize('SUPER_ADMIN', 'ADMIN'),
  societyController.getSociety
);

router.patch(
  '/:id',
  authorize('SUPER_ADMIN', 'ADMIN'),
  societyController.updateSociety
);

router.get(
  '/:id/stats',
  authorize('SUPER_ADMIN', 'ADMIN'),
  societyController.getSocietyStats
);

export default router;