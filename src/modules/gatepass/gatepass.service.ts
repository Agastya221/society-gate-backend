import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import { generateQRToken } from '../../utils/QrGenerate';
import { findInSociety, clampPagination } from '../../utils/scope';
import type { CreateGatePassInput } from './gatepass.schemas';
import type {
  GatePassFilters,
  Prisma,
} from '../../types';

/** Who is acting, and in which society. */
export interface GatePassCaller {
  id: string;
  role: string;
  flatId: string | null;
  societyId: string;
}

/**
 * Residents may only see passes for their own flat or ones they requested
 * (passes carry a usable QR token). Admins and guards see the whole society.
 */
function residentPassScope(caller: GatePassCaller): Prisma.GatePassWhereInput {
  if (caller.role !== 'RESIDENT') return {};
  return {
    OR: [
      { requestedById: caller.id },
      ...(caller.flatId ? [{ flatId: caller.flatId }] : []),
    ],
  };
}

export class GatePassService {
  async createGatePass(data: CreateGatePassInput, requestedById: string) {
    // Get user info to determine flatId and societyId
    const user = await prisma.user.findUnique({
      where: { id: requestedById },
      include: { flat: true, society: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (!user.societyId) {
      throw new AppError('User must have a society assigned', 400);
    }

    const isSocietyAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
    // Residents can only raise a pass for their own flat.
    const flatId = isSocietyAdmin ? data.flatId : user.flatId;
    const societyId = user.societyId;

    if (!isSocietyAdmin && !flatId) {
      throw new AppError('Resident must have a flat assigned', 400);
    }

    // A resident pass is always flat-bound. Admins may optionally target a
    // flat, otherwise the pass is issued by the society itself.
    if (flatId) {
      const flat = await prisma.flat.findUnique({
        where: { id: flatId },
        select: { societyId: true },
      });

      if (!flat || flat.societyId !== societyId) {
        throw new AppError('Invalid flat or society', 400);
      }
    }

    // Generate QR token
    const qrToken = generateQRToken({
      type: 'gatepass',
      flatId: flatId ?? null,
      societyId,
      passType: data.type,
    });

    const gatePass = await prisma.gatePass.create({
      data: {
        // Only allow-listed fields (see gatepass.schemas.ts); status, qrToken,
        // approval and usage fields are server-set.
        type: data.type,
        title: data.title,
        description: data.description,
        validFrom: data.validFrom,
        validUntil: data.validUntil,
        attachments: data.attachments ?? [],
        vehicleNumber: 'vehicleNumber' in data ? data.vehicleNumber : undefined,
        driverName: 'driverName' in data ? data.driverName : undefined,
        driverPhone: 'driverPhone' in data ? data.driverPhone : undefined,
        itemsList: 'itemsList' in data ? (data.itemsList ?? []) : [],
        workerName: 'workerName' in data ? data.workerName : undefined,
        workerPhone: 'workerPhone' in data ? data.workerPhone : undefined,
        companyName: data.companyName,
        flatId: flatId ?? null,
        societyId,
        requestedById,
        qrToken,
        status: 'PENDING',
      },
      include: {
        flat: true,
        requestedBy: { select: { id: true, name: true, phone: true, role: true } },
        society: { select: { id: true, name: true } },
      },
    });

    return gatePass;
  }

  async approveGatePass(gatePassId: string, approvedById: string, societyId: string) {
    const gatePass = await findInSociety(prisma.gatePass, gatePassId, societyId, {
      entity: 'Gate pass',
    });

    if (gatePass.status !== 'PENDING') {
      throw new AppError('Gate pass is not pending approval', 400);
    }

    const updatedGatePass = await prisma.gatePass.update({
      where: { id: gatePassId },
      data: {
        status: 'APPROVED',
        approvedById,
        approvedAt: new Date(),
      },
      include: {
        flat: true,
        requestedBy: { select: { id: true, name: true, phone: true } },
        approvedBy: { select: { id: true, name: true, phone: true } },
      },
    });

    return updatedGatePass;
  }

  async rejectGatePass(gatePassId: string, reason: string, approvedById: string, societyId: string) {
    const gatePass = await findInSociety(prisma.gatePass, gatePassId, societyId, {
      entity: 'Gate pass',
    });

    if (gatePass.status !== 'PENDING') {
      throw new AppError('Gate pass is not pending approval', 400);
    }

    const updatedGatePass = await prisma.gatePass.update({
      where: { id: gatePassId },
      data: {
        status: 'REJECTED',
        approvedById,
        rejectionReason: reason,
      },
      include: {
        flat: true,
        requestedBy: { select: { id: true, name: true, phone: true } },
        approvedBy: { select: { id: true, name: true, phone: true } },
      },
    });

    return updatedGatePass;
  }

  async scanGatePass(qrToken: string, guardId: string, societyId: string) {
    if (!qrToken || typeof qrToken !== 'string') {
      throw new AppError('Invalid QR code', 404);
    }
    // A guard can only admit passes issued by their own society.
    const gatePass = await prisma.gatePass.findFirst({
      where: { qrToken, societyId },
      include: {
        flat: true,
        requestedBy: { select: { id: true, name: true, phone: true } },
      },
    });

    if (!gatePass) {
      throw new AppError('Invalid QR code', 404);
    }

    // Check if already used
    if (gatePass.isUsed || gatePass.status === 'USED') {
      throw new AppError('Gate pass already used', 400);
    }

    // Check if rejected or expired
    if (gatePass.status === 'REJECTED') {
      throw new AppError('Gate pass was rejected', 400);
    }

    if (gatePass.status === 'EXPIRED') {
      throw new AppError('Gate pass has expired', 400);
    }

    // Check if approved or active (both are valid for scanning)
    if (gatePass.status !== 'APPROVED' && gatePass.status !== 'ACTIVE') {
      throw new AppError(`Gate pass is ${gatePass.status.toLowerCase()}, not approved`, 400);
    }

    // Check validity period
    const now = new Date();
    if (now < gatePass.validFrom) {
      throw new AppError(
        `Gate pass is not yet valid. Valid from: ${gatePass.validFrom.toLocaleDateString()}`,
        400
      );
    }

    if (now > gatePass.validUntil) {
      // Auto-expire the gate pass
      await prisma.gatePass.update({
        where: { id: gatePass.id },
        data: { status: 'EXPIRED' },
      });
      throw new AppError(
        `Gate pass has expired. Was valid until: ${gatePass.validUntil.toLocaleDateString()}`,
        400
      );
    }

    // CRITICAL FIX: Use atomic updateMany to prevent double-scan race condition
    const updateResult = await prisma.gatePass.updateMany({
      where: {
        id: gatePass.id,
        isUsed: false, // Only update if not already used
      },
      data: {
        isUsed: true,
        usedAt: new Date(),
        usedByGuardId: guardId,
        status: 'USED',
      },
    });

    // If no records updated, it was already used
    if (updateResult.count === 0) {
      throw new AppError('Gate pass has already been used', 400);
    }

    // Get updated gate pass with relations
    const updatedGatePass = await prisma.gatePass.findUnique({
      where: { id: gatePass.id },
      include: {
        flat: true,
        requestedBy: { select: { id: true, name: true, phone: true } },
      },
    });

    return updatedGatePass;
  }

  async getGatePasses(filters: GatePassFilters, caller: GatePassCaller) {
    const { flatId, status, type } = filters;
    const { page, limit, skip } = clampPagination(filters.page, filters.limit);

    const where: Prisma.GatePassWhereInput = { societyId: caller.societyId, ...residentPassScope(caller) };
    if (flatId) where.flatId = flatId;
    if (status) where.status = status;
    if (type) where.type = type;

    const [gatePasses, total] = await Promise.all([
      prisma.gatePass.findMany({
        where,
        include: {
          flat: true,
          requestedBy: { select: { id: true, name: true, phone: true } },
          approvedBy: { select: { id: true, name: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.gatePass.count({ where }),
    ]);

    return {
      gatePasses,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getGatePassById(gatePassId: string, caller: GatePassCaller) {
    const gatePass = await findInSociety(prisma.gatePass, gatePassId, caller.societyId, {
      entity: 'Gate pass',
      where: residentPassScope(caller),
      include: {
        flat: true,
        requestedBy: { select: { id: true, name: true, phone: true } },
        approvedBy: { select: { id: true, name: true, phone: true } },
      },
    });

    return gatePass;
  }

  async getGatePassQR(gatePassId: string, caller: GatePassCaller) {
    const gatePass = await findInSociety(prisma.gatePass, gatePassId, caller.societyId, {
      entity: 'Gate pass',
      where: residentPassScope(caller),
    });

    return {
      qrToken: gatePass.qrToken,
      gatePassId: gatePass.id,
      type: gatePass.type,
      validFrom: gatePass.validFrom,
      validUntil: gatePass.validUntil,
      status: gatePass.status,
    };
  }

  async cancelGatePass(gatePassId: string, userId: string, societyId: string) {
    const gatePass = await findInSociety(prisma.gatePass, gatePassId, societyId, {
      entity: 'Gate pass',
    });

    if (gatePass.requestedById !== userId) {
      throw new AppError('You can only cancel your own gate passes', 403);
    }

    if (gatePass.isUsed) {
      throw new AppError('Cannot cancel a used gate pass', 400);
    }

    const updatedGatePass = await prisma.gatePass.update({
      where: { id: gatePassId },
      data: {
        status: 'EXPIRED',
      },
    });

    return updatedGatePass;
  }
}
