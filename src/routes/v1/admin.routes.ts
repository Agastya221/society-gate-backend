import { Router } from 'express';
import societyRoutes from '../../modules/society/society.routes';
import reportsRoutes from '../../modules/reports/reports.routes';
import vehicleRoutes from '../../modules/vehicle/vehicle.routes';
import documentRoutes from '../../modules/document/document.routes';
import pollRoutes from '../../modules/poll/poll.routes';
import noticeRoutes from '../../modules/notice/notice.routes';
import billingRoutes from '../../modules/billing/billing.routes';
import broadcastRoutes from '../../modules/broadcast/broadcast.routes';
import {
  getAdminStaffDirectory,
  getAdminStaffAttendance,
} from '../../modules/admin/admin-staff.controller';
import {
  listForAdmin,
  adminCancelEntry,
} from '../../modules/pre-approved-entry/pre-approved-entry.controller';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { cache } from '../../middlewares/cache.middleware';
import {
  idParams,
  adminPreApprovedQuerySchema,
  adminCancelEntrySchema,
} from '../../schemas';

const router = Router();

// ---- Existing modules ----
router.use('/societies', societyRoutes);  // /api/v1/admin/societies
router.use('/reports', reportsRoutes);    // /api/v1/admin/reports
router.use('/vehicles', vehicleRoutes);   // /api/v1/admin/vehicles
router.use('/documents', documentRoutes); // /api/v1/admin/documents
router.use('/polls', pollRoutes);         // /api/v1/admin/polls
router.use('/notices', noticeRoutes);     // /api/v1/admin/notices

// ---- New modules ----
router.use('/billing', billingRoutes);       // /api/v1/admin/billing/...  +  /api/v1/admin/billing/dues
router.use('/broadcast', broadcastRoutes);   // /api/v1/admin/broadcast

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

// ---- Pre-approved entry oversight ----
router.get('/pre-approved', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), validate({ query: adminPreApprovedQuerySchema }), listForAdmin);
router.patch('/pre-approved/:id/cancel', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), validate({ params: idParams, body: adminCancelEntrySchema }), adminCancelEntry);

export default router;
