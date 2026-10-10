import { Request, Response } from 'express';
import { asyncHandler, AppError } from '../../utils/ResponseHandler';
import { getSocietyId, clampPagination } from '../../utils/scope';
import { prisma } from '../../utils/Client';
import { ParkingViolationService } from './parking-violation.service';
import { pushService } from '../../services/push.service';
import {
  issueViolationSchema,
  fileComplaintSchema,
  resolveViolationSchema,
  listViolationsQuerySchema,
  zodErrorBody,
} from './vehicle.schemas';

const service = new ParkingViolationService();

// Roles allowed to issue OFFICIAL violations (routes enforce this too via authorize()).
const VIOLATION_ISSUER_ROLES = ['GUARD', 'ADMIN', 'SUPER_ADMIN'];
// Only society management may push a penalty onto a flat's invoice.
const INVOICE_ROLES = ['ADMIN', 'SUPER_ADMIN'];

// ============================================
// VEHICLE LOOKUP — Admin & Guard
// ============================================
export const lookupVehicle = asyncHandler(async (req: Request, res: Response) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q.length < 2) {
    return res.status(400).json({ success: false, message: 'Query must be at least 2 characters' });
  }
  const data = await service.lookupVehicle(q.slice(0, 30), getSocietyId(req));
  res.json({ success: true, data });
});

// ============================================
// ISSUE VIOLATION — Admin & Guard (OFFICIAL)
// ============================================
export const issueViolation = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  if (!VIOLATION_ISSUER_ROLES.includes(user.role)) {
    throw new AppError('Only guards and admins can issue parking violations', 403);
  }

  const parsed = issueViolationSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json(zodErrorBody(parsed.error));
  }
  const { vehicleNumber, plateNumber, type, description, penaltyAmount, addToInvoice } = parsed.data;

  if (addToInvoice && !INVOICE_ROLES.includes(user.role)) {
    throw new AppError('Only admins can add a penalty to an invoice', 403);
  }

  const rawVehicleId = req.params.vehicleId as string | undefined;
  const vehicleId = rawVehicleId && rawVehicleId !== 'unknown' ? rawVehicleId : undefined;

  // vehicleNumber required if no vehicleId
  const resolvedNumber = vehicleNumber ?? plateNumber;
  if (!vehicleId && !resolvedNumber) {
    return res.status(400).json({ success: false, message: 'vehicleNumber is required' });
  }

  const { violation, notifyUserId } = await service.issueViolation(
    {
      vehicleId,
      vehicleNumber: resolvedNumber,
      type,
      description: description ?? undefined,
      penaltyAmount,
      addToInvoice: !!addToInvoice,
    },
    user.id,
    getSocietyId(req)
  );

  // Push notification to the vehicle owner
  if (notifyUserId) {
    const penaltyText = penaltyAmount ? ` Penalty: ₹${penaltyAmount}.` : '';
    await pushService.sendToUser(notifyUserId, {
      title: 'Parking Violation Issued',
      body: `Your vehicle ${violation.vehicleNumber} has a parking violation: ${type.replace(/_/g, ' ')}.${penaltyText}`,
      data: { type: 'PARKING_VIOLATION', violationId: violation.id },
    });
  }

  res.status(201).json({ success: true, data: violation });
});

// ============================================
// FILE COMPLAINT — Resident
// ============================================
export const fileComplaint = asyncHandler(async (req: Request, res: Response) => {
  const parsed = fileComplaintSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'vehicleNumber and a valid type are required' });
  }
  const { vehicleNumber, type, description } = parsed.data;
  const societyId = getSocietyId(req);

  const violation = await service.fileComplaint(
    { vehicleNumber, type, description: description ?? undefined },
    req.user!.id,
    societyId
  );

  // Notify all admins in the society
  const admins = await prisma.user.findMany({
    where: { societyId, role: { in: ['ADMIN', 'SUPER_ADMIN'] }, isActive: true },
    select: { id: true },
  });

  await Promise.all(
    admins.map((admin) =>
      pushService.sendToUser(admin.id, {
        title: 'Parking Complaint Filed',
        body: `${req.user!.name} reported vehicle ${violation.vehicleNumber} for ${type.replace(/_/g, ' ')}.`,
        data: { type: 'PARKING_COMPLAINT', violationId: violation.id },
      })
    )
  );

  res.status(201).json({ success: true, data: violation });
});

// ============================================
// LIST VIOLATIONS — Admin/Guard see the society's, Resident sees own complaints
// ============================================
export const listViolations = asyncHandler(async (req: Request, res: Response) => {
  const parsed = listViolationsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(zodErrorBody(parsed.error));
  }
  const { source, status, vehicleId } = parsed.data;
  const { page, limit } = clampPagination(parsed.data.page, parsed.data.limit, 20);
  const user = req.user!;

  // Anyone who is not society staff (guard/admin) only sees their own complaints
  const isStaff = VIOLATION_ISSUER_ROLES.includes(user.role);

  const data = await service.listViolations({
    societyId: getSocietyId(req),
    source: isStaff ? source : 'COMPLAINT',
    status,
    vehicleId,
    reportedById: isStaff ? undefined : user.id,
    page,
    limit,
  });

  res.json({ success: true, data });
});

// ============================================
// RESOLVE / DISMISS — Admin only
// ============================================
export const resolveViolation = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const parsed = resolveViolationSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'status must be RESOLVED or DISMISSED' });
  }
  const { status, resolutionNote } = parsed.data;

  const violation = await service.resolveViolation(
    id,
    { status, resolutionNote: resolutionNote ?? undefined },
    req.user!.id,
    getSocietyId(req)
  );

  res.json({ success: true, data: violation });
});
