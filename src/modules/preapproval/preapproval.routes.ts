import { Router } from 'express';
import { PreApprovalController } from './preapproval.controller';
import {
  authenticate,
  authorize,
  authenticateResidentApp,
  authenticateGuardApp,
  ensureSameSociety,
} from '../../middlewares/auth.middleware';
import { cache, clearCacheAfter } from '../../middlewares/cache.middleware';

const router = Router();
const preApprovalController = new PreApprovalController();

// ============================================
// QR CODE PRE-APPROVAL ROUTES (Resident App)
// ============================================

// Create pre-approval
router.post(
  '/',
  authenticateResidentApp,
  ensureSameSociety,
  preApprovalController.createPreApproval
);

// Get all pre-approvals
router.get(
  '/',
  authenticateResidentApp,
  ensureSameSociety,
  preApprovalController.getPreApprovals
);

// Get QR code
router.get(
  '/:id/qr',
  authenticateResidentApp,
  ensureSameSociety,
  preApprovalController.getPreApprovalQR
);

// Cancel pre-approval
router.delete(
  '/:id',
  authenticateResidentApp,
  ensureSameSociety,
  preApprovalController.cancelPreApproval
);

// ============================================
// QR CODE PRE-APPROVAL ROUTES (Guard App)
// ============================================

// Scan QR code
router.post(
  '/scan',
  authenticateGuardApp,
  ensureSameSociety,
  preApprovalController.scanPreApprovalQR
);

// ============================================
// DELIVERY AUTO-APPROVAL ROUTES
// ============================================

// Expected deliveries
router.post(
  '/deliveries/expected',
  authenticate,
  ensureSameSociety,
  authorize('RESIDENT', 'ADMIN'),
  preApprovalController.createExpectedDelivery
);

router.get(
  '/deliveries/expected',
  authenticate,
  ensureSameSociety,
  authorize('RESIDENT', 'ADMIN'),
  preApprovalController.getExpectedDeliveries
);

// Auto-approve rules
router.post(
  '/deliveries/auto-approve',
  authenticate,
  ensureSameSociety,
  authorize('RESIDENT', 'ADMIN'),
  preApprovalController.createAutoApproveRule
);

router.get(
  '/deliveries/auto-approve',
  authenticate,
  ensureSameSociety,
  authorize('RESIDENT', 'ADMIN'),
  preApprovalController.getAutoApproveRules
);

router.patch(
  '/deliveries/auto-approve/:id',
  authenticate,
  ensureSameSociety,
  authorize('RESIDENT', 'ADMIN'),
  preApprovalController.toggleAutoApproveRule
);

router.delete(
  '/deliveries/auto-approve/:id',
  authenticate,
  ensureSameSociety,
  authorize('RESIDENT', 'ADMIN'),
  preApprovalController.deleteAutoApproveRule
);

// Popular companies list
router.get(
  '/deliveries/companies',
  authenticate,
  ensureSameSociety,
  authorize('RESIDENT', 'ADMIN'),
  preApprovalController.getPopularCompanies
);

// ============================================
// ENTRY QUERY ROUTES (Read-only + Checkout)
// ============================================

// Cached GET routes (short TTL since entries change frequently)
router.get(
  '/entries',
  authenticate,
  ensureSameSociety,
  cache({ ttl: 30, keyPrefix: 'entries', varyBy: ['societyId'] }),
  preApprovalController.getEntries
);

router.get(
  '/entries/pending',
  authenticate,
  ensureSameSociety,
  authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'),
  cache({ ttl: 15, keyPrefix: 'entries', varyBy: ['societyId', 'userId'] }),
  preApprovalController.getPendingApprovals
);

router.get(
  '/entries/today',
  authenticate,
  ensureSameSociety,
  authorize('GUARD'),
  cache({ ttl: 30, keyPrefix: 'entries', varyBy: ['societyId'] }),
  preApprovalController.getTodayEntries
);

// Checkout route (Guard marks visitor as left)
router.patch(
  '/entries/:id/checkout',
  authenticate,
  ensureSameSociety,
  authorize('GUARD'),
  clearCacheAfter(['entries:*']),
  preApprovalController.checkoutEntry
);

export default router;
