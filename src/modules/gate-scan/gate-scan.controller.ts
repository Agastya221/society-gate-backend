import type { Request, Response } from 'express';
import { GateScanService } from './gate-scan.service';
import { getErrorMessage, getErrorStatusCode } from '../../utils/errorHandler';
import { prisma } from '../../utils/Client';
import { asyncHandler, AppError } from '../../utils/ResponseHandler';
import { getSocietyId, clampPagination } from '../../utils/scope';
import type { EntryStatus, EntryType } from '../../../prisma/generated/prisma/client';

const gateScanService = new GateScanService();

const ENTRY_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CHECKED_IN', 'CHECKED_OUT'] as const;
const ENTRY_TYPES = ['VISITOR', 'DELIVERY', 'DOMESTIC_STAFF', 'CAB', 'VENDOR'] as const;

const INDIA_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const getIndiaDayRange = (now = new Date()) => {
  const indiaNow = new Date(now.getTime() + INDIA_OFFSET_MS);
  const startUtcMs = Date.UTC(
    indiaNow.getUTCFullYear(),
    indiaNow.getUTCMonth(),
    indiaNow.getUTCDate(),
  ) - INDIA_OFFSET_MS;

  return {
    start: new Date(startUtcMs),
    end: new Date(startUtcMs + 24 * 60 * 60 * 1000),
  };
};

/**
 * POST /guard/scan
 * Universal QR scan endpoint for guards (GatePass + DomesticStaff).
 */
export const scanQR = async (req: Request, res: Response) => {
  try {
    const guardId = req.user!.id;
    const { qrToken, gatePointId } = req.body;

    if (!qrToken) {
      return res.status(400).json({ success: false, message: 'qrToken is required' });
    }

    if (typeof qrToken !== 'string') {
      return res.status(400).json({ success: false, message: 'qrToken must be a string' });
    }

    const result = await gateScanService.scan(qrToken, guardId, getSocietyId(req), gatePointId);

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
 * POST /gate/verify-code
 * Universal passcode verification — works for all invite types.
 */
export const verifyCode = async (req: Request, res: Response) => {
  try {
    const guardId = req.user!.id;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: 'code is required' });
    }

    if (typeof code !== 'string') {
      return res.status(400).json({ success: false, message: 'code must be a string' });
    }

    const result = await gateScanService.verifyCode(code.trim(), guardId, getSocietyId(req));

    const statusCode = result.allowed ? 200 : 403;
    res.status(statusCode).json({
      success: result.allowed,
      message: result.allowed ? 'Access granted' : result.message,
      data: result,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

/**
 * GET /gate/entry-log
 * View entry history for guard/admin.
 */
export const getEntryLog = asyncHandler(async (req: Request, res: Response) => {
  const societyId = getSocietyId(req);
  const { page, limit } = clampPagination(req.query.page, req.query.limit, 30);

  const result = await gateScanService.getEntryLog(societyId, page, limit);

  res.json({ success: true, data: result });
});

/**
 * GET /guard/today
 * Today's entries for guard dashboard.
 */
export const getTodayEntries = asyncHandler(async (req: Request, res: Response) => {
  const societyId = getSocietyId(req);
  const { start, end } = getIndiaDayRange();

  const entryInclude = {
    flat: true,
    createdBy: { select: { id: true, name: true, role: true } },
  } as const;
  const staffAttendanceInclude = {
    domesticStaff: {
      select: { id: true, name: true, staffType: true, photoUrl: true },
    },
    flat: {
      select: { flatNumber: true, block: { select: { name: true } } },
    },
  } as const;

  const [todayEntries, todayStaffAttendances, stillInsideEntries, stillWorkingStaff] = await Promise.all([
    prisma.entry.findMany({
      where: { societyId, checkInTime: { gte: start, lt: end } },
      include: entryInclude,
      orderBy: { checkInTime: 'desc' },
    }),
    prisma.staffAttendance.findMany({
      where: { societyId, checkInTime: { gte: start, lt: end } },
      include: staffAttendanceInclude,
      orderBy: { checkInTime: 'desc' },
    }),
    // People who checked in before today and never checked out — they're still at the
    // gate/society and must not disappear from the guard's view just because midnight passed.
    prisma.entry.findMany({
      where: { societyId, status: 'CHECKED_IN', checkInTime: { lt: start } },
      include: entryInclude,
      orderBy: { checkInTime: 'desc' },
    }),
    prisma.staffAttendance.findMany({
      where: { societyId, checkOutTime: null, checkInTime: { lt: start } },
      include: staffAttendanceInclude,
      orderBy: { checkInTime: 'desc' },
    }),
  ]);

  const entries = [...stillInsideEntries, ...todayEntries];
  const staffAttendances = [...stillWorkingStaff, ...todayStaffAttendances];

  const stats = {
    total: entries.length + staffAttendances.length,
    pending: entries.filter((e) => e.status === 'PENDING').length,
    approved: entries.filter((e) => e.status === 'APPROVED').length,
    checkedIn: entries.filter((e) => e.status === 'CHECKED_IN').length,
    checkedOut: entries.filter((e) => e.status === 'CHECKED_OUT').length,
    delivery: entries.filter((e) => e.type === 'DELIVERY').length,
    visitor: entries.filter((e) => e.type === 'VISITOR').length,
    domesticStaff: staffAttendances.length,
  };

  res.json({ success: true, data: { entries, staffAttendances, stats } });
});

/**
 * GET /guard/entries
 * Paginated entry list with filters.
 */
export const getEntries = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const societyId = getSocietyId(req);
  const { status, type, flatId } = req.query;
  const { page: pageNum, limit: limitNum, skip } = clampPagination(req.query.page, req.query.limit, 20);

  const where: {
    societyId: string;
    status?: EntryStatus;
    type?: EntryType;
    flatId?: string;
  } = { societyId };

  if (typeof status === 'string' && (ENTRY_STATUSES as readonly string[]).includes(status)) {
    where.status = status as EntryStatus;
  }
  if (typeof type === 'string' && (ENTRY_TYPES as readonly string[]).includes(type)) {
    where.type = type as EntryType;
  }

  // Residents are always scoped to their own flat regardless of query param
  if (user.role === 'RESIDENT') {
    if (!user.flatId) {
      return res.json({
        success: true,
        data: { entries: [], pagination: { total: 0, page: pageNum, limit: limitNum, pages: 0 } },
      });
    }
    where.flatId = user.flatId;
  } else if (typeof flatId === 'string' && flatId) {
    // flatId only narrows within the caller's society (societyId is always in the where)
    where.flatId = flatId;
  }

  const [entries, total] = await Promise.all([
    prisma.entry.findMany({
      where,
      select: {
        id: true,
        type: true,
        status: true,
        visitorName: true,
        visitorPhone: true,
        companyName: true,
        createdAt: true,
        checkInTime: true,
        checkOutTime: true,
        flat: { select: { flatNumber: true } },
      },
      orderBy: { checkInTime: 'desc' },
      skip,
      take: limitNum,
    }),
    prisma.entry.count({ where }),
  ]);

  const mapped = entries.map((entry) => ({
    ...entry,
    flatNumber: entry.flat?.flatNumber ?? null,
  }));

  res.json({
    success: true,
    data: {
      entries: mapped,
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
 * PATCH /guard/entries/:id/checkout
 */
export const checkoutEntry = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);

  // Only entries of the guard's own society that are still inside can be checked out
  const existing = await prisma.entry.findFirst({
    where: { id, societyId: getSocietyId(req) },
    select: { status: true },
  });
  if (!existing) {
    throw new AppError('Entry not found', 404);
  }
  if (existing.status === 'CHECKED_OUT') {
    throw new AppError('Visitor is already checked out', 400);
  }

  const entry = await prisma.entry.update({
    where: { id },
    data: { status: 'CHECKED_OUT', checkOutTime: new Date() },
  });

  res.json({ success: true, message: 'Visitor checked out', data: entry });
});
