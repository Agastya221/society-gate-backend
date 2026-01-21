import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import { notificationService } from '../notification/notification.service';
import { emitToUser } from '../../utils/socket';
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

export class EntryRequestService {
  /**
   * Create a new entry request (Guard action)
   */
  async createEntryRequest(
    data: CreateEntryRequestData,
    guardId: string
  ): Promise<any> {
    // Get guard's society
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

    // Calculate expiry time (15 minutes from now)
    const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000);

    // Create the entry request
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

    // Send notification to flat residents
    const providerName = data.providerTag || data.type;
    await notificationService.sendToFlat(data.flatId, {
      type: 'ENTRY_REQUEST',
      title: `${providerName} at Gate`,
      message: data.visitorName
        ? `${data.visitorName} (${providerName}) is waiting at the gate`
        : `${providerName} delivery is waiting at the gate`,
      data: { entryRequestId: entryRequest.id },
      referenceId: entryRequest.id,
      referenceType: 'EntryRequest',
      societyId: guard.societyId,
    });

    return entryRequest;
  }

  /**
   * Get entry requests with filters
   */
  async getEntryRequests(
    userId: string,
    filters: {
      status?: EntryRequestStatus;
      flatId?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<{ entryRequests: any[]; pagination: any }> {
    const { status, flatId, page = 1, limit = 20 } = filters;

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, societyId: true, flatId: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const where: any = {};

    // Role-based filtering
    if (user.role === 'GUARD') {
      where.guardId = userId;
    } else if (user.role === 'RESIDENT') {
      where.flatId = user.flatId;
    } else if (user.role === 'ADMIN') {
      where.societyId = user.societyId;
    }

    // Additional filters
    if (status) where.status = status;
    if (flatId && user.role !== 'RESIDENT') where.flatId = flatId;

    const [entryRequests, total] = await Promise.all([
      prisma.entryRequest.findMany({
        where,
        include: {
          flat: { select: { id: true, flatNumber: true } },
          guard: { select: { id: true, name: true } },
          approvedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.entryRequest.count({ where }),
    ]);

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

  /**
   * Get a single entry request by ID
   */
  async getEntryRequestById(entryRequestId: string, userId: string): Promise<any> {
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
        guard: { select: { id: true, name: true, phone: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    });

    if (!entryRequest) {
      throw new AppError('Entry request not found', 404);
    }

    // Get user for access check
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, societyId: true, flatId: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Access check
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

  /**
   * Approve an entry request (Resident action)
   */
  async approveEntryRequest(entryRequestId: string, userId: string): Promise<any> {
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

    // Check if user is a resident of the flat
    const isFlatResident = entryRequest.flat.residents.some((r) => r.id === userId);
    if (!isFlatResident) {
      throw new AppError('Only flat residents can approve entry requests', 403);
    }

    // Check status
    if (entryRequest.status !== 'PENDING') {
      throw new AppError(`Entry request is already ${entryRequest.status.toLowerCase()}`, 400);
    }

    // Check if expired
    if (new Date() > entryRequest.expiresAt) {
      await prisma.entryRequest.update({
        where: { id: entryRequestId },
        data: { status: 'EXPIRED' },
      });
      throw new AppError('Entry request has expired', 400);
    }

    // Create actual Entry record
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

    // Update entry request
    const updatedRequest = await prisma.entryRequest.update({
      where: { id: entryRequestId },
      data: {
        status: 'APPROVED',
        approvedById: userId,
        approvedAt: new Date(),
        entryId: entry.id,
      },
      include: {
        flat: { select: { id: true, flatNumber: true } },
        guard: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    });

    // Notify guard via Socket.IO
    emitToUser(entryRequest.guardId, 'entry-request-status', {
      id: entryRequestId,
      status: 'APPROVED',
      flatNumber: entryRequest.flat.flatNumber,
      approvedBy: updatedRequest.approvedBy?.name,
    });

    return updatedRequest;
  }

  /**
   * Reject an entry request (Resident action)
   */
  async rejectEntryRequest(
    entryRequestId: string,
    userId: string,
    reason?: string
  ): Promise<any> {
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

    // Check if user is a resident of the flat
    const isFlatResident = entryRequest.flat.residents.some((r) => r.id === userId);
    if (!isFlatResident) {
      throw new AppError('Only flat residents can reject entry requests', 403);
    }

    // Check status
    if (entryRequest.status !== 'PENDING') {
      throw new AppError(`Entry request is already ${entryRequest.status.toLowerCase()}`, 400);
    }

    // Update entry request
    const updatedRequest = await prisma.entryRequest.update({
      where: { id: entryRequestId },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
      include: {
        flat: { select: { id: true, flatNumber: true } },
        guard: { select: { id: true, name: true } },
      },
    });

    // Notify guard via Socket.IO
    emitToUser(entryRequest.guardId, 'entry-request-status', {
      id: entryRequestId,
      status: 'REJECTED',
      flatNumber: entryRequest.flat.flatNumber,
      reason,
    });

    return updatedRequest;
  }

  /**
   * Expire pending entry requests (called by cron job)
   */
  async expirePendingRequests(): Promise<{ count: number }> {
    const result = await prisma.entryRequest.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    });

    // Optionally notify guards about expired requests
    if (result.count > 0) {
      console.log(`Auto-expired ${result.count} entry requests`);
    }

    return { count: result.count };
  }

  /**
   * Get pending requests count for a guard
   */
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
