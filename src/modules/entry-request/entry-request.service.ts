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
  flatId?: string;
  flatIds?: string[];
  visitorName?: string;
  visitorPhone?: string;
  providerTag?: ProviderTag;
  photoKey?: string;
}

interface RequestTargetInfo {
  targetId?: string;
  flatId: string;
  flatNumber: string;
  blockName: string | null;
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
    const guard = await prisma.user.findUnique({
      where: { id: guardId },
      select: {
        societyId: true,
        role: true,
        society: { select: { name: true } },
      },
    });

    if (!guard || guard.role !== 'GUARD') {
      throw new AppError('Only guards can create entry requests', 403);
    }

    if (!guard.societyId) {
      throw new AppError('Guard must be assigned to a society', 400);
    }

    const requestedFlatIds = [
      ...new Set([
        ...(data.flatId ? [data.flatId] : []),
        ...(data.flatIds ?? []),
      ]),
    ];

    if (requestedFlatIds.length === 0) {
      throw new AppError('At least one flat is required', 400);
    }

    const flats = await prisma.flat.findMany({
      where: { id: { in: requestedFlatIds }, isActive: true },
      select: {
        id: true,
        societyId: true,
        flatNumber: true,
        block: { select: { name: true } },
      },
    });

    const flatById = new Map(flats.map((flat) => [flat.id, flat]));
    const missingFlatIds = requestedFlatIds.filter((flatId) => !flatById.has(flatId));
    if (missingFlatIds.length > 0) {
      throw new AppError(`Flat not found: ${missingFlatIds.join(', ')}`, 404);
    }

    const orderedFlats = requestedFlatIds.map((flatId) => flatById.get(flatId)!);
    const crossSocietyFlat = orderedFlats.find((flat) => flat.societyId !== guard.societyId);
    if (crossSocietyFlat) {
      throw new AppError('All flats must belong to the guard society', 400);
    }

    const primaryFlat = orderedFlats[0];
    const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000);

    const entryRequest = await prisma.entryRequest.create({
      data: {
        type: data.type,
        visitorName: data.visitorName,
        visitorPhone: data.visitorPhone,
        providerTag: data.providerTag,
        photoKey: data.photoKey,
        flatId: primaryFlat.id,
        societyId: guard.societyId,
        guardId,
        expiresAt,
        status: 'PENDING',
        targets: {
          create: orderedFlats.map((flat) => ({
            flatId: flat.id,
            societyId: guard.societyId!,
          })),
        },
      },
      include: this.getInclude(),
    });

    const targetInfos = this.getTargetInfos(entryRequest);

    eventBus.emit('entry-request.created', {
      entryRequestId: entryRequest.id,
      flatId: primaryFlat.id,
      flatIds: targetInfos.map((target) => target.flatId),
      flats: targetInfos,
      societyId: guard.societyId,
      societyName: guard.society?.name ?? 'Society',
      guardId,
      visitorName: data.visitorName,
      providerTag: data.providerTag,
      type: data.type,
    });

    return { entryRequest: this.formatEntryRequest(entryRequest) };
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
      select: {
        role: true,
        societyId: true,
        flatId: true,
        flatMemberships: {
          where: { isActive: true, flatId: { not: null } },
          select: { flatId: true },
        },
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const where: Prisma.EntryRequestWhereInput = {};

    if (user.role === 'GUARD') {
      if (user.societyId) where.societyId = user.societyId;
    } else if (user.role === 'RESIDENT') {
      const visibleFlatIds = this.getUserFlatIds(user);
      if (visibleFlatIds.length === 0) {
        where.id = '__no_access__';
      } else if (flatId) {
        if (!visibleFlatIds.includes(flatId)) {
          throw new AppError('Access denied for this flat', 403);
        }
        where.OR = [{ flatId }, { targets: { some: { flatId } } }];
      } else {
        where.OR = [
          { flatId: { in: visibleFlatIds } },
          { targets: { some: { flatId: { in: visibleFlatIds } } } },
        ];
      }
    } else if (user.role === 'ADMIN') {
      if (user.societyId) where.societyId = user.societyId;
    }

    if (status) where.status = status;
    if (flatId && user.role !== 'RESIDENT') {
      where.OR = [{ flatId }, { targets: { some: { flatId } } }];
    }

    const [rawRequests, total] = await Promise.all([
      prisma.entryRequest.findMany({
        where,
        include: this.getInclude(),
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.entryRequest.count({ where }),
    ]);

    return {
      entryRequests: rawRequests.map((request) => this.formatEntryRequest(request)),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // ============================================
  // GET SINGLE ENTRY REQUEST
  // ============================================
  async getEntryRequestById(entryRequestId: string, userId: string) {
    const entryRequest = await prisma.entryRequest.findUnique({
      where: { id: entryRequestId },
      include: this.getInclude(),
    });

    if (!entryRequest) {
      throw new AppError('Entry request not found', 404);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        societyId: true,
        flatId: true,
        flatMemberships: {
          where: { isActive: true, flatId: { not: null } },
          select: { flatId: true },
        },
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const targetFlatIds = this.getTargetInfos(entryRequest).map((target) => target.flatId);
    const isGuard = entryRequest.guardId === userId;
    const isFlatResident = this.getUserFlatIds(user).some((flatId) => targetFlatIds.includes(flatId));
    const isSocietyAdmin =
      user.role === 'ADMIN' && user.societyId === entryRequest.societyId;
    const isSuperAdmin = user.role === 'SUPER_ADMIN';

    if (!isGuard && !isFlatResident && !isSocietyAdmin && !isSuperAdmin) {
      throw new AppError('Access denied', 403);
    }

    return this.formatEntryRequest(entryRequest);
  }

  // ============================================
  // APPROVE ENTRY REQUEST
  // ============================================
  async approveEntryRequest(entryRequestId: string, userId: string) {
    const entryRequest = await prisma.entryRequest.findUnique({
      where: { id: entryRequestId },
      include: this.getInclude(),
    });

    if (!entryRequest) {
      throw new AppError('Entry request not found', 404);
    }

    const approver = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        flatId: true,
        flatMemberships: {
          where: { isActive: true, flatId: { not: null } },
          select: { flatId: true },
        },
      },
    });

    if (!approver) {
      throw new AppError('User not found', 404);
    }

    const targetInfos = this.getTargetInfos(entryRequest);
    const approverFlatIds = this.getUserFlatIds(approver);
    const canApprove = targetInfos.some((target) => approverFlatIds.includes(target.flatId));
    if (!canApprove) {
      throw new AppError('Only linked flat residents can approve entry requests', 403);
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

    const now = new Date();
    const updatedRequest = await prisma.$transaction(async (tx) => {
      const createdEntryIds: string[] = [];

      for (const target of targetInfos) {
        const entry = await tx.entry.create({
          data: {
            type: entryRequest.type,
            visitorName: entryRequest.visitorName || 'Visitor',
            visitorPhone: entryRequest.visitorPhone,
            visitorPhoto: entryRequest.photoKey,
            companyName: entryRequest.providerTag,
            flatId: target.flatId,
            societyId: entryRequest.societyId,
            createdById: entryRequest.guardId,
            approvedById: userId,
            approvedAt: now,
            status: 'APPROVED',
          },
        });

        createdEntryIds.push(entry.id);
        if (target.targetId) {
          await tx.entryRequestTarget.update({
            where: { id: target.targetId },
            data: { entryId: entry.id },
          });
        }
      }

      return tx.entryRequest.update({
        where: { id: entryRequestId },
        data: {
          status: 'APPROVED',
          approvedById: userId,
          approvedAt: now,
          entryId: createdEntryIds[0],
        },
        include: this.getInclude(),
      });
    });

    const flatLabel = this.getFlatLabelList(targetInfos);
    emitToUser(entryRequest.guardId, SOCKET_EVENTS.ENTRY_REQUEST_STATUS, {
      id: entryRequestId,
      status: 'APPROVED',
      flatNumber: flatLabel,
      flatIds: targetInfos.map((target) => target.flatId),
      approvedBy: updatedRequest.approvedBy?.name,
    });

    eventBus.emit('entry-request.approved', {
      entryRequestId,
      flatId: entryRequest.flatId,
      flatIds: targetInfos.map((target) => target.flatId),
      flats: targetInfos,
      societyId: entryRequest.societyId,
      guardId: entryRequest.guardId,
      visitorName: entryRequest.visitorName || 'Visitor',
      visitorType: entryRequest.type,
      approvedById: userId,
      approvedByName: updatedRequest.approvedBy?.name ?? approver.name ?? 'A resident',
    });

    return this.formatEntryRequest(updatedRequest);
  }

  // ============================================
  // REJECT ENTRY REQUEST
  // ============================================
  async rejectEntryRequest(
    entryRequestId: string,
    userId: string,
    reason?: string
  ) {
    const entryRequest = await prisma.entryRequest.findUnique({
      where: { id: entryRequestId },
      include: this.getInclude(),
    });

    if (!entryRequest) {
      throw new AppError('Entry request not found', 404);
    }

    const rejecter = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        flatId: true,
        flatMemberships: {
          where: { isActive: true, flatId: { not: null } },
          select: { flatId: true },
        },
      },
    });

    if (!rejecter) {
      throw new AppError('User not found', 404);
    }

    const targetInfos = this.getTargetInfos(entryRequest);
    const rejecterFlatIds = this.getUserFlatIds(rejecter);
    const canReject = targetInfos.some((target) => rejecterFlatIds.includes(target.flatId));
    if (!canReject) {
      throw new AppError('Only linked flat residents can reject entry requests', 403);
    }

    if (entryRequest.status !== 'PENDING') {
      throw new AppError(`Entry request is already ${entryRequest.status.toLowerCase()}`, 400);
    }

    const updatedRequest = await prisma.entryRequest.update({
      where: { id: entryRequestId },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
      include: this.getInclude(),
    });

    const flatLabel = this.getFlatLabelList(targetInfos);
    emitToUser(entryRequest.guardId, SOCKET_EVENTS.ENTRY_REQUEST_STATUS, {
      id: entryRequestId,
      status: 'REJECTED',
      flatNumber: flatLabel,
      flatIds: targetInfos.map((target) => target.flatId),
      reason,
    });

    eventBus.emit('entry-request.rejected', {
      entryRequestId,
      flatId: entryRequest.flatId,
      flatIds: targetInfos.map((target) => target.flatId),
      flats: targetInfos,
      societyId: entryRequest.societyId,
      guardId: entryRequest.guardId,
      visitorName: entryRequest.visitorName || 'Visitor',
      visitorType: entryRequest.type,
      rejectedById: userId,
      rejectedByName: rejecter.name ?? 'A resident',
      reason,
    });

    return this.formatEntryRequest(updatedRequest);
  }

  // ============================================
  // EXPIRE PENDING REQUESTS (cron job)
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
  // GET PENDING COUNT FOR GUARD
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

  private getInclude() {
    return {
      flat: {
        select: {
          id: true,
          flatNumber: true,
          block: { select: { name: true } },
        },
      },
      targets: {
        include: {
          flat: {
            select: {
              id: true,
              flatNumber: true,
              block: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' as const },
      },
      guard: { select: { id: true, name: true, phone: true } },
      approvedBy: { select: { id: true, name: true } },
    };
  }

  private getUserFlatIds(user: { flatId?: string | null; flatMemberships?: { flatId: string | null }[] }) {
    const membershipFlatIds = user.flatMemberships
      ?.map((membership) => membership.flatId)
      .filter((flatId): flatId is string => Boolean(flatId)) ?? [];

    return [...new Set([...(user.flatId ? [user.flatId] : []), ...membershipFlatIds])];
  }

  private getTargetInfos(entryRequest: {
    flatId: string;
    flat?: { id: string; flatNumber: string; block?: { name: string } | null } | null;
    targets?: {
      id: string;
      flatId: string;
      flat: { id: string; flatNumber: string; block?: { name: string } | null };
    }[];
  }): RequestTargetInfo[] {
    if (entryRequest.targets && entryRequest.targets.length > 0) {
      return entryRequest.targets.map((target) => ({
        targetId: target.id,
        flatId: target.flatId,
        flatNumber: target.flat.flatNumber,
        blockName: target.flat.block?.name ?? null,
      }));
    }

    return [
      {
        flatId: entryRequest.flatId,
        flatNumber: entryRequest.flat?.flatNumber ?? '',
        blockName: entryRequest.flat?.block?.name ?? null,
      },
    ];
  }

  private getFlatLabelList(targetInfos: RequestTargetInfo[]) {
    return targetInfos
      .map((target) => target.blockName
        ? `${target.blockName} ${target.flatNumber}`
        : target.flatNumber
      )
      .join(', ');
  }

  private formatEntryRequest<T extends { flat?: unknown; targets?: unknown[]; flatId: string }>(
    entryRequest: T
  ) {
    const targetInfos = this.getTargetInfos(entryRequest as Parameters<typeof this.getTargetInfos>[0]);

    return {
      ...entryRequest,
      flat: {
        number: (entryRequest as { flat?: { flatNumber?: string } }).flat?.flatNumber ?? '',
        block: (entryRequest as { flat?: { block?: { name: string } | null } }).flat?.block ?? null,
      },
      flatIds: targetInfos.map((target) => target.flatId),
      targetFlats: targetInfos.map((target) => ({
        id: target.flatId,
        flatNumber: target.flatNumber,
        blockName: target.blockName,
      })),
      flatLabel: this.getFlatLabelList(targetInfos),
    };
  }
}

export const entryRequestService = new EntryRequestService();
