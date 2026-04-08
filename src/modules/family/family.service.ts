import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import { FamilyRole } from '../../../prisma/generated/prisma/enums';
import { validatePhoneNumber, validateRequiredFields } from '../../utils/validation';

const MAX_FAMILY_MEMBERS = 6;

export class FamilyService {
  // ============================================
  // ADD FAMILY MEMBER (Primary Resident Only)
  // Post-approval: just name + phone, no OTP flow.
  // The family member gets linked to the flat immediately.
  // They activate their account when they first log in via OTP.
  // ============================================
  async addFamilyMember(data: {
    phone: string;
    name: string;
    familyRole?: FamilyRole;
    primaryResidentId: string;
  }) {
    const { phone, name, familyRole, primaryResidentId } = data;

    validateRequiredFields({ phone, name }, ['phone', 'name'], 'Add Family Member');
    validatePhoneNumber(phone);

    // Verify primary resident is approved and active
    const primaryResident = await prisma.user.findUnique({
      where: { id: primaryResidentId },
    });

    if (!primaryResident) {
      throw new AppError('Primary resident not found', 404);
    }

    if (!primaryResident.isActive) {
      throw new AppError('Your account is not active', 403);
    }

    if (!primaryResident.isPrimaryResident) {
      throw new AppError('Only the primary resident of a flat can add family members', 403);
    }

    if (!primaryResident.flatId || !primaryResident.societyId) {
      throw new AppError('You must be assigned to a flat before adding family members', 400);
    }

    // Count active + pending family members (anyone linked to the flat)
    const currentCount = await prisma.user.count({
      where: {
        flatId: primaryResident.flatId,
        role: 'RESIDENT',
        id: { not: primaryResidentId },
      },
    });

    if (currentCount >= MAX_FAMILY_MEMBERS) {
      throw new AppError(`Maximum ${MAX_FAMILY_MEMBERS} additional family members allowed per flat`, 400);
    }

    // Check if this phone is already in the system
    const existingUser = await prisma.user.findUnique({ where: { phone } });

    if (existingUser) {
      // Only RESIDENT accounts can be added as family members
      if (existingUser.role !== 'RESIDENT') {
        throw new AppError('This phone number belongs to a non-resident account and cannot be added as a family member', 400);
      }

      // If already in the system: link them to this flat if they have no flat
      if (existingUser.flatId) {
        throw new AppError('This phone number is already registered to a flat', 400);
      }

      // Link existing user to this flat as a family member
      const linked = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name: name || existingUser.name,
          flatId: primaryResident.flatId,
          societyId: primaryResident.societyId,
          isPrimaryResident: false,
          familyRole: familyRole ?? null,
          primaryResidentId,
          // Keep their existing isActive state
        },
        select: {
          id: true,
          name: true,
          phone: true,
          familyRole: true,
          isActive: true,
          isPrimaryResident: true,
        },
      });

      return { member: linked, isNew: false };
    }

    // Create a new pre-linked user record (inactive until they login via OTP)
    const member = await prisma.user.create({
      data: {
        phone,
        name,
        role: 'RESIDENT',
        flatId: primaryResident.flatId,
        societyId: primaryResident.societyId,
        isPrimaryResident: false,
        familyRole: familyRole ?? null,
        primaryResidentId,
        isActive: false, // activated on first OTP login
        isOwner: false,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        familyRole: true,
        isActive: true,
        isPrimaryResident: true,
      },
    });

    return { member, isNew: true };
  }

  // ============================================
  // GET FAMILY MEMBERS (by flatId)
  // ============================================
  async getFamilyMembers(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.flatId) {
      throw new AppError('User not found or not assigned to a flat', 404);
    }

    const familyMembers = await prisma.user.findMany({
      where: {
        flatId: user.flatId,
        role: 'RESIDENT',
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        photoUrl: true,
        isActive: true,
        isPrimaryResident: true,
        familyRole: true,
        createdAt: true,
      },
      orderBy: [
        { isPrimaryResident: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    return familyMembers;
  }

  // ============================================
  // REMOVE FAMILY MEMBER (Primary Resident Only)
  // ============================================
  async removeFamilyMember(memberId: string, primaryResidentId: string) {
    const primaryResident = await prisma.user.findUnique({
      where: { id: primaryResidentId },
    });

    if (!primaryResident || !primaryResident.isPrimaryResident) {
      throw new AppError('Only primary residents can remove family members', 403);
    }

    const member = await prisma.user.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new AppError('Family member not found', 404);
    }

    if (member.id === primaryResidentId) {
      throw new AppError('Primary resident cannot remove themselves', 400);
    }

    if (member.flatId !== primaryResident.flatId) {
      throw new AppError('Can only remove family members from your own flat', 403);
    }

    if (member.isPrimaryResident) {
      throw new AppError('Cannot remove the primary resident', 400);
    }

    // Unlink from flat but keep the user account (they may re-register elsewhere)
    await prisma.user.update({
      where: { id: memberId },
      data: {
        isActive: false,
        flatId: null,
        societyId: null,
        primaryResidentId: null,
        familyRole: null,
      },
    });

    return { message: 'Family member removed successfully' };
  }

  // ============================================
  // UPDATE FAMILY ROLE (Primary Resident Only)
  // ============================================
  async updateFamilyRole(memberId: string, newRole: FamilyRole, primaryResidentId: string) {
    const primaryResident = await prisma.user.findUnique({
      where: { id: primaryResidentId },
    });

    if (!primaryResident || !primaryResident.isPrimaryResident) {
      throw new AppError('Only primary residents can update family roles', 403);
    }

    const member = await prisma.user.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new AppError('Family member not found', 404);
    }

    if (member.flatId !== primaryResident.flatId) {
      throw new AppError('Can only update family members from your own flat', 403);
    }

    if (member.isPrimaryResident) {
      throw new AppError('Cannot update primary resident role', 400);
    }

    const updated = await prisma.user.update({
      where: { id: memberId },
      data: { familyRole: newRole },
      select: {
        id: true,
        name: true,
        phone: true,
        familyRole: true,
      },
    });

    return updated;
  }
}
