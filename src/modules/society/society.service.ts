import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import type { AuthenticatedUser, Prisma } from '../../types';
import type { SubscriptionCycle } from '../../../prisma/generated/prisma/enums';
import { clampPagination } from '../../utils/scope';
import type { z } from 'zod';
import type {
  adminUpdateSocietySchema,
  superAdminUpdateSocietySchema,
  createSocietySchema,
} from './society.schemas';

type SocietyUpdateData =
  | z.infer<typeof adminUpdateSocietySchema>
  | z.infer<typeof superAdminUpdateSocietySchema>;

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
  private assertCanManageSociety(user: AuthenticatedUser, societyId: string) {
    if (user.role === 'SUPER_ADMIN') return;
    if (user.role === 'ADMIN' && user.societyId === societyId) return;
    throw new AppError('You can manage flats only for your active society', 403);
  }

  async createSociety(data: z.infer<typeof createSocietySchema>) {
    const cycle = (data.subscriptionCycle as SubscriptionCycle | undefined) ?? 'MONTHLY';
    const nextDueDate = nextDueDateFromCycle(new Date(), cycle);

    const society = await prisma.society.create({
      data: {
        ...(data as Omit<Prisma.SocietyCreateInput, 'nextDueDate' | 'isActive'>),
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

  async createBlock(
    societyId: string,
    data: { name: string; totalFloors?: number; description?: string },
    user: AuthenticatedUser
  ) {
    this.assertCanManageSociety(user, societyId);

    const name = data.name?.trim();
    if (!name) throw new AppError('Block name is required', 400);

    const society = await prisma.society.findUnique({ where: { id: societyId }, select: { id: true } });
    if (!society) throw new AppError('Society not found', 404);

    return prisma.block.create({
      data: {
        societyId,
        name,
        totalFloors: data.totalFloors,
        description: data.description?.trim() || undefined,
      },
    });
  }

  private async findOrCreateBlock(societyId: string, blockName: string) {
    const name = blockName.trim();
    if (!name) throw new AppError('Block name is required', 400);

    const existing = await prisma.block.findUnique({
      where: { societyId_name: { societyId, name } },
    });

    if (existing) return existing;

    return prisma.block.create({
      data: { societyId, name },
    });
  }

  async createFlat(
    societyId: string,
    data: {
      blockName: string;
      flatNumber: string;
      floor?: string;
      ownerName?: string;
      ownerPhone?: string;
      ownerEmail?: string;
    },
    user: AuthenticatedUser
  ) {
    this.assertCanManageSociety(user, societyId);

    const society = await prisma.society.findUnique({ where: { id: societyId }, select: { id: true } });
    if (!society) throw new AppError('Society not found', 404);

    const flatNumber = data.flatNumber?.trim();
    if (!flatNumber) throw new AppError('Flat number is required', 400);

    const block = await this.findOrCreateBlock(societyId, data.blockName);

    return prisma.flat.create({
      data: {
        societyId,
        blockId: block.id,
        flatNumber,
        floor: data.floor?.trim() || undefined,
        ownerName: data.ownerName?.trim() || undefined,
        ownerPhone: data.ownerPhone?.trim() || undefined,
        ownerEmail: data.ownerEmail?.trim() || undefined,
      },
      include: { block: true },
    });
  }

  async updateFlat(
    societyId: string,
    flatId: string,
    data: {
      blockName?: string;
      flatNumber?: string;
      floor?: string;
      ownerName?: string;
      ownerPhone?: string;
      ownerEmail?: string;
      isActive?: boolean;
    },
    user: AuthenticatedUser
  ) {
    this.assertCanManageSociety(user, societyId);

    const flat = await prisma.flat.findFirst({ where: { id: flatId, societyId } });
    if (!flat) throw new AppError('Flat not found', 404);

    const block = data.blockName ? await this.findOrCreateBlock(societyId, data.blockName) : null;

    return prisma.flat.update({
      where: { id: flatId },
      data: {
        blockId: block?.id,
        flatNumber: data.flatNumber?.trim(),
        floor: data.floor?.trim() || undefined,
        ownerName: data.ownerName?.trim() || undefined,
        ownerPhone: data.ownerPhone?.trim() || undefined,
        ownerEmail: data.ownerEmail?.trim() || undefined,
        isActive: data.isActive,
      },
      include: { block: true },
    });
  }

  async deactivateFlat(societyId: string, flatId: string, user: AuthenticatedUser) {
    this.assertCanManageSociety(user, societyId);

    const flat = await prisma.flat.findFirst({ where: { id: flatId, societyId } });
    if (!flat) throw new AppError('Flat not found', 404);

    return prisma.flat.update({
      where: { id: flatId },
      data: { isActive: false },
      include: { block: true },
    });
  }

  async getSocieties(filters?: { city?: string; isActive?: boolean; page?: unknown; limit?: unknown }) {
    const { city, isActive } = filters || {};
    const { page, limit, skip } = clampPagination(filters?.page, filters?.limit, 20);

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
        skip,
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

  async updateSociety(societyId: string, data: SocietyUpdateData) {
    if (Object.keys(data).length === 0) {
      throw new AppError('No valid society fields provided for update', 400);
    }

    const existing = await prisma.society.findUnique({ where: { id: societyId }, select: { id: true } });
    if (!existing) throw new AppError('Society not found', 404);

    const society = await prisma.society.update({
      where: { id: societyId },
      data: data as Prisma.SocietyUpdateInput,
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
      prisma.domesticStaff.count({ where: { societyId, isActive: true } }),
      prisma.entry.count({
        where: {
          societyId,
          checkInTime: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      // Visitors waiting for a resident are PENDING gate requests, not Entries
      prisma.entryRequest.count({
        where: {
          societyId,
          status: 'PENDING',
          expiresAt: { gt: new Date() },
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
