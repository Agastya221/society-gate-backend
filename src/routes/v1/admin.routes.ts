import { Router } from 'express';
import societyRoutes from '../../modules/society/society.routes';
import reportsRoutes from '../../modules/reports/reports.routes';
import vehicleRoutes from '../../modules/vehicle/vehicle.routes';
import documentRoutes from '../../modules/document/document.routes';
import pollRoutes from '../../modules/poll/poll.routes';
import noticeRoutes from '../../modules/notice/notice.routes';
import {
  listForAdmin,
  adminCancelEntry,
} from '../../modules/pre-approved-entry/pre-approved-entry.controller';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  idParams,
  adminPreApprovedQuerySchema,
  adminCancelEntrySchema,
} from '../../schemas';

const router = Router();

// Admin-specific endpoints
router.use('/societies', societyRoutes);  // /api/v1/admin/societies
router.use('/reports', reportsRoutes);    // /api/v1/admin/reports
router.use('/vehicles', vehicleRoutes);   // /api/v1/admin/vehicles
router.use('/documents', documentRoutes); // /api/v1/admin/documents
router.use('/polls', pollRoutes);         // /api/v1/admin/polls
router.use('/notices', noticeRoutes);     // /api/v1/admin/notices

// Pre-approved entry oversight
router.get('/pre-approved', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), validate({ query: adminPreApprovedQuerySchema }), listForAdmin);
router.patch('/pre-approved/:id/cancel', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), validate({ params: idParams, body: adminCancelEntrySchema }), adminCancelEntry);

export default router;
