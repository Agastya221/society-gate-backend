import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';

export class SocietyService {
  async createSociety(data: any) {
    // Set next due date (30 days from now)
    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + 30);

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

    return society;
  }

  async getSocieties(filters?: any) {
    const { city, isActive, page = 1, limit = 20 } = filters || {};

    const where: any = {};
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

  async updateSociety(societyId: string, data: any) {
    const society = await prisma.society.update({
      where: { id: societyId },
      data,
    });

    return society;
  }

  async markPaymentPaid(societyId: string) {
    const today = new Date();
    const nextDueDate = new Date(today);
    nextDueDate.setDate(nextDueDate.getDate() + 30);

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