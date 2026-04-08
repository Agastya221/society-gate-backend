import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import type { Prisma } from '../../types';
import type { SubscriptionCycle } from '../../../prisma/generated/prisma/enums';

function nextDueDateFromCycle(from: Date, cycle: SubscriptionCycle): Date {
  const d = new Date(from);
  switch (cycle) {
    case 'QUARTERLY': d.setMonth(d.getMonth() + 3); break;
    case 'ANNUALLY':  d.setFullYear(d.getFullYear() + 1); break;
    case 'MONTHLY':
    default:          d.setMonth(d.getMonth() + 1); break;
  }
  return d;
}

export class SocietyService {
  async createSociety(data: Omit<Prisma.SocietyUncheckedCreateInput, 'nextDueDate' | 'isActive'>) {
    const cycle = (data.subscriptionCycle as SubscriptionCycle | undefined) ?? 'MONTHLY';
    const nextDueDate = nextDueDateFromCycle(new Date(), cycle);

    const society = await prisma.society.create({
      data: {
        ...data,
        nextDueDate,
        isActive: true,
      },
    });

    // Create default main gate
    await prisma.gatePoint.create({
      data: {
        name: 'Main Gate',
        societyId: society.id,
      },
    });

    // Create Admin Office block + flat for outside admins/society managers
    const adminBlock = await prisma.block.create({
      data: {
        name: 'Admin',
        societyId: society.id,
        description: 'Virtual block for society management office',
      },
    });
    await prisma.flat.create({
      data: {
        flatNumber: 'OFFICE',
        blockId: adminBlock.id,
        societyId: society.id,
        isOccupied: false,
      },
    });

    return society;
  }

  async getSocieties(filters?: { city?: string; isActive?: boolean; page?: number; limit?: number }) {
    const { city, isActive, page = 1, limit = 20 } = filters || {};

    const where: Prisma.SocietyWhereInput = {};
    if (city) where.city = city;
    if (isActive !== undefined) where.isActive = isActive;

    const [societies, total] = await Promise.all([
      prisma.society.findMany({
        where,
        include: {
          _count: {
            select: {
              users: true,
              flats: true,
              entries: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.society.count({ where }),
    ]);

    return {
      societies,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getSocietyById(societyId: string) {
    const society = await prisma.society.findUnique({
      where: { id: societyId },
      include: {
        gatePoints: true,
        _count: {
          select: {
            users: true,
            flats: true,
            entries: true,
          },
        },
      },
    });

    if (!society) {
      throw new AppError('Society not found', 404);
    }

    return society;
  }

  async updateSociety(societyId: string, data: Prisma.SocietyUpdateInput) {
    const society = await prisma.society.update({
      where: { id: societyId },
      data,
    });

    return society;
  }

  async markPaymentPaid(societyId: string) {
    const today = new Date();
    const existing = await prisma.society.findUnique({
      where: { id: societyId },
      select: { subscriptionCycle: true },
    });
    if (!existing) throw new AppError('Society not found', 404);
    const nextDueDate = nextDueDateFromCycle(today, existing.subscriptionCycle);

    const society = await prisma.society.update({
      where: { id: societyId },
      data: {
        lastPaidDate: today,
        nextDueDate,
        paymentStatus: 'PAID',
        isActive: true,
      },
    });

    // Create payment reminder record
    await prisma.paymentReminder.create({
      data: {
        societyId,
        dueDate: nextDueDate,
        amount: society.monthlyFee,
        isPaid: true,
        paidAt: today,
      },
    });

    return society;
  }

  async getSocietyStats(societyId: string) {
    const [
      totalFlats,
      totalResidents,
      totalGuards,
      totalDomesticStaff,
      todayEntries,
      pendingEntries,
    ] = await Promise.all([
      prisma.flat.count({ where: { societyId } }),
      prisma.user.count({ where: { societyId, role: 'RESIDENT' } }),
      prisma.user.count({ where: { societyId, role: 'GUARD' } }),
      prisma.domesticStaff.count({ where: { isActive: true } }),
      prisma.entry.count({
        where: {
          societyId,
          checkInTime: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      prisma.entry.count({
        where: {
          societyId,
          status: 'PENDING',
        },
      }),
    ]);

    return {
      totalFlats,
      totalResidents,
      totalGuards,
      totalDomesticStaff,
      todayEntries,
      pendingEntries,
    };
  }
}