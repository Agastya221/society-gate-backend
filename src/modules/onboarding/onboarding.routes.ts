import { Router } from 'express';
import { OnboardingController } from './onboarding.controller';
import { authenticateForOnboarding, authenticateResidentApp, authorize } from '../../middlewares/auth.middleware';
import { cache, clearCacheAfter } from '../../middlewares/cache.middleware';

const router = Router();
const onboardingController = new OnboardingController();

// ============================================
// ONBOARDING ROUTES (Allows inactive users)
// ============================================

// List societies (for onboarding)
router.get('/societies', authenticateForOnboarding, cache({ ttl: 3600, keyPrefix: 'onboarding', varyBy: [] }), onboardingController.listSocieties);

// List blocks in a society
router.get(
    '/societies/:societyId/blocks',
    authenticateForOnboarding,
    cache({ ttl: 1800, keyPrefix: 'onboarding' }),
    onboardingController.listBlocks
);

// List flats in a block
router.get(
    '/societies/:societyId/blocks/:blockId/flats',
    authenticateForOnboarding,
    cache({ ttl: 1800, keyPrefix: 'onboarding' }),
    onboardingController.listFlats
);

// Submit onboarding request
router.post('/request', authenticateForOnboarding, clearCacheAfter(['onboarding:*']), onboardingController.submitRequest);

// Get onboarding status
router.get('/status', authenticateForOnboarding, cache({ ttl: 60, keyPrefix: 'onboarding', varyBy: ['userId'] }), onboardingController.getStatus);

// ============================================
// ADMIN ROUTES
// ============================================

// List pending onboarding requests
router.get(
    '/admin/pending',
    authenticateResidentApp,
    authorize('ADMIN', 'SUPER_ADMIN'),
    cache({ ttl: 60, keyPrefix: 'onboarding', varyBy: ['societyId'] }),
    onboardingController.listPendingRequests
);

// Get request details
router.get(
    '/admin/:requestId',
    authenticateResidentApp,
    authorize('ADMIN', 'SUPER_ADMIN'),
    cache({ ttl: 120, keyPrefix: 'onboarding' }),
    onboardingController.getRequestDetails
);

// Approve request
router.patch(
    '/admin/:requestId/approve',
    authenticateResidentApp,
    authorize('ADMIN', 'SUPER_ADMIN'),
    clearCacheAfter(['onboarding:*']),
    onboardingController.approveRequest
);

// Reject request
router.patch(
    '/admin/:requestId/reject',
    authenticateResidentApp,
    authorize('ADMIN', 'SUPER_ADMIN'),
    clearCacheAfter(['onboarding:*']),
    onboardingController.rejectRequest
);

// Request resubmission
router.patch(
    '/admin/:requestId/request-resubmit',
    authenticateResidentApp,
    authorize('ADMIN', 'SUPER_ADMIN'),
    clearCacheAfter(['onboarding:*']),
    onboardingController.requestResubmission
);

export default router;
