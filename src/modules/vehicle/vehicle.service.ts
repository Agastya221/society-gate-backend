import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import { findInSociety } from '../../utils/scope';
import type { Prisma, VehicleStatus } from '../../types';

export class VehicleService {
  // ============================================
  // RESIDENT — own vehicles
  // ============================================

  async registerVehicle(data: {
    vehicleNumber: string;
    vehicleType: string;
    model?: string | null;
    color?: string | null;
  }, userId: string, flatId: string | null, societyId: string, creatorRole?: string) {
    const vehicleNumber = data.vehicleNumber.toUpperCase().replace(/\s/g, '');

    const existing = await prisma.vehicle.findUnique({
      where: { societyId_vehicleNumber: { societyId, vehicleNumber } },
    });

    if (existing) {
      throw new AppError('Vehicle with this number is already registered in your society', 400);
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        vehicleNumber,
        vehicleType: data.vehicleType,
        model: data.model ?? null,
        color: data.color ?? null,
        userId,
        flatId,
        societyId,
        // Resident registrations wait for admin verification; admins' own are trusted
        status: creatorRole === 'ADMIN' || creatorRole === 'SUPER_ADMIN' ? 'ACTIVE' : 'PENDING',
      },
      include: {
        flat: { select: { flatNumber: true, block: { select: { name: true } } } },
      },
    });

    return vehicle;
  }

  async getMyVehicles(userId: string) {
    const vehicles = await prisma.vehicle.findMany({
      where: { userId, isActive: true },
      include: {
        flat: { select: { flatNumber: true, block: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return vehicles;
  }

  async updateVehicle(vehicleId: string, data: {
    model?: string | null;
    color?: string | null;
  }, userId: string, societyId: string) {
    const vehicle = await findInSociety(prisma.vehicle, vehicleId, societyId, { entity: 'Vehicle' });
    if (vehicle.userId !== userId) throw new AppError('You can only update your own vehicles', 403);

    return prisma.vehicle.update({
      where: { id: vehicleId },
      data: { model: data.model, color: data.color },
    });
  }

  async deleteVehicle(vehicleId: string, userId: string, societyId: string) {
    const vehicle = await findInSociety(prisma.vehicle, vehicleId, societyId, { entity: 'Vehicle' });
    if (vehicle.userId !== userId) throw new AppError('You can only remove your own vehicles', 403);

    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { isActive: false },
    });

    return { message: 'Vehicle removed successfully' };
  }

  // ============================================
  // ADMIN — all society vehicles
  // ============================================

  async getAllVehicles(filters: {
    societyId: string;
    status?: VehicleStatus;
    vehicleType?: string;
    flatId?: string;
    page?: number;
    limit?: number;
  }) {
    const { societyId, status, vehicleType, flatId, page = 1, limit = 20 } = filters;

    const where: Prisma.VehicleWhereInput = { societyId, isActive: true };
    if (status) where.status = status;
    if (vehicleType) where.vehicleType = vehicleType;
    if (flatId) where.flatId = flatId;

    const [vehicles, total] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, phone: true } },
          flat: { select: { flatNumber: true, block: { select: { name: true } } } },
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.vehicle.count({ where }),
    ]);

    return {
      vehicles,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async approveVehicle(vehicleId: string, data: {
    status: 'ACTIVE' | 'REJECTED';
    parkingSlot?: string | null;
    stickerNumber?: string | null;
    rejectionNote?: string | null;
    reason?: string | null;
  }, societyId?: string | null) {
    if (data.status !== 'ACTIVE' && data.status !== 'REJECTED') {
      throw new AppError("status must be 'ACTIVE' or 'REJECTED'", 400);
    }
    // societyId is null only for a SUPER_ADMIN with no society context (any society)
    if (societyId) {
      await findInSociety(prisma.vehicle, vehicleId, societyId, { select: { id: true }, entity: 'Vehicle' });
    } else {
      const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true } });
      if (!vehicle) throw new AppError('Vehicle not found', 404);
    }

    return prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        status: data.status,
        parkingSlot: data.parkingSlot,
        stickerNumber: data.stickerNumber,
        // `reason` accepted as an alias of rejectionNote; cleared on approval
        rejectionNote: data.status === 'REJECTED' ? (data.rejectionNote ?? data.reason ?? null) : null,
      },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        flat: { select: { flatNumber: true, block: { select: { name: true } } } },
      },
    });
  }

  // ============================================
  // VEHICLE SEARCH (by plate number) — status-aware
  // Accepts vehicleNumber, q, or plateNumber param.
  // Returns found:true + status for any registered vehicle,
  // found:false only when no record exists in the society.
  // ============================================

  async searchVehicle(query: string, societyId: string) {
    const normalized = query.toUpperCase().replace(/\s/g, '');

    const vehicle = await prisma.vehicle.findFirst({
      where: {
        societyId,
        vehicleNumber: { contains: normalized, mode: 'insensitive' },
        isActive: true,
      },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        flat: { select: { flatNumber: true, block: { select: { name: true } } } },
      },
    });

    if (!vehicle) {
      return { found: false, vehicle: null };
    }

    return {
      found: true,
      vehicle,
      status: vehicle.status,
      isApproved: vehicle.status === 'ACTIVE',
    };
  }
}
