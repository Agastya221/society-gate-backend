"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const user_controller_1 = require("./user.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const router = (0, express_1.Router)();
const userController = new user_controller_1.UserController();
// ============================================
// PUBLIC ROUTES (No authentication)
// ============================================
// OTP Routes (New Onboarding Flow)
router.post('/otp/send', userController.requestResidentOtp);
router.post('/otp/verify', userController.verifyOtpAndCreateProfile);
// Resident App - Login
router.post('/resident-app/login', userController.residentAppLogin);
// Resident App - Register
router.post('/resident-app/register', userController.residentAppRegister);
// Guard App - Login
router.post('/guard-app/login', userController.guardAppLogin);
// ============================================
// RESIDENT APP - PROTECTED ROUTES
// ============================================
// Get Profile
router.get('/resident-app/profile', auth_middleware_1.authenticateResidentApp, userController.getProfile);
// Update Profile
router.patch('/resident-app/profile', auth_middleware_1.authenticateResidentApp, userController.updateProfile);
// Admin creates Guard
router.post('/resident-app/create-guard', auth_middleware_1.authenticateResidentApp, (0, auth_middleware_1.authorize)('ADMIN'), userController.createGuard);
// Admin gets all Guards
router.get('/resident-app/guards', auth_middleware_1.authenticateResidentApp, (0, auth_middleware_1.authorize)('ADMIN'), userController.getGuards);
// Admin toggles user status
router.patch('/resident-app/users/:id/status', auth_middleware_1.authenticateResidentApp, (0, auth_middleware_1.authorize)('ADMIN'), userController.toggleUserStatus);
// ============================================
// GUARD APP - PROTECTED ROUTES
// ============================================
// Get Profile
router.get('/guard-app/profile', auth_middleware_1.authenticateGuardApp, userController.getProfile);
exports.default = router;
