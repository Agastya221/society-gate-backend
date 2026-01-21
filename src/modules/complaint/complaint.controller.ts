import type { Response, Request } from 'express';
import { ComplaintService } from './complaint.service';
import { asyncHandler } from '../../utils/ResponseHandler';

const complaintService = new ComplaintService();

// Resident creates complaint with photos
export const createComplaint = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const societyId = req.user!.societyId;
  const flatId = req.user!.flatId;

  const complaint = await complaintService.createComplaint(req.body, userId, societyId, flatId);

  res.status(201).json({
    success: true,
    message: 'Complaint created successfully',
    data: complaint,
  });
});

// Admin/Resident get complaints (filtered by role)
export const getComplaints = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const userRole = req.user!.role;
  const userSocietyId = req.user!.societyId;
  const userFlatId = req.user!.flatId;
  const filters = req.query;

  const result = await complaintService.getComplaints(
    filters,
    userId,
    userRole,
    userSocietyId,
    userFlatId
  );

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
  const userSocietyId = req.user!.societyId;

  const complaint = await complaintService.getComplaintById(id, userId, userRole, userSocietyId);

  res.status(200).json({
    success: true,
    data: complaint,
  });
});

// Admin updates complaint status
export const updateComplaintStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  const adminSocietyId = req.user!.societyId;

  const complaint = await complaintService.updateComplaintStatus(id, status, adminSocietyId);

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
  const adminSocietyId = req.user!.societyId;

  const complaint = await complaintService.assignComplaint(id, assignedToId, adminSocietyId);

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
  const adminSocietyId = req.user!.societyId;

  const complaint = await complaintService.resolveComplaint(id, resolution, userId, adminSocietyId);

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

  const result = await complaintService.deleteComplaint(id, userId);

  res.status(200).json({
    success: true,
    message: result.message,
  });
});
