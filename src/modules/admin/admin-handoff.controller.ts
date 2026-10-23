import { Request, Response } from 'express';
import { asyncHandler, AppError } from '../../utils/ResponseHandler';
import { handoffAdminRole } from './admin-handoff.service';

// POST /api/v1/admin/handoff
export const handoffAdmin = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  if (!user.societyId) throw new AppError('Admin is not assigned to a society', 403);
  const data = await handoffAdminRole(user.societyId, user.id, req.body);
  res.json({ success: true, message: 'Admin role handed over', data });
});
