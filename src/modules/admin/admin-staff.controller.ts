import type { Request, Response } from 'express';
import { prisma } from '../../utils/Client';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred';
}

// ============================================
// GET /admin/staff
// Returns a unified list of staff: Guards (from User table)
// AND Domestic Staff (from DomesticStaff table)
// ============================================
export const getAdminStaffDirectory = async (req: Request, res: Response) => {
  try {
    const societyId = req.user!.societyId!;

    // Fetch Guards from User table
    const guards = await prisma.user.findMany({
      where: { societyId, role: 'GUARD', isActive: true },
      select: {
        id: true,
        name: true,
        phone: true,
        photoUrl: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Fetch Domestic staff (maids, cooks, etc.)
    const domesticStaff = await prisma.domesticStaff.findMany({
      where: { societyId, isActive: true },
      select: {
        id: true,
        name: true,
        phone: true,
        photoUrl: true,
        staffType: true,
        availabilityStatus: true,
        isActive: true,
        monthlyRate: true,
        workStartTime: true,
        workEndTime: true,
        isVerified: true,
        assignedFlats: {
          where: { isActive: true },
          select: {
            flat: { select: { flatNumber: true, block: { select: { name: true } } } },
          },
        },
        createdAt: true,
      },
    });

    // Normalize Guard records into StaffMember shape
    const normalizedGuards = guards.map((g) => ({
      id: g.id,
      name: g.name,
      phone: g.phone,
      role: 'GUARD',
      status: g.isActive ? 'ACTIVE' : 'INACTIVE',
      salary: null,
      shiftStart: null,
      shiftEnd: null,
      assignedFlats: ['SOCIETY'],
      photoUrl: g.photoUrl,
      agencyName: null,
      source: 'USER',
      createdAt: g.createdAt,
    }));

    // Normalize Domestic Staff records into StaffMember shape
    const normalizedDomesticStaff = domesticStaff.map((s) => ({
      id: s.id,
      name: s.name,
      phone: s.phone,
      role: s.staffType,
      status: s.isActive
        ? s.availabilityStatus === 'INACTIVE'
          ? 'INACTIVE'
          : 'ACTIVE'
        : 'INACTIVE',
      salary: s.monthlyRate ?? null,
      shiftStart: s.workStartTime ?? null,
      shiftEnd: s.workEndTime ?? null,
      assignedFlats: s.assignedFlats.map(
        (a) =>
          `${a.flat.block?.name ? a.flat.block.name + '-' : ''}${a.flat.flatNumber}`,
      ),
      photoUrl: s.photoUrl,
      agencyName: null,
      isVerified: s.isVerified,
      source: 'DOMESTIC',
      createdAt: s.createdAt,
    }));

    const allStaff = [...normalizedGuards, ...normalizedDomesticStaff].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    return res.status(200).json({
      success: true,
      data: allStaff,
      meta: {
        total: allStaff.length,
        guards: normalizedGuards.length,
        domesticStaff: normalizedDomesticStaff.length,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

// ============================================
// GET /admin/staff/attendance
// Returns attendance records optionally filtered by date
// ============================================
export const getAdminStaffAttendance = async (req: Request, res: Response) => {
  try {
    const societyId = req.user!.societyId!;
    const { date, staffId, page, limit } = req.query as Record<string, string>;

    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const skip = (pageNum - 1) * limitNum;

    // Build date range filter
    let dateFilter: { gte?: Date; lt?: Date } | undefined;
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      dateFilter = { gte: start, lt: end };
    }

    const where: {
      societyId: string;
      domesticStaffId?: string;
      checkInTime?: { gte?: Date; lt?: Date };
    } = { societyId };
    if (staffId) where.domesticStaffId = staffId;
    if (dateFilter) where.checkInTime = dateFilter;

    const [records, total] = await Promise.all([
      prisma.staffAttendance.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { checkInTime: 'desc' },
        include: {
          domesticStaff: {
            select: { id: true, name: true, staffType: true, photoUrl: true },
          },
          flat: { select: { flatNumber: true, block: { select: { name: true } } } },
        },
      }),
      prisma.staffAttendance.count({ where }),
    ]);

    const formatted = records.map((r) => ({
      id: r.id,
      staffId: r.domesticStaffId,
      staffName: r.domesticStaff.name,
      staffType: r.domesticStaff.staffType,
      staffPhoto: r.domesticStaff.photoUrl,
      flatNumber: r.flat.flatNumber,
      blockName: r.flat.block?.name ?? null,
      date: r.checkInTime.toISOString().split('T')[0],
      checkInTime: r.checkInTime,
      checkOutTime: r.checkOutTime ?? null,
      duration: r.duration ?? null,
      status: !r.checkOutTime
        ? 'PRESENT'
        : r.duration && r.duration < 240
        ? 'HALF_DAY'
        : 'PRESENT',
      notes: r.notes ?? null,
      workCompleted: r.workCompleted ?? null,
    }));

    return res.status(200).json({
      success: true,
      data: formatted,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};
