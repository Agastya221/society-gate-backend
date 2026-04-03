import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import { eventBus } from '../../utils/eventBus';
import { emitToUser, SOCKET_EVENTS } from '../../utils/socket';
import logger from '../../utils/logger';
import type { Prisma } from '../../types';
import {
  EntryType,
  EntryRequestStatus,
  ProviderTag,
} from '../../../prisma/generated/prisma/enums';

const EXPIRY_MINUTES = 15;

interface CreateEntryRequestData {
  type: EntryType;
  flatId: string;
  visitorName?: string;
  visitorPhone?: string;
  providerTag?: ProviderTag;
  photoKey?: string;
}

export interface CreateEntryRequestResult {
  entryRequest: Awaited<ReturnType<typeof prisma.entryRequest.findUniqueOrThrow>>;
}

export class EntryRequestService {
  // ============================================
  // MAIN: CREATE ENTRY REQUEST
  // MyGate-style tiered trust system:
  //  Tier 1 — Standing auto-approve rule match  → auto-enter, notify after
  //  Tier 2 — Expected delivery match           → auto-enter, notify after
  //  Tier 3 — No match                          → PENDING, guard notifies resident for approval
  // ============================================
  async createEntryRequest(
    data: CreateEntryRequestData,
    guardId: string
  ): Promise<{ entryRequest: object }> {
    // Guard validation
    const guard = await prisma.user.findUnique({
      where: { id: guardId },
      select: { societyId: true, role: true },
    });

    if (!guard || guard.role !== 'GUARD') {
      throw new AppError('Only guards can create entry requests', 403);
    }

    if (!guard.societyId) {
      throw new AppError('Guard must be assigned to a society', 400);
    }

    // Verify flat exists and belongs to the same society
    const flat = await prisma.flat.findUnique({
      where: { id: data.flatId },
      select: { id: true, societyId: true, flatNumber: true },
    });

    if (!flat) {
      throw new AppError('Flat not found', 404);
    }

    if (flat.societyId !== guard.societyId) {
      throw new AppError('Flat does not belong to your society', 400);
    }

    // ============================================
    // Create PENDING request — notify resident for manual approval
    // Resident has 15 minutes to respond via app before it expires
    // (Auto-approval is handled by InvitePass at guard scan time)
    // ============================================
    const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000);

    const entryRequest = await prisma.entryRequest.create({
      data: {
        type: data.type,
        visitorName: data.visitorName,
        visitorPhone: data.visitorPhone,
        providerTag: data.providerTag,
        photoKey: data.photoKey,
        flatId: data.flatId,
        societyId: guard.societyId,
        guardId,
        expiresAt,
        status: 'PENDING',
      },
      include: {
        flat: { select: { id: true, flatNumber: true } },
        guard: { select: { id: true, name: true } },
      },
    });

    // ARCH-3: Emit event — listener handles push notification + in-app notification
    // Resident sees: photo of visitor + Approve / Reject buttons
    eventBus.emit('entry-request.created', {
      entryRequestId: entryRequest.id,
      flatId: data.flatId,
      societyId: guard.societyId,
      guardId,
      visitorName: data.visitorName,
      providerTag: data.providerTag,
      type: data.type,
    });

    return { entryRequest };
  }

  // ============================================
  // GET ENTRY REQUESTS
  // ============================================
  async getEntryRequests(
    userId: string,
    filters: {
      status?: EntryRequestStatus;
      flatId?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const { status, flatId, page = 1, limit = 20 } = filters;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, societyId: true, flatId: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const where: Prisma.EntryRequestWhereInput = {};

    if (user.role === 'GUARD') {
      // Guards see all requests for their society (not just their own — any guard can process)
      if (user.societyId) where.societyId = user.societyId;
    } else if (user.role === 'RESIDENT') {
      if (user.flatId) where.flatId = user.flatId;
    } else if (user.role === 'ADMIN') {
      if (user.societyId) where.societyId = user.societyId;
    }

    if (status) where.status = status;
    if (flatId && user.role !== 'RESIDENT') where.flatId = flatId;

    const [rawRequests, total] = await Promise.all([
      prisma.entryRequest.findMany({
        where,
        include: {
          flat: {
            select: {
              flatNumber: true,
              block: { select: { name: true } },
            },
          },
          guard: { select: { id: true, name: true } },
          approvedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.entryRequest.count({ where }),
    ]);

    const entryRequests = rawRequests.map((r) => ({
      ...r,
      flat: {
        number: r.flat?.flatNumber ?? '',
        block: r.flat?.block ?? null,
      },
    }));

    return {
      entryRequests,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // ============================================
  // GET SINGLE ENTRY REQUEST (unchanged)
  // ============================================
  async getEntryRequestById(entryRequestId: string, userId: string) {
    const entryRequest = await prisma.entryRequest.findUnique({
      where: { id: entryRequestId },
      include: {
        flat: {
          select: {
            id: true,
            flatNumber: true,
            block: { select: { name: true } },
            residents: { select: { id: true } },
          },
        },
        guard: { select: { id: true, name: true, phone: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    });

    if (!entryRequest) {
      throw new AppError('Entry request not found', 404);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, societyId: true, flatId: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const isGuard = entryRequest.guardId === userId;
    const isFlatResident = entryRequest.flat.residents.some((r) => r.id === userId);
    const isSocietyAdmin =
      user.role === 'ADMIN' && user.societyId === entryRequest.societyId;
    const isSuperAdmin = user.role === 'SUPER_ADMIN';

    if (!isGuard && !isFlatResident && !isSocietyAdmin && !isSuperAdmin) {
      throw new AppError('Access denied', 403);
    }

    return entryRequest;
  }

  // ============================================
  // APPROVE ENTRY REQUEST (unchanged)
  // ============================================
  async approveEntryRequest(entryRequestId: string, userId: string) {
    const entryRequest = await prisma.entryRequest.findUnique({
      where: { id: entryRequestId },
      include: {
        flat: {
          select: {
            id: true,
            flatNumber: true,
            residents: { select: { id: true } },
          },
        },
      },
    });

    if (!entryRequest) {
      throw new AppError('Entry request not found', 404);
    }

    const isFlatResident = entryRequest.flat.residents.some((r) => r.id === userId);
    if (!isFlatResident) {
      throw new AppError('Only flat residents can approve entry requests', 403);
    }

    if (entryRequest.status !== 'PENDING') {
      throw new AppError(`Entry request is already ${entryRequest.status.toLowerCase()}`, 400);
    }

    if (new Date() > entryRequest.expiresAt) {
      await prisma.entryRequest.update({
        where: { id: entryRequestId },
        data: { status: 'EXPIRED' },
      });
      throw new AppError('Entry request has expired', 400);
    }

    const entry = await prisma.entry.create({
      data: {
        type: entryRequest.type,
        visitorName: entryRequest.visitorName || 'Visitor',
        visitorPhone: entryRequest.visitorPhone,
        visitorPhoto: entryRequest.photoKey,
        companyName: entryRequest.providerTag,
        flatId: entryRequest.flatId,
        societyId: entryRequest.societyId,
        createdById: entryRequest.guardId,
        approvedById: userId,
        approvedAt: new Date(),
        status: 'APPROVED',
      },
    });

    const updatedRequest = await prisma.entryRequest.update({
      where: { id: entryRequestId },
      data: {
        status: 'APPROVED',
        approvedById: userId,
        approvedAt: new Date(),
        entryId: entry.id,
      },
      include: {
        flat: { select: { id: true, flatNumber: true, block: { select: { name: true } } } },
        guard: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    });

    emitToUser(entryRequest.guardId, SOCKET_EVENTS.ENTRY_REQUEST_STATUS, {
      id: entryRequestId,
      status: 'APPROVED',
      flatNumber: entryRequest.flat.flatNumber,
      approvedBy: updatedRequest.approvedBy?.name,
    });

    eventBus.emit('entry-request.approved', {
      entryRequestId,
      flatId: entryRequest.flatId,
      societyId: entryRequest.societyId,
      guardId: entryRequest.guardId,
      visitorName: entryRequest.visitorName || 'Visitor',
      visitorType: entryRequest.type,
      approvedById: userId,
      approvedByName: updatedRequest.approvedBy?.name ?? 'A resident',
    });

    return updatedRequest;
  }

  // ============================================
  // REJECT ENTRY REQUEST (unchanged)
  // ============================================
  async rejectEntryRequest(
    entryRequestId: string,
    userId: string,
    reason?: string
  ) {
    const entryRequest = await prisma.entryRequest.findUnique({
      where: { id: entryRequestId },
      include: {
        flat: {
          select: {
            id: true,
            flatNumber: true,
            residents: { select: { id: true } },
          },
        },
      },
    });

    if (!entryRequest) {
      throw new AppError('Entry request not found', 404);
    }

    const isFlatResident = entryRequest.flat.residents.some((r) => r.id === userId);
    if (!isFlatResident) {
      throw new AppError('Only flat residents can reject entry requests', 403);
    }

    if (entryRequest.status !== 'PENDING') {
      throw new AppError(`Entry request is already ${entryRequest.status.toLowerCase()}`, 400);
    }

    const [updatedRequest, rejecter] = await Promise.all([
      prisma.entryRequest.update({
        where: { id: entryRequestId },
        data: {
          status: 'REJECTED',
          rejectedAt: new Date(),
          rejectionReason: reason,
        },
        include: {
          flat: { select: { id: true, flatNumber: true, block: { select: { name: true } } } },
          guard: { select: { id: true, name: true } },
        },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      }),
    ]);

    emitToUser(entryRequest.guardId, SOCKET_EVENTS.ENTRY_REQUEST_STATUS, {
      id: entryRequestId,
      status: 'REJECTED',
      flatNumber: entryRequest.flat.flatNumber,
      reason,
    });

    eventBus.emit('entry-request.rejected', {
      entryRequestId,
      flatId: entryRequest.flatId,
      societyId: entryRequest.societyId,
      guardId: entryRequest.guardId,
      visitorName: entryRequest.visitorName || 'Visitor',
      visitorType: entryRequest.type,
      rejectedById: userId,
      rejectedByName: rejecter?.name ?? 'A resident',
      reason,
    });

    return updatedRequest;
  }

  // ============================================
  // EXPIRE PENDING REQUESTS (cron job, unchanged)
  // ============================================
  async expirePendingRequests(): Promise<{ count: number }> {
    const result = await prisma.entryRequest.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    });

    if (result.count > 0) {
      logger.info({ count: result.count }, 'Auto-expired entry requests');
    }

    return { count: result.count };
  }

  // ============================================
  // GET PENDING COUNT FOR GUARD (unchanged)
  // ============================================
  async getPendingCountForGuard(guardId: string): Promise<number> {
    return prisma.entryRequest.count({
      where: {
        guardId,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    });
  }
}

export const entryRequestService = new EntryRequestService();
