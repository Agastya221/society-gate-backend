import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import { generateQRToken, generateQRImage, verifyQRToken } from '../../utils/QrGenerate';
import { VisitorType } from '../../../prisma/generated/prisma/enums';
import {
  validatePhoneNumber,
  validateDateRange,
  validateFutureDate,
  validateRequiredFields,
  sanitizeString,
} from '../../utils/validation';

export class PreApprovalService {
  // ============================================
  // CREATE PRE-APPROVAL WITH QR CODE
  // ============================================
  async createPreApproval(
    data: {
      visitorName: string;
      visitorPhone: string;
      visitorType: VisitorType;
      purpose?: string;
      vehicleNumber?: string;
      validFrom: Date;
      validUntil: Date;
      maxUses?: number;
    },
    userId: string
  ) {
    // Validate required fields
    validateRequiredFields(data, ['visitorName', 'visitorPhone', 'visitorType', 'validFrom', 'validUntil'], 'Pre-approval');

    // Validate phone number
    validatePhoneNumber(data.visitorPhone, 'Visitor phone');

    // Sanitize name
    const visitorName = sanitizeString(data.visitorName);

    // Validate dates using validation utility
    const validFrom = new Date(data.validFrom);
    const validUntil = new Date(data.validUntil);
    validateDateRange(validFrom, validUntil, { start: 'Valid from', end: 'Valid until' });
    validateFutureDate(validUntil, 'Valid until');

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { flat: true, society: true },
    });

    if (!user || user.role !== 'RESIDENT') {
      throw new AppError('Only residents can create pre-approvals', 403);
    }

    if (!user.flatId) {
      throw new AppError('User must have a flat assigned', 400);
    }

    // Generate unique QR token
    const qrTokenPayload = {
      type: 'PRE_APPROVAL',
      visitorPhone: data.visitorPhone,
      visitorName: visitorName,
      flatId: user.flatId,
      societyId: user.societyId,
      createdAt: new Date().toISOString(),
    };

    const qrToken = generateQRToken(qrTokenPayload, '90d'); // 90 days max

    // Generate QR code image
    const qrCodeImage = await generateQRImage(qrToken);

    // Create pre-approval
    const preApproval = await prisma.preApproval.create({
      data: {
        visitorName: visitorName,
        visitorPhone: data.visitorPhone,
        visitorType: data.visitorType,
        purpose: data.purpose,
        vehicleNumber: data.vehicleNumber,
        qrToken,
        validFrom,
        validUntil,
        maxUses: data.maxUses || 1,
        usedCount: 0,
        status: 'ACTIVE',
        flatId: user.flatId,
        societyId: user.societyId as string,
        createdById: userId,
      },
      include: {
        flat: {
          select: {
            flatNumber: true,
            block: true,
            floor: true,
          },
        },
        society: {
          select: {
            name: true,
            address: true,
          },
        },
      },
    });

    return {
      preApproval,
      qrCodeImage,
      qrToken,
    };
  }

  // ============================================
  // GET PRE-APPROVALS (Resident)
  // ============================================
  async getPreApprovals(userId: string, filters?: { status?: string }) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.flatId) {
      throw new AppError('User must have a flat assigned', 400);
    }

    const where: any = {
      flatId: user.flatId,
    };

    if (filters?.status) {
      where.status = filters.status;
    }

    const preApprovals = await prisma.preApproval.findMany({
      where,
      include: {
        flat: {
          select: {
            flatNumber: true,
          },
        },
        entries: {
          select: {
            id: true,
            checkInTime: true,
            checkOutTime: true,
          },
          orderBy: {
            checkInTime: 'desc',
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return preApprovals;
  }

  // ============================================
  // GET PRE-APPROVAL QR CODE
  // ============================================
  async getPreApprovalQR(preApprovalId: string, userId: string) {
    const preApproval = await prisma.preApproval.findUnique({
      where: { id: preApprovalId },
      include: {
        flat: true,
      },
    });

    if (!preApproval) {
      throw new AppError('Pre-approval not found', 404);
    }

    // Verify user owns this pre-approval
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.flatId !== preApproval.flatId) {
      throw new AppError('You can only access QR codes for your own pre-approvals', 403);
    }

    // Regenerate QR image from token
    const qrCodeImage = await generateQRImage(preApproval.qrToken);

    return {
      preApproval,
      qrCodeImage,
      qrToken: preApproval.qrToken,
    };
  }

  // ============================================
  // CANCEL PRE-APPROVAL
  // ============================================
  async cancelPreApproval(preApprovalId: string, userId: string) {
    const preApproval = await prisma.preApproval.findUnique({
      where: { id: preApprovalId },
    });

    if (!preApproval) {
      throw new AppError('Pre-approval not found', 404);
    }

    if (preApproval.createdById !== userId) {
      throw new AppError('You can only cancel your own pre-approvals', 403);
    }

    if (preApproval.status === 'CANCELLED') {
      throw new AppError('Pre-approval already cancelled', 400);
    }

    const updated = await prisma.preApproval.update({
      where: { id: preApprovalId },
      data: { status: 'CANCELLED' },
    });

    return updated;
  }

  // ============================================
  // SCAN PRE-APPROVAL QR CODE (Guard)
  // ============================================
  async scanPreApprovalQR(qrToken: string, guardId: string) {
    const guard = await prisma.user.findUnique({
      where: { id: guardId },
    });

    if (!guard || guard.role !== 'GUARD') {
      throw new AppError('Only guards can scan QR codes', 403);
    }

    // Verify QR token

    let decoded: any;

    try {
      decoded = verifyQRToken(qrToken);
    } catch (error: any) {
      throw new AppError(error.message, 400);
    }

    if (typeof decoded !== 'object' || decoded.type !== 'PRE_APPROVAL') {
      throw new AppError('This is not a pre-approval QR code', 400);
    }

    // Find pre-approval
    const preApproval = await prisma.preApproval.findUnique({
      where: { qrToken },
      include: {
        flat: true,
        createdBy: {
          select: {
            name: true,
            phone: true,
          },
        },
      },
    });

    if (!preApproval) {
      throw new AppError('Pre-approval not found', 404);
    }

    // Validate society match
    if (preApproval.societyId !== guard.societyId) {
      throw new AppError('This pre-approval belongs to a different society', 403);
    }

    // Check status
    if (preApproval.status === 'CANCELLED') {
      throw new AppError('Pre-approval has been cancelled by resident', 400);
    }

    if (preApproval.status === 'USED') {
      throw new AppError('Pre-approval has been fully used', 400);
    }

    if (preApproval.status === 'EXPIRED') {
      throw new AppError('Pre-approval has expired', 400);
    }

    // Check validity period
    const now = new Date();
    
    if (now < preApproval.validFrom) {
      throw new AppError(
        `Pre-approval is not yet valid. Valid from: ${preApproval.validFrom.toLocaleString()}`,
        400
      );
    }

    if (now > preApproval.validUntil) {
      await prisma.preApproval.update({
        where: { id: preApproval.id },
        data: { status: 'EXPIRED' },
      });
      throw new AppError('Pre-approval has expired', 400);
    }

    // Check max uses
    if (preApproval.usedCount >= preApproval.maxUses) {
      await prisma.preApproval.update({
        where: { id: preApproval.id },
        data: { status: 'USED' },
      });
      throw new AppError('Pre-approval has reached maximum uses', 400);
    }

    // Create entry with pre-approval
    const entry = await prisma.entry.create({
      data: {
        type: 'VISITOR',
        status: 'APPROVED',
        visitorName: preApproval.visitorName,
        visitorPhone: preApproval.visitorPhone,
        visitorType: preApproval.visitorType,
        purpose: preApproval.purpose,
        vehicleNumber: preApproval.vehicleNumber,
        flatId: preApproval.flatId,
        societyId: preApproval.societyId,
        preApprovalId: preApproval.id,
        createdById: guardId,
        wasAutoApproved: true,
        autoApprovalReason: 'Pre-approved by resident',
        approvedAt: new Date(),
        checkInTime: new Date(),
      },
      include: {
        flat: true,
      },
    });

    // CRITICAL FIX: Use atomic increment with condition to prevent race condition
    const updateResult = await prisma.preApproval.updateMany({
      where: {
        id: preApproval.id,
        usedCount: { lt: preApproval.maxUses }, // Only update if still below max
      },
      data: {
        usedCount: { increment: 1 },
      },
    });

    // If no records updated, max uses has been reached
    if (updateResult.count === 0) {
      throw new AppError('Pre-approval has reached maximum uses', 400);
    }

    // Get updated pre-approval to check if status needs to change
    const updatedPreApproval = await prisma.preApproval.findUnique({
      where: { id: preApproval.id },
    });

    // Update status to USED if this was the last use
    if (updatedPreApproval && updatedPreApproval.usedCount >= updatedPreApproval.maxUses) {
      await prisma.preApproval.update({
        where: { id: preApproval.id },
        data: { status: 'USED' },
      });
    }

    const updatedUsedCount = updatedPreApproval?.usedCount || preApproval.usedCount + 1;

    return {
      entry,
      preApproval: {
        visitorName: preApproval.visitorName,
        flatNumber: preApproval.flat.flatNumber,
        usedCount: updatedUsedCount,
        maxUses: preApproval.maxUses,
        remainingUses: preApproval.maxUses - updatedUsedCount,
        createdBy: preApproval.createdBy.name,
      },
    };
  }
}