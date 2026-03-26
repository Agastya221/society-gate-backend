import { prisma } from '../../utils/Client';
import { generateUniquePasscode } from '../../utils/passcode';
import { AppError } from '../../utils/ResponseHandler';
import type { GuestInviteStatus, GuestInviteType } from '../../../prisma/generated/prisma/client';

export interface CreateGuestInviteDTO {
  type: GuestInviteType;
  visitorName: string;
  visitorPhone: string;
  validFrom: Date;
  validUntil: Date;
  allowedDays?: string[];
  timeFrom?: string;
  timeUntil?: string;
  isPrivate?: boolean;
  note?: string;
}

export class GuestInviteService {
  /**
   * Create a Quick, Frequent, or Private invite.
   * Generates a unique 6-char passcode.
   */
  async create(userId: string, dto: CreateGuestInviteDTO) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { flatId: true, societyId: true },
    });

    if (!user?.flatId || !user?.societyId) {
      throw new AppError('User must be assigned to a flat and society', 400);
    }

    const passcode = await generateUniquePasscode();
    const maxUses = dto.type === 'FREQUENT' ? null : 1;

    const invite = await prisma.guestInvite.create({
      data: {
        type: dto.type,
        visitorName: dto.visitorName,
        visitorPhone: dto.visitorPhone,
        validFrom: dto.validFrom,
        validUntil: dto.validUntil,
        allowedDays: dto.allowedDays ?? [],
        timeFrom: dto.timeFrom ?? null,
        timeUntil: dto.timeUntil ?? null,
        isPrivate: dto.type === 'PRIVATE' ? true : (dto.isPrivate ?? false),
        note: dto.note ?? null,
        passcode,
        maxUses,
        flatId: user.flatId,
        residentId: userId,
        societyId: user.societyId,
      },
    });

    return invite;
  }

  /**
   * List all guest invites for the authenticated resident.
   */
  async list(userId: string, status?: GuestInviteStatus, type?: GuestInviteType) {
    return prisma.guestInvite.findMany({
      where: {
        residentId: userId,
        ...(status ? { status } : {}),
        ...(type ? { type } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get single invite by ID (owner only).
   */
  async getById(id: string, userId: string) {
    const invite = await prisma.guestInvite.findUnique({ where: { id } });
    if (!invite) throw new AppError('Guest invite not found', 404);
    if (invite.residentId !== userId) throw new AppError('Access denied', 403);
    return invite;
  }

  /**
   * Revoke an active invite immediately.
   */
  async revoke(id: string, userId: string) {
    const invite = await prisma.guestInvite.findUnique({ where: { id } });
    if (!invite) throw new AppError('Guest invite not found', 404);
    if (invite.residentId !== userId) throw new AppError('Access denied', 403);
    if (invite.status !== 'ACTIVE') throw new AppError('Only active invites can be revoked', 400);

    return prisma.guestInvite.update({
      where: { id },
      data: { status: 'REVOKED' },
    });
  }

  /**
   * Hard-delete an invite (only if REVOKED or EXPIRED).
   */
  async delete(id: string, userId: string) {
    const invite = await prisma.guestInvite.findUnique({ where: { id } });
    if (!invite) throw new AppError('Guest invite not found', 404);
    if (invite.residentId !== userId) throw new AppError('Access denied', 403);
    if (invite.status === 'ACTIVE') {
      throw new AppError('Cannot delete active invites. Revoke first.', 400);
    }

    await prisma.guestInvite.delete({ where: { id } });
    return { message: 'Invite deleted' };
  }
}
