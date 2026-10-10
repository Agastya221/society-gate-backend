import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import { findInSociety } from '../../utils/scope';
import type { Prisma } from '../../types';
import type { ViolationType, ViolationSource, ViolationStatus } from '../../../prisma/generated/prisma/client';

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
      isApproved: v.status === 'ACTIVE',
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
  // Caller (controller) has already validated: type is a ViolationType, penaltyAmount is
  // in (0, MAX_PARKING_PENALTY_INR], and addToInvoice is only set for ADMIN/SUPER_ADMIN.
  async issueViolation(data: {
    vehicleId?: string;
    vehicleNumber?: string;
    type: ViolationType;
    description?: string;
    penaltyAmount?: number;
    addToInvoice?: boolean;
  }, reportedById: string, societyId: string) {
    let vehicle: { id: string; userId: string; flatId: string | null; vehicleNumber: string } | null = null;

    if (data.vehicleId) {
      // Only a vehicle of the caller's society — never by id alone
      vehicle = await findInSociety(prisma.vehicle, data.vehicleId, societyId, {
        select: { id: true, userId: true, flatId: true, vehicleNumber: true },
        entity: 'Vehicle',
      });
    } else if (data.vehicleNumber) {
      // Resolve vehicleId from number (society-scoped)
      const normalized = data.vehicleNumber.toUpperCase().replace(/\s/g, '');
      vehicle = await prisma.vehicle.findFirst({
        where: { vehicleNumber: normalized, societyId },
        select: { id: true, userId: true, flatId: true, vehicleNumber: true },
      });
    }

    const vehicleNumber = (vehicle?.vehicleNumber ?? data.vehicleNumber ?? '').toUpperCase().replace(/\s/g, '');
    if (!vehicleNumber) throw new AppError('vehicleNumber is required', 400);

    const resolvedUserId = vehicle?.userId ?? null;
    let invoiceId: string | null = null;

    // Optionally push penalty to current month's invoice (admins only — enforced by controller)
    if (data.penaltyAmount && data.addToInvoice && vehicle) {
      let flatId = vehicle.flatId;
      if (!flatId) {
        const owner = await prisma.user.findUnique({
          where: { id: vehicle.userId },
          select: { flatId: true },
        });
        flatId = owner?.flatId ?? null;
      }

      if (flatId) {
        const now = new Date();
        const month = now.toLocaleString('default', { month: 'long', year: 'numeric' });

        const invoice = await prisma.invoice.findFirst({
          where: { flatId, societyId, month, status: { not: 'PAID' } },
          select: { id: true },
        });

        if (invoice) {
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              penalty: { increment: data.penaltyAmount },
              totalAmount: { increment: data.penaltyAmount },
            },
          });
          invoiceId = invoice.id;
        }
      }
    }

    const violation = await prisma.parkingViolation.create({
      data: {
        vehicleId: vehicle?.id ?? null,
        vehicleNumber,
        type: data.type,
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
    type: ViolationType;
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
        type: data.type,
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
    source?: ViolationSource;
    status?: ViolationStatus;
    vehicleId?: string;
    reportedById?: string;  // for resident own-only scope
    page?: number;
    limit?: number;
  }) {
    const { societyId, source, status, vehicleId, reportedById, page = 1, limit = 20 } = filters;

    const where: Prisma.ParkingViolationWhereInput = { societyId };
    if (source) where.source = source;
    if (status) where.status = status;
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
    const violation = await findInSociety(prisma.parkingViolation, violationId, societyId, {
      select: { id: true, status: true },
      entity: 'Violation',
    });

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
