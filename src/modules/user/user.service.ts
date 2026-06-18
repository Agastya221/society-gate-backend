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
import type { Role } from '../../../prisma/generated/prisma/client';


// CRIT-6: Only name, email, photoUrl are allowed in profile updates

export class UserService {
  // ============================================
  // BOOTSTRAP: CREATE SUPER_ADMIN
  // ============================================
  async bootstrapSuperAdmin(data: {
    phone: string;
    name: string;
    email?: string;
    bootstrapSecret: string;
  }) {
    // 1. Verify secret
    const expectedSecret = process.env.BOOTSTRAP_SECRET;
    if (!expectedSecret) {
      throw new AppError('Bootstrap is not configured on this server.', 500);
    }
    if (data.bootstrapSecret !== expectedSecret) {
      throw new AppError('Invalid bootstrap secret.', 403);
    }

    // 2. One-time gate — block if SUPER_ADMIN already exists
    const existingSuperAdmin = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
    });
    if (existingSuperAdmin) {
      throw new AppError(
        'Bootstrap already completed. A SUPER_ADMIN account already exists.',
        403
      );
    }

    // 3. Reuse an existing account if the owner already registered in the app
    const existingUser = await prisma.user.findUnique({ where: { phone: data.phone } });

    // 4. Create or promote SUPER_ADMIN
    const superAdmin = existingUser
      ? await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            name: sanitizeString(data.name),
            email: data.email ?? existingUser.email,
            role: 'SUPER_ADMIN',
            isActive: true,
          },
        })
      : await prisma.user.create({
          data: {
            phone: data.phone,
            name: sanitizeString(data.name),
            email: data.email,
            role: 'SUPER_ADMIN',
            isActive: true,
          },
        });

    // 5. Issue tokens — same pattern as residentWidgetVerify
    const accessToken = generateAccessToken(
      superAdmin.id, superAdmin.role, null, null, 'RESIDENT_APP'
    );
    const refreshToken = generateRefreshToken(
      superAdmin.id, superAdmin.role, null, null, 'RESIDENT_APP'
    );

    await prisma.user.update({
      where: { id: superAdmin.id },
      data: { refreshToken, lastTokenRefresh: new Date() },
    });

    logger.info(
      `[BOOTSTRAP] SUPER_ADMIN created — id: ${superAdmin.id} | phone: ${superAdmin.phone}`
    );

    const { password: _, refreshToken: __, ...safe } = superAdmin;
    return { accessToken, refreshToken, user: safe };
  }


  // ============================================
  // WIDGET: RESIDENT APP LOGIN / REGISTER
  // Verifies MSG91 widget token, creates user if first time
  // ============================================
  async residentWidgetVerify(widgetToken: string, name?: string, email?: string) {
    logger.info({ tokenPrefix: widgetToken?.substring(0, 20), hasName: !!name, hasEmail: !!email }, '[residentWidgetVerify] called');

    // 1. Verify with MSG91 — get the confirmed phone number
    const phone = await verifyMSG91WidgetToken(widgetToken);
    logger.info({ phone }, '[residentWidgetVerify] MSG91 verified phone');

    if (email) validateEmail(email);

    let user = await prisma.user.findUnique({ where: { phone } });
    logger.info({ userFound: !!user, userId: user?.id, role: user?.role }, '[residentWidgetVerify] DB lookup result');

    if (user) {
      // Existing user — re-activate if they have a flat but are inactive
      if (!user.isActive && user.flatId && user.primaryResidentId) {
        const societyId = user.societyId || (await prisma.flat.findUnique({
          where: { id: user.flatId },
          select: { societyId: true },
        }))?.societyId;

        if (!societyId) {
          throw new AppError('Associated flat or society not found', 404);
        }

        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            isActive: true,
            societyId,
          },
        });

        // Check/create UserFlatMembership
        const existingMembership = await prisma.userFlatMembership.findFirst({
          where: {
            userId: user.id,
            flatId: user.flatId,
          },
        });

        if (existingMembership) {
          await prisma.userFlatMembership.update({
            where: { id: existingMembership.id },
            data: { isActive: true },
          });
        } else {
          await prisma.userFlatMembership.create({
            data: {
              userId: user.id,
              flatId: user.flatId,
              societyId,
              role: 'RESIDENT',
              isActive: true,
              isDefault: true,
              isOwner: false,
            },
          });
        }
      }

      user = await this.repairActiveRoleFromMembership(user);

      const accessToken = generateAccessToken(user.id, user.role, user.societyId, user.flatId, 'RESIDENT_APP');
      const refreshToken = generateRefreshToken(user.id, user.role, user.societyId, user.flatId, 'RESIDENT_APP');

      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken, lastTokenRefresh: new Date(), lastLogin: new Date() },
      });

      const [onboardingRequest, societyState] = await Promise.all([
        prisma.onboardingRequest.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
        }),
        user.societyId
          ? prisma.society.findUnique({
              where: { id: user.societyId },
              select: { isActive: true, onboardingStatus: true },
            })
          : Promise.resolve(null),
      ]);

      const { password: _, refreshToken: __, ...safe } = user;
      const contexts = await this.getContexts(user.id);
      const loginState = this.resolveResidentAppLoginState({
        role: user.role,
        isActive: user.isActive,
        societyId: user.societyId,
        onboardingStatus: onboardingRequest?.status || 'NOT_STARTED',
        societyIsActive: societyState?.isActive ?? null,
        societyOnboardingStatus: societyState?.onboardingStatus ?? null,
      });

      return {
        accessToken, refreshToken, user: safe,
        contexts,
        ...loginState,
        appType: 'RESIDENT_APP',
      };
    }

    // New user — auto-create with phone only (Swiggy/Zomato pattern)
    // Name is optional at signup; collected during onboarding
    const sanitizedName = name ? sanitizeString(name) : '';

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
    const contexts = await this.getContexts(user.id);
    return {
      accessToken, refreshToken, user: safe,
      contexts,
      requiresOnboarding: true,
      onboardingStatus: 'DRAFT',
      nextAction: 'START_ONBOARDING',
      appType: 'RESIDENT_APP',
      redirectTo: 'ONBOARDING',
    };
  }

  private resolveResidentAppLoginState(input: {
    role: string;
    isActive: boolean;
    societyId: string | null;
    onboardingStatus: string;
    societyIsActive: boolean | null;
    societyOnboardingStatus: string | null;
  }) {
    if (input.role === 'ADMIN' || input.role === 'SUPER_ADMIN') {
      return {
        requiresOnboarding: false,
        onboardingStatus: input.onboardingStatus,
        societyOnboardingStatus: input.societyOnboardingStatus,
        nextAction: 'OPEN_ADMIN_PANEL',
        redirectTo: 'ADMIN_PANEL',
      };
    }

    if (
      input.societyId &&
      (input.societyIsActive === false ||
        (input.societyOnboardingStatus && input.societyOnboardingStatus !== 'ACTIVE'))
    ) {
      return {
        requiresOnboarding: true,
        onboardingStatus: input.onboardingStatus,
        societyOnboardingStatus: input.societyOnboardingStatus,
        nextAction: 'WAIT_FOR_SOCIETY_ACTIVATION',
        redirectTo: 'ONBOARDING_STATUS',
      };
    }

    switch (input.onboardingStatus) {
      case 'PENDING_APPROVAL':
        return {
          requiresOnboarding: true,
          onboardingStatus: input.onboardingStatus,
          societyOnboardingStatus: input.societyOnboardingStatus,
          nextAction: 'WAIT_FOR_APPROVAL',
          redirectTo: 'ONBOARDING_STATUS',
        };
      case 'RESUBMIT_REQUESTED':
        return {
          requiresOnboarding: true,
          onboardingStatus: input.onboardingStatus,
          societyOnboardingStatus: input.societyOnboardingStatus,
          nextAction: 'RESUBMIT_DOCUMENTS',
          redirectTo: 'ONBOARDING_RESUBMIT',
        };
      case 'REJECTED':
        return {
          requiresOnboarding: true,
          onboardingStatus: input.onboardingStatus,
          societyOnboardingStatus: input.societyOnboardingStatus,
          nextAction: 'REAPPLY',
          redirectTo: 'ONBOARDING_STATUS',
        };
      case 'DRAFT':
      case 'PENDING_DOCS':
        return {
          requiresOnboarding: true,
          onboardingStatus: input.onboardingStatus,
          societyOnboardingStatus: input.societyOnboardingStatus,
          nextAction: 'COMPLETE_ONBOARDING',
          redirectTo: 'ONBOARDING',
        };
      default:
        break;
    }

    if (!input.isActive || !input.societyId) {
      return {
        requiresOnboarding: true,
        onboardingStatus: input.onboardingStatus,
        societyOnboardingStatus: input.societyOnboardingStatus,
        nextAction: 'START_ONBOARDING',
        redirectTo: 'ONBOARDING',
      };
    }

    return {
      requiresOnboarding: false,
      onboardingStatus: input.onboardingStatus === 'NOT_STARTED' ? 'COMPLETED' : input.onboardingStatus,
      societyOnboardingStatus: input.societyOnboardingStatus,
      nextAction: 'OPEN_RESIDENT_PANEL',
      redirectTo: 'RESIDENT_PANEL',
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
    const contexts = await this.getContexts(user.id);

    // Tell the frontend which panel to show based on role
    const redirectTo = ['ADMIN', 'SUPER_ADMIN'].includes(user.role)
      ? 'ADMIN_PANEL'
      : 'RESIDENT_PANEL';

    return { accessToken, refreshToken, user: safe, contexts, appType: 'RESIDENT_APP', redirectTo };
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

    if (!admin || !['ADMIN', 'SUPER_ADMIN'].includes(admin.role)) {
      throw new AppError('Only admin can create guard accounts', 403);
    }
    if (!admin.societyId) {
      throw new AppError('Select a society before creating guard accounts', 400);
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

    await prisma.userFlatMembership.create({
      data: {
        userId: guard.id,
        societyId: guard.societyId!,
        role: 'GUARD',
        isActive: true,
        isDefault: true,
      },
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
  // RESIDENT APP - MULTI SOCIETY / FLAT CONTEXTS
  // ============================================
  async getContexts(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        flatMemberships: {
          where: { isActive: true },
          include: {
            society: {
              select: {
                id: true,
                name: true,
                address: true,
                city: true,
                state: true,
                pincode: true,
                isActive: true,
              },
            },
            flat: {
              select: {
                id: true,
                flatNumber: true,
                floor: true,
                block: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        onboardingRequests: {
          where: {
            status: {
              in: ['DRAFT', 'PENDING_DOCS', 'PENDING_APPROVAL', 'RESUBMIT_REQUESTED', 'REJECTED', 'APPROVED'],
            },
          },
          include: {
            society: {
              select: {
                id: true,
                name: true,
                city: true,
                isActive: true,
              },
            },
            block: {
              select: {
                id: true,
                name: true,
              },
            },
            flat: {
              select: {
                id: true,
                flatNumber: true,
                floor: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) throw new AppError('User not found', 404);

    const approvedOnboardingKeys = new Set(
      user.onboardingRequests
        .filter((request) => request.status === 'APPROVED' && request.flatId)
        .map((request) => this.membershipKey(request.societyId, request.flatId))
    );

    const contexts = user.flatMemberships.map((membership) => {
      const blockName = membership.flat?.block?.name ?? null;
      const flatNumber = membership.flat?.flatNumber ?? null;
      const flatLabel = flatNumber
        ? [blockName, flatNumber].filter(Boolean).join(' - ')
        : 'Society Admin';
      const role = this.getEffectiveMembershipRole(
        membership.role,
        membership.societyId,
        membership.flatId,
        approvedOnboardingKeys
      );

      const isActiveContext =
        user.societyId === membership.societyId &&
        user.flatId === membership.flatId &&
        (user.role === role || user.role === 'SUPER_ADMIN');

      return {
        membershipId: membership.id,
        societyId: membership.societyId,
        societyName: membership.society.name,
        societyCity: membership.society.city,
        societyIsActive: membership.society.isActive,
        flatId: membership.flatId,
        flatNumber,
        blockId: membership.flat?.block?.id ?? null,
        blockName,
        floor: membership.flat?.floor ?? null,
        label: flatLabel,
        subtitle: membership.society.name,
        role,
        residentType: membership.residentType,
        isOwner: membership.isOwner,
        isLivingHere: membership.isLivingHere,
        canUseDailyGateFeatures:
          role !== 'RESIDENT' ||
          membership.residentType !== 'OWNER' ||
          membership.isLivingHere,
        isPrimary: membership.isPrimary,
        isDefault: membership.isDefault,
        isActiveContext,
      };
    });

    const approvedMembershipKeys = new Set(
      contexts
        .filter((context) => context.flatId)
        .map((context) => `${context.societyId}:${context.flatId}`)
    );

    const requests = user.onboardingRequests
      .filter((request) => request.status !== 'APPROVED' && !approvedMembershipKeys.has(`${request.societyId}:${request.flatId}`))
      .map((request) => {
        const label = [request.block?.name, request.flat?.flatNumber].filter(Boolean).join(' - ');

        return {
          requestId: request.id,
          societyId: request.societyId,
          societyName: request.society.name,
          societyCity: request.society.city,
          societyIsActive: request.society.isActive,
          flatId: request.flatId,
          flatNumber: request.flat.flatNumber,
          blockId: request.blockId,
          blockName: request.block.name,
          floor: request.flat.floor,
          label,
          subtitle: request.society.name,
          status: request.status,
          residentType: request.residentType,
          isLivingHere: request.isLivingHere,
          submittedAt: request.submittedAt,
          reviewedAt: request.reviewedAt,
          rejectedAt: request.rejectedAt,
          rejectionReason: request.rejectionReason,
          resubmitReason: request.resubmitReason,
          canSwitch: false,
        };
      });

    const societies = contexts.reduce<Array<{
      societyId: string;
      societyName: string;
      societyCity: string;
      contexts: typeof contexts;
    }>>((groups, context) => {
      let group = groups.find((item) => item.societyId === context.societyId);
      if (!group) {
        group = {
          societyId: context.societyId,
          societyName: context.societyName,
          societyCity: context.societyCity,
          contexts: [],
        };
        groups.push(group);
      }
      group.contexts.push(context);
      return groups;
    }, []);

    return {
      activeContext: contexts.find((context) => context.isActiveContext) ?? null,
      contexts,
      requests,
      societies,
    };
  }

  async switchContext(userId: string, membershipId: string) {
    const [user, membership] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.userFlatMembership.findFirst({
        where: { id: membershipId, userId, isActive: true },
        include: {
          society: true,
          flat: { include: { block: true } },
        },
      }),
    ]);

    if (!user || !user.isActive) {
      throw new AppError('User not found or inactive', 401);
    }

    if (!membership) {
      throw new AppError('Context not found for this user', 404);
    }

    if (!membership.society.isActive) {
      throw new AppError('Society is inactive', 403);
    }

    const approvedOnboardingKeys = new Set<string>();
    if (membership.flatId) {
      const approvedOnboarding = await prisma.onboardingRequest.findFirst({
        where: {
          userId,
          societyId: membership.societyId,
          flatId: membership.flatId,
          status: 'APPROVED',
        },
        select: { id: true },
      });

      if (approvedOnboarding) {
        approvedOnboardingKeys.add(this.membershipKey(membership.societyId, membership.flatId));
      }
    }

    const membershipRole = this.getEffectiveMembershipRole(
      membership.role,
      membership.societyId,
      membership.flatId,
      approvedOnboardingKeys
    );

    if (membership.role !== membershipRole) {
      await prisma.userFlatMembership.update({
        where: { id: membership.id },
        data: { role: membershipRole },
      });
    }

    const nextRole = user.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : membershipRole;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        role: nextRole,
        societyId: membership.societyId,
        flatId: membership.flatId,
        isOwner: membership.isOwner,
        isPrimaryResident: membership.isPrimary,
      },
      include: { flat: true, society: true },
    });

    const accessToken = generateAccessToken(
      updatedUser.id,
      updatedUser.role,
      updatedUser.societyId,
      updatedUser.flatId,
      'RESIDENT_APP',
    );
    const refreshToken = generateRefreshToken(
      updatedUser.id,
      updatedUser.role,
      updatedUser.societyId,
      updatedUser.flatId,
      'RESIDENT_APP',
    );

    await prisma.user.update({
      where: { id: updatedUser.id },
      data: { refreshToken, lastTokenRefresh: new Date() },
    });

    await prisma.userFlatMembership.updateMany({
      where: { userId: updatedUser.id },
      data: { isDefault: false },
    });
    await prisma.userFlatMembership.update({
      where: { id: membership.id },
      data: { isDefault: true },
    });

    const { password: _, refreshToken: __, ...safe } = updatedUser;
    const contexts = await this.getContexts(updatedUser.id);

    const redirectTo = ['ADMIN', 'SUPER_ADMIN'].includes(updatedUser.role)
      ? 'ADMIN_PANEL'
      : 'RESIDENT_PANEL';

    return {
      accessToken,
      refreshToken,
      user: safe,
      contexts,
      appType: 'RESIDENT_APP',
      redirectTo,
    };
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
  // UPDATE FCM TOKEN
  // ============================================
  async updateFcmToken(userId: string, fcmToken: string, deviceType: string) {
    if (deviceType !== 'android' && deviceType !== 'ios') {
      throw new AppError('deviceType must be "android" or "ios"', 400);
    }

    await prisma.user.update({
      where: { id: userId },
      data: { fcmToken, deviceType },
    });

    return { success: true };
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

  private membershipKey(societyId: string, flatId?: string | null) {
    return `${societyId}:${flatId ?? 'society'}`;
  }

  private getEffectiveMembershipRole(
    role: Role,
    societyId: string,
    flatId: string | null | undefined,
    approvedOnboardingKeys: Set<string>
  ): Role {
    if (role === 'SUPER_ADMIN') {
      return role;
    }

    if (role === 'ADMIN' && flatId && approvedOnboardingKeys.has(this.membershipKey(societyId, flatId))) {
      return 'RESIDENT';
    }

    return role;
  }

  private async repairActiveRoleFromMembership<T extends {
    id: string;
    role: Role;
    societyId: string | null;
    flatId: string | null;
  }>(user: T): Promise<T> {
    if (user.role === 'SUPER_ADMIN' || !user.societyId || !user.flatId) {
      return user;
    }

    const membership = await prisma.userFlatMembership.findFirst({
      where: {
        userId: user.id,
        societyId: user.societyId,
        flatId: user.flatId,
        isActive: true,
      },
      select: {
        id: true,
        role: true,
        societyId: true,
        flatId: true,
      },
    });

    if (!membership || !membership.flatId) {
      return user;
    }

    const approvedOnboarding = await prisma.onboardingRequest.findFirst({
      where: {
        userId: user.id,
        societyId: membership.societyId,
        flatId: membership.flatId,
        status: 'APPROVED',
      },
      select: { id: true },
    });

    const approvedOnboardingKeys = new Set<string>();
    if (approvedOnboarding && membership.flatId) {
      approvedOnboardingKeys.add(this.membershipKey(membership.societyId, membership.flatId));
    }

    const role = this.getEffectiveMembershipRole(
      membership.role,
      membership.societyId,
      membership.flatId,
      approvedOnboardingKeys
    );

    if (membership.role !== role) {
      await prisma.userFlatMembership.update({
        where: { id: membership.id },
        data: { role },
      });
    }

    if (user.role !== role) {
      await prisma.user.update({
        where: { id: user.id },
        data: { role },
      });
      return { ...user, role };
    }

    return user;
  }

}
