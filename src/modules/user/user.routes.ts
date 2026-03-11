import { Router } from 'express';
import { UserController } from './user.controller';
import {
  authenticateResidentApp,
  authenticateGuardApp,
  authorize,
  authenticate,
} from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  verifyWidgetTokenSchema,
  verifyResidentWidgetTokenSchema,
  refreshTokenSchema,
  updateProfileSchema,
  createGuardSchema,
  toggleUserStatusSchema,
  idParams,
} from '../../schemas';

const router = Router();
const userController = new UserController();

// ============================================
// PUBLIC ROUTES — MSG91 Widget Auth
// ============================================

// Resident App — verify widget token (creates new user if first login)
router.post('/otp/verify', validate({ body: verifyResidentWidgetTokenSchema }), userController.residentWidgetVerify);

// Admin/Resident App — verify widget token (existing users only)
router.post('/admin-app/otp/verify', validate({ body: verifyWidgetTokenSchema }), userController.adminAppOtpVerify);

// Guard App — verify widget token (guards only)
router.post('/guard-app/otp/verify', validate({ body: verifyWidgetTokenSchema }), userController.guardAppOtpVerify);

// Token Refresh
router.post('/refresh-token', validate({ body: refreshTokenSchema }), userController.refreshToken);

// Logout (requires valid access token)
router.post('/logout', authenticate, userController.logout);


// ============================================
// RESIDENT APP — PROTECTED ROUTES
// ============================================

// Get Profile
router.get('/resident-app/profile', authenticateResidentApp, userController.getProfile);

// Update Profile
router.patch('/resident-app/profile', authenticateResidentApp, validate({ body: updateProfileSchema }), userController.updateProfile);

// Admin: Create Guard
router.post(
  '/resident-app/create-guard',
  authenticateResidentApp,
  authorize('ADMIN'),
  validate({ body: createGuardSchema }),
  userController.createGuard
);

// Admin: Get all Guards
router.get(
  '/resident-app/guards',
  authenticateResidentApp,
  authorize('ADMIN'),
  userController.getGuards
);

// Admin: Toggle user active/inactive
router.patch(
  '/resident-app/users/:id/status',
  authenticateResidentApp,
  authorize('ADMIN'),
  validate({ params: idParams, body: toggleUserStatusSchema }),
  userController.toggleUserStatus
);


// ============================================
// GUARD APP — PROTECTED ROUTES
// ============================================

// Get Profile
router.get('/guard-app/profile', authenticateGuardApp, userController.getProfile);

export default router;