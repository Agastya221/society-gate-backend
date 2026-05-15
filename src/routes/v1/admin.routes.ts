import { Router } from 'express';
import { z } from 'zod';
import societyRoutes from '../../modules/society/society.routes';
import reportsRoutes from '../../modules/reports/reports.routes';
import vehicleRoutes from '../../modules/vehicle/vehicle.routes';
import documentRoutes from '../../modules/document/document.routes';
import pollRoutes from '../../modules/poll/poll.routes';
import noticeRoutes from '../../modules/notice/notice.routes';
import billingRoutes from '../../modules/billing/billing.routes';
import broadcastRoutes from '../../modules/broadcast/broadcast.routes';
import adminNotificationRoutes from '../../modules/admin/admin-notification.routes';
import {
  getAdminStaffDirectory,
  getAdminStaffAttendance,
} from '../../modules/admin/admin-staff.controller';
import { getAdminIntercomContacts } from '../../modules/admin/admin-intercom.controller';
import {
  listForAdmin,
  adminCancelEntry,
} from '../../modules/pre-approved-entry/pre-approved-entry.controller';
import {
  lookupVehicle,
  issueViolation,
  listViolations,
  resolveViolation,
} from '../../modules/vehicle/parking-violation.controller';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { cache } from '../../middlewares/cache.middleware';
import {
  idParams,
  adminPreApprovedQuerySchema,
  adminCancelEntrySchema,
} from '../../schemas';

const router = Router();

const queryBoolean = z.preprocess((value) => {
  if (typeof value !== 'string') return value;

  const normalized = value.toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return value;
}, z.boolean());

const adminIntercomContactsQuerySchema = z.object({
  societyId: z.string().uuid().optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  includeGuards: queryBoolean.default(true),
  includeInactive: queryBoolean.default(false),
});

// ---- Existing modules ----
router.use('/societies', societyRoutes);  // /api/v1/admin/societies
router.use('/reports', reportsRoutes);    // /api/v1/admin/reports
router.use('/vehicles', vehicleRoutes);   // /api/v1/admin/vehicles
router.use('/documents', documentRoutes); // /api/v1/admin/documents
router.use('/polls', pollRoutes);         // /api/v1/admin/polls
router.use('/notices', noticeRoutes);     // /api/v1/admin/notices

// ---- New modules ----
router.use('/billing', billingRoutes);         // /api/v1/admin/billing/...
router.use('/broadcast', broadcastRoutes);     // /api/v1/admin/broadcast
router.use('/notifications', adminNotificationRoutes); // /api/v1/admin/notifications

// GET /api/v1/admin/intercom/contacts
router.get(
  '/intercom/contacts',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate({ query: adminIntercomContactsQuerySchema }),
  cache({ ttl: 120, keyPrefix: 'admin:intercom', varyBy: ['societyId', 'role'] }),
  getAdminIntercomContacts,
);

// Alias: /api/v1/admin/dues → billing dues list (matches frontend audit spec)
import { listDues } from '../../modules/billing/billing.controller';
router.get(
  '/dues',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  cache({ ttl: 60, keyPrefix: 'billing', varyBy: ['societyId'] }),
  listDues,
);

// ---- Unified Staff Directory ----
// GET /api/v1/admin/staff
router.get(
  '/staff',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  cache({ ttl: 120, keyPrefix: 'admin:staff', varyBy: ['societyId'] }),
  getAdminStaffDirectory,
);

// GET /api/v1/admin/staff/attendance
router.get(
  '/staff/attendance',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  cache({ ttl: 60, keyPrefix: 'admin:attendance', varyBy: ['societyId', 'date'] }),
  getAdminStaffAttendance,
);

// ---- Parking violations ----
router.get('/parking/lookup', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), lookupVehicle);
router.get('/parking/violations', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), listViolations);
router.post('/parking/violations', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), issueViolation);
router.post('/parking/vehicles/:vehicleId/violations', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), issueViolation);
router.patch('/parking/violations/:id/resolve', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), resolveViolation);

// ---- Pre-approved entry oversight ----
router.get('/pre-approved', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), validate({ query: adminPreApprovedQuerySchema }), listForAdmin);
router.patch('/pre-approved/:id/cancel', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), validate({ params: idParams, body: adminCancelEntrySchema }), adminCancelEntry);

export default router;
