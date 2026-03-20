import { Router } from 'express';
import { authenticateGuardApp } from '../../middlewares/auth.middleware';
import {
  createEntryRequest,
  getPendingCount,
} from '../../modules/entry-request/entry-request.controller';
import { scanGatePass } from '../../modules/gatepass/gatepass.controller';
import { scanQRCode } from '../../modules/domestic-staff/domestic-staff.controller';
import {
  respondToEmergency,
  getActiveEmergencies,
} from '../../modules/emergency/emergency.controller';
import {
  scanQR,
  getTodayEntries,
  getEntries,
  checkoutEntry,
} from '../../modules/gate-scan/gate-scan.controller';

const router = Router();

// All guard routes require guard authentication
router.use(authenticateGuardApp);

// ============================================
// DASHBOARD / HOME
// ============================================
router.get('/today', getTodayEntries);
router.get('/pending-count', getPendingCount);

// ============================================
// ENTRY MANAGEMENT
// ============================================
router.patch('/entries/:id/checkout', checkoutEntry);
router.get('/entries', getEntries);

// ============================================
// ENTRY REQUESTS (Visitor at gate — manual approval)
// ============================================
router.post('/entry-requests', createEntryRequest);

// ============================================
// QR SCANNING
// ============================================
router.post('/scan', scanQR);                  // Unified scan (preferred)
router.post('/scan/gatepass', scanGatePass);   // Legacy
router.post('/scan/staff', scanQRCode);        // Legacy

// ============================================
// EMERGENCIES
// ============================================
router.get('/emergencies/active', getActiveEmergencies);
router.patch('/emergencies/:id/respond', respondToEmergency);

export default router;
