import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/ResponseHandler';
import { ParkingViolationService } from './parking-violation.service';
import { pushService } from '../../services/push.service';

const service = new ParkingViolationService();

// ============================================
// VEHICLE LOOKUP — Admin & Guard
// ============================================
export const lookupVehicle = asyncHandler(async (req: Request, res: Response) => {
  const { q } = req.query as { q: string };
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ success: false, message: 'Query must be at least 2 characters' });
  }
  const data = await service.lookupVehicle(q.trim(), req.user!.societyId!);
  res.json({ success: true, data });
});

// ============================================
// ISSUE VIOLATION — Admin & Guard (OFFICIAL)
// ============================================
export const issueViolation = asyncHandler(async (req: Request, res: Response) => {
  const vehicleId = req.params.vehicleId as string | undefined;
  const { vehicleNumber, plateNumber, type, description, penaltyAmount, addToInvoice } = req.body;

  if (!type) {
    return res.status(400).json({ success: false, message: 'type is required' });
  }

  // vehicleNumber required if no vehicleId
  const resolvedNumber = (vehicleNumber ?? plateNumber) as string | undefined;
  if (!vehicleId && !resolvedNumber) {
    return res.status(400).json({ success: false, message: 'vehicleNumber is required' });
  }

  const { violation, notifyUserId } = await service.issueViolation(
    {
      vehicleId: vehicleId && vehicleId !== 'unknown' ? vehicleId : undefined,
      vehicleNumber: resolvedNumber!,
      type,
      description,
      penaltyAmount,
      addToInvoice,
    },
    req.user!.id,
    req.user!.societyId!
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
  const { vehicleNumber, type, description } = req.body;

  if (!vehicleNumber || !type) {
    return res.status(400).json({ success: false, message: 'vehicleNumber and type are required' });
  }

  const violation = await service.fileComplaint(
    { vehicleNumber, type, description },
    req.user!.id,
    req.user!.societyId!
  );

  // Notify all admins in the society
  const admins = await import('../../utils/Client').then(({ prisma }) =>
    prisma.user.findMany({
      where: { societyId: req.user!.societyId!, role: { in: ['ADMIN', 'SUPER_ADMIN'] }, isActive: true },
      select: { id: true },
    })
  );

  await Promise.all(
    admins.map((admin) =>
      pushService.sendToUser(admin.id, {
        title: 'Parking Complaint Filed',
        body: `${req.user!.name} reported vehicle ${vehicleNumber} for ${type.replace(/_/g, ' ')}.`,
        data: { type: 'PARKING_COMPLAINT', violationId: violation.id },
      })
    )
  );

  res.status(201).json({ success: true, data: violation });
});

// ============================================
// LIST VIOLATIONS — Admin sees all, Resident sees own complaints
// ============================================
export const listViolations = asyncHandler(async (req: Request, res: Response) => {
  const { source, status, vehicleId, page, limit } = req.query as Record<string, string>;
  const user = req.user!;

  // Residents can only see their own complaints
  const reportedById = user.role === 'RESIDENT' ? user.id : undefined;

  const data = await service.listViolations({
    societyId: user.societyId!,
    source: user.role === 'RESIDENT' ? 'COMPLAINT' : source,
    status,
    vehicleId,
    reportedById,
    page: page ? parseInt(page) : 1,
    limit: limit ? parseInt(limit) : 20,
  });

  res.json({ success: true, data });
});

// ============================================
// RESOLVE / DISMISS — Admin only
// ============================================
export const resolveViolation = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { status, resolutionNote } = req.body as { status: 'RESOLVED' | 'DISMISSED'; resolutionNote?: string };

  if (!status || !['RESOLVED', 'DISMISSED'].includes(status)) {
    return res.status(400).json({ success: false, message: 'status must be RESOLVED or DISMISSED' });
  }

  const violation = await service.resolveViolation(
    id,
    { status, resolutionNote },
    req.user!.id,
    req.user!.societyId!
  );

  res.json({ success: true, data: violation });
});
