import { Request, Response } from 'express';
import { asyncHandler, AppError } from '../../utils/ResponseHandler';
import { adminResidentsService } from './admin-residents.service';

// ADMIN → their own society. SUPER_ADMIN must name one with ?societyId=.
const resolveSocietyId = (req: Request): string => {
  const user = req.user!;
  if (user.role === 'SUPER_ADMIN') {
    const societyId = typeof req.query.societyId === 'string' ? req.query.societyId : user.societyId;
    if (!societyId) throw new AppError('societyId query parameter is required', 400);
    return societyId;
  }
  if (!user.societyId) throw new AppError('Admin is not assigned to a society', 403);
  return user.societyId;
};

// GET /api/v1/admin/residents?search=&page=&limit=
export const listAdminResidents = asyncHandler(async (req: Request, res: Response) => {
  const { search, page, limit } = req.query as unknown as { search?: string; page: number; limit: number };
  const data = await adminResidentsService.list(resolveSocietyId(req), {
    search: search || undefined,
    page: Number(page) || 1,
    limit: Number(limit) || 20,
  });
  res.json({ success: true, data });
});

// POST /api/v1/admin/residents
export const createAdminResident = asyncHandler(async (req: Request, res: Response) => {
  const data = await adminResidentsService.create(resolveSocietyId(req), req.body, req.user!.id);
  res.status(201).json({ success: true, message: 'Resident added', data });
});

// DELETE /api/v1/admin/residents/:membershipId
export const removeAdminResident = asyncHandler(async (req: Request, res: Response) => {
  const data = await adminResidentsService.remove(
    resolveSocietyId(req),
    String(req.params.membershipId),
    req.user!.id,
  );
  res.json({ success: true, message: 'Resident removed', data });
});
