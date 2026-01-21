import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import { FamilyRole } from '../../../prisma/generated/prisma/enums';
import { validatePhoneNumber, validateEmail, validateRequiredFields } from '../../utils/validation';

const MAX_FAMILY_MEMBERS = 6;

export class FamilyService {
  // ============================================
  // INVITE FAMILY MEMBER (Primary Resident Only)
  // ============================================
  async inviteFamilyMember(data: {
    phone: string;
    name: string;
    email?: string;
    familyRole: FamilyRole;
    primaryResidentId: string;
  }) {
    const { phone, name, email, familyRole, primaryResidentId } = data;

    // Validate inputs
    validateRequiredFields(data, ['phone', 'name', 'familyRole'], 'Family Member Invitation');
    validatePhoneNumber(phone);
    if (email) {
      validateEmail(email);
    }

    // Check if primary resident exists and is active
    const primaryResident = await prisma.user.findUnique({
      where: { id: primaryResidentId },
      include: {
        flat: true,
        familyMembers: true,
      },
    });

    if (!primaryResident) {
      throw new AppError('Primary resident not found', 404);
    }

    if (!primaryResident.isActive) {
      throw new AppError('Primary resident account is not active', 403);
    }

    if (!primaryResident.isPrimaryResident) {
      throw new AppError('Only primary residents can invite family members', 403);
    }

    if (!primaryResident.flatId) {
      throw new AppError('Primary resident must be assigned to a flat', 400);
    }

    // CRITICAL FIX: Check family member count (including primary + invited but not yet active)
    const currentMemberCount = await prisma.user.count({
      where: {
        flatId: primaryResident.flatId,
        role: 'RESIDENT',
        OR: [
          { isActive: true }, // Active residents
          {
            isActive: false,
            primaryResidentId: { not: null }, // Invited family members (inactive but invited)
          },
        ],
      },
    });

    if (currentMemberCount >= MAX_FAMILY_MEMBERS) {
      throw new AppError(`Maximum ${MAX_FAMILY_MEMBERS} family members allowed per flat`, 400);
    }

    // Check if phone already exists
    const existingUser = await prisma.user.findUnique({
      where: { phone },
    });

    if (existingUser) {
      throw new AppError('Phone number already registered', 400);
    }

    // Create family member (inactive, pending OTP verification)
    const familyMember = await prisma.user.create({
      data: {
        phone,
        name,
        email,
        role: 'RESIDENT',
        flatId: primaryResident.flatId,
        societyId: primaryResident.societyId,
        isPrimaryResident: false,
        familyRole,
        primaryResidentId,
        isActive: false, // Will be activated after OTP verification
        isOwner: false,
      },
      include: {
        flat: true,
        primaryResident: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
    });

    return familyMember;
  }

  // ============================================
  // GET FAMILY MEMBERS (by flatId or userId)
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
        { isPrimaryResident: 'desc' }, // Primary first
        { createdAt: 'asc' },
      ],
    });

    return familyMembers;
  }

  // ============================================
  // REMOVE FAMILY MEMBER (Primary Resident Only)
  // ============================================
  async removeFamilyMember(memberId: string, primaryResidentId: string) {
    // Verify primary resident
    const primaryResident = await prisma.user.findUnique({
      where: { id: primaryResidentId },
    });

    if (!primaryResident || !primaryResident.isPrimaryResident) {
      throw new AppError('Only primary residents can remove family members', 403);
    }

    // Get member to remove
    const member = await prisma.user.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new AppError('Family member not found', 404);
    }

    // Can't remove self
    if (member.id === primaryResidentId) {
      throw new AppError('Primary resident cannot remove themselves', 400);
    }

    // Verify member is in same flat
    if (member.flatId !== primaryResident.flatId) {
      throw new AppError('Can only remove family members from your own flat', 403);
    }

    // Verify member is not primary
    if (member.isPrimaryResident) {
      throw new AppError('Cannot remove primary resident', 400);
    }

    // Soft delete: set isActive to false
    await prisma.user.update({
      where: { id: memberId },
      data: {
        isActive: false,
        flatId: null, // Remove from flat
        societyId: null,
        primaryResidentId: null,
      },
    });

    return { message: 'Family member removed successfully' };
  }

  // ============================================
  // UPDATE FAMILY ROLE (Primary Resident Only)
  // ============================================
  async updateFamilyRole(memberId: string, newRole: FamilyRole, primaryResidentId: string) {
    // Verify primary resident
    const primaryResident = await prisma.user.findUnique({
      where: { id: primaryResidentId },
    });

    if (!primaryResident || !primaryResident.isPrimaryResident) {
      throw new AppError('Only primary residents can update family roles', 403);
    }

    // Get member
    const member = await prisma.user.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new AppError('Family member not found', 404);
    }

    // Verify member is in same flat
    if (member.flatId !== primaryResident.flatId) {
      throw new AppError('Can only update family members from your own flat', 403);
    }

    // Can't update primary resident's role
    if (member.isPrimaryResident) {
      throw new AppError('Cannot update primary resident role', 400);
    }

    const updatedMember = await prisma.user.update({
      where: { id: memberId },
      data: { familyRole: newRole },
      select: {
        id: true,
        name: true,
        phone: true,
        familyRole: true,
      },
    });

    return updatedMember;
  }
}
