import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  blacklistToken,
  isTokenBlacklisted,
  extractJti,
} from '../../services/token.service';
import { verifyMSG91WidgetToken } from '../../utils/msg91';
import {
  validateEmail,
  validateRequiredFields,
  sanitizeString,
} from '../../utils/validation';
import logger from '../../utils/logger';


// CRIT-6: Only name, email, photoUrl are allowed in profile updates

export class UserService {

  // ============================================
  // WIDGET: RESIDENT APP LOGIN / REGISTER
  // Verifies MSG91 widget token, creates user if first time
  // ============================================
  async residentWidgetVerify(widgetToken: string, name?: string, email?: string) {
    // 1. Verify with MSG91 — get the confirmed phone number
    const phone = await verifyMSG91WidgetToken(widgetToken);

    if (email) validateEmail(email);

    let user = await prisma.user.findUnique({ where: { phone } });

    if (user) {
      // Existing user — re-activate if they have a flat but are inactive
      if (!user.isActive && user.flatId && user.primaryResidentId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { isActive: true },
        });
      }

      const accessToken = generateAccessToken(user.id, user.role, user.societyId, user.flatId, 'RESIDENT_APP');
      const refreshToken = generateRefreshToken(user.id, user.role, user.societyId, user.flatId, 'RESIDENT_APP');

      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken, lastTokenRefresh: new Date(), lastLogin: new Date() },
      });

      const onboardingRequest = await prisma.onboardingRequest.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      });

      const { password: _, refreshToken: __, ...safe } = user;
      return {
        accessToken, refreshToken, user: safe,
        requiresOnboarding: !user.isActive || !user.societyId,
        onboardingStatus: onboardingRequest?.status || 'NOT_STARTED',
        appType: 'RESIDENT_APP',
      };
    }

    // New user — create account. Name is required for brand-new users.
    if (!name) throw new AppError('Name is required for new accounts', 400);
    const sanitizedName = sanitizeString(name);

    user = await prisma.user.create({
      data: { phone, name: sanitizedName, email, role: 'RESIDENT', isActive: false },
    });

    const accessToken = generateAccessToken(user.id, user.role, user.societyId, user.flatId, 'RESIDENT_APP');
    const refreshToken = generateRefreshToken(user.id, user.role, user.societyId, user.flatId, 'RESIDENT_APP');

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken, lastTokenRefresh: new Date() },
    });

    const { password: _, refreshToken: __, ...safe } = user;
    return {
      accessToken, refreshToken, user: safe,
      requiresOnboarding: true,
      onboardingStatus: 'DRAFT',
      appType: 'RESIDENT_APP',
    };
  }

  // ============================================
  // WIDGET: ADMIN APP LOGIN (existing users only, no creation)
  // Accepts: ADMIN, SUPER_ADMIN, RESIDENT
  // ============================================
  async adminAppOtpVerify(widgetToken: string) {
    const phone = await verifyMSG91WidgetToken(widgetToken);

    const user = await prisma.user.findUnique({
      where: { phone },
      include: { flat: true, society: true },
    });

    if (!user) {
      throw new AppError('No account found for this number. Please contact your society admin.', 404);
    }

    const allowedRoles = ['ADMIN', 'SUPER_ADMIN', 'RESIDENT'];
    if (!allowedRoles.includes(user.role)) {
      throw new AppError('Access denied. This app is for residents and admins only.', 403);
    }

    if (!user.isActive) {
      throw new AppError('Your account is inactive. Please contact your society admin.', 403);
    }

    const accessToken = generateAccessToken(user.id, user.role, user.societyId, user.flatId, 'RESIDENT_APP');
    const refreshToken = generateRefreshToken(user.id, user.role, user.societyId, user.flatId, 'RESIDENT_APP');

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken, lastTokenRefresh: new Date(), lastLogin: new Date() },
    });

    const { password: _, refreshToken: __, ...safe } = user;
    return { accessToken, refreshToken, user: safe, appType: 'RESIDENT_APP' };
  }

  // ============================================
  // WIDGET: GUARD APP LOGIN (guards only, no creation)
  // ============================================
  async guardAppOtpVerify(widgetToken: string) {
    const phone = await verifyMSG91WidgetToken(widgetToken);

    const user = await prisma.user.findUnique({
      where: { phone },
      include: {
        society: { select: { id: true, name: true, address: true, city: true, isActive: true } },
      },
    });

    if (!user) {
      throw new AppError('No guard account found for this number. Please contact your admin.', 404);
    }

    if (user.role !== 'GUARD') {
      throw new AppError('Access denied. This app is for guards only.', 403);
    }

    if (!user.isActive) {
      throw new AppError('Your account is inactive. Please contact your society admin.', 403);
    }

    if (!user.society?.isActive) {
      throw new AppError('Society is currently inactive.', 403);
    }

    const accessToken = generateAccessToken(user.id, user.role, user.societyId, null, 'GUARD_APP');
    const refreshToken = generateRefreshToken(user.id, user.role, user.societyId, null, 'GUARD_APP');

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken, lastTokenRefresh: new Date(), lastLogin: new Date() },
    });

    const { password: _, refreshToken: __, ...safe } = user;
    return { accessToken, refreshToken, user: safe, appType: 'GUARD_APP' };
  }

  // ============================================
  // ADMIN - CREATE GUARD
  // Guards no longer have passwords — they log in via OTP
  // ============================================
  async createGuard(data: { name: string; phone: string; photoUrl?: string }, adminId: string) {
    validateRequiredFields(data, ['name', 'phone'], 'Guard');
    // Inline phone validation (no import needed)
    if (!/^(\+91)?0?[6-9]\d{9}$/.test(data.phone)) {
      throw new AppError('Invalid phone number format', 400);
    }
    const guardName = sanitizeString(data.name);

    const admin = await prisma.user.findUnique({ where: { id: adminId } });

    if (!admin || admin.role !== 'ADMIN') {
      throw new AppError('Only admin can create guard accounts', 403);
    }

    const existingUser = await prisma.user.findUnique({ where: { phone: data.phone } });
    if (existingUser) throw new AppError('Phone already registered', 400);

    const guard = await prisma.user.create({
      data: {
        name: guardName,
        phone: data.phone,
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

    const { password: _, refreshToken: __, ...userWithoutSensitive } = user;
    return userWithoutSensitive;
  }

  // ============================================
  // UPDATE PROFILE
  // CRIT-6: Only allow whitelisted fields to prevent privilege escalation
  // ============================================
  async updateProfile(userId: string, data: Record<string, unknown>) {
    const sanitizedData: { name?: string; email?: string; photoUrl?: string } = {};

    if (typeof data.name === 'string') {
      sanitizedData.name = sanitizeString(data.name);
    }
    if (typeof data.email === 'string') {
      validateEmail(data.email);
      sanitizedData.email = data.email;
    }
    if (typeof data.photoUrl === 'string') {
      sanitizedData.photoUrl = data.photoUrl;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: sanitizedData,
      include: { flat: true, society: true },
    });

    const { password: _, refreshToken: __, ...userWithoutSensitive } = user;
    return userWithoutSensitive;
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
  // CRIT-7: Verify target user belongs to admin's society and is not SUPER_ADMIN
  // ============================================
  async toggleUserStatus(userId: string, isActive: boolean, adminSocietyId: string) {
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });

    if (!targetUser) {
      throw new AppError('User not found', 404);
    }

    if (targetUser.role === 'SUPER_ADMIN') {
      throw new AppError('Cannot modify super admin status', 403);
    }

    if (targetUser.societyId !== adminSocietyId) {
      throw new AppError('Access denied. User does not belong to your society.', 403);
    }

    return prisma.user.update({
      where: { id: userId },
      data: { isActive },
      select: { id: true, name: true, isActive: true },
    });
  }

  // ============================================
  // REFRESH TOKEN
  // ============================================
  async refreshAccessToken(refreshTokenStr: string) {
    // CRIT-3: Extract JTI properly and check blacklist
    const { jti: refreshJti } = extractJti(refreshTokenStr);
    if (refreshJti) {
      const isBlacklisted = await isTokenBlacklisted(refreshJti);
      if (isBlacklisted) {
        throw new AppError('Refresh token has been revoked. Please login again.', 401);
      }
    }

    const decoded = verifyRefreshToken(refreshTokenStr);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { flat: true, society: true },
    });

    if (!user || !user.isActive) {
      throw new AppError('User not found or inactive', 401);
    }

    if (user.refreshToken !== refreshTokenStr) {
      throw new AppError('Invalid refresh token. Please login again.', 401);
    }

    const newAccessToken = generateAccessToken(
      user.id, user.role, user.societyId, user.flatId, decoded.appType
    );
    const newRefreshToken = generateRefreshToken(
      user.id, user.role, user.societyId, user.flatId, decoded.appType
    );

    await prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: newRefreshToken,
        lastTokenRefresh: new Date(),
      },
    });

    const { password: _, refreshToken: __, ...userWithoutSensitiveData } = user;

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: userWithoutSensitiveData,
    };
  }

  // ============================================
  // LOGOUT
  // CRIT-2 & CRIT-3: Use JTI for blacklisting, not full token string
  // ============================================
  async logout(accessToken: string, refreshTokenStr?: string) {
    try {
      const fullDecoded = jwt.decode(accessToken) as { userId?: string; jti?: string; exp?: number } | null;

      // Clear refresh token from database
      if (fullDecoded?.userId) {
        await prisma.user.update({
          where: { id: fullDecoded.userId },
          data: { refreshToken: null },
        }).catch(err => {
          logger.error({ error: err }, 'Error clearing refresh token from database');
        });
      }

      // Blacklist access token by JTI
      if (fullDecoded?.jti && fullDecoded?.exp) {
        const ttl = fullDecoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await blacklistToken(fullDecoded.jti, ttl);
        }
      }

      // Blacklist refresh token by JTI
      if (refreshTokenStr) {
        const { jti: refreshJti, exp: refreshExp } = extractJti(refreshTokenStr);
        if (refreshJti && refreshExp) {
          const ttl = refreshExp - Math.floor(Date.now() / 1000);
          if (ttl > 0) {
            await blacklistToken(refreshJti, ttl);
          }
        }
      }

      return { success: true };
    } catch (error) {
      logger.error({ error }, 'Error during logout');
      return { success: true };
    }
  }

}
