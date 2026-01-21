import { Router } from 'express';
import { OnboardingController } from './onboarding.controller';
import { authenticateForOnboarding, authenticateResidentApp, authorize } from '../../middlewares/auth.middleware';

const router = Router();
const onboardingController = new OnboardingController();

// ============================================
// ONBOARDING ROUTES (Allows inactive users)
// ============================================

// List societies (for onboarding)
router.get('/societies', authenticateForOnboarding, onboardingController.listSocieties);

// List blocks in a society
router.get(
    '/societies/:societyId/blocks',
    authenticateForOnboarding,
    onboardingController.listBlocks
);

// List flats in a block
router.get(
    '/societies/:societyId/blocks/:blockId/flats',
    authenticateForOnboarding,
    onboardingController.listFlats
);

// Submit onboarding request
router.post('/request', authenticateForOnboarding, onboardingController.submitRequest);

// Get onboarding status
router.get('/status', authenticateForOnboarding, onboardingController.getStatus);

// ============================================
// ADMIN ROUTES
// ============================================

// List pending onboarding requests
router.get(
    '/admin/pending',
    authenticateResidentApp,
    authorize('ADMIN', 'SUPER_ADMIN'),
    onboardingController.listPendingRequests
);

// Get request details
router.get(
    '/admin/:requestId',
    authenticateResidentApp,
    authorize('ADMIN', 'SUPER_ADMIN'),
    onboardingController.getRequestDetails
);

// Approve request
router.patch(
    '/admin/:requestId/approve',
    authenticateResidentApp,
    authorize('ADMIN', 'SUPER_ADMIN'),
    onboardingController.approveRequest
);

// Reject request
router.patch(
    '/admin/:requestId/reject',
    authenticateResidentApp,
    authorize('ADMIN', 'SUPER_ADMIN'),
    onboardingController.rejectRequest
);

// Request resubmission
router.patch(
    '/admin/:requestId/request-resubmit',
    authenticateResidentApp,
    authorize('ADMIN', 'SUPER_ADMIN'),
    onboardingController.requestResubmission
);

export default router;
