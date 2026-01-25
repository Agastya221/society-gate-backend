import { Router } from 'express';
import { authenticateGuardApp } from '../../middlewares/auth.middleware';
import { EntryController } from '../../modules/entry/entry.controller';
import {
  createEntryRequest,
  getPendingCount,
} from '../../modules/entry-request/entry-request.controller';
import { PreApprovalController } from '../../modules/preapproval/preapproval.controller';
import { scanGatePass } from '../../modules/gatepass/gatepass.controller';
import { scanQRCode } from '../../modules/domestic-staff/domestic-staff.controller';

const router = Router();
const entryController = new EntryController();
const preApprovalController = new PreApprovalController();

// All guard routes require guard authentication
router.use(authenticateGuardApp);

// ============================================
// DASHBOARD / HOME
// ============================================
router.get('/today', entryController.getTodayEntries);
router.get('/pending-count', getPendingCount);

// ============================================
// ENTRY MANAGEMENT
// ============================================
router.post('/entries', entryController.createEntry);
router.patch('/entries/:id/checkout', entryController.checkoutEntry);
router.get('/entries', entryController.getEntries);

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
