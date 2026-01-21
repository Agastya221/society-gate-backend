import { Router } from 'express';
import { PreApprovalController } from './preapproval.controller';
import {
  authenticateResidentApp,
  authenticateGuardApp,
  ensureSameSociety,
} from '../../middlewares/auth.middleware';

const router = Router();
const preApprovalController = new PreApprovalController();

// CRITICAL: Apply society isolation to all pre-approval routes
// Cannot use router.use() because different auth methods are used per route
// ensureSameSociety is chained with each route individually

// ============================================
// RESIDENT APP ROUTES
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
// GUARD APP ROUTES
// ============================================

// Scan QR code
router.post(
  '/scan',
  authenticateGuardApp,
  ensureSameSociety,
  preApprovalController.scanPreApprovalQR
);

export default router;
