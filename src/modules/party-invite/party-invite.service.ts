import { prisma } from '../../utils/Client';
import { generateUniquePasscode, generateUniqueInviteCode } from '../../utils/passcode';
import { AppError } from '../../utils/ResponseHandler';

export interface CreatePartyInviteDTO {
  hostName: string;
  validFrom: Date;
  validUntil: Date;
  venue?: string;
  maxGuests: number;
  theme?: number;
  note?: string;
}

export class PartyInviteService {
  /**
   * Create a Party/Group invite. Pre-generates all slots with unique codes.
   */
  async create(userId: string, dto: CreatePartyInviteDTO) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { flatId: true, societyId: true },
    });

    if (!user?.flatId || !user?.societyId) {
      throw new AppError('User must be assigned to a flat and society', 400);
    }

    const inviteCode = await generateUniqueInviteCode();
    const inviteLink = `https://sgate.app/${inviteCode.toLowerCase()}`;

    // Pre-generate all slot codes
    const slotCodes: string[] = [];
    for (let i = 0; i < dto.maxGuests; i++) {
      slotCodes.push(await generateUniquePasscode());
    }

    const invite = await prisma.$transaction(async (tx) => {
      const partyInvite = await tx.partyInvite.create({
        data: {
          hostName: dto.hostName,
          validFrom: dto.validFrom,
          validUntil: dto.validUntil,
          venue: dto.venue ?? null,
          note: dto.note ?? null,
          theme: dto.theme ?? 0,
          maxGuests: dto.maxGuests,
          inviteCode,
          inviteLink,
          flatId: user.flatId!,
          residentId: userId,
          societyId: user.societyId!,
        },
      });

      // Create all slots in bulk
      await tx.partySlot.createMany({
        data: slotCodes.map((code) => ({
          partyInviteId: partyInvite.id,
          code,
        })),
      });

      return partyInvite;
    });

    // Return invite WITHOUT slots (spec says: "NOT the slots — those are internal")
    return {
      id: invite.id,
      inviteCode: invite.inviteCode,
      inviteLink: invite.inviteLink,
      hostName: invite.hostName,
      validFrom: invite.validFrom,
      validUntil: invite.validUntil,
      venue: invite.venue,
      maxGuests: invite.maxGuests,
      usedSlots: 0,
      theme: invite.theme,
      note: invite.note,
      status: invite.status,
    };
  }

  /**
   * Get party invite with only claimed slots (for resident management screen).
   */
  async getById(id: string, userId: string) {
    const invite = await prisma.partyInvite.findUnique({
      where: { id },
      include: {
        slots: {
          where: { phone: { not: null } },
          select: { code: true, name: true, phone: true, addedByResident: true, claimedAt: true },
        },
      },
    });

    if (!invite) throw new AppError('Party invite not found', 404);
    if (invite.residentId !== userId) throw new AppError('Access denied', 403);

    return {
      id: invite.id,
      inviteLink: invite.inviteLink,
      inviteCode: invite.inviteCode,
      hostName: invite.hostName,
      validFrom: invite.validFrom,
      validUntil: invite.validUntil,
      venue: invite.venue,
      maxGuests: invite.maxGuests,
      usedSlots: invite.slots.length,
      theme: invite.theme,
      note: invite.note,
      status: invite.status,
      slots: invite.slots,
    };
  }

  /**
   * Resident manually adds a guest → claims a slot.
   * Uses transaction to prevent race conditions.
   */
  async addGuest(partyId: string, userId: string, name: string, phone: string) {
    const invite = await prisma.partyInvite.findUnique({ where: { id: partyId } });
    if (!invite) throw new AppError('Party invite not found', 404);
    if (invite.residentId !== userId) throw new AppError('Access denied', 403);
    if (invite.status !== 'ACTIVE') throw new AppError('Party invite is not active', 400);

    return prisma.$transaction(async (tx) => {
      const freeSlot = await tx.partySlot.findFirst({
        where: { partyInviteId: partyId, phone: null },
      });

      if (!freeSlot) throw new AppError('No slots remaining', 409);

      // Atomic update to ensure no race condition
      const updateResult = await tx.partySlot.updateMany({
        where: { id: freeSlot.id, phone: null },
        data: {
          phone,
          name,
          addedByResident: true,
          claimedAt: new Date(),
        },
      });

      if (updateResult.count === 0) {
        throw new AppError('Slot was claimed by someone else simultaneously, try again.', 409);
      }

      await tx.partyInvite.update({
        where: { id: partyId },
        data: { usedSlots: { increment: 1 } },
      });

      return tx.partySlot.findUnique({
        where: { id: freeSlot.id },
        select: { code: true, name: true, phone: true, addedByResident: true, claimedAt: true },
      });
    });
  }

  /**
   * Guest self-service: opens share link, enters phone, gets a code.
   * PUBLIC (no auth). Idempotent — returns existing slot if already claimed.
   */
  async claimSlot(inviteCode: string, phone: string) {
    const invite = await prisma.partyInvite.findUnique({ where: { inviteCode } });
    if (!invite) throw new AppError('Invite not found', 404);
    if (invite.status !== 'ACTIVE') throw new AppError('This invite has expired or been cancelled', 410);
    if (new Date() > invite.validUntil) throw new AppError('Invite expired', 410);

    // Idempotent: if already claimed, return existing slot
    const existingSlot = await prisma.partySlot.findFirst({
      where: { partyInviteId: invite.id, phone },
      select: { code: true },
    });

    if (existingSlot) {
      return {
        code: existingSlot.code,
        invite: {
          hostName: invite.hostName,
          validFrom: invite.validFrom,
          validUntil: invite.validUntil,
          venue: invite.venue,
          note: invite.note,
        },
      };
    }

    // Transaction to prevent race condition on last slot
    return prisma.$transaction(async (tx) => {
      const freeSlot = await tx.partySlot.findFirst({
        where: { partyInviteId: invite.id, phone: null },
      });

      if (!freeSlot) throw new AppError('This invite is full', 409);

      // Atomic update on the slot
      const updateResult = await tx.partySlot.updateMany({
        where: { id: freeSlot.id, phone: null },
        data: { phone, claimedAt: new Date() },
      });

      if (updateResult.count === 0) {
        throw new AppError('Slot claiming race condition detected, please try again', 409);
      }

      await tx.partyInvite.update({
        where: { id: invite.id },
        data: { usedSlots: { increment: 1 } },
      });

      return {
        code: freeSlot.code,
        invite: {
          hostName: invite.hostName,
          validFrom: invite.validFrom,
          validUntil: invite.validUntil,
          venue: invite.venue,
          note: invite.note,
        },
      };
    });
  }

  /**
   * Remove a guest (free a slot) by code.
   */
  async removeGuest(partyId: string, userId: string, code: string) {
    const invite = await prisma.partyInvite.findUnique({ where: { id: partyId } });
    if (!invite) throw new AppError('Party invite not found', 404);
    if (invite.residentId !== userId) throw new AppError('Access denied', 403);

    const slot = await prisma.partySlot.findFirst({
      where: { partyInviteId: partyId, code },
    });
    if (!slot) throw new AppError('Guest slot not found', 404);
    if (!slot.phone) throw new AppError('This slot is not claimed', 400);

    await prisma.$transaction(async (tx) => {
      await tx.partySlot.update({
        where: { id: slot.id },
        data: { phone: null, name: null, addedByResident: false, claimedAt: null },
      });

      await tx.partyInvite.update({
        where: { id: partyId },
        data: { usedSlots: { decrement: 1 } },
      });
    });

    return { message: 'Guest removed' };
  }

  /**
   * Cancel the entire party invite. All slots become invalid.
   */
  async cancel(id: string, userId: string) {
    const invite = await prisma.partyInvite.findUnique({ where: { id } });
    if (!invite) throw new AppError('Party invite not found', 404);
    if (invite.residentId !== userId) throw new AppError('Access denied', 403);
    if (invite.status !== 'ACTIVE') throw new AppError('Party invite is not active', 400);

    return prisma.partyInvite.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  /**
   * List all party invites for a resident.
   */
  async list(userId: string) {
    return prisma.partyInvite.findMany({
      where: { residentId: userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
