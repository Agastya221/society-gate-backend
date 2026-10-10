import type { Request, Response } from 'express';
import { AppError } from '../../utils/ResponseHandler';
import { prisma } from '../../utils/Client';
import { StaffAppService } from './staff-app.service';
import { verifyStaffToken } from './staff-app.token';

const service = new StaffAppService();
const staffId = (req: Request) => {
  const id = req.staffAccount?.domesticStaffId;
  if (!id) throw new AppError('Staff authentication required', 401);
  return id;
};

export const verifyOtp = async (req: Request, res: Response) => {
  if (!req.body.widgetToken) throw new AppError('Widget token is required', 400);
  res.json({ success: true, data: await service.verifyOtp(req.body.widgetToken) });
};
export const refresh = async (req: Request, res: Response) => {
  if (!req.body.refreshToken) throw new AppError('Refresh token is required', 400);
  res.json({ success: true, data: await service.refresh(req.body.refreshToken) });
};
// Logout works with a valid access token (Authorization header) or, when the access
// token has expired, with just { refreshToken } in the body — so the server-side
// session is still revoked.
export const logout = async (req: Request, res: Response) => {
  const accessToken = req.headers.authorization?.split(' ')[1];
  const refreshToken = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : undefined;
  let accountId: string | null = null;
  if (accessToken) {
    try { accountId = verifyStaffToken(accessToken, 'access').staffAccountId; } catch { /* expired/invalid — fall back to refresh token */ }
  }
  if (!accountId && !refreshToken) throw new AppError('No valid token provided', 401);
  await service.logout(accountId, accountId ? accessToken : undefined, refreshToken);
  res.json({ success: true, message: 'Logged out successfully' });
};
export const dashboard = async (req: Request, res: Response) => res.json({ success: true, data: await service.dashboard(staffId(req)) });
export const profile = async (req: Request, res: Response) => res.json({ success: true, data: (await service.dashboard(staffId(req))).staff });
export const pass = async (req: Request, res: Response) => { const staff = req.staffAccount!.domesticStaff; res.json({ success: true, data: { staffId: staff.id, name: staff.name, staffType: staff.staffType, qrToken: staff.qrToken, isVerified: staff.isVerified } }); };
export const assignments = async (req: Request, res: Response) => res.json({ success: true, data: await service.assignments(staffId(req)) });
export const attendance = async (req: Request, res: Response) => res.json({ success: true, data: await service.attendance(staffId(req), Math.max(1, Number(req.query.page) || 1)) });
export const bookings = async (req: Request, res: Response) => res.json({ success: true, data: await service.bookings(staffId(req)) });
export const acceptBooking = async (req: Request, res: Response) => res.json({ success: true, data: await service.updateBooking(staffId(req), String(req.params.id), 'accept') });
export const rejectBooking = async (req: Request, res: Response) => res.json({ success: true, data: await service.updateBooking(staffId(req), String(req.params.id), 'reject', req.body.rejectionReason) });
export const availability = async (req: Request, res: Response) => {
  const allowed = ['AVAILABLE', 'ON_LEAVE'];
  if (!allowed.includes(req.body.status)) throw new AppError('Staff can only select AVAILABLE or ON_LEAVE', 400);
  const data = await prisma.domesticStaff.update({ where: { id: staffId(req) }, data: { availabilityStatus: req.body.status } });
  res.json({ success: true, data });
};
export const fcmToken = async (req: Request, res: Response) => {
  if (!req.body.fcmToken) throw new AppError('FCM token is required', 400);
  const data = await prisma.staffAccount.update({ where: { id: req.staffAccount!.id }, data: { fcmToken: req.body.fcmToken, deviceType: req.body.deviceType } });
  res.json({ success: true, data: { id: data.id } });
};
