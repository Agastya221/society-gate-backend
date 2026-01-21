import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import { EntryType, EntryStatus } from '../../../prisma/generated/prisma/enums';




interface TodayEntriesStats {
      total: number;
      pending: number;
      approved: number;
      rejected: number;
      checkedOut: number;
      delivery: number;
      visitor: number;
      domesticStaff: number;
    }


export class EntryService {
  async createEntry(data: any, createdById: string) {
    const { flatId, societyId, type, companyName } = data;

    // Check if delivery has auto-approval
    if (type === 'DELIVERY' && companyName) {
      const autoApproval = await this.checkAutoApproval(flatId, companyName);
      
      if (autoApproval) {
        const entry = await prisma.entry.create({
          data: {
            ...data,
            createdById,
            status: 'APPROVED',
            wasAutoApproved: true,
            autoApprovalReason: autoApproval.reason,
            approvedAt: new Date(),
          },
          include: {
            flat: true,
            createdBy: { select: { id: true, name: true, role: true } },
          },
        });

        // TODO: Send notification
        await this.updateVisitorFrequency(flatId, data.visitorPhone, data.visitorName);
        return entry;
      }
    }

    // Check for QR pre-approval with transaction to prevent race conditions
    if (data.preApprovalId) {
      const entry = await prisma.$transaction(async (tx) => {
        const preApproval = await tx.preApproval.findUnique({
          where: { id: data.preApprovalId },
        });

        if (!preApproval || preApproval.status !== 'ACTIVE') {
          throw new AppError('Pre-approval not found or not active', 404);
        }

        // CRITICAL FIX: Use atomic increment with condition to prevent race condition
        // Try to increment usedCount only if it's less than maxUses
        const updatedPreApproval = await tx.preApproval.updateMany({
          where: {
            id: data.preApprovalId,
            usedCount: { lt: preApproval.maxUses },
          },
          data: {
            usedCount: { increment: 1 },
          },
        });

        // If no records were updated, it means max uses has been reached
        if (updatedPreApproval.count === 0) {
          throw new AppError('Pre-approval has reached maximum uses', 400);
        }

        // Create entry atomically
        const newEntry = await tx.entry.create({
          data: {
            ...data,
            createdById,
            status: 'APPROVED',
            approvedAt: new Date(),
          },
          include: {
            flat: true,
            createdBy: true,
          },
        });

        // Update pre-approval status if this was the last use
        const refreshedPreApproval = await tx.preApproval.findUnique({
          where: { id: data.preApprovalId },
        });
        if (refreshedPreApproval && refreshedPreApproval.usedCount >= refreshedPreApproval.maxUses) {
          await tx.preApproval.update({
            where: { id: data.preApprovalId },
            data: { status: 'USED' },
          });
        }

        return newEntry;
      });

      return entry;
    }

    // Regular entry - needs approval
    const entry = await prisma.entry.create({
      data: {
        ...data,
        createdById,
        status: 'PENDING',
      },
      include: {
        flat: true,
        createdBy: true,
      },
    });

    // Update visitor frequency
    if (data.visitorPhone) {
      await this.updateVisitorFrequency(flatId, data.visitorPhone, data.visitorName);
    }

    // TODO: Send notification to resident
    return entry;
  }

  private async checkAutoApproval(flatId: string, companyName: string) {
    // Check expected delivery
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const expectedDelivery = await prisma.expectedDelivery.findFirst({
      where: {
        flatId,
        companyName,
        isUsed: false,
        expectedDate: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    // CRITICAL FIX: Use atomic updateMany to prevent race condition
    if (expectedDelivery && expectedDelivery.autoApprove) {
      const result = await prisma.expectedDelivery.updateMany({
        where: {
          id: expectedDelivery.id,
          isUsed: false, // Only update if still unused
        },
        data: {
          isUsed: true,
          usedAt: new Date(),
        },
      });

      // If count is 0, it means another concurrent request already used it
      if (result.count > 0) {
        return { reason: 'Expected delivery' };
      }
      // Otherwise, fall through to check standing rules
    }

    // Check standing rule
    const now = new Date();
    const currentDay = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][now.getDay()];
    const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"

    const rule = await prisma.deliveryAutoApproveRule.findFirst({
      where: {
        flatId,
        isActive: true,
        companies: { has: companyName },
      },
    });

    if (rule) {
      // Check day restriction
      if (rule.allowedDays.length > 0 && !rule.allowedDays.includes(currentDay)) {
        return null;
      }

      // Check time restriction - FIXED to handle midnight-spanning rules
      if (rule.timeFrom && rule.timeUntil) {
        // Convert time strings to minutes since midnight for proper comparison
        const timeToMinutes = (timeStr: string): number => {
          const [hours, minutes] = timeStr.split(':').map(Number);
          return hours * 60 + minutes;
        };

        const currentMinutes = timeToMinutes(currentTime);
        const fromMinutes = timeToMinutes(rule.timeFrom);
        const untilMinutes = timeToMinutes(rule.timeUntil);

        // Handle midnight wrap-around (e.g., 22:00 to 02:00)
        const isActive =
          untilMinutes < fromMinutes
            ? currentMinutes >= fromMinutes || currentMinutes <= untilMinutes // Spans midnight
            : currentMinutes >= fromMinutes && currentMinutes <= untilMinutes; // Same day

        if (!isActive) {
          return null;
        }
      }

      return { reason: 'Auto-approve rule' };
    }

    return null;
  }

  private async updateVisitorFrequency(flatId: string, visitorPhone: string, visitorName: string) {
    if (!visitorPhone) return;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Find or create visitor frequency record
    const existing = await prisma.visitorFrequency.findUnique({
      where: {
        societyId_flatId_visitorPhone: {
          societyId: (await prisma.flat.findUnique({ where: { id: flatId } }))!.societyId,
          flatId,
          visitorPhone,
        },
      },
    });

    if (existing) {
      const newVisitCount = existing.visitCount + 1;
      const isFrequent = newVisitCount >= 3;

      await prisma.visitorFrequency.update({
        where: { id: existing.id },
        data: {
          visitCount: newVisitCount,
          lastVisit: new Date(),
          isFrequent,
          visitorName, // Update name in case it changed
        },
      });
    } else {
      const flat = await prisma.flat.findUnique({ where: { id: flatId } });
      await prisma.visitorFrequency.create({
        data: {
          flatId,
          societyId: flat!.societyId,
          visitorPhone,
          visitorName,
          visitCount: 1,
          lastVisit: new Date(),
          isFrequent: false,
        },
      });
    }
  }

  async approveEntry(entryId: string, approvedById: string) {
    const entry = await prisma.entry.findUnique({
      where: { id: entryId },
      include: {
        flat: {
          include: {
            residents: { where: { isActive: true, role: 'RESIDENT' } },
          },
        },
      },
    });

    if (!entry) {
      throw new AppError('Entry not found', 404);
    }

    if (entry.status !== 'PENDING') {
      throw new AppError('Entry is not pending approval', 400);
    }

    // CRITICAL FIX: Verify that approver is a resident of the flat
    const isResidentOfFlat = entry.flat.residents.some((r) => r.id === approvedById);
    if (!isResidentOfFlat) {
      throw new AppError('You are not authorized to approve entries for this flat', 403);
    }

    const updatedEntry = await prisma.entry.update({
      where: { id: entryId },
      data: {
        status: 'APPROVED',
        approvedById,
        approvedAt: new Date(),
      },
      include: {
        flat: true,
        createdBy: { select: { id: true, name: true, role: true } },
        approvedBy: { select: { id: true, name: true, role: true } },
      },
    });

    // TODO: Send notification to guard
    return updatedEntry;
  }

  async rejectEntry(entryId: string, reason: string, rejectedById: string) {
    const entry = await prisma.entry.findUnique({
      where: { id: entryId },
      include: {
        flat: {
          include: {
            residents: { where: { isActive: true, role: 'RESIDENT' } },
          },
        },
      },
    });

    if (!entry) {
      throw new AppError('Entry not found', 404);
    }

    if (entry.status !== 'PENDING') {
      throw new AppError('Entry is not pending approval', 400);
    }

    // CRITICAL FIX: Verify that rejecter is a resident of the flat
    const isResidentOfFlat = entry.flat.residents.some((r) => r.id === rejectedById);
    if (!isResidentOfFlat) {
      throw new AppError('You are not authorized to reject entries for this flat', 403);
    }

    const updatedEntry = await prisma.entry.update({
      where: { id: entryId },
      data: {
        status: 'REJECTED',
        approvedById: rejectedById,
        rejectionReason: reason,
      },
      include: {
        flat: true,
        createdBy: { select: { id: true, name: true, role: true } },
        approvedBy: { select: { id: true, name: true, role: true } },
      },
    });

    // TODO: Send notification to guard
    return updatedEntry;
  }

  async checkoutEntry(entryId: string) {
    const entry = await prisma.entry.findUnique({
      where: { id: entryId },
    });

    if (!entry) {
      throw new AppError('Entry not found', 404);
    }

    if (entry.status !== 'APPROVED') {
      throw new AppError('Only approved entries can be checked out', 400);
    }

    if (entry.checkOutTime) {
      throw new AppError('Entry already checked out', 400);
    }

    const updatedEntry = await prisma.entry.update({
      where: { id: entryId },
      data: {
        status: 'CHECKED_OUT',
        checkOutTime: new Date(),
      },
      include: {
        flat: true,
        createdBy: { select: { id: true, name: true, role: true } },
      },
    });

    return updatedEntry;
  }

  async getEntries(filters: any) {
    const { societyId, flatId, status, type, page = 1, limit = 20 } = filters;

    const where: any = { societyId };
    if (flatId) where.flatId = flatId;
    if (status) where.status = status;
    if (type) where.type = type;

    const [entries, total] = await Promise.all([
      prisma.entry.findMany({
        where,
        include: {
          flat: true,
          createdBy: { select: { id: true, name: true, role: true } },
          approvedBy: { select: { id: true, name: true, role: true } },
        },
        orderBy: { checkInTime: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.entry.count({ where }),
    ]);

    return {
      entries,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getPendingEntries(societyId: string, flatId?: string) {
    const where: any = {
      societyId,
      status: 'PENDING',
    };

    if (flatId) where.flatId = flatId;

    const entries = await prisma.entry.findMany({
      where,
      include: {
        flat: true,
        createdBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: { checkInTime: 'desc' },
    });

    return entries;
  }

  async getTodayEntries(societyId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const entries = await prisma.entry.findMany({
      where: {
        societyId,
        checkInTime: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        flat: true,
        createdBy: { select: { id: true, name: true, role: true } },
        approvedBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: { checkInTime: 'desc' },
    });


    const stats: TodayEntriesStats = {
      total: entries.length,
      pending: entries.filter((e: { status?: EntryStatus }) => e.status === 'PENDING').length,
      approved: entries.filter((e: { status?: EntryStatus }) => e.status === 'APPROVED').length,
      rejected: entries.filter((e: { status?: EntryStatus }) => e.status === 'REJECTED').length,
      checkedOut: entries.filter((e: { status?: EntryStatus }) => e.status === 'CHECKED_OUT').length,
      delivery: entries.filter((e: { type?: EntryType }) => e.type === 'DELIVERY').length,
      visitor: entries.filter((e: { type?: EntryType }) => e.type === 'VISITOR').length,
      domesticStaff: entries.filter((e: { type?: EntryType }) => e.type === 'DOMESTIC_STAFF').length,
    };

    return {
      entries,
      stats,
    };
  }

  async getEntryById(entryId: string) {
    const entry = await prisma.entry.findUnique({
      where: { id: entryId },
      include: {
        flat: true,
        createdBy: { select: { id: true, name: true, role: true } },
        approvedBy: { select: { id: true, name: true, role: true } },
        domesticStaff: true,
      },
    });

    if (!entry) {
      throw new AppError('Entry not found', 404);
    }

    return entry;
  }
}