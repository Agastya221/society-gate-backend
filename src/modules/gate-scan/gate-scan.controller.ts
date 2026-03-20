import type { Request, Response } from 'express';
import { GateScanService } from './gate-scan.service';
import { getErrorMessage, getErrorStatusCode } from '../../utils/errorHandler';
import { prisma } from '../../utils/Client';
import { asyncHandler } from '../../utils/ResponseHandler';
import type { EntryStatus, EntryType } from '../../../prisma/generated/prisma/client';

const gateScanService = new GateScanService();

/**
 * POST /guard-app/scan
 * Universal QR scan endpoint for guards.
 */
export const scanQR = async (req: Request, res: Response) => {
  try {
    const guardId = req.user!.id;
    const { qrToken, gatePointId } = req.body;

    if (!qrToken) {
      return res.status(400).json({ success: false, message: 'qrToken is required' });
    }

    const result = await gateScanService.scan(qrToken, guardId, gatePointId);

    const statusCode = result.allowed ? 200 : 403;
    res.status(statusCode).json({
      success: result.allowed,
      message: result.reason,
      data: {
        type: result.type,
        allowed: result.allowed,
        entry: result.entry,
        pass: result.data,
      },
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

/**
 * GET /guard-app/today
 * Today's entries for guard dashboard.
 */
export const getTodayEntries = asyncHandler(async (req: Request, res: Response) => {
  const societyId = req.user!.societyId!;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const entries = await prisma.entry.findMany({
    where: { societyId, checkInTime: { gte: today, lt: tomorrow } },
    include: {
      flat: true,
      invitePass: { select: { type: true, visitorName: true } },
      createdBy: { select: { id: true, name: true, role: true } },
    },
    orderBy: { checkInTime: 'desc' },
  });

  const stats = {
    total: entries.length,
    pending: entries.filter((e) => e.status === 'PENDING').length,
    approved: entries.filter((e) => e.status === 'APPROVED').length,
    checkedOut: entries.filter((e) => e.status === 'CHECKED_OUT').length,
    delivery: entries.filter((e) => e.type === 'DELIVERY').length,
    visitor: entries.filter((e) => e.type === 'VISITOR').length,
    domesticStaff: entries.filter((e) => e.type === 'DOMESTIC_STAFF').length,
  };

  res.json({ success: true, data: { entries, stats } });
});

/**
 * GET /guard-app/entries
 * Paginated entry list with filters.
 */
export const getEntries = asyncHandler(async (req: Request, res: Response) => {
  const societyId = req.user!.societyId!;
  const { status, type, flatId, page = '1', limit = '20' } = req.query;

  const where: {
    societyId: string;
    status?: EntryStatus;
    type?: EntryType;
    flatId?: string;
  } = { societyId };

  if (status) where.status = status as EntryStatus;
  if (type) where.type = type as EntryType;
  if (flatId) where.flatId = flatId as string;

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);

  const [entries, total] = await Promise.all([
    prisma.entry.findMany({
      where,
      include: {
        flat: true,
        invitePass: { select: { type: true, visitorName: true } },
        createdBy: { select: { id: true, name: true, role: true } },
        approvedBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: { checkInTime: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.entry.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      entries,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    },
  });
});

/**
 * PATCH /guard-app/entries/:id/checkout
 */
export const checkoutEntry = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);

  const entry = await prisma.entry.update({
    where: { id },
    data: { status: 'CHECKED_OUT', checkOutTime: new Date() },
  });

  res.json({ success: true, message: 'Visitor checked out', data: entry });
});
