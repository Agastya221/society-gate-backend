import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import { eventBus } from '../../utils/eventBus';
import { emitToUser, SOCKET_EVENTS } from '../../utils/socket';
import { notificationService } from '../notification/notification.service';
import logger from '../../utils/logger';
import type { Prisma } from '../../types';
import {
  EntryType,
  EntryRequestStatus,
  ProviderTag,
} from '../../../prisma/generated/prisma/enums';

const EXPIRY_MINUTES = 15;

// Map ProviderTag enum → human readable company name
// Must match what residents store in DeliveryAutoApproveRule.companies
// and ExpectedDelivery.companyName
const PROVIDER_TAG_TO_COMPANY: Record<string, string> = {
  BLINKIT: 'Blinkit',
  SWIGGY: 'Swiggy',
  ZOMATO: 'Zomato',
  AMAZON: 'Amazon',
  FLIPKART: 'Flipkart',
  BIGBASKET: 'BigBasket',
  DUNZO: 'Dunzo',
  OTHER: 'Other',
};

interface CreateEntryRequestData {
  type: EntryType;
  flatId: string;
  visitorName?: string;
  visitorPhone?: string;
  providerTag?: ProviderTag;
  photoKey?: string;
}

// Discriminated union — controller handles both cases explicitly
export type CreateEntryRequestResult =
  | {
      autoApproved: false;
      entryRequest: Awaited<ReturnType<typeof prisma.entryRequest.findUniqueOrThrow>>;
    }
  | {
      autoApproved: true;
      reason: 'STANDING_RULE' | 'EXPECTED_DELIVERY';
      entry: Awaited<ReturnType<typeof prisma.entry.findUniqueOrThrow>>;
    };

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
  ): Promise<CreateEntryRequestResult> {
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
    // AUTO-APPROVAL DECISION ENGINE
    // Only runs for DELIVERY type with a known provider tag
    // ============================================
    if (data.type === 'DELIVERY' && data.providerTag) {
      const autoResult = await this.checkDeliveryAutoApproval(
        data.flatId,
        data.providerTag
      );

      if (autoResult) {
        // Create entry directly — no pending state, no resident interruption
        const entry = await prisma.entry.create({
          data: {
            type: 'DELIVERY',
            status: 'APPROVED',
            visitorName:
              data.visitorName ||
              PROVIDER_TAG_TO_COMPANY[data.providerTag] ||
              'Delivery',
            visitorPhone: data.visitorPhone,
            companyName:
              PROVIDER_TAG_TO_COMPANY[data.providerTag] || data.providerTag,
            visitorPhoto: data.photoKey,
            flatId: data.flatId,
            societyId: guard.societyId,
            createdById: guardId,
            wasAutoApproved: true,
            autoApprovalReason: autoResult.reason,
            approvedAt: new Date(),
            checkInTime: new Date(),
          },
        });

        // Mark expected delivery as used so it can't match again
        if (autoResult.expectedDeliveryId) {
          await prisma.expectedDelivery.update({
            where: { id: autoResult.expectedDeliveryId },
            data: { isUsed: true, usedAt: new Date() },
          });
        }

        // Notify resident AFTER entry — informational, not approval request
        // "Your Amazon delivery entered at 2:04 PM"
        await this.notifyResidentAfterAutoApproval(
          data.flatId,
          guard.societyId,
          data.providerTag,
          data.visitorName,
          entry.id
        );

        logger.info(
          {
            entryId: entry.id,
            flatId: data.flatId,
            providerTag: data.providerTag,
            reason: autoResult.reason,
          },
          'Delivery auto-approved'
        );

        return {
          autoApproved: true,
          reason: autoResult.matchType,
          entry,
        };
      }
    }

    // ============================================
    // TIER 3 — No auto-approval match
    // Create PENDING request, notify resident for manual approval
    // Resident has 15 minutes to respond via app before it expires
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
      visitorName: data.visitorName,
      providerTag: data.providerTag,
      type: data.type,
    });

    return {
      autoApproved: false,
      entryRequest,
    };
  }

  // ============================================
  // AUTO-APPROVAL DECISION ENGINE (private)
  // Priority: Standing rule → Expected delivery → null
  // ============================================
  private async checkDeliveryAutoApproval(
    flatId: string,
    providerTag: string
  ): Promise<{
    reason: string;
    matchType: 'STANDING_RULE' | 'EXPECTED_DELIVERY';
    expectedDeliveryId?: string;
  } | null> {
    const now = new Date();

    // Current day: "MONDAY", "TUESDAY" etc — matches DB format
    const currentDay = now
      .toLocaleDateString('en-US', { weekday: 'long' })
      .toUpperCase();

    // Current time as HH:MM for string comparison
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;

    // Human readable name ("Amazon") to match what residents store
    const companyName = PROVIDER_TAG_TO_COMPANY[providerTag] || providerTag;

    // ---- Tier 1: Standing auto-approve rules ----
    const rules = await prisma.deliveryAutoApproveRule.findMany({
      where: { flatId, isActive: true },
    });

    for (const rule of rules) {
      // Case-insensitive match against either "Amazon" or "AMAZON"
      const companyMatch = rule.companies.some(
        (c) =>
          c.toLowerCase() === companyName.toLowerCase() ||
          c.toLowerCase() === providerTag.toLowerCase()
      );
      if (!companyMatch) continue;

      // Empty allowedDays = all days
      const dayMatch =
        rule.allowedDays.length === 0 || rule.allowedDays.includes(currentDay);
      if (!dayMatch) continue;

      // Missing time boundary = unrestricted
      const afterStart = !rule.timeFrom || currentTime >= rule.timeFrom;
      const beforeEnd = !rule.timeUntil || currentTime <= rule.timeUntil;

      if (afterStart && beforeEnd) {
        const window = rule.timeFrom
          ? `${rule.timeFrom}–${rule.timeUntil || '23:59'}`
          : 'anytime';
        return {
          reason: `Auto-approved by standing rule for ${companyName} (${window})`,
          matchType: 'STANDING_RULE',
        };
      }
    }

    // ---- Tier 2: Expected delivery ----
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const expectedDeliveries = await prisma.expectedDelivery.findMany({
      where: {
        flatId,
        isUsed: false,
        expiresAt: { gt: now },
        expectedDate: { gte: startOfDay, lte: endOfDay },
      },
    });

    for (const expected of expectedDeliveries) {
      const companyMatch =
        expected.companyName.toLowerCase() === companyName.toLowerCase() ||
        expected.companyName.toLowerCase() === providerTag.toLowerCase();
      if (!companyMatch) continue;

      const afterStart = !expected.timeFrom || currentTime >= expected.timeFrom;
      const beforeEnd = !expected.timeUntil || currentTime <= expected.timeUntil;

      if (afterStart && beforeEnd) {
        return {
          reason: `Matched expected delivery from ${expected.companyName}`,
          matchType: 'EXPECTED_DELIVERY',
          expectedDeliveryId: expected.id,
        };
      }
    }

    return null;
  }

  // ============================================
  // NOTIFY RESIDENT AFTER AUTO-APPROVAL (private)
  // Informational only — "Your delivery entered at X"
  // Non-critical: failure is logged but never blocks the entry
  // ============================================
  private async notifyResidentAfterAutoApproval(
    flatId: string,
    societyId: string,
    providerTag: string,
    visitorName: string | undefined,
    entryId: string
  ): Promise<void> {
    try {
      const companyName = PROVIDER_TAG_TO_COMPANY[providerTag] || providerTag;
      const displayName = visitorName
        ? `${visitorName} (${companyName})`
        : companyName;

      const timeStr = new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      await notificationService.sendToFlat(flatId, {
        type: 'DELIVERY_REQUEST',
        title: `${companyName} Delivery Entered`,
        message: `${displayName} was auto-approved and entered at ${timeStr}`,
        data: { entryId },
        referenceId: entryId,
        referenceType: 'Entry',
        societyId,
      });
    } catch (error) {
      logger.error(
        { error, flatId, providerTag },
        'Failed to send auto-approval notification to resident'
      );
    }
  }

  // ============================================
  // GET ENTRY REQUESTS (unchanged)
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
      where.guardId = userId;
    } else if (user.role === 'RESIDENT') {
      if (user.flatId) where.flatId = user.flatId;
    } else if (user.role === 'ADMIN') {
      if (user.societyId) where.societyId = user.societyId;
    }

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
        flat: { select: { id: true, flatNumber: true } },
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

    emitToUser(entryRequest.guardId, SOCKET_EVENTS.ENTRY_REQUEST_STATUS, {
      id: entryRequestId,
      status: 'REJECTED',
      flatNumber: entryRequest.flat.flatNumber,
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
