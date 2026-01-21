import bcrypt from 'bcryptjs';
import axios from 'axios';
import { prisma, TransactionClient } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import { generateToken } from '../../middlewares/auth.middleware';
import { OtpService } from '../../utils/Otp';
import {
  validatePhoneNumber,
  validateEmail,
  validateRequiredFields,
  sanitizeString,
} from '../../utils/validation';

const OTP_TTL = 120; // 2 minutes
const MAX_OTP_PHONE = 3; // per hour
const MAX_OTP_IP = 5; // per hour

export class UserService {
  private otpService = new OtpService();

  // ============================================
  // OTP HELPERS
  // ============================================
  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async sendOtpSms(phone: string, otp: string) {
    await axios.post('https://api.msg91.com/api/v5/otp', {
      mobile: phone,
      otp,
      authkey: process.env.MSG91_API_KEY,
    });
  }

  // ============================================
  // OTP REQUEST (RESIDENT APP)
  // ============================================
  async requestResidentOtp(phone: string, ip: string) {
    // Validate phone number format
    validatePhoneNumber(phone);

    const phoneKey = `otp:attempts:phone:${phone}`;
    const ipKey = `otp:attempts:ip:${ip}`;

    const phoneAttempts = await this.otpService.getCount(phoneKey);
    const ipAttempts = await this.otpService.getCount(ipKey);

    if (phoneAttempts >= MAX_OTP_PHONE) {
      throw new AppError('Too many OTP requests for this phone', 429);
    }

    if (ipAttempts >= MAX_OTP_IP) {
      throw new AppError('Too many OTP requests from this IP', 429);
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
  async verifyOtpAndCreateProfile(phone: string, otp: string, name: string, email?: string) {
    // Validate inputs
    validatePhoneNumber(phone);
    if (email) {
      validateEmail(email);
    }
    const sanitizedName = sanitizeString(name);

    const savedOtp = await this.otpService.getOtp(phone);

    if (!savedOtp || savedOtp !== otp) {
      throw new AppError('Invalid or expired OTP', 400);
    }

    await this.otpService.deleteOtp(phone);

    // Check if user already exists
    let user = await prisma.user.findUnique({ where: { phone } });

    if (user) {
      // If user is an invited family member (has flatId but not active), activate them
      if (!user.isActive && user.flatId && user.primaryResidentId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { isActive: true },
        });
      }

      // User exists, just return login
      const token = generateToken(
        user.id,
        user.role,
        user.societyId,
        user.flatId,
        'RESIDENT_APP'
      );

      // Check onboarding status
      const onboardingRequest = await prisma.onboardingRequest.findFirst({
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
    user = await prisma.user.create({
      data: {
        phone,
        name: sanitizedName,
        email,
        role: 'RESIDENT',
        isActive: false, // Will be activated after admin approval
      },
    });

    const token = generateToken(
      user.id,
      user.role,
      user.societyId,
      user.flatId,
      'RESIDENT_APP'
    );

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
  async verifyOtpAndLoginResident(phone: string, otp: string) {
    const savedOtp = await this.otpService.getOtp(phone);

    if (!savedOtp || savedOtp !== otp) {
      throw new AppError('Invalid or expired OTP', 400);
    }

    await this.otpService.deleteOtp(phone);

    let user = await prisma.user.findUnique({ where: { phone } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          phone,
          role: 'RESIDENT',
          isActive: false, // Changed to false for new onboarding flow
        },
      });
    }

    const token = generateToken(
      user.id,
      user.role,
      user.societyId,
      user.flatId,
      'RESIDENT_APP'
    );

    return {
      token,
      user,
      requiresOnboarding: !user.societyId,
      appType: 'RESIDENT_APP',
    };
  }

  // ============================================
  // LEGACY PASSWORD LOGIN (OPTIONAL / ADMIN)
  // ============================================
  async residentAppLogin(identifier: string, password: string) {
    // Try to find user by email first, then by phone
    let user = null;

    // Check if identifier is email (contains @)
    if (identifier.includes('@')) {
      user = await prisma.user.findFirst({
        where: { email: identifier },
        include: { flat: true, society: true },
      });
    } else {
      // Otherwise treat as phone number
      user = await prisma.user.findUnique({
        where: { phone: identifier },
        include: { flat: true, society: true },
      });
    }

    if (!user) throw new AppError('Invalid credentials', 401);
    if (user.role !== 'ADMIN' && user.role !== 'RESIDENT' && user.role !== 'SUPER_ADMIN') {
      throw new AppError('Access denied', 403);
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) throw new AppError('Invalid credentials', 401);

    const token = generateToken(
      user.id,
      user.role,
      user.societyId,
      user.flatId,
      'RESIDENT_APP'
    );

    return { token, user, appType: 'RESIDENT_APP' };
  }


  // ============================================
  // GUARD APP - LOGIN
  // ============================================
  async guardAppLogin(phone: string, password: string) {
    const user = await prisma.user.findUnique({
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

    if (!user) throw new AppError('Invalid credentials', 401);
    if (user.role !== 'GUARD') {
      throw new AppError('This app is only for guards.', 403);
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) throw new AppError('Invalid credentials', 401);

    if (!user.isActive) throw new AppError('Your account is inactive.', 403);
    if (!user.society?.isActive) throw new AppError('Society inactive.', 403);

    const token = generateToken(
      user.id,
      user.role,
      user.societyId,
      null,
      'GUARD_APP'
    );

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const { password: _, ...userWithoutPassword } = user;

    return { token, user: userWithoutPassword, appType: 'GUARD_APP' };
  }

  // ============================================
  // ADMIN - CREATE GUARD
  // ============================================
  async createGuard(data: { name: string; phone: string; password: string; photoUrl?: string }, adminId: string) {
    // Validate inputs
    validateRequiredFields(data, ['name', 'phone', 'password'], 'Guard');
    validatePhoneNumber(data.phone);
    const guardName = sanitizeString(data.name);

    const admin = await prisma.user.findUnique({ where: { id: adminId } });

    if (!admin || admin.role !== 'ADMIN') {
      throw new AppError('Only admin can create guard accounts', 403);
    }

    const existingUser = await prisma.user.findUnique({ where: { phone: data.phone } });
    if (existingUser) throw new AppError('Phone already registered', 400);

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const guard = await prisma.user.create({
      data: {
        name: guardName,
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
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { flat: true, society: true },
    });

    if (!user) throw new AppError('User not found', 404);

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // ============================================
  // UPDATE PROFILE
  // ============================================
  async updateProfile(userId: string, data: { name?: string; email?: string; photoUrl?: string }) {
    const user = await prisma.user.update({
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
  async getGuards(societyId: string) {
    return prisma.user.findMany({
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
  async toggleUserStatus(userId: string, isActive: boolean) {
    return prisma.user.update({
      where: { id: userId },
      data: { isActive },
      select: { id: true, name: true, isActive: true },
    });
  }
}
