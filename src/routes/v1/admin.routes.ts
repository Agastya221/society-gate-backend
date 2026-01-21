import { Router } from 'express';
import societyRoutes from '../../modules/society/society.routes';
import reportsRoutes from '../../modules/reports/reports.routes';

const router = Router();

// Admin-specific endpoints
router.use('/societies', societyRoutes);  // /api/v1/admin/societies
router.use('/reports', reportsRoutes);    // /api/v1/admin/reports

export default router;
