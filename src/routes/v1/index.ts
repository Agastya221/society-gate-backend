import { Router } from 'express';
import authRoutes from '../../modules/user/user.routes';
import gateRoutes from './gate.routes';
import staffRoutes from './staff.routes';
import communityRoutes from './community.routes';
import residentRoutes from './resident.routes';
import adminRoutes from './admin.routes';
import guardRoutes from './guard.routes';
import uploadRoutes from '../../modules/upload/upload.routes';
import societyRegistrationRoutes from '../../modules/society-registration/society-registration.routes';
import paymentRoutes from '../../modules/payment/payment.routes';
import superadminRoutes from '../../modules/superadmin/superadmin.routes';
import staffAppRoutes from '../../modules/staff-app/staff-app.routes';

const router = Router();

// API v1 Route Groups
router.use('/auth', authRoutes);              // /api/v1/auth
router.use('/users', authRoutes);             // /api/v1/users (alias — FCM token, profile, etc.)
router.use('/gate', gateRoutes);              // /api/v1/gate/*
router.use('/staff', staffRoutes);            // /api/v1/staff/*
router.use('/staff-app', staffAppRoutes);      // /api/v1/staff-app/*
router.use('/community', communityRoutes);    // /api/v1/community/*
router.use('/resident', residentRoutes);      // /api/v1/resident/*
router.use('/admin', adminRoutes);            // /api/v1/admin/*
router.use('/guard', guardRoutes);            // /api/v1/guard/*
router.use('/upload', uploadRoutes);          // /api/v1/upload
// Online gateway (Cashfree) is off: residents pay the society directly by UPI/bank
// and S-Gate never handles the money. Kept for a possible future opt-in.
if (process.env.PAYMENT_GATEWAY_ENABLED === 'true') {
  router.use('/payments', paymentRoutes);     // /api/v1/payments
} else {
  router.use('/payments', (_req, res) => {
    res.status(503).json({ success: false, message: 'Online payments are not available. Please pay your society directly.' });
  });
}
router.use('/society-registration', societyRegistrationRoutes); // /api/v1/society-registration
router.use('/superadmin', superadminRoutes); // /api/v1/superadmin

export default router;

