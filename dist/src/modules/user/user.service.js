"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const axios_1 = __importDefault(require("axios"));
const Client_1 = require("../../utils/Client");
const ResponseHandler_1 = require("../../utils/ResponseHandler");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const Otp_1 = require("../../utils/Otp");
const OTP_TTL = 120; // 2 minutes
const MAX_OTP_PHONE = 3; // per hour
const MAX_OTP_IP = 5; // per hour
class UserService {
    constructor() {
        this.otpService = new Otp_1.OtpService();
    }
    // ============================================
    // OTP HELPERS
    // ============================================
    generateOtp() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }
    async sendOtpSms(phone, otp) {
        await axios_1.default.post('https://api.msg91.com/api/v5/otp', {
            mobile: phone,
            otp,
            authkey: process.env.MSG91_API_KEY,
        });
    }
    // ============================================
    // OTP REQUEST (RESIDENT APP)
    // ============================================
    async requestResidentOtp(phone, ip) {
        const phoneKey = `otp:attempts:phone:${phone}`;
        const ipKey = `otp:attempts:ip:${ip}`;
        const phoneAttempts = await this.otpService.getCount(phoneKey);
        const ipAttempts = await this.otpService.getCount(ipKey);
        if (phoneAttempts >= MAX_OTP_PHONE) {
            throw new ResponseHandler_1.AppError('Too many OTP requests for this phone', 429);
        }
        if (ipAttempts >= MAX_OTP_IP) {
            throw new ResponseHandler_1.AppError('Too many OTP requests from this IP', 429);
        }
        const otp = this.generateOtp();
        await this.otpService.setOtp(phone, otp, OTP_TTL);
        await this.otpService.increment(phoneKey, 3600);
        await this.otpService.increment(ipKey, 3600);
        await this.sendOtpSms(phone, otp);
    }
    // ============================================
    // OTP VERIFY + CREATE PROFILE (NEW ONBOARDING)
    // ============================================
    async verifyOtpAndCreateProfile(phone, otp, name, email) {
        const savedOtp = await this.otpService.getOtp(phone);
        if (!savedOtp || savedOtp !== otp) {
            throw new ResponseHandler_1.AppError('Invalid or expired OTP', 400);
        }
        await this.otpService.deleteOtp(phone);
        // Check if user already exists
        let user = await Client_1.prisma.user.findUnique({ where: { phone } });
        if (user) {
            // User exists, just return login
            const token = (0, auth_middleware_1.generateToken)(user.id, user.role, user.societyId, user.flatId, 'RESIDENT_APP');
            // Check onboarding status
            const onboardingRequest = await Client_1.prisma.onboardingRequest.findFirst({
                where: { userId: user.id },
                orderBy: { createdAt: 'desc' },
            });
            return {
                token,
                user,
                requiresOnboarding: !user.isActive || !user.societyId,
                onboardingStatus: onboardingRequest?.status || 'NOT_STARTED',
                appType: 'RESIDENT_APP',
            };
        }
        // Create new user with profile
        user = await Client_1.prisma.user.create({
            data: {
                phone,
                name,
                email,
                role: 'RESIDENT',
                isActive: false, // Will be activated after admin approval
            },
        });
        const token = (0, auth_middleware_1.generateToken)(user.id, user.role, user.societyId, user.flatId, 'RESIDENT_APP');
        return {
            token,
            user,
            requiresOnboarding: true,
            onboardingStatus: 'DRAFT',
            appType: 'RESIDENT_APP',
        };
    }
    // ============================================
    // OTP VERIFY + LOGIN (LEGACY - Keep for backward compatibility)
    // ============================================
    async verifyOtpAndLoginResident(phone, otp) {
        const savedOtp = await this.otpService.getOtp(phone);
        if (!savedOtp || savedOtp !== otp) {
            throw new ResponseHandler_1.AppError('Invalid or expired OTP', 400);
        }
        await this.otpService.deleteOtp(phone);
        let user = await Client_1.prisma.user.findUnique({ where: { phone } });
        if (!user) {
            user = await Client_1.prisma.user.create({
                data: {
                    phone,
                    role: 'RESIDENT',
                    isActive: false, // Changed to false for new onboarding flow
                },
            });
        }
        const token = (0, auth_middleware_1.generateToken)(user.id, user.role, user.societyId, user.flatId, 'RESIDENT_APP');
        return {
            token,
            user,
            requiresOnboarding: !user.societyId,
            appType: 'RESIDENT_APP',
        };
    }
    // ============================================
    // INVITATION ONBOARDING (PHASE 2)
    // ============================================
    async onboardResidentWithInvitation(userId, invitationCode) {
        const invitation = await Client_1.prisma.invitation.findUnique({
            where: { code: invitationCode },
            include: { society: true, flat: true },
        });
        if (!invitation)
            throw new ResponseHandler_1.AppError('Invalid invitation code', 400);
        if (invitation.isUsed)
            throw new ResponseHandler_1.AppError('Invitation already used', 400);
        if (invitation.expiresAt < new Date()) {
            throw new ResponseHandler_1.AppError('Invitation expired', 400);
        }
        const user = await Client_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new ResponseHandler_1.AppError('User not found', 404);
        if (user.societyId)
            throw new ResponseHandler_1.AppError('User already onboarded', 400);
        const updatedUser = await Client_1.prisma.$transaction(async (tx) => {
            const u = await tx.user.update({
                where: { id: userId },
                data: {
                    societyId: invitation.societyId,
                    flatId: invitation.flatId,
                    isOwner: invitation.isOwner,
                    isActive: true,
                },
                include: { society: true, flat: true },
            });
            await tx.invitation.update({
                where: { id: invitation.id },
                data: { isUsed: true, usedAt: new Date() },
            });
            return u;
        });
        const token = (0, auth_middleware_1.generateToken)(updatedUser.id, updatedUser.role, updatedUser.societyId, updatedUser.flatId, 'RESIDENT_APP');
        const { password: _, ...userWithoutPassword } = updatedUser;
        return {
            token,
            user: userWithoutPassword,
            appType: 'RESIDENT_APP',
        };
    }
    // ============================================
    // LEGACY PASSWORD LOGIN (OPTIONAL / ADMIN)
    // ============================================
    async residentAppLogin(identifier, password) {
        // Try to find user by email first, then by phone
        let user = null;
        // Check if identifier is email (contains @)
        if (identifier.includes('@')) {
            user = await Client_1.prisma.user.findFirst({
                where: { email: identifier },
                include: { flat: true, society: true },
            });
        }
        else {
            // Otherwise treat as phone number
            user = await Client_1.prisma.user.findUnique({
                where: { phone: identifier },
                include: { flat: true, society: true },
            });
        }
        if (!user)
            throw new ResponseHandler_1.AppError('Invalid credentials', 401);
        if (user.role !== 'ADMIN' && user.role !== 'RESIDENT' && user.role !== 'SUPER_ADMIN') {
            throw new ResponseHandler_1.AppError('Access denied', 403);
        }
        const isValidPassword = await bcryptjs_1.default.compare(password, user.password);
        if (!isValidPassword)
            throw new ResponseHandler_1.AppError('Invalid credentials', 401);
        const token = (0, auth_middleware_1.generateToken)(user.id, user.role, user.societyId, user.flatId, 'RESIDENT_APP');
        return { token, user, appType: 'RESIDENT_APP' };
    }
    // ============================================
    // GUARD APP - LOGIN
    // ============================================
    async guardAppLogin(phone, password) {
        const user = await Client_1.prisma.user.findUnique({
            where: { phone },
            include: {
                society: {
                    select: {
                        id: true,
                        name: true,
                        address: true,
                        city: true,
                        isActive: true,
                    },
                },
            },
        });
        if (!user)
            throw new ResponseHandler_1.AppError('Invalid credentials', 401);
        if (user.role !== 'GUARD') {
            throw new ResponseHandler_1.AppError('This app is only for guards.', 403);
        }
        const isValidPassword = await bcryptjs_1.default.compare(password, user.password);
        if (!isValidPassword)
            throw new ResponseHandler_1.AppError('Invalid credentials', 401);
        if (!user.isActive)
            throw new ResponseHandler_1.AppError('Your account is inactive.', 403);
        if (!user.society?.isActive)
            throw new ResponseHandler_1.AppError('Society inactive.', 403);
        const token = (0, auth_middleware_1.generateToken)(user.id, user.role, user.societyId, null, 'GUARD_APP');
        await Client_1.prisma.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() },
        });
        const { password: _, ...userWithoutPassword } = user;
        return { token, user: userWithoutPassword, appType: 'GUARD_APP' };
    }
    // ============================================
    // RESIDENT APP - REGISTER (INVITATION)
    // ============================================
    async residentAppRegister(data) {
        const { name, phone, email, password, invitationCode } = data;
        const invitation = await Client_1.prisma.invitation.findUnique({
            where: { code: invitationCode },
            include: { flat: true, society: true },
        });
        if (!invitation)
            throw new ResponseHandler_1.AppError('Invalid invitation code', 400);
        if (invitation.isUsed)
            throw new ResponseHandler_1.AppError('Invitation already used', 400);
        if (invitation.expiresAt < new Date()) {
            throw new ResponseHandler_1.AppError('Invitation expired', 400);
        }
        const existingUser = await Client_1.prisma.user.findUnique({ where: { phone } });
        if (existingUser)
            throw new ResponseHandler_1.AppError('Phone already registered', 400);
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const resident = await Client_1.prisma.$transaction(async (tx) => {
            const newUser = await tx.user.create({
                data: {
                    name,
                    phone,
                    email,
                    password: hashedPassword,
                    role: 'RESIDENT',
                    societyId: invitation.societyId,
                    flatId: invitation.flatId,
                    isOwner: invitation.isOwner,
                    isActive: true,
                },
                include: { flat: true, society: true },
            });
            await tx.invitation.update({
                where: { id: invitation.id },
                data: { isUsed: true, usedAt: new Date() },
            });
            return newUser;
        });
        const token = (0, auth_middleware_1.generateToken)(resident.id, resident.role, resident.societyId, resident.flatId, 'RESIDENT_APP');
        const { password: _, ...residentWithoutPassword } = resident;
        return { token, user: residentWithoutPassword, appType: 'RESIDENT_APP' };
    }
    // ============================================
    // ADMIN - CREATE GUARD
    // ============================================
    async createGuard(data, adminId) {
        const admin = await Client_1.prisma.user.findUnique({ where: { id: adminId } });
        if (!admin || admin.role !== 'ADMIN') {
            throw new ResponseHandler_1.AppError('Only admin can create guard accounts', 403);
        }
        const existingUser = await Client_1.prisma.user.findUnique({ where: { phone: data.phone } });
        if (existingUser)
            throw new ResponseHandler_1.AppError('Phone already registered', 400);
        const hashedPassword = await bcryptjs_1.default.hash(data.password, 10);
        const guard = await Client_1.prisma.user.create({
            data: {
                name: data.name,
                phone: data.phone,
                password: hashedPassword,
                photoUrl: data.photoUrl,
                role: 'GUARD',
                societyId: admin.societyId,
                isActive: true,
            },
            include: { society: true },
        });
        const { password: _, ...guardWithoutPassword } = guard;
        return guardWithoutPassword;
    }
    // ============================================
    // GET PROFILE
    // ============================================
    async getProfile(userId) {
        const user = await Client_1.prisma.user.findUnique({
            where: { id: userId },
            include: { flat: true, society: true },
        });
        if (!user)
            throw new ResponseHandler_1.AppError('User not found', 404);
        const { password: _, ...userWithoutPassword } = user;
        return userWithoutPassword;
    }
    // ============================================
    // UPDATE PROFILE
    // ============================================
    async updateProfile(userId, data) {
        const user = await Client_1.prisma.user.update({
            where: { id: userId },
            data,
            include: { flat: true, society: true },
        });
        const { password: _, ...userWithoutPassword } = user;
        return userWithoutPassword;
    }
    // ============================================
    // GET ALL GUARDS
    // ============================================
    async getGuards(societyId) {
        return Client_1.prisma.user.findMany({
            where: { societyId, role: 'GUARD' },
            select: {
                id: true,
                name: true,
                phone: true,
                photoUrl: true,
                isActive: true,
                lastLogin: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    // ============================================
    // TOGGLE USER STATUS
    // ============================================
    async toggleUserStatus(userId, isActive) {
        return Client_1.prisma.user.update({
            where: { id: userId },
            data: { isActive },
            select: { id: true, name: true, isActive: true },
        });
    }
}
exports.UserService = UserService;
