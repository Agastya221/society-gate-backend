"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const onboarding_controller_1 = require("./onboarding.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const router = (0, express_1.Router)();
const onboardingController = new onboarding_controller_1.OnboardingController();
// ============================================
// PUBLIC/AUTHENTICATED RESIDENT ROUTES
// ============================================
// List societies (for onboarding)
router.get('/societies', auth_middleware_1.authenticateResidentApp, onboardingController.listSocieties);
// List blocks in a society
router.get('/societies/:societyId/blocks', auth_middleware_1.authenticateResidentApp, onboardingController.listBlocks);
// List flats in a block
router.get('/societies/:societyId/blocks/:blockId/flats', auth_middleware_1.authenticateResidentApp, onboardingController.listFlats);
// Submit onboarding request
router.post('/request', auth_middleware_1.authenticateResidentApp, onboardingController.submitRequest);
// Get onboarding status
router.get('/status', auth_middleware_1.authenticateResidentApp, onboardingController.getStatus);
// ============================================
// ADMIN ROUTES
// ============================================
// List pending onboarding requests
router.get('/admin/pending', auth_middleware_1.authenticateResidentApp, (0, auth_middleware_1.authorize)('ADMIN', 'SUPER_ADMIN'), onboardingController.listPendingRequests);
// Get request details
router.get('/admin/:requestId', auth_middleware_1.authenticateResidentApp, (0, auth_middleware_1.authorize)('ADMIN', 'SUPER_ADMIN'), onboardingController.getRequestDetails);
// Approve request
router.patch('/admin/:requestId/approve', auth_middleware_1.authenticateResidentApp, (0, auth_middleware_1.authorize)('ADMIN', 'SUPER_ADMIN'), onboardingController.approveRequest);
// Reject request
router.patch('/admin/:requestId/reject', auth_middleware_1.authenticateResidentApp, (0, auth_middleware_1.authorize)('ADMIN', 'SUPER_ADMIN'), onboardingController.rejectRequest);
// Request resubmission
router.patch('/admin/:requestId/request-resubmit', auth_middleware_1.authenticateResidentApp, (0, auth_middleware_1.authorize)('ADMIN', 'SUPER_ADMIN'), onboardingController.requestResubmission);
exports.default = router;
