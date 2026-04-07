import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import type { Prisma } from '../../types';

const VEHICLE_SELECT = {
  id: true,
  vehicleNumber: true,
  vehicleType: true,
  model: true,
  color: true,
  stickerNumber: true,
  parkingSlot: true,
  status: true,
  user: { select: { id: true, name: true, phone: true } },
  flat: { select: { id: true, flatNumber: true, block: { select: { name: true } } } },
};

export class ParkingViolationService {

  // ============================================
  // VEHICLE LOOKUP — Admin & Guard
  // ============================================
  async lookupVehicle(q: string, societyId: string) {
    const normalized = q.toUpperCase().replace(/\s/g, '');

    const vehicles = await prisma.vehicle.findMany({
      where: {
        societyId,
        isActive: true,
        OR: [
          { vehicleNumber: { contains: normalized, mode: 'insensitive' } },
          { stickerNumber: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: VEHICLE_SELECT,
      take: 10,
    });

    return vehicles.map((v) => ({
      id: v.id,
      plateNumber: v.vehicleNumber,
      type: v.vehicleType,
      makeModel: v.model ?? null,
      color: v.color ?? null,
      stickerNumber: v.stickerNumber ?? null,
      parkingSlot: v.parkingSlot ?? null,
      status: v.status,
      flat: v.flat
        ? {
            id: v.flat.id,
            number: v.flat.flatNumber,
            block: v.flat.block ?? null,
            isAdminFlat: v.flat.flatNumber === 'OFFICE',
          }
        : null,
      resident: v.user,
    }));
  }

  // ============================================
  // ISSUE VIOLATION — Admin & Guard (OFFICIAL)
  // ============================================
  async issueViolation(data: {
    vehicleId?: string;
    vehicleNumber: string;
    type: string;
    description?: string;
    penaltyAmount?: number;
    addToInvoice?: boolean;
  }, reportedById: string, societyId: string) {
    // Resolve vehicleId from number if not provided
    let vehicleId = data.vehicleId ?? null;
    let resolvedUserId: string | null = null;

    if (!vehicleId && data.vehicleNumber) {
      const normalized = data.vehicleNumber.toUpperCase().replace(/\s/g, '');
      const vehicle = await prisma.vehicle.findFirst({
        where: { vehicleNumber: normalized, societyId },
      });
      if (vehicle) {
        vehicleId = vehicle.id;
        resolvedUserId = vehicle.userId;
      }
    } else if (vehicleId) {
      const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
      if (!vehicle) throw new AppError('Vehicle not found', 404);
      resolvedUserId = vehicle.userId;
    }

    let invoiceId: string | null = null;

    // Optionally push penalty to current month's invoice
    if (data.penaltyAmount && data.addToInvoice && resolvedUserId) {
      const user = await prisma.user.findUnique({
        where: { id: resolvedUserId },
        select: { flatId: true },
      });

      if (user?.flatId) {
        const now = new Date();
        const month = now.toLocaleString('default', { month: 'long', year: 'numeric' });

        const invoice = await prisma.invoice.findFirst({
          where: { flatId: user.flatId, societyId, month, status: { not: 'PAID' } },
        });

        if (invoice) {
          const newTotal = invoice.totalAmount + data.penaltyAmount;
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              penalty: { increment: data.penaltyAmount },
              totalAmount: newTotal,
            },
          });
          invoiceId = invoice.id;
        }
      }
    }

    const violation = await prisma.parkingViolation.create({
      data: {
        vehicleId,
        vehicleNumber: data.vehicleNumber.toUpperCase().replace(/\s/g, ''),
        type: data.type as any,
        description: data.description,
        source: 'OFFICIAL',
        penaltyAmount: data.penaltyAmount ?? null,
        addedToInvoice: !!invoiceId,
        invoiceId,
        reportedById,
        societyId,
        status: 'NOTIFIED',
      },
      include: {
        vehicle: { select: { ...VEHICLE_SELECT } },
        reportedBy: { select: { id: true, name: true, role: true } },
      },
    });

    return { violation, notifyUserId: resolvedUserId };
  }

  // ============================================
  // FILE COMPLAINT — Resident
  // ============================================
  async fileComplaint(data: {
    vehicleNumber: string;
    type: string;
    description?: string;
  }, reportedById: string, societyId: string) {
    const normalized = data.vehicleNumber.toUpperCase().replace(/\s/g, '');

    const vehicle = await prisma.vehicle.findFirst({
      where: { vehicleNumber: normalized, societyId },
    });

    const violation = await prisma.parkingViolation.create({
      data: {
        vehicleId: vehicle?.id ?? null,
        vehicleNumber: normalized,
        type: data.type as any,
        description: data.description,
        source: 'COMPLAINT',
        reportedById,
        societyId,
        status: 'OPEN',
      },
      include: {
        reportedBy: { select: { id: true, name: true } },
      },
    });

    return violation;
  }

  // ============================================
  // LIST VIOLATIONS — Admin sees all, Resident sees own
  // ============================================
  async listViolations(filters: {
    societyId: string;
    source?: string;
    status?: string;
    vehicleId?: string;
    reportedById?: string;  // for resident own-only scope
    page?: number;
    limit?: number;
  }) {
    const { societyId, source, status, vehicleId, reportedById, page = 1, limit = 20 } = filters;

    const where: Prisma.ParkingViolationWhereInput = { societyId };
    if (source) where.source = source as any;
    if (status) where.status = status as any;
    if (vehicleId) where.vehicleId = vehicleId;
    if (reportedById) where.reportedById = reportedById;

    const [violations, total] = await Promise.all([
      prisma.parkingViolation.findMany({
        where,
        include: {
          vehicle: { select: VEHICLE_SELECT },
          reportedBy: { select: { id: true, name: true, role: true } },
          resolvedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.parkingViolation.count({ where }),
    ]);

    return {
      violations,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  // ============================================
  // RESOLVE / DISMISS — Admin only
  // ============================================
  async resolveViolation(violationId: string, data: {
    status: 'RESOLVED' | 'DISMISSED';
    resolutionNote?: string;
  }, resolvedById: string, societyId: string) {
    const violation = await prisma.parkingViolation.findUnique({
      where: { id: violationId },
    });

    if (!violation) throw new AppError('Violation not found', 404);
    if (violation.societyId !== societyId) throw new AppError('Access denied', 403);
    if (violation.status === 'RESOLVED' || violation.status === 'DISMISSED') {
      throw new AppError('Violation is already closed', 400);
    }

    return prisma.parkingViolation.update({
      where: { id: violationId },
      data: {
        status: data.status,
        resolutionNote: data.resolutionNote,
        resolvedById,
        resolvedAt: new Date(),
      },
      include: {
        vehicle: { select: VEHICLE_SELECT },
        reportedBy: { select: { id: true, name: true } },
        resolvedBy: { select: { id: true, name: true } },
      },
    });
  }
}
