import { Router } from 'express';
import { authenticateGuardApp } from '../../middlewares/auth.middleware';
import {
  createEntryRequest,
  getPendingCount,
} from '../../modules/entry-request/entry-request.controller';
import { PreApprovalController } from '../../modules/preapproval/preapproval.controller';
import { scanGatePass } from '../../modules/gatepass/gatepass.controller';
import { scanQRCode } from '../../modules/domestic-staff/domestic-staff.controller';

const router = Router();
const preApprovalController = new PreApprovalController();

// All guard routes require guard authentication
router.use(authenticateGuardApp);

// ============================================
// DASHBOARD / HOME
// ============================================
router.get('/today', preApprovalController.getTodayEntries);
router.get('/pending-count', getPendingCount);

// ============================================
// ENTRY MANAGEMENT (Read-only + Checkout)
// ============================================
router.patch('/entries/:id/checkout', preApprovalController.checkoutEntry);
router.get('/entries', preApprovalController.getEntries);

// ============================================
// ENTRY REQUESTS (Visitor at gate)
// ============================================
router.post('/entry-requests', createEntryRequest);

// ============================================
// QR SCANNING
// ============================================
router.post('/scan/preapproval', preApprovalController.scanPreApprovalQR);
router.post('/scan/gatepass', scanGatePass);
router.post('/scan/staff', scanQRCode);

export default router;
