import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import { isTokenBlacklisted } from '../../services/token.service';
import { verifyStaffToken } from './staff-app.token';

declare global {
  namespace Express {
    interface Request {
      staffAccount?: Awaited<ReturnType<typeof loadStaffAccount>>;
    }
  }
}

const loadStaffAccount = (id: string) => prisma.staffAccount.findUnique({
  where: { id },
  include: { domesticStaff: { include: { society: { select: { id: true, name: true, isActive: true } } } } },
});

export const authenticateStaffApp = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) throw new AppError('No token provided. Please login.', 401);
    const decoded = verifyStaffToken(token, 'access');
    if (await isTokenBlacklisted(decoded.jti)) throw new AppError('Token has been revoked. Please login again.', 401);
    const account = await loadStaffAccount(decoded.staffAccountId);
    if (!account || !account.isActive || !account.domesticStaff.isActive) throw new AppError('Staff account not found or inactive', 401);
    if (!account.domesticStaff.society.isActive) throw new AppError('Society is inactive', 403);
    if (account.domesticStaffId !== decoded.domesticStaffId || account.domesticStaff.societyId !== decoded.societyId) throw new AppError('Invalid staff session', 401);
    req.staffAccount = account;
    req.societyId = account.domesticStaff.societyId;
    next();
  } catch (error) { next(error); }
};
