import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import { generateQRToken } from '../../utils/QrGenerate';
import { GatePassType, GatePassStatus } from '../../../prisma/generated/prisma/enums';
import {
  validateDateRange,
  validateFutureDate,
  validateRequiredFields,
  sanitizeString,
} from '../../utils/validation';

export class GatePassService {
  async createGatePass(data: any, requestedById: string) {
    // Get user info to determine flatId and societyId
    const user = await prisma.user.findUnique({
      where: { id: requestedById },
      include: { flat: true, society: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (!user.flatId || !user.societyId) {
      throw new AppError('User must have a flat and society assigned', 400);
    }

    const flatId = data.flatId || user.flatId;
    const societyId = data.societyId || user.societyId;

    // Verify flat belongs to society
    const flat = await prisma.flat.findUnique({
      where: { id: flatId },
      include: { society: true },
    });

    if (!flat || flat.societyId !== societyId) {
      throw new AppError('Invalid flat or society', 400);
    }

    // Generate QR token
    const qrToken = await generateQRToken({
      type: 'gatepass',
      flatId,
      societyId,
      passType: data.type,
    });

    const gatePass = await prisma.gatePass.create({
      data: {
        ...data,
        flatId,
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

  async approveGatePass(gatePassId: string, approvedById: string) {
    const gatePass = await prisma.gatePass.findUnique({
      where: { id: gatePassId },
    });

    if (!gatePass) {
      throw new AppError('Gate pass not found', 404);
    }

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

  async rejectGatePass(gatePassId: string, reason: string, approvedById: string) {
    const gatePass = await prisma.gatePass.findUnique({
      where: { id: gatePassId },
    });

    if (!gatePass) {
      throw new AppError('Gate pass not found', 404);
    }

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

  async scanGatePass(qrToken: string, guardId: string) {
    const gatePass = await prisma.gatePass.findUnique({
      where: { qrToken },
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

  async getGatePasses(filters: any) {
    const { societyId, flatId, status, type, page = 1, limit = 20 } = filters;

    const where: any = { societyId };
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
        skip: (page - 1) * limit,
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

  async getGatePassById(gatePassId: string) {
    const gatePass = await prisma.gatePass.findUnique({
      where: { id: gatePassId },
      include: {
        flat: true,
        requestedBy: { select: { id: true, name: true, phone: true } },
        approvedBy: { select: { id: true, name: true, phone: true } },
      },
    });

    if (!gatePass) {
      throw new AppError('Gate pass not found', 404);
    }

    return gatePass;
  }

  async getGatePassQR(gatePassId: string) {
    const gatePass = await prisma.gatePass.findUnique({
      where: { id: gatePassId },
    });

    if (!gatePass) {
      throw new AppError('Gate pass not found', 404);
    }

    return {
      qrToken: gatePass.qrToken,
      gatePassId: gatePass.id,
      type: gatePass.type,
      validFrom: gatePass.validFrom,
      validUntil: gatePass.validUntil,
      status: gatePass.status,
    };
  }

  async cancelGatePass(gatePassId: string, userId: string) {
    const gatePass = await prisma.gatePass.findUnique({
      where: { id: gatePassId },
    });

    if (!gatePass) {
      throw new AppError('Gate pass not found', 404);
    }

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
