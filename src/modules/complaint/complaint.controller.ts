import type { Response, Request } from 'express';
import { ComplaintService } from './complaint.service';
import { asyncHandler, AppError } from '../../utils/ResponseHandler';
import logger from '../../utils/logger';
import { getSocietyId } from '../../utils/scope';

const complaintService = new ComplaintService();

// Resident creates complaint with photos
export const createComplaint = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const societyId = getSocietyId(req);
  const flatId = req.user!.flatId;

  const complaint = await complaintService.createComplaint(req.body, userId, societyId, flatId);

  res.status(201).json({
    success: true,
    message: 'Complaint created successfully',
    data: complaint,
  });
});

// Admin/Resident get complaints (filtered by role)
// In complaint.controller.ts
export const getComplaints = asyncHandler(async (req: Request, res: Response) => {
  // ✅ Add safety checks
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  const userId = req.user.id;
  const userRole = req.user.role;
  // Non-super-admins always get their own society; SUPER_ADMIN may have picked one.
  const userSocietyId = userRole === 'SUPER_ADMIN' ? (req.societyId ?? null) : getSocietyId(req);
  const userFlatId = req.user.flatId;

  const filters = req.query;

  logger.debug({ userId, userRole, userSocietyId, filters }, 'Fetching complaints from database');

  const result = await complaintService.getComplaints(
    filters,
    userId,
    userRole,
    userSocietyId ?? '',
    userFlatId
  );

  logger.debug({ total: result.pagination.total }, 'Complaints fetched');

  res.status(200).json({
    success: true,
    data: result,
  });
});

// Get single complaint (Admin sees all details including photos)
export const getComplaintById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const userRole = req.user!.role;
  const userSocietyId = req.user!.role === 'SUPER_ADMIN' ? (req.societyId ?? '') : getSocietyId(req);

  logger.debug({ complaintId: id, userId, userRole }, 'Fetching complaint by ID');

  const complaint = await complaintService.getComplaintById(String(id), userId, userRole, userSocietyId);

  logger.debug({ complaintId: complaint.id }, 'Complaint fetched');

  res.status(200).json({
    success: true,
    data: complaint,
  });
});

// Admin updates complaint status
export const updateComplaintStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  const adminSocietyId = getSocietyId(req);

  const complaint = await complaintService.updateComplaintStatus(String(id), status, adminSocietyId);

  res.status(200).json({
    success: true,
    message: 'Complaint status updated',
    data: complaint,
  });
});

// Admin assigns complaint to staff
export const assignComplaint = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { assignedToId } = req.body;
  const adminSocietyId = getSocietyId(req);

  const complaint = await complaintService.assignComplaint(String(id), assignedToId, adminSocietyId);

  res.status(200).json({
    success: true,
    message: 'Complaint assigned successfully',
    data: complaint,
  });
});

// Admin resolves complaint
export const resolveComplaint = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { resolution } = req.body;
  const userId = req.user!.id;
  const adminSocietyId = getSocietyId(req);

  const complaint = await complaintService.resolveComplaint(String(id), resolution, userId, adminSocietyId);

  res.status(200).json({
    success: true,
    message: 'Complaint resolved successfully',
    data: complaint,
  });
});

// Resident deletes their own complaint
export const deleteComplaint = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const result = await complaintService.deleteComplaint(String(id), userId, getSocietyId(req));

  res.status(200).json({
    success: true,
    message: result.message,
  });
});
