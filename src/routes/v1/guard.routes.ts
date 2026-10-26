import { Router } from 'express';
import { authenticateGuardApp } from '../../middlewares/auth.middleware';
import { requireGuardAtGate } from '../../modules/geofence/geofence.middleware';
import { evaluate, getGateLocations, readingFromHeaders } from '../../modules/geofence/geofence.service';
import { currentDuty, endDuty, myAttendance, startDuty } from '../../modules/geofence/duty.service';
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
import { clearCacheAfter } from '../../middlewares/cache.middleware';
import {
  idParams,
  validatePreApprovedEntrySchema,
  markEntryUsedSchema,
  guardPreApprovedSearchSchema,
  guardPreApprovedListQuerySchema,
  createEntryRequestSchema,
  checkoutEntrySchema,
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
router.patch('/entries/:id/checkout', requireGuardAtGate('Record exit'), validate({ body: checkoutEntrySchema }), checkoutEntry);
router.get('/entries', getEntries);

// ============================================
// ENTRY REQUESTS (Visitor at gate — manual approval)
// ============================================
router.post('/entry-requests', requireGuardAtGate('Raise a visitor request'), validate({ body: createEntryRequestSchema }), clearCacheAfter(['entry-requests:*', 'entries:*']), createEntryRequest);

// ============================================
// QR SCANNING
// ============================================
// Scanning may check a staff member in/out (debounced) or create a guest/party Entry —
// both read from caches the guard's own home/today screens rely on, so clear them.
router.post('/scan', requireGuardAtGate('Scan a pass'), clearCacheAfter(['staff:*', 'entries:*']), scanQR);                  // Unified QR scan (GatePass + Staff)
router.post('/scan/gatepass', requireGuardAtGate('Scan a pass'), scanGatePass);   // Legacy
router.post('/scan/staff', requireGuardAtGate('Scan a pass'), clearCacheAfter(['staff:*', 'entries:*']), scanQRCode);        // Legacy
// Invite usage (usedCount/status) changes on verify — drop residents' cached invite lists
router.post('/verify-code', requireGuardAtGate('Verify a code'), clearCacheAfter(['guest-invites:*', 'party-invites:*']), verifyCode);       // Passcode verification (Guest/Party invites)

// ============================================
// ENTRY LOG
// ============================================
router.get('/entry-log', getEntryLog);

// ============================================
// PRE-APPROVED ENTRIES
// ============================================
router.post('/pre-approved/validate', requireGuardAtGate('Verify a pass'), validate({ body: validatePreApprovedEntrySchema }), validateEntry);
router.post('/pre-approved/:id/use', requireGuardAtGate('Let a pass holder in'), validate({ params: idParams, body: markEntryUsedSchema }), markEntryUsed);
router.get('/pre-approved', validate({ query: guardPreApprovedListQuerySchema }), listForGuard);
router.get('/pre-approved/search', validate({ query: guardPreApprovedSearchSchema }), searchForGuard);

// ============================================
// EMERGENCIES
// ============================================
router.get('/emergencies/active', getActiveEmergencies);
router.patch('/emergencies/:id/respond', respondToEmergency);

// Shift: start (only from the gate), end, and the current state
router.get('/duty', async (req, res) => {
  res.json({ success: true, data: { duty: await currentDuty(req.user!.id) } });
});
router.post('/duty/start', requireGuardAtGate('Start duty', { needsDuty: false }), async (req, res) => {
  const reading = readingFromHeaders(req.headers);
  const gates = await getGateLocations(req.user!.societyId!);
  const gate = gates.length === 1 ? gates[0] : null;
  const duty = await startDuty(req.user!.id, req.user!.societyId!, { gatePointId: gate?.id, latitude: reading?.latitude, longitude: reading?.longitude });
  res.status(201).json({ success: true, message: 'Duty started', data: { duty } });
});
router.post('/duty/end', async (req, res) => {
  await endDuty(req.user!.id);
  res.json({ success: true, message: 'Duty ended', data: { duty: null } });
});

// The guard's own month: days on duty, hours, late / early flags and every shift (?month=YYYY-MM, default this month)
router.get('/attendance/me', async (req, res) => {
  const now = new Date();
  const fallback = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const asked = typeof req.query.month === 'string' ? req.query.month : fallback;
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(asked) ? asked : fallback;
  res.json({ success: true, data: await myAttendance(req.user!.id, req.user!.societyId!, month) });
});

// Is this phone at the gate right now? (the guard app shows it as a chip; nothing is recorded)
router.get('/geofence/status', async (req, res) => {
  const verdict = await evaluate(req.user!.societyId!, readingFromHeaders(req.headers));
  res.json({ success: true, data: verdict });
});

export default router;
