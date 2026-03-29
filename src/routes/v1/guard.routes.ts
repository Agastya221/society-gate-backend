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
  verifyCode,
  getEntryLog,
  getTodayEntries,
  getEntries,
  checkoutEntry,
} from '../../modules/gate-scan/gate-scan.controller';
import {
  validateEntry,
  markEntryUsed,
  listForGuard,
  searchForGuard,
} from '../../modules/pre-approved-entry/pre-approved-entry.controller';
import { validate } from '../../middlewares/validate.middleware';
import {
  idParams,
  validatePreApprovedEntrySchema,
  markEntryUsedSchema,
  guardPreApprovedSearchSchema,
  preApprovedEntryQuerySchema,
} from '../../schemas';

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
router.post('/scan', scanQR);                  // Unified QR scan (GatePass + Staff)
router.post('/scan/gatepass', scanGatePass);   // Legacy
router.post('/scan/staff', scanQRCode);        // Legacy
router.post('/verify-code', verifyCode);       // Passcode verification (Guest/Party invites)

// ============================================
// ENTRY LOG
// ============================================
router.get('/entry-log', getEntryLog);

// ============================================
// PRE-APPROVED ENTRIES
// ============================================
router.post('/pre-approved/validate', validate({ body: validatePreApprovedEntrySchema }), validateEntry);
router.post('/pre-approved/:id/use', validate({ params: idParams, body: markEntryUsedSchema }), markEntryUsed);
router.get('/pre-approved', validate({ query: preApprovedEntryQuerySchema }), listForGuard);
router.get('/pre-approved/search', validate({ query: guardPreApprovedSearchSchema }), searchForGuard);

// ============================================
// EMERGENCIES
// ============================================
router.get('/emergencies/active', getActiveEmergencies);
router.patch('/emergencies/:id/respond', respondToEmergency);

export default router;
