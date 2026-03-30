import { Router } from 'express';
import onboardingRoutes from '../../modules/onboarding/onboarding.routes';
import notificationRoutes from '../../modules/notification/notification.routes';
import familyRoutes from '../../modules/family/family.routes';
import noticeRoutes from '../../modules/notice/notice.routes';
import vendorRoutes from '../../modules/vendor/vendor.routes';
import domesticStaffRoutes from '../../modules/domestic-staff/domestic-staff.routes';
import communityPostRoutes from '../../modules/community-post/community-post.routes';
import vehicleRoutes from '../../modules/vehicle/vehicle.routes';
import documentRoutes from '../../modules/document/document.routes';
import pollRoutes from '../../modules/poll/poll.routes';

const router = Router();

// Resident-specific endpoints
router.use('/onboarding', onboardingRoutes);       // /api/v1/resident/onboarding
router.use('/notifications', notificationRoutes);  // /api/v1/resident/notifications
router.use('/family', familyRoutes);               // /api/v1/resident/family

// Resident-facing aliases (frontend-expected paths)
router.use('/notices', noticeRoutes);              // /api/v1/resident/notices
router.use('/local-directory', vendorRoutes);      // /api/v1/resident/local-directory
router.use('/daily-help', domesticStaffRoutes);    // /api/v1/resident/daily-help

// New modules
router.use('/posts', communityPostRoutes);         // /api/v1/resident/posts
router.use('/vehicles', vehicleRoutes);            // /api/v1/resident/vehicles
router.use('/documents', documentRoutes);          // /api/v1/resident/documents
router.use('/polls', pollRoutes);                  // /api/v1/resident/polls

export default router;
