"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserController = void 0;
const user_service_1 = require("./user.service");
const ResponseHandler_1 = require("../../utils/ResponseHandler");
const userService = new user_service_1.UserService();
class UserController {
    constructor() {
        // RESIDENT APP - Request OTP
        // UserController
        this.requestResidentOtp = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const { phone } = req.body;
            const ip = req.ip || req.headers['x-forwarded-for'] || '';
            await userService.requestResidentOtp(phone, ip);
            res.json({
                success: true,
                message: 'OTP sent successfully',
            });
        });
        // NEW: Verify OTP and create profile (for onboarding)
        this.verifyOtpAndCreateProfile = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const { phone, otp, name, email } = req.body;
            if (!name) {
                throw new ResponseHandler_1.AppError('Name is required', 400);
            }
            const result = await userService.verifyOtpAndCreateProfile(phone, otp, name, email);
            res.json({
                success: true,
                message: result.requiresOnboarding
                    ? 'Profile created successfully. Please complete onboarding.'
                    : 'Welcome back!',
                data: result,
            });
        });
        // LEGACY: Verify OTP (backward compatibility)
        this.verifyResidentOtp = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const { phone, otp } = req.body;
            const result = await userService.verifyOtpAndLoginResident(phone, otp);
            res.json({
                success: true,
                message: `Welcome back!`,
                data: result,
            });
        });
        // RESIDENT APP - Login
        this.residentAppLogin = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const { phone, email, password } = req.body;
            // Accept either phone or email as identifier
            const identifier = email || phone;
            if (!identifier || !password) {
                throw new ResponseHandler_1.AppError('Phone/Email and password are required', 400);
            }
            const result = await userService.residentAppLogin(identifier, password);
            res.json({
                success: true,
                message: `Welcome back, ${result.user.name}!`,
                data: result,
            });
        });
        // GUARD APP - Login
        this.guardAppLogin = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const { phone, password } = req.body;
            const result = await userService.guardAppLogin(phone, password);
            res.json({
                success: true,
                message: `Welcome back, ${result.user.name}!`,
                data: result,
            });
        });
        // RESIDENT APP - Register
        this.residentAppRegister = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const result = await userService.residentAppRegister(req.body);
            res.status(201).json({
                success: true,
                message: 'Registration successful! Welcome to your society.',
                data: result,
            });
        });
        // ADMIN - Create Guard
        this.createGuard = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const guard = await userService.createGuard(req.body, req.user.id);
            res.status(201).json({
                success: true,
                message: 'Guard account created successfully',
                data: guard,
            });
        });
        // Get Profile
        this.getProfile = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const user = await userService.getProfile(req.user.id);
            res.json({
                success: true,
                data: user,
            });
        });
        // Update Profile
        this.updateProfile = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const user = await userService.updateProfile(req.user.id, req.body);
            res.json({
                success: true,
                message: 'Profile updated successfully',
                data: user,
            });
        });
        // Get All Guards (Admin only)
        this.getGuards = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const guards = await userService.getGuards(req.user.societyId);
            res.json({
                success: true,
                data: guards,
            });
        });
        // Toggle User Status (Admin only)
        this.toggleUserStatus = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const { isActive } = req.body;
            const user = await userService.toggleUserStatus(req.params.id, isActive);
            res.json({
                success: true,
                message: isActive ? 'User activated' : 'User deactivated',
                data: user,
            });
        });
    }
}
exports.UserController = UserController;
