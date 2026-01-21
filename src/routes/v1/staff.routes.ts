import { Router } from 'express';
import domesticStaffRoutes from '../../modules/domestic-staff/domestic-staff.routes';
import vendorRoutes from '../../modules/vendor/vendor.routes';

const router = Router();

// All staff/service provider endpoints grouped together
router.use('/domestic', domesticStaffRoutes);  // /api/v1/staff/domestic
router.use('/vendors', vendorRoutes);          // /api/v1/staff/vendors

export default router;
