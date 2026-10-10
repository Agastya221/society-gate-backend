import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  blacklistToken,
  isTokenBlacklisted,
  hashToken,
  refreshTokenMatches,
  verifyAccessToken,
  isJwtError,
} from '../../services/token.service';
import { verifyMSG91WidgetToken } from '../../utils/msg91';
import {
  validateEmail,
  validateRequiredFields,
  sanitizeString,
} from '../../utils/validation';
import logger, { maskPhone } from '../../utils/logger';
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
    const given = Buffer.from(String(data.bootstrapSecret ?? ''));
    const expected = Buffer.from(expectedSecret);
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
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
      data: { refreshToken: hashToken(refreshToken), lastTokenRefresh: new Date() },
    });

    logger.info(
      { userId: superAdmin.id, phone: maskPhone(superAdmin.phone) },
      '[BOOTSTRAP] SUPER_ADMIN created'
    );

    const { password: _, refreshToken: __, ...safe } = superAdmin;
    return { accessToken, refreshToken, user: safe };
  }


  // ============================================
  // WIDGET: RESIDENT APP LOGIN / REGISTER
  // Verifies MSG91 widget token, creates user if first time
  // ============================================
  async residentWidgetVerify(widgetToken: string, name?: string, email?: string) {
    logger.info({ hasName: !!name, hasEmail: !!email }, '[residentWidgetVerify] called');

    // 1. Verify with MSG91 — get the confirmed phone number
    const phone = await verifyMSG91WidgetToken(widgetToken);
    logger.info({ phone: maskPhone(phone) }, '[residentWidgetVerify] MSG91 verified phone');

    if (email) validateEmail(email);

    let user = await prisma.user.findUnique({ where: { phone } });
    logger.info({ userFound: !!user, userId: user?.id, role: user?.role }, '[residentWidgetVerify] DB lookup result');

    if (user) {
      // The resident app never issues RESIDENT_APP tokens to guards — they use the guard app.
      if (user.role === 'GUARD') {
        throw new AppError('This number is registered as a security guard. Please use the S-Gate Guard app.', 403);
      }
      // An account an admin / super admin deactivated (tokenVersion bumped on
      // deactivation) must not get a session. New and onboarding users are also
      // inactive but have tokenVersion 0, and still need onboarding tokens.
      if (!user.isActive && user.tokenVersion > 0) {
        throw new AppError('Your account is inactive. Please contact your society admin.', 403);
      }

      // Existing user — re-activate if they have a flat but are inactive
      // Only pending family invites (never revoked: tokenVersion 0) self-activate;
      // an account an admin deactivated must stay inactive.
      if (!user.isActive && user.flatId && user.primaryResidentId && user.role === 'RESIDENT' && user.tokenVersion === 0) {
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
      user = await this.revokeStaleAdminRole(user);

      const accessToken = generateAccessToken(user.id, user.role, user.societyId, user.flatId, 'RESIDENT_APP');
      const refreshToken = generateRefreshToken(user.id, user.role, user.societyId, user.flatId, 'RESIDENT_APP');

      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: hashToken(refreshToken), lastTokenRefresh: new Date(), lastLogin: new Date() },
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
        activeContext: contexts.activeContext,
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
      data: { refreshToken: hashToken(refreshToken), lastTokenRefresh: new Date() },
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
    activeContext?: { role: string; flatId: string | null } | null;
  }) {
    const isActiveAdminContext =
      input.isActive &&
      input.activeContext?.role &&
      ['ADMIN', 'SUPER_ADMIN'].includes(input.activeContext.role) &&
      !input.activeContext.flatId;

    if (isActiveAdminContext || (input.isActive && !input.activeContext && (input.role === 'ADMIN' || input.role === 'SUPER_ADMIN'))) {
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

    let user = await prisma.user.findUnique({
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

    user = await this.repairActiveRoleFromMembership(user);
    user = await this.revokeStaleAdminRole(user);
    if (!user.isActive) {
      throw new AppError('Your account is inactive. Please contact your society admin.', 403);
    }

    const accessToken = generateAccessToken(user.id, user.role, user.societyId, user.flatId, 'RESIDENT_APP');
    const refreshToken = generateRefreshToken(user.id, user.role, user.societyId, user.flatId, 'RESIDENT_APP');

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashToken(refreshToken), lastTokenRefresh: new Date(), lastLogin: new Date() },
    });

    const { password: _, refreshToken: __, ...safe } = user;
    const contexts = await this.getContexts(user.id);
    const panelState = this.resolvePanelStateFromContexts(contexts, user.role);

    return { accessToken, refreshToken, user: safe, contexts, appType: 'RESIDENT_APP', ...panelState };
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
      data: { refreshToken: hashToken(refreshToken), lastTokenRefresh: new Date(), lastLogin: new Date() },
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
    // Store the bare 10 digits, as logins do — "+91…" would never match a login.
    const phone = data.phone.replace(/\D/g, '').slice(-10);
    const guardName = sanitizeString(data.name);

    const admin = await prisma.user.findUnique({ where: { id: adminId } });

    if (!admin || !['ADMIN', 'SUPER_ADMIN'].includes(admin.role)) {
      throw new AppError('Only admin can create guard accounts', 403);
    }
    if (!admin.societyId) {
      throw new AppError('Select a society before creating guard accounts', 400);
    }

    const existingUser = await prisma.user.findUnique({ where: { phone } });
    if (existingUser) throw new AppError('Phone already registered', 400);

    const guard = await prisma.user.create({
      data: {
        name: guardName,
        phone,
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
    await this.normalizeAdminFlatMemberships(userId);

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

    // A deactivated account must not be offered admin contexts.
    const usableMemberships = user.isActive || user.role === 'SUPER_ADMIN'
      ? user.flatMemberships
      : user.flatMemberships.filter((m) => m.role !== 'ADMIN' && m.role !== 'SUPER_ADMIN');

    const contexts = usableMemberships.map((membership) => {
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
    await this.normalizeAdminFlatMemberships(userId);

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

    // Guard contexts belong to the guard app (GUARD_APP tokens), never RESIDENT_APP.
    if (membership.role === 'GUARD') {
      throw new AppError('Guard accounts must use the S-Gate Guard app.', 403);
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
      data: { refreshToken: hashToken(refreshToken), lastTokenRefresh: new Date() },
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
    const panelState = this.resolvePanelStateFromContexts(contexts, updatedUser.role);

    return {
      accessToken,
      refreshToken,
      user: safe,
      contexts,
      appType: 'RESIDENT_APP',
      ...panelState,
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
  async toggleUserStatus(
    userId: string,
    isActive: boolean,
    adminSocietyId: string,
    actorId?: string,
    actorRole?: Role,
  ) {
    if (actorId && actorId === userId && !isActive) {
      throw new AppError('You cannot deactivate your own account', 400);
    }

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

    if (actorRole !== 'SUPER_ADMIN') {
      // A society admin cannot change another admin's status: either the active
      // role, or an active admin membership in this society (admins switched into
      // their flat context carry role RESIDENT).
      const isTargetAdmin = targetUser.role === 'ADMIN' || Boolean(await prisma.userFlatMembership.findFirst({
        where: { userId, societyId: adminSocietyId, role: 'ADMIN', isActive: true },
        select: { id: true },
      }));
      if (isTargetAdmin) {
        throw new AppError('Admins cannot change the status of another admin. Contact the platform super admin.', 403);
      }

      // Nor re-activate an account the platform super admin disabled (the latest
      // platform audit entry for this user is USER_DISABLED).
      if (isActive) {
        const lastPlatformAction = await prisma.platformAuditLog.findFirst({
          where: { targetType: 'User', targetId: userId, action: { in: ['USER_DISABLED', 'USER_ACTIVATED'] } },
          orderBy: { createdAt: 'desc' },
          select: { action: true },
        });
        if (lastPlatformAction?.action === 'USER_DISABLED') {
          throw new AppError('This account was disabled by the platform super admin and can only be re-activated by them.', 403);
        }
      }
    }

    // Deactivation revokes the session: refresh token cleared (refresh fails) and
    // tokenVersion bumped (also stops family-invite auto-reactivation on login).
    return prisma.user.update({
      where: { id: userId },
      data: isActive
        ? { isActive }
        : { isActive, refreshToken: null, tokenVersion: { increment: 1 } },
      select: { id: true, name: true, isActive: true },
    });
  }

  // ============================================
  // REFRESH TOKEN
  // ============================================
  async refreshAccessToken(refreshTokenStr: string) {
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshTokenStr);
    } catch (error: unknown) {
      if (isJwtError(error) && (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError')) {
        throw new AppError(error.message || 'Invalid refresh token', 401);
      }
      throw error;
    }

    // CRIT-3: revoked (logged-out) refresh tokens are blacklisted by JTI
    if (decoded.jti && (await isTokenBlacklisted(decoded.jti))) {
      throw new AppError('Refresh token has been revoked. Please login again.', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { flat: true, society: true },
    });

    if (!user) {
      throw new AppError('User not found or inactive', 401);
    }

    // Only the SHA-256 hash of the current refresh token is stored. A token that
    // verifies cryptographically but is not the current one is an already-rotated
    // (or revoked) token being replayed: end the session so a stolen token cannot
    // keep it alive. Legacy plain-text rows also fail here once (user re-logs in).
    const storedHash = user.refreshToken;
    if (!refreshTokenMatches(refreshTokenStr, storedHash)) {
      if (storedHash) {
        await prisma.user.updateMany({
          where: { id: user.id, refreshToken: storedHash },
          data: { refreshToken: null },
        });
        logger.warn({ userId: user.id }, 'Refresh token reuse detected, session revoked');
      }
      throw new AppError('Invalid refresh token. Please login again.', 401);
    }

    if (!user.isActive) {
      throw new AppError('User not found or inactive', 401);
    }

    // Guard-app sessions stay GUARD-only (mirrors guardAppOtpVerify), and
    // resident-app sessions are never re-minted for guards.
    if (decoded.appType === 'GUARD_APP' && user.role !== 'GUARD') {
      throw new AppError('Access denied. This app is for guards only.', 403);
    }
    if (decoded.appType !== 'GUARD_APP' && user.role === 'GUARD') {
      throw new AppError('Access denied. Please use the guard app.', 403);
    }

    // Admin rights are re-derived on every refresh: a revoked admin membership
    // demotes the session instead of re-minting ADMIN tokens.
    if (user.role === 'ADMIN') {
      const checked = await this.revokeStaleAdminRole(user);
      if (!checked.isActive) {
        throw new AppError('User not found or inactive', 401);
      }
      if (checked.role !== user.role || checked.societyId !== user.societyId || checked.flatId !== user.flatId) {
        const refreshed = await prisma.user.findUnique({
          where: { id: user.id },
          include: { flat: true, society: true },
        });
        if (!refreshed) throw new AppError('User not found or inactive', 401);
        Object.assign(user, refreshed);
      }
    }

    const appType = decoded.appType === 'GUARD_APP' ? 'GUARD_APP' : 'RESIDENT_APP';
    const newAccessToken = generateAccessToken(
      user.id, user.role, user.societyId, user.flatId, appType
    );
    const newRefreshToken = generateRefreshToken(
      user.id, user.role, user.societyId, user.flatId, appType
    );

    // Compare-and-swap on the old hash: if a concurrent refresh already rotated
    // this token, this one loses instead of forking the session.
    const rotated = await prisma.user.updateMany({
      where: { id: user.id, refreshToken: storedHash },
      data: {
        refreshToken: hashToken(newRefreshToken),
        lastTokenRefresh: new Date(),
      },
    });
    if (rotated.count === 0) {
      throw new AppError('Invalid refresh token. Please login again.', 401);
    }

    const { password: _, refreshToken: __, ...userWithoutSensitiveData } = user;

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: userWithoutSensitiveData,
    };
  }

  // ============================================
  // LOGOUT
  // CRIT-2 & CRIT-3: Use JTI for blacklisting, not full token string.
  // Works with a valid access token, or (when the access token has expired)
  // with just the refresh token, so the session is always revoked server-side.
  // Only cryptographically verified tokens identify the user.
  // ============================================
  async logout(accessToken?: string, refreshTokenStr?: string) {
    const nowSec = Math.floor(Date.now() / 1000);
    let userId: string | null = null;

    if (accessToken) {
      try {
        const decoded = verifyAccessToken(accessToken);
        userId = decoded.userId;
        if (decoded.jti && decoded.exp && decoded.exp - nowSec > 0) {
          await blacklistToken(decoded.jti, decoded.exp - nowSec);
        }
      } catch {
        // Expired / invalid access token: fall back to the refresh token
      }
    }

    if (refreshTokenStr) {
      try {
        const decoded = verifyRefreshToken(refreshTokenStr);
        if (!userId) userId = decoded.userId;
        if (decoded.userId === userId && decoded.jti && decoded.exp && decoded.exp - nowSec > 0) {
          await blacklistToken(decoded.jti, decoded.exp - nowSec);
        }
      } catch {
        // Expired / invalid refresh token: nothing to revoke with it
      }
    }

    if (!userId) {
      throw new AppError('No valid access or refresh token provided', 401);
    }

    try {
      await prisma.user.update({
        where: { id: userId },
        data: { refreshToken: null },
      });
    } catch (error) {
      logger.error({ err: error }, 'Error clearing refresh token from database');
    }

    return { success: true };
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

    if (role === 'ADMIN' && flatId) {
      return 'RESIDENT';
    }

    return role;
  }

  private resolvePanelStateFromContexts(
    contexts: Awaited<ReturnType<UserService['getContexts']>>,
    fallbackRole: string
  ) {
    const activeContext = contexts.activeContext;
    const canOpenAdminPanel = contexts.contexts.some(
      (context) => ['ADMIN', 'SUPER_ADMIN'].includes(context.role) && !context.flatId
    ) || fallbackRole === 'SUPER_ADMIN';

    if (
      (activeContext && ['ADMIN', 'SUPER_ADMIN'].includes(activeContext.role) && !activeContext.flatId) ||
      (!activeContext && ['ADMIN', 'SUPER_ADMIN'].includes(fallbackRole))
    ) {
      return {
        nextAction: 'OPEN_ADMIN_PANEL',
        redirectTo: 'ADMIN_PANEL',
        canOpenAdminPanel,
      };
    }

    return {
      nextAction: 'OPEN_RESIDENT_PANEL',
      redirectTo: 'RESIDENT_PANEL',
      canOpenAdminPanel,
    };
  }

  private async normalizeAdminFlatMemberships(userId: string) {
    const adminFlatMemberships = await prisma.userFlatMembership.findMany({
      where: {
        userId,
        role: 'ADMIN',
        flatId: { not: null },
        isActive: true,
      },
      select: {
        id: true,
        societyId: true,
      },
    });

    for (const membership of adminFlatMemberships) {
      const existingAdminContext = await prisma.userFlatMembership.findFirst({
        where: {
          userId,
          societyId: membership.societyId,
          flatId: null,
          role: 'ADMIN',
          isActive: true,
        },
        select: { id: true },
      });

      if (!existingAdminContext) {
        await prisma.userFlatMembership.create({
          data: {
            userId,
            societyId: membership.societyId,
            role: 'ADMIN',
            isActive: true,
            isDefault: false,
          },
        });
      }

      await prisma.userFlatMembership.update({
        where: { id: membership.id },
        data: { role: 'RESIDENT' },
      });
    }

    if (adminFlatMemberships.length === 0) {
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        societyId: true,
        flatId: true,
      },
    });

    if (!user || user.role !== 'ADMIN' || !user.societyId || !user.flatId) {
      return;
    }

    const activeFlatMembership = await prisma.userFlatMembership.findFirst({
      where: {
        userId,
        societyId: user.societyId,
        flatId: user.flatId,
        isActive: true,
      },
      select: { role: true },
    });

    if (activeFlatMembership?.role === 'RESIDENT') {
      await prisma.user.update({
        where: { id: userId },
        data: { role: 'RESIDENT' },
      });
    }
  }

  /**
   * If the user's active role is ADMIN for a society whose ADMIN membership has
   * been deactivated (and no active one remains), drop the admin role: move them
   * to another active membership, or detach and deactivate them (mirrors
   * admin resident removal). Users with no ADMIN membership record at all
   * (legacy admins) are left untouched.
   */
  private async revokeStaleAdminRole<T extends {
    id: string;
    role: Role;
    societyId: string | null;
    flatId: string | null;
    isActive: boolean;
  }>(user: T): Promise<T> {
    if (user.role !== 'ADMIN' || !user.societyId) return user;

    const adminMemberships = await prisma.userFlatMembership.findMany({
      where: { userId: user.id, societyId: user.societyId, role: 'ADMIN' },
      select: { isActive: true },
    });
    if (adminMemberships.length === 0 || adminMemberships.some((m) => m.isActive)) {
      return user;
    }

    const fallback = await prisma.userFlatMembership.findFirst({
      where: { userId: user.id, isActive: true, role: { in: ['RESIDENT', 'GUARD'] } },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });

    if (fallback) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          role: fallback.role,
          societyId: fallback.societyId,
          flatId: fallback.flatId,
          isOwner: fallback.isOwner,
          isPrimaryResident: fallback.isPrimary,
        },
      });
      return { ...user, role: fallback.role, societyId: fallback.societyId, flatId: fallback.flatId };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { role: 'RESIDENT', societyId: null, flatId: null, isActive: false, refreshToken: null },
    });
    return { ...user, role: 'RESIDENT' as Role, societyId: null, flatId: null, isActive: false };
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
