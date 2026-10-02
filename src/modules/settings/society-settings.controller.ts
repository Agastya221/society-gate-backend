import { Request, Response } from 'express';
import { asyncHandler, AppError } from '../../utils/ResponseHandler';
import { societySettingsService } from './society-settings.service';

// ADMIN → their own society. SUPER_ADMIN has no society of their own, so they
// must name one with ?societyId= (ensureSameSociety is bypassed for them).
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

export const getSocietySettings = asyncHandler(async (req: Request, res: Response) => {
  const data = await societySettingsService.getSettings(resolveSocietyId(req));
  res.json({ success: true, data });
});

export const updateSocietySettings = asyncHandler(async (req: Request, res: Response) => {
  const data = await societySettingsService.updateSettings(resolveSocietyId(req), req.body);
  res.json({ success: true, data });
});
