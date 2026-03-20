import { prisma } from '../../utils/Client';
import { generateQRToken } from '../../utils/QrGenerate';
import { AppError } from '../../utils/ResponseHandler';
import type { InviteType, InviteStatus } from '../../../prisma/generated/prisma/client';

export interface CreateInvitePassDTO {
  type: InviteType;
  visitorName?: string;
  visitorPhone?: string;
  companyName?: string;
  companies?: string[];
  vehicleNumber?: string;
  purpose?: string;
  visitorPhoto?: string;
  validFrom: Date;
  validUntil: Date;
  allowedDays?: string[];
  timeFrom?: string;
  timeUntil?: string;
  maxUses?: number;
}

export class InviteService {
  async createInvitePass(flatId: string, userId: string, dto: CreateInvitePassDTO) {
    const flat = await prisma.flat.findUnique({ where: { id: flatId }, select: { societyId: true } });
    if (!flat) throw new AppError('Flat not found', 404);

    const qrToken = generateQRToken({ flatId, type: dto.type, createdBy: userId, ts: Date.now() }, '10y');

    const maxUses = dto.maxUses ?? (dto.type === 'DELIVERY_STANDING' ? -1 : 1);

    const invite = await prisma.invitePass.create({
      data: {
        type: dto.type,
        visitorName: dto.visitorName,
        visitorPhone: dto.visitorPhone,
        companyName: dto.companyName,
        companies: dto.companies ?? [],
        vehicleNumber: dto.vehicleNumber,
        purpose: dto.purpose,
        visitorPhoto: dto.visitorPhoto,
        validFrom: dto.validFrom,
        validUntil: dto.validUntil,
        allowedDays: dto.allowedDays ?? [],
        timeFrom: dto.timeFrom,
        timeUntil: dto.timeUntil,
        maxUses,
        qrToken,
        flatId,
        societyId: flat.societyId,
        createdById: userId,
      },
    });

    return invite;
  }

  async getMyInvites(userId: string, flatId: string, status?: InviteStatus) {
    const invites = await prisma.invitePass.findMany({
      where: {
        flatId,
        createdById: userId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    return invites;
  }

  async getInviteById(id: string, userId: string) {
    const invite = await prisma.invitePass.findUnique({
      where: { id },
      include: { entries: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });

    if (!invite) throw new AppError('Invite pass not found', 404);
    if (invite.createdById !== userId) throw new AppError('Access denied', 403);

    return invite;
  }

  async cancelInvite(id: string, userId: string) {
    const invite = await prisma.invitePass.findUnique({ where: { id } });
    if (!invite) throw new AppError('Invite pass not found', 404);
    if (invite.createdById !== userId) throw new AppError('Access denied', 403);
    if (invite.status !== 'ACTIVE') throw new AppError('Only active invites can be cancelled', 400);

    return prisma.invitePass.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  // Called by gate-scan service after a successful scan
  async recordUsage(id: string): Promise<void> {
    const invite = await prisma.invitePass.findUnique({ where: { id } });
    if (!invite) return;

    const newCount = invite.usedCount + 1;
    const isExhausted = invite.maxUses !== -1 && newCount >= invite.maxUses;

    await prisma.invitePass.update({
      where: { id },
      data: {
        usedCount: newCount,
        status: isExhausted ? 'USED' : 'ACTIVE',
      },
    });
  }
}
