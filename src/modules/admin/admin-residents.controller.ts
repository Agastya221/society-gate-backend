import { Request, Response } from 'express';
import { asyncHandler, AppError } from '../../utils/ResponseHandler';
import { adminResidentsService } from './admin-residents.service';
import { clampPagination } from '../../utils/scope';

// ADMIN → their own society. SUPER_ADMIN must name one with ?societyId=.
const resolveSocietyId = (req: Request): string => {
  const user = req.user!;
  if (user.role === 'SUPER_ADMIN') {
    // ensureSameSociety resolved the requested society (body/query/params) into
    // req.societyId; only SUPER_ADMIN gets a client-chosen society.
    const societyId = req.societyId ?? user.societyId;
    if (!societyId) throw new AppError('societyId query parameter is required', 400);
    return societyId;
  }
  // Everyone else is pinned to their own society, whatever the client sent.
  if (!user.societyId) throw new AppError('Admin is not assigned to a society', 403);
  return user.societyId;
};

// GET /api/v1/admin/residents?search=&page=&limit=
export const listAdminResidents = asyncHandler(async (req: Request, res: Response) => {
  // validate({ query }) stores the parsed values on req.validatedQuery (req.query is raw).
  const { search, page, limit } = (req.validatedQuery ?? {}) as { search?: string; page?: number; limit?: number };
  const paging = clampPagination(page, limit, 20);
  const data = await adminResidentsService.list(resolveSocietyId(req), {
    search: search || undefined,
    page: paging.page,
    limit: paging.limit,
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
    req.user!.role,
  );
  res.json({ success: true, message: 'Resident removed', data });
});
