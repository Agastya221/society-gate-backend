import { Router } from 'express';
import onboardingRoutes from '../../modules/onboarding/onboarding.routes';
import notificationRoutes from '../../modules/notification/notification.routes';
import familyRoutes from '../../modules/family/family.routes';

const router = Router();

// Resident-specific endpoints
router.use('/onboarding', onboardingRoutes);      // /api/v1/resident/onboarding
router.use('/notifications', notificationRoutes); // /api/v1/resident/notifications
router.use('/family', familyRoutes);              // /api/v1/resident/family

export default router;
