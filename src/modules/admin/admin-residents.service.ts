import { prisma, TransactionClient } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import { getPresignedViewUrl } from '../../utils/s3';
import type { Prisma } from '../../types';
import { grantResidentFlatAccess } from '../onboarding/onboarding.service';

// ============================================
// ADMIN RESIDENTS
// GET    /api/v1/admin/residents
// POST   /api/v1/admin/residents
// DELETE /api/v1/admin/residents/:membershipId
// A "resident" here is an active flat membership (UserFlatMembership with a flat)
// in the society. residentType: OWNER / TENANT from the membership; a membership
// with no ownership/tenancy claim (family member) is reported as FAMILY.
// ============================================

export type AdminResidentType = 'OWNER' | 'TENANT' | 'FAMILY';

export interface CreateAdminResidentDTO {
  name: string;
  phone: string; // normalised 10-digit
  flatId: string;
  residentType: AdminResidentType;
}

const RESIDENT_MEMBERSHIP_ROLES = ['RESIDENT', 'ADMIN'] as const;

const membershipInclude = {
  user: { select: { id: true, name: true, phone: true, photoUrl: true } },
  flat: { select: { id: true, flatNumber: true, block: { select: { id: true, name: true } } } },
} satisfies Prisma.UserFlatMembershipInclude;

type MembershipRow = Prisma.UserFlatMembershipGetPayload<{ include: typeof membershipInclude }>;

const resolvePhotoUrl = async (value: string | null): Promise<string | null> => {
  if (!value || /^https?:\/\//i.test(value)) return value;
  try {
    return await getPresignedViewUrl(value);
  } catch {
    return null;
  }
};

export function toAdminResidentType(m: { residentType: string | null; isOwner: boolean }): AdminResidentType {
  if (m.residentType === 'OWNER' || m.isOwner) return 'OWNER';
  if (m.residentType === 'TENANT') return 'TENANT';
  return 'FAMILY';
}

async function formatResident(m: MembershipRow) {
  return {
    id: m.user.id,
    membershipId: m.id,
    name: m.user.name,
    phone: m.user.phone,
    photoUrl: await resolvePhotoUrl(m.user.photoUrl),
    residentType: toAdminResidentType(m),
    isPrimary: m.isPrimary,
    flat: m.flat
      ? {
          id: m.flat.id,
          flatNumber: m.flat.flatNumber,
          block: m.flat.block ? { id: m.flat.block.id, name: m.flat.block.name } : null,
        }
      : null,
    createdAt: m.createdAt,
  };
}

/** Recompute Flat.isOccupied / occupancyStatus from active memberships + pointers. */
async function recomputeFlatOccupancy(tx: TransactionClient, flatId: string) {
  const flat = await tx.flat.findUnique({
    where: { id: flatId },
    select: {
      currentOwnerId: true,
      currentTenantId: true,
      userMemberships: {
        where: { isActive: true },
        select: { residentType: true, isOwner: true, isLivingHere: true },
      },
    },
  });
  if (!flat) return;
  const hasOwner = !!flat.currentOwnerId || flat.userMemberships.some((m) => m.isOwner || m.residentType === 'OWNER');
  const hasTenant = !!flat.currentTenantId || flat.userMemberships.some((m) => m.residentType === 'TENANT');
  const isOccupied = hasOwner || hasTenant || flat.userMemberships.length > 0;
  const occupancyStatus = hasTenant
    ? 'RENTED'
    : flat.userMemberships.some((m) => m.isLivingHere)
      ? 'OWNER_OCCUPIED'
      : 'VACANT';
  await tx.flat.update({ where: { id: flatId }, data: { isOccupied, occupancyStatus } });
}

export class AdminResidentsService {
  async list(societyId: string, opts: { search?: string; page: number; limit: number }) {
    const { search, page, limit } = opts;
    const where: Prisma.UserFlatMembershipWhereInput = {
      societyId,
      isActive: true,
      flatId: { not: null },
      role: { in: [...RESIDENT_MEMBERSHIP_ROLES] },
      ...(search
        ? {
            OR: [
              { user: { name: { contains: search, mode: 'insensitive' } } },
              { user: { phone: { contains: search } } },
              { flat: { flatNumber: { contains: search, mode: 'insensitive' } } },
              { flat: { block: { name: { contains: search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.userFlatMembership.findMany({
        where,
        include: membershipInclude,
        orderBy: [
          { flat: { block: { name: 'asc' } } },
          { flat: { flatNumber: 'asc' } },
          { isPrimary: 'desc' },
          { createdAt: 'asc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.userFlatMembership.count({ where }),
    ]);

    return {
      residents: await Promise.all(rows.map(formatResident)),
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async create(societyId: string, data: CreateAdminResidentDTO, actorId: string) {
    const flat = await prisma.flat.findFirst({
      where: { id: data.flatId, societyId, isActive: true },
      select: { id: true, currentOwnerId: true },
    });
    if (!flat) throw new AppError('Flat not found in this society', 404);

    const existingUser = await prisma.user.findUnique({ where: { phone: data.phone } });

    if (existingUser) {
      if (existingUser.role === 'GUARD') {
        // A guard of THIS society may live here too. Guard access is kept by their guard membership; the person
        // becomes a resident as well (users.role moves to RESIDENT when the flat is granted below).
        if (!existingUser.isActive) {
          throw new AppError('This guard account is switched off. Switch it on before adding the person as a resident.', 409);
        }
        if (existingUser.societyId !== societyId) {
          throw new AppError('This phone number belongs to a guard of another society', 409);
        }
        const hasGuardPost = await prisma.userFlatMembership.findFirst({
          where: { userId: existingUser.id, societyId, role: 'GUARD' },
          select: { id: true },
        });
        if (!hasGuardPost) {
          await prisma.userFlatMembership.create({
            data: { userId: existingUser.id, societyId, role: 'GUARD', isActive: true, isDefault: false },
          });
        } else {
          await prisma.userFlatMembership.update({ where: { id: hasGuardPost.id }, data: { isActive: true } });
        }
      }
      const alreadyMember = await prisma.userFlatMembership.findFirst({
        where: { userId: existingUser.id, flatId: flat.id, isActive: true },
        select: { id: true },
      });
      if (alreadyMember) {
        throw new AppError('This person is already a resident of this flat', 409);
      }
    }

    const activeOwner = await prisma.userFlatMembership.findFirst({
      where: { flatId: flat.id, isActive: true, OR: [{ isOwner: true }, { residentType: 'OWNER' }] },
      select: { userId: true },
    });
    const ownerUserId = activeOwner?.userId ?? flat.currentOwnerId ?? null;

    if (data.residentType === 'OWNER' && ownerUserId && ownerUserId !== existingUser?.id) {
      throw new AppError('This flat already has an owner', 409);
    }
    if (data.residentType === 'TENANT' && !ownerUserId) {
      throw new AppError('This flat has no approved owner yet', 409);
    }

    // Family members are linked to the flat's primary resident (same as the family module)
    let primaryResidentId: string | null | undefined;
    if (data.residentType === 'FAMILY') {
      const primary = await prisma.userFlatMembership.findFirst({
        where: { flatId: flat.id, isActive: true, NOT: { userId: existingUser?.id ?? '' } },
        orderBy: [{ isPrimary: 'desc' }, { isOwner: 'desc' }, { createdAt: 'asc' }],
        select: { userId: true },
      });
      primaryResidentId = primary?.userId ?? null;
    }

    const membership = await prisma.$transaction(async (tx) => {
      // Reuse the user by phone; never duplicate
      const user = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: existingUser.name ? {} : { name: data.name },
          })
        : await tx.user.create({
            data: { phone: data.phone, name: data.name, role: 'RESIDENT', isActive: true },
          });

      // Don't switch the active context of someone already active elsewhere
      const updateActiveContext = !existingUser || !existingUser.isActive || !existingUser.societyId || !existingUser.flatId;

      const { membership: granted } = await grantResidentFlatAccess(tx, {
        userId: user.id,
        societyId,
        flatId: flat.id,
        residentType: data.residentType === 'FAMILY' ? null : data.residentType,
        isLivingHere: true,
        currentUserRole: user.role,
        updateActiveContext,
        ...(data.residentType === 'FAMILY' && updateActiveContext ? { primaryResidentId } : {}),
      });

      // An in-flight self-onboarding request for this same flat is now moot —
      // close it as approved so login doesn't route the user back into onboarding.
      if (existingUser) {
        const now = new Date();
        await tx.onboardingRequest.updateMany({
          where: {
            userId: user.id,
            flatId: flat.id,
            status: { in: ['DRAFT', 'PENDING_DOCS', 'PENDING_APPROVAL', 'RESUBMIT_REQUESTED'] },
          },
          data: { status: 'APPROVED', approvedAt: now, reviewedById: actorId, reviewedAt: now },
        });
      }

      return tx.userFlatMembership.findUniqueOrThrow({
        where: { id: granted.id },
        include: membershipInclude,
      });
    });

    return formatResident(membership);
  }

  async remove(societyId: string, membershipId: string, actorId: string, actorRole?: string) {
    const membership = await prisma.userFlatMembership.findFirst({
      where: { id: membershipId, societyId, isActive: true, flatId: { not: null } },
      include: { user: { select: { id: true, role: true, flatId: true, societyId: true } } },
    });
    if (!membership || !membership.flatId) throw new AppError('Resident not found', 404);
    if (membership.userId === actorId) {
      throw new AppError("You can't remove your own residency", 400);
    }
    // Nobody but a SUPER_ADMIN may touch a SUPER_ADMIN account.
    if (membership.user.role === 'SUPER_ADMIN' && actorRole !== 'SUPER_ADMIN') {
      throw new AppError('Resident not found', 404);
    }
    // Only SUPER_ADMIN may remove a co-admin of THIS society. users.role is just the
    // user's currently selected context, so admin status comes from the membership rows.
    if (actorRole !== 'SUPER_ADMIN') {
      const adminHere = await prisma.userFlatMembership.findFirst({
        where: { userId: membership.userId, societyId, role: 'ADMIN', isActive: true },
        select: { id: true },
      });
      if (adminHere) {
        throw new AppError('Only a super admin can remove a society admin', 403);
      }
    }
    const flatId = membership.flatId;

    await prisma.$transaction(async (tx) => {
      await tx.userFlatMembership.update({
        where: { id: membership.id },
        data: { isActive: false, isDefault: false, isPrimary: false },
      });

      // Clear flat owner/tenant pointers held by this user
      const flat = await tx.flat.findUnique({
        where: { id: flatId },
        select: { currentOwnerId: true, currentTenantId: true },
      });
      const pointerUpdate: Prisma.FlatUncheckedUpdateInput = {};
      if (flat?.currentOwnerId === membership.userId) pointerUpdate.currentOwnerId = null;
      if (flat?.currentTenantId === membership.userId) pointerUpdate.currentTenantId = null;
      if (Object.keys(pointerUpdate).length > 0) {
        await tx.flat.update({ where: { id: flatId }, data: pointerUpdate });
      }

      // Hand "primary" to the longest-standing remaining member
      if (membership.isPrimary) {
        const next = await tx.userFlatMembership.findFirst({
          where: { flatId, isActive: true },
          orderBy: [{ isOwner: 'desc' }, { createdAt: 'asc' }],
          select: { id: true, userId: true },
        });
        if (next) {
          await tx.userFlatMembership.update({ where: { id: next.id }, data: { isPrimary: true } });
          await tx.user.updateMany({
            where: { id: next.userId, flatId },
            data: { isPrimaryResident: true },
          });
        }
      }

      await recomputeFlatOccupancy(tx, flatId);

      // If this flat was the user's active context, move them to another active
      // membership, or detach them (they'll go back through onboarding).
      // Only flat memberships are removable here and admin memberships carry no
      // flat, so removing one never revokes an admin role by itself; the
      // fallback below re-derives role/society/flat from what remains.
      const user = membership.user;
      if (user.flatId === flatId && user.societyId === societyId) {
        const fallback = await tx.userFlatMembership.findFirst({
          where: { userId: user.id, isActive: true },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        });
        const keepRole = user.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : undefined;
        if (fallback) {
          await tx.user.update({
            where: { id: user.id },
            data: {
              role: keepRole ?? fallback.role,
              societyId: fallback.societyId,
              flatId: fallback.flatId,
              isOwner: fallback.isOwner,
              isPrimaryResident: fallback.isPrimary,
            },
          });
          await tx.userFlatMembership.update({ where: { id: fallback.id }, data: { isDefault: true } });
        } else {
          await tx.user.update({
            where: { id: user.id },
            data: {
              role: keepRole ?? 'RESIDENT',
              isActive: keepRole ? true : false,
              societyId: null,
              flatId: null,
              isOwner: false,
              isPrimaryResident: false,
              primaryResidentId: null,
              familyRole: null,
            },
          });
        }
      }
    });

    return { membershipId: membership.id, removed: true };
  }
}

export const adminResidentsService = new AdminResidentsService();
