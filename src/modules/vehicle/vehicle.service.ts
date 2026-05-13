import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import type { Prisma, VehicleStatus } from '../../types';

export class VehicleService {
  // ============================================
  // RESIDENT — own vehicles
  // ============================================

  async registerVehicle(data: {
    vehicleNumber: string;
    vehicleType: string;
    model?: string;
    color?: string;
  }, userId: string, flatId: string, societyId: string) {
    const vehicleNumber = data.vehicleNumber.toUpperCase().replace(/\s/g, '');

    const existing = await prisma.vehicle.findUnique({
      where: { societyId_vehicleNumber: { societyId, vehicleNumber } },
    });

    if (existing) {
      throw new AppError('Vehicle with this number is already registered in your society', 400);
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        ...data,
        vehicleNumber,
        userId,
        flatId,
        societyId,
        status: 'ACTIVE',
      },
      include: {
        flat: { select: { flatNumber: true } },
      },
    });

    return vehicle;
  }

  async getMyVehicles(userId: string) {
    const vehicles = await prisma.vehicle.findMany({
      where: { userId, isActive: true },
      include: {
        flat: { select: { flatNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return vehicles;
  }

  async updateVehicle(vehicleId: string, data: {
    model?: string;
    color?: string;
    parkingSlot?: string;
  }, userId: string) {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });

    if (!vehicle) throw new AppError('Vehicle not found', 404);
    if (vehicle.userId !== userId) throw new AppError('You can only update your own vehicles', 403);

    return prisma.vehicle.update({
      where: { id: vehicleId },
      data,
    });
  }

  async deleteVehicle(vehicleId: string, userId: string) {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });

    if (!vehicle) throw new AppError('Vehicle not found', 404);
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
          flat: { select: { flatNumber: true } },
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
    parkingSlot?: string;
    stickerNumber?: string;
    rejectionNote?: string;
  }) {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new AppError('Vehicle not found', 404);

    return prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        status: data.status,
        parkingSlot: data.parkingSlot,
        stickerNumber: data.stickerNumber,
        rejectionNote: data.rejectionNote,
      },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        flat: { select: { flatNumber: true } },
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
        flat: { select: { flatNumber: true } },
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
