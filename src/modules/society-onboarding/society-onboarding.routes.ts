import { Router } from 'express';
import { SocietyOnboardingController } from './society-onboarding.controller';
import { authenticateForOnboarding, authorize } from '../../middlewares/auth.middleware';
import { clearCacheAfter } from '../../middlewares/cache.middleware';

const router = Router();
const controller = new SocietyOnboardingController();

router.use(authenticateForOnboarding);

router.get('/import-template', authorize('ADMIN', 'SUPER_ADMIN'), controller.getImportTemplate);

router.post(
  '/leads',
  authorize('SUPER_ADMIN'),
  clearCacheAfter(['society:*', 'onboarding:*', 'society-onboarding:*']),
  controller.createLead,
);

router.post(
  '/:societyId/invite-admin',
  authorize('SUPER_ADMIN'),
  clearCacheAfter(['society:*', 'society-onboarding:*']),
  controller.inviteAdmin,
);

router.get('/:societyId/status', authorize('ADMIN', 'SUPER_ADMIN'), controller.getStatus);

router.patch(
  '/:societyId/basic-details',
  authorize('ADMIN', 'SUPER_ADMIN'),
  clearCacheAfter(['society:*', 'society-onboarding:*']),
  controller.updateBasicDetails,
);

router.patch(
  '/:societyId/financial-details',
  authorize('ADMIN', 'SUPER_ADMIN'),
  clearCacheAfter(['society:*', 'society-onboarding:*']),
  controller.updateFinancialDetails,
);

router.post(
  '/:societyId/documents/presigned-url',
  authorize('ADMIN', 'SUPER_ADMIN'),
  controller.getDocumentUploadUrl,
);

router.post(
  '/:societyId/documents',
  authorize('ADMIN', 'SUPER_ADMIN'),
  clearCacheAfter(['society:*', 'society-onboarding:*']),
  controller.addDocument,
);

router.post(
  '/:societyId/submit-verification',
  authorize('ADMIN', 'SUPER_ADMIN'),
  clearCacheAfter(['society:*', 'society-onboarding:*']),
  controller.submitVerification,
);

router.post(
  '/:societyId/approve',
  authorize('SUPER_ADMIN'),
  clearCacheAfter(['society:*', 'society-onboarding:*']),
  controller.approveVerification,
);

router.post(
  '/:societyId/reject',
  authorize('SUPER_ADMIN'),
  clearCacheAfter(['society:*', 'society-onboarding:*']),
  controller.rejectVerification,
);

router.post(
  '/:societyId/import/validate',
  authorize('ADMIN', 'SUPER_ADMIN'),
  clearCacheAfter(['society:*', 'society-onboarding:*']),
  controller.validateImport,
);

router.post(
  '/:societyId/import/commit',
  authorize('ADMIN', 'SUPER_ADMIN'),
  clearCacheAfter(['society:*', 'onboarding:*', 'society-onboarding:*', 'vehicles:*']),
  controller.commitImport,
);

router.patch(
  '/:societyId/rules',
  authorize('ADMIN', 'SUPER_ADMIN'),
  clearCacheAfter(['society:*', 'society-onboarding:*']),
  controller.updateRules,
);

router.patch(
  '/:societyId/branding',
  authorize('ADMIN', 'SUPER_ADMIN'),
  clearCacheAfter(['society:*', 'society-onboarding:*']),
  controller.updateBranding,
);

router.post(
  '/:societyId/gates',
  authorize('ADMIN', 'SUPER_ADMIN'),
  clearCacheAfter(['society:*', 'society-onboarding:*']),
  controller.configureGates,
);

router.post(
  '/:societyId/guards',
  authorize('ADMIN', 'SUPER_ADMIN'),
  clearCacheAfter(['society:*', 'society-onboarding:*']),
  controller.createGuards,
);

router.post(
  '/:societyId/activate',
  authorize('ADMIN', 'SUPER_ADMIN'),
  clearCacheAfter(['society:*', 'onboarding:*', 'society-onboarding:*']),
  controller.activateSociety,
);

router.post(
  '/:societyId/send-resident-invites',
  authorize('ADMIN', 'SUPER_ADMIN'),
  controller.sendResidentInvites,
);

export default router;
