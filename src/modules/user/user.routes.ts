import { Router } from 'express';
import { UserController } from './user.controller';
import {
  authenticateResidentApp,
  authenticateGuardApp,
  authorize,
  authenticate,
} from '../../middlewares/auth.middleware';

const router = Router();
const userController = new UserController();

// ============================================
// PUBLIC ROUTES (No authentication)
// ============================================

// OTP Routes (New Onboarding Flow)
router.post('/otp/send', userController.requestResidentOtp);
router.post('/otp/verify', userController.verifyOtpAndCreateProfile);

// Admin App - Login
router.post('/admin-app/login', userController.residentAppLogin);

// Guard App - Login
router.post('/guard-app/login', userController.guardAppLogin);

// Token Refresh
router.post('/refresh-token', userController.refreshToken);

// Logout
router.post('/logout', authenticate, userController.logout);


// ============================================
// RESIDENT APP - PROTECTED ROUTES
// ============================================

// Get Profile
router.get('/resident-app/profile', authenticateResidentApp, userController.getProfile);

// Update Profile
router.patch('/resident-app/profile', authenticateResidentApp, userController.updateProfile);

// Admin creates Guard
router.post(
  '/resident-app/create-guard',
  authenticateResidentApp,
  authorize('ADMIN'),
  userController.createGuard
);

// Admin gets all Guards
router.get(
  '/resident-app/guards',
  authenticateResidentApp,
  authorize('ADMIN'),
  userController.getGuards
);

// Admin toggles user status
router.patch(
  '/resident-app/users/:id/status',
  authenticateResidentApp,
  authorize('ADMIN'),
  userController.toggleUserStatus
);

// ============================================
// GUARD APP - PROTECTED ROUTES
// ============================================

// Get Profile
router.get('/guard-app/profile', authenticateGuardApp, userController.getProfile);

export default router;