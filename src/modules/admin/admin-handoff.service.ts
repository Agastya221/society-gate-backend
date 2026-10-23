import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import logger from '../../utils/logger';

// ============================================
// ADMIN HANDOFF
// POST /api/v1/admin/handoff { phone, name }
// The society admin hands the admin role to another phone number himself. The new number becomes the
// society admin; the old admin steps down (back to his flat as a resident when he has one, otherwise
// he leaves the society and would have to join again). No super admin involved.
// ============================================

export interface HandoffDTO {
  phone: string; // normalised 10-digit
  name: string;
}

export const handoffAdminRole = async (societyId: string, actorId: string, input: HandoffDTO) => {
  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { id: true, role: true, societyId: true, phone: true },
  });
  if (!actor || actor.role !== 'ADMIN' || actor.societyId !== societyId) {
    throw new AppError('Only the society admin can hand over the admin role', 403);
  }
  if (actor.phone === input.phone) {
    throw new AppError('That is your own number. Enter the number of the person taking over.', 400);
  }

  const existing = await prisma.user.findUnique({
    where: { phone: input.phone },
    select: { id: true, name: true, role: true, societyId: true, email: true },
  });
  if (existing) {
    if (existing.role === 'SUPER_ADMIN') throw new AppError('This number cannot be made a society admin', 400);
    if (existing.role === 'GUARD') {
      throw new AppError('This number is registered as a security guard, so it cannot be the society admin', 409);
    }
    if (existing.societyId && existing.societyId !== societyId) {
      throw new AppError('This number already belongs to another society', 409);
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    // ---- the new admin ----
    const newAdmin = existing
      ? await tx.user.update({
          where: { id: existing.id },
          data: {
            name: existing.name?.trim() ? existing.name : input.name,
            role: 'ADMIN',
            societyId,
            flatId: null,
            isActive: true,
            isOwner: false,
            isPrimaryResident: false,
          },
          select: { id: true, name: true, phone: true },
        })
      : await tx.user.create({
          data: { name: input.name, phone: input.phone, role: 'ADMIN', societyId, isActive: true },
          select: { id: true, name: true, phone: true },
        });

    // Any flat he lives in stays available as a second context; the admin panel opens first
    await tx.userFlatMembership.updateMany({
      where: { userId: newAdmin.id, societyId, flatId: { not: null }, isActive: true },
      data: { isDefault: false },
    });
    const adminContext = await tx.userFlatMembership.findFirst({
      where: { userId: newAdmin.id, societyId, role: 'ADMIN', flatId: null },
      select: { id: true },
    });
    if (adminContext) {
      await tx.userFlatMembership.update({ where: { id: adminContext.id }, data: { isActive: true, isDefault: true } });
    } else {
      await tx.userFlatMembership.create({
        data: { userId: newAdmin.id, societyId, role: 'ADMIN', isActive: true, isDefault: true },
      });
    }

    // ---- the old admin steps down ----
    await tx.userFlatMembership.updateMany({
      where: { userId: actorId, societyId, role: 'ADMIN' },
      data: { isActive: false, isDefault: false },
    });
    const home = await tx.userFlatMembership.findFirst({
      where: { userId: actorId, societyId, role: 'RESIDENT', flatId: { not: null }, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    if (home) {
      await tx.userFlatMembership.update({ where: { id: home.id }, data: { isDefault: true } });
      await tx.user.update({
        where: { id: actorId },
        data: {
          role: 'RESIDENT',
          societyId,
          flatId: home.flatId,
          isOwner: home.isOwner,
          isPrimaryResident: home.isPrimary,
        },
      });
    } else {
      // No flat here: he leaves the society. Not deactivated by an admin (tokenVersion untouched), so he
      // can sign in again and go through onboarding like any new person.
      await tx.user.update({
        where: { id: actorId },
        data: { role: 'RESIDENT', societyId: null, flatId: null, isActive: false, refreshToken: null },
      });
    }

    // The society's contact is whoever runs it now
    await tx.society.update({
      where: { id: societyId },
      data: { contactName: newAdmin.name || input.name, contactPhone: input.phone },
    });

    return { newAdmin, oldAdminStaysAsResident: Boolean(home) };
  });

  logger.info(
    `[ADMIN_HANDOFF] society ${societyId}: ${actorId} handed the admin role to ${result.newAdmin.id} (old admin stays as resident: ${result.oldAdminStaysAsResident})`,
  );

  return {
    newAdmin: result.newAdmin,
    oldAdminStaysAsResident: result.oldAdminStaysAsResident,
  };
};
