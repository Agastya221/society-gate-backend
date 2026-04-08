import { Router } from 'express';
import { UserController } from './user.controller';
import { SettingsController } from '../settings/settings.controller';
import {
  authenticateResidentApp,
  authenticateGuardApp,
  authenticateForOnboarding,
  authorize,
  authenticate,
} from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { cache, clearCacheAfter } from '../../middlewares/cache.middleware';
import {
  verifyWidgetTokenSchema,
  verifyResidentWidgetTokenSchema,
  refreshTokenSchema,
  updateProfileSchema,
  createGuardSchema,
  toggleUserStatusSchema,
  bootstrapSuperAdminSchema,
  updateFcmTokenSchema,
  idParams,
} from '../../schemas';

const router = Router();
const userController = new UserController();
const settingsController = new SettingsController();

// ============================================
// PUBLIC ROUTES — MSG91 Widget Auth
// ============================================

router.post(
  '/bootstrap-superadmin',
  validate({ body: bootstrapSuperAdminSchema }),
  userController.bootstrapSuperAdmin
);

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
router.get('/resident-app/profile', authenticateResidentApp, cache({ ttl: 300, keyPrefix: 'user:profile', varyBy: ['userId'] }), userController.getProfile);

// Update Profile
router.patch('/resident-app/profile', authenticateResidentApp, validate({ body: updateProfileSchema }), clearCacheAfter(['api:user*']), userController.updateProfile);

// Admin: Create Guard
router.post(
  '/resident-app/create-guard',
  authenticateResidentApp,
  authorize('ADMIN'),
  validate({ body: createGuardSchema }),
  clearCacheAfter(['api:user*']),
  userController.createGuard
);

// Admin: Get all Guards
router.get(
  '/resident-app/guards',
  authenticateResidentApp,
  authorize('ADMIN'),
  cache({ ttl: 300, keyPrefix: 'user:guards', varyBy: ['societyId'] }),
  userController.getGuards
);

// Settings Summary — works for onboarding and approved residents
router.get(
  '/resident-app/settings-summary',
  authenticateForOnboarding,
  settingsController.getResidentSettingsSummary
);

// Update FCM Token (Resident App) — allow inactive users (new users after first login)
router.patch(
  '/resident-app/fcm-token',
  authenticateForOnboarding,
  validate({ body: updateFcmTokenSchema }),
  clearCacheAfter(['api:user*']),
  userController.updateFcmToken
);

// Admin: Toggle user active/inactive
router.patch(
  '/resident-app/users/:id/status',
  authenticateResidentApp,
  authorize('ADMIN'),
  validate({ params: idParams, body: toggleUserStatusSchema }),
  clearCacheAfter(['api:user*']),
  userController.toggleUserStatus
);


// ============================================
// GUARD APP — PROTECTED ROUTES
// ============================================

// Get Profile
router.get('/guard-app/profile', authenticateGuardApp, cache({ ttl: 300, keyPrefix: 'user:profile', varyBy: ['userId'] }), userController.getProfile);

// Update FCM Token (Guard App)
router.patch(
  '/guard-app/fcm-token',
  authenticateGuardApp,
  validate({ body: updateFcmTokenSchema }),
  clearCacheAfter(['api:user*']),
  userController.updateFcmToken
);

export default router;