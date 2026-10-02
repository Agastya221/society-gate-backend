import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import { generateQRToken } from '../../utils/QrGenerate';
import { eventBus } from '../../utils/eventBus';
import {
  validateRequiredFields,
  validateTimeRange,
  validatePositiveNumber,
} from '../../utils/validation';
import type {
  CreateStaffDTO,
  UpdateStaffDTO,
  StaffFilters,
  CreateStaffAssignmentDTO,
  UpdateStaffAssignmentDTO,
  StaffCheckInDTO,
  AttendanceFilters,
  CreateStaffBookingDTO,
  StaffBookingFilters,
  CreateStaffReviewDTO,
  Prisma,
  StaffAvailabilityStatus,
  StaffBookingStatus,
  DomesticStaffType,
} from '../../types';

const timeToMinutes = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};

const minutesToTime = (value: number) =>
  `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;

const weekdayFor = (date: string) =>
  ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date(`${date}T12:00:00Z`).getUTCDay()];

const dayMatches = (days: string[], weekday: string) =>
  days.length === 0 || days.some((day) => day.trim().toUpperCase().startsWith(weekday));

const bookingDay = (date: string) => new Date(`${date}T00:00:00.000Z`);

const bookingDayRange = (date: string) => ({
  gte: bookingDay(date),
  lt: new Date(bookingDay(date).getTime() + 24 * 60 * 60 * 1000),
});

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export const BOOKING_EXPIRED_MESSAGE = 'This request has expired';

/**
 * A booking request is expired once its start (IST date + startTime) has passed.
 * StaffBookingStatus has no EXPIRED value, so stale PENDING requests are rejected
 * on action and left out of pending lists instead of being re-labelled.
 */
export function isBookingExpired(
  booking: { bookingDate: Date | string; startTime: string },
  now: Date = new Date(),
): boolean {
  const istDate = new Date(new Date(booking.bookingDate).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
  const startTime = /^\d{2}:\d{2}$/.test(booking.startTime) ? booking.startTime : '23:59';
  const startsAt = Date.parse(`${istDate}T${startTime}:00.000+05:30`);
  return Number.isFinite(startsAt) && startsAt < now.getTime();
}

/** Prisma filter for "pending and not yet past its date" (day-level; same-day time is checked per row). */
export function notPastPendingWhere(now: Date = new Date()): Prisma.StaffBookingWhereInput {
  const istToday = new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
  // Covers both storage styles: UTC midnight of the date, or IST midnight (18:30Z the day before)
  const todayStartUtc = new Date(Date.parse(`${istToday}T00:00:00.000Z`) - IST_OFFSET_MS);
  return { NOT: { status: 'PENDING', bookingDate: { lt: todayStartUtc } } };
}

/**
 * StaffBookingStatus has no REJECTED value (adding one needs an enum migration),
 * so a staff/admin decline is stored as CANCELLED + rejectedAt. In API responses
 * that combination is reported as REJECTED; CANCELLED without rejectedAt stays
 * CANCELLED (reserved for resident-side cancellation).
 */
export type StaffBookingApiStatus = StaffBookingStatus | 'REJECTED';

export function bookingApiStatus(booking: { status: StaffBookingStatus | string; rejectedAt?: Date | string | null }): StaffBookingApiStatus {
  if (booking.status === 'CANCELLED' && booking.rejectedAt) return 'REJECTED';
  return booking.status as StaffBookingStatus;
}

export function presentStaffBooking<T extends { status: StaffBookingStatus | string; rejectedAt?: Date | string | null }>(
  booking: T,
): Omit<T, 'status'> & { status: StaffBookingApiStatus } {
  return { ...booking, status: bookingApiStatus(booking) };
}

/** Translate an API status filter (which may be REJECTED) into a Prisma where clause. */
export function bookingStatusWhere(status: string): Prisma.StaffBookingWhereInput {
  if (status === 'REJECTED') return { status: 'CANCELLED', rejectedAt: { not: null } };
  if (status === 'CANCELLED') return { status: 'CANCELLED', rejectedAt: null };
  return { status: status as StaffBookingStatus };
}

// Staff still "inside" this long after check-in are assumed to have left without scanning out
export const STALE_CHECK_IN_HOURS = 16;

export class DomesticStaffService {
  // ============================================
  // STAFF MANAGEMENT
  // ============================================

  async createStaff(data: CreateStaffDTO, addedById: string) {
    const { societyId } = data;
    const phone = data.phone.replace(/\D/g, '').slice(-10);

    if (phone.length !== 10) {
      throw new AppError('Enter a valid 10-digit phone number', 400);
    }
    if (!data.name?.trim()) {
      throw new AppError('Staff name is required', 400);
    }
    if (!data.photoUrl) {
      throw new AppError('A clear face photo is required', 400);
    }

    // Check if staff with this phone already exists in society
    const existing = await prisma.domesticStaff.findUnique({ where: { phone } });

    if (existing) {
      throw new AppError('Staff with this phone number is already registered', 400);
    }

    // Generate QR token
    const qrToken =  generateQRToken({
      type: 'domestic_staff',
      phone,
      societyId,
    });

    const { flatId: _flatId, ...staffData } = data;
    const staff = await prisma.$transaction(async (tx) => {
      const createdStaff = await tx.domesticStaff.create({
        data: {
          ...staffData,
          name: data.name.trim(),
          phone,
          languages: data.languages ?? [],
          workingDays: data.workingDays ?? [],
          qrToken,
          addedById,
          isActive: true,
          isVerified: true,
          verifiedAt: new Date(),
          verifiedBy: addedById,
        },
        include: {
          addedBy: { select: { id: true, name: true, role: true } },
          society: { select: { id: true, name: true } },
        },
      });

      await tx.staffAccount.create({
        data: {
          domesticStaffId: createdStaff.id,
          phone,
          isActive: true,
        },
      });

      return createdStaff;
    });

    return staff;
  }

  async getStaffList(filters: StaffFilters & { search?: string }) {
    const {
      societyId,
      staffType,
      availabilityStatus,
      isVerified,
      isActive,
      search,
      page = 1,
      limit = 20,
    } = filters;

    const where: Prisma.DomesticStaffWhereInput = { societyId };
    if (staffType) where.staffType = staffType;
    if (availabilityStatus) where.availabilityStatus = availabilityStatus;
    if (isVerified !== undefined) where.isVerified = isVerified;
    if (isActive !== undefined) where.isActive = isActive;

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    // NICE-1: Cap pagination limit to prevent large queries
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [staffRows, total] = await Promise.all([
      prisma.domesticStaff.findMany({
        where,
        include: {
          assignedFlats: {
            where: { isActive: true },
            include: { flat: { select: { id: true, flatNumber: true } } },
          },
          reviews: { select: { rating: true } },
          attendanceRecords: {
            where: { checkInTime: { gte: thirtyDaysAgo } },
            select: { id: true, checkInTime: true },
            orderBy: { checkInTime: 'desc' },
          },
        },
        orderBy: [
          { isVerified: 'desc' },
          { rating: 'desc' },
          { name: 'asc' },
        ],
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
      prisma.domesticStaff.count({ where }),
    ]);

    const staff = staffRows.map((s) => this._formatStaffListItem(s, now));

    return {
      staff,
      pagination: {
        total,
        page: safePage,
        limit: safeLimit,
        pages: Math.ceil(total / safeLimit),
      },
    };
  }

  async getStaffById(staffId: string) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const staff = await prisma.domesticStaff.findUnique({
      where: { id: staffId },
      include: {
        addedBy: { select: { id: true, name: true, role: true } },
        assignedFlats: {
          where: { isActive: true },
          include: { flat: { select: { id: true, flatNumber: true } } },
        },
        reviews: {
          include: {
            reviewer: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        attendanceRecords: {
          where: { checkInTime: { gte: thirtyDaysAgo } },
          select: { id: true, checkInTime: true },
          orderBy: { checkInTime: 'desc' },
        },
      },
    });

    if (!staff) {
      throw new AppError('Staff not found', 404);
    }

    return this._formatStaffListItem(staff, now);
  }

  // Returns count of active staff per type for the society
  async getTypeSummary(societyId: string) {
    const counts = await prisma.domesticStaff.groupBy({
      by: ['staffType'],
      where: { societyId, isActive: true },
      _count: { id: true },
      orderBy: { staffType: 'asc' },
    });

    return counts.map((c) => ({
      type: c.staffType,
      count: c._count.id,
    }));
  }

  // Shapes a staff record into the frontend-expected shape
  private _formatStaffListItem<T extends {
    phone: string;
    createdAt: Date;
    isCurrentlyWorking: boolean;
    assignedFlats: Array<{ flat: { id: string; flatNumber: string }; createdAt: Date }>;
    reviews: Array<{ rating: number }>;
    attendanceRecords: Array<{ id: string; checkInTime: Date }>;
  }>(staff: T, now: Date) {
    const { phone, createdAt, assignedFlats, reviews, attendanceRecords, ...rest } = staff;

    // Phone masking: show only last 4 digits
    const maskedPhone = phone.length > 4
      ? `${'*'.repeat(phone.length - 4)}${phone.slice(-4)}`
      : phone;

    // Years in society since staff was added
    const yearsInSociety = Math.floor(
      (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24 * 365)
    );

    // Attendance score for current 30-day window: unique days with check-in
    const uniqueDays = new Set(
      attendanceRecords.map((a) => a.checkInTime.toISOString().slice(0, 10))
    );
    const attendanceScore = `${uniqueDays.size}/30`;

    // worksIn: flats this staff is assigned to, with duration in months since assignment
    const worksIn = assignedFlats.map((a) => ({
      flat: a.flat.flatNumber,
      flatId: a.flat.id,
      durationMonths: Math.floor(
        (now.getTime() - new Date(a.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30)
      ),
    }));

    // Aggregated ratings: count per star (1–5)
    const ratingCounts: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    for (const r of reviews) {
      const key = String(Math.round(r.rating));
      if (ratingCounts[key] !== undefined) ratingCounts[key]++;
    }
    const ratings = Object.entries(ratingCounts).map(([label, count]) => ({
      label: `${label} star`,
      count,
    }));

    return {
      ...rest,
      phone: maskedPhone,
      createdAt,
      yearsInSociety,
      attendanceScore,
      housesCount: assignedFlats.length,
      worksIn,
      ratings,
    };
  }

  async updateStaff(staffId: string, data: UpdateStaffDTO, societyId: string) {
    const staff = await prisma.domesticStaff.findUnique({
      where: { id: staffId },
    });

    if (!staff || staff.societyId !== societyId) {
      throw new AppError('Staff not found', 404);
    }

    const phone = data.phone ? data.phone.replace(/\D/g, '').slice(-10) : staff.phone;
    if (phone.length !== 10) {
      throw new AppError('Enter a valid 10-digit phone number', 400);
    }
    if (phone !== staff.phone) {
      const phoneOwner = await prisma.domesticStaff.findUnique({ where: { phone } });
      if (phoneOwner) {
        throw new AppError('Staff with this phone number is already registered', 400);
      }
    }

    const updatedStaff = await prisma.$transaction(async (tx) => {
      const updated = await tx.domesticStaff.update({
        where: { id: staffId },
        data: {
          ...data,
          ...(data.name ? { name: data.name.trim() } : {}),
          phone,
          ...(data.isActive === true ? { availabilityStatus: 'AVAILABLE' } : {}),
          ...(data.isActive === false ? { availabilityStatus: 'INACTIVE' } : {}),
        },
      });

      await tx.staffAccount.upsert({
        where: { domesticStaffId: staffId },
        create: { domesticStaffId: staffId, phone, isActive: updated.isActive },
        update: {
          phone,
          isActive: updated.isActive,
          ...(!updated.isActive ? { refreshToken: null, fcmToken: null } : {}),
        },
      });
      return updated;
    });

    return updatedStaff;
  }

  // NICE-4: Soft delete instead of hard delete for data consistency
  async deleteStaff(staffId: string, societyId: string) {
    const staff = await prisma.domesticStaff.findUnique({
      where: { id: staffId },
    });

    if (!staff || staff.societyId !== societyId) {
      throw new AppError('Staff not found', 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.domesticStaff.update({
        where: { id: staffId },
        data: {
          isActive: false,
          availabilityStatus: 'INACTIVE',
        },
      });
      await tx.staffAccount.updateMany({
        where: { domesticStaffId: staffId },
        data: { isActive: false, refreshToken: null, fcmToken: null },
      });
    });

    return { message: 'Staff deactivated successfully' };
  }

  async verifyStaff(staffId: string, verifiedBy: string) {
    const staff = await prisma.domesticStaff.findUnique({
      where: { id: staffId },
    });

    if (!staff) {
      throw new AppError('Staff not found', 404);
    }

    const updatedStaff = await prisma.domesticStaff.update({
      where: { id: staffId },
      data: {
        isVerified: !staff.isVerified,
        verifiedAt: !staff.isVerified ? new Date() : null,
        verifiedBy: !staff.isVerified ? verifiedBy : null,
      },
    });

    return updatedStaff;
  }

  // ============================================
  // FLAT ASSIGNMENTS
  // ============================================

  async assignStaffToFlat(data: CreateStaffAssignmentDTO) {
    const { domesticStaffId, flatId } = data;

    // Check if assignment already exists
    const existing = await prisma.staffFlatAssignment.findUnique({
      where: {
        domesticStaffId_flatId: {
          domesticStaffId,
          flatId,
        },
      },
    });

    if (existing) {
      throw new AppError('Staff is already assigned to this flat', 400);
    }

    const assignment = await prisma.staffFlatAssignment.create({
      data,
      include: {
        domesticStaff: true,
        flat: true,
      },
    });

    return assignment;
  }

  async updateAssignment(assignmentId: string, data: UpdateStaffAssignmentDTO) {
    const assignment = await prisma.staffFlatAssignment.update({
      where: { id: assignmentId },
      data,
    });

    return assignment;
  }

  async removeAssignment(assignmentId: string) {
    await prisma.staffFlatAssignment.delete({
      where: { id: assignmentId },
    });

    return { message: 'Assignment removed successfully' };
  }

  async getStaffAssignments(staffId: string) {
    const assignments = await prisma.staffFlatAssignment.findMany({
      where: { domesticStaffId: staffId },
      include: {
        flat: true,
      },
    });

    return assignments;
  }

  // ============================================
  // ATTENDANCE & CHECK-IN/OUT
  // ============================================

  async checkIn(data: StaffCheckInDTO & { notes?: string }, verifiedByGuardId?: string) {
    const { domesticStaffId, flatId, societyId, checkInMethod = 'QR', notes } = data;

    // Use transaction to prevent race conditions
    const result = await prisma.$transaction(async (tx) => {
      // Check if staff is active and not already checked in (with SELECT FOR UPDATE semantics)
      const staff = await tx.domesticStaff.findUnique({
        where: { id: domesticStaffId },
      });

      if (!staff || !staff.isActive || staff.societyId !== societyId) {
        throw new AppError('Staff not found or inactive', 404);
      }

      if (flatId) {
        const flat = await tx.flat.findFirst({ where: { id: flatId, societyId }, select: { id: true } });
        if (!flat) {
          throw new AppError('Flat not found in this society', 404);
        }
      }

      // Check if already checked in
      if (staff.isCurrentlyWorking) {
        throw new AppError('Staff is already checked in', 400);
      }

      // Create attendance record and update staff status atomically
      const attendance = await tx.staffAttendance.create({
        data: {
          domesticStaffId,
          flatId,
          societyId,
          checkInTime: new Date(),
          checkInMethod,
          notes,
          verifiedByGuardId,
        },
        include: {
          domesticStaff: true,
          flat: true,
        },
      });

      // Update staff status
      await tx.domesticStaff.update({
        where: { id: domesticStaffId },
        data: {
          isCurrentlyWorking: true,
          currentFlatId: flatId,
          lastCheckIn: new Date(),
          availabilityStatus: 'BUSY',
        },
      });

      return attendance;
    });

    const assignedFlatIds = await prisma.staffFlatAssignment.findMany({
      where: { domesticStaffId, isActive: true },
      select: { flatId: true },
    });
    const flatIds = [...new Set([flatId, ...assignedFlatIds.map((assignment) => assignment.flatId)].filter((id): id is string => Boolean(id)))];

    // ARCH-3: Emit event for notification listener
    eventBus.emit('staff.checked-in', {
      attendanceId: result.id,
      flatId,
      flatIds,
      societyId,
      staffId: domesticStaffId,
      staffName: result.domesticStaff.name,
      staffType: result.domesticStaff.staffType,
      checkInTime: result.checkInTime,
    });

    return result;
  }

  async checkOut(
    domesticStaffId: string,
    workCompleted?: string,
    options: { checkOutMethod?: string; notify?: boolean } = {},
  ) {
    const { checkOutMethod = 'QR', notify = true } = options;
    // Use transaction to prevent race conditions
    const result = await prisma.$transaction(async (tx) => {
      const staff = await tx.domesticStaff.findUnique({
        where: { id: domesticStaffId },
      });

      if (!staff || !staff.isCurrentlyWorking) {
        throw new AppError('Staff is not currently checked in', 400);
      }

      // Find the latest uncompleted attendance
      const attendance = await tx.staffAttendance.findFirst({
        where: {
          domesticStaffId,
          checkOutTime: null,
        },
        orderBy: { checkInTime: 'desc' },
      });

      if (!attendance) {
        throw new AppError('No active check-in found', 404);
      }

      const checkOutTime = new Date();
      const duration = Math.floor((checkOutTime.getTime() - attendance.checkInTime.getTime()) / 60000);

      // Update attendance
      const updatedAttendance = await tx.staffAttendance.update({
        where: { id: attendance.id },
        data: {
          checkOutTime,
          duration,
          checkOutMethod,
          workCompleted,
        },
        include: {
          domesticStaff: true,
          flat: true,
        },
      });

      // Update staff status
      await tx.domesticStaff.update({
        where: { id: domesticStaffId },
        data: {
          isCurrentlyWorking: false,
          currentFlatId: null,
          lastCheckOut: checkOutTime,
          availabilityStatus: 'AVAILABLE',
        },
      });

      return updatedAttendance;
    });

    if (!notify) return result;

    const assignedFlatIds = await prisma.staffFlatAssignment.findMany({
      where: { domesticStaffId, isActive: true },
      select: { flatId: true },
    });
    const flatIds = [...new Set([result.flatId ?? undefined, ...assignedFlatIds.map((assignment) => assignment.flatId)].filter((id): id is string => Boolean(id)))];

    // ARCH-3: Emit event for notification listener
    eventBus.emit('staff.checked-out', {
      attendanceId: result.id,
      flatId: result.flatId ?? undefined,
      flatIds,
      societyId: result.societyId,
      staffId: domesticStaffId,
      staffName: result.domesticStaff.name,
      staffType: result.domesticStaff.staffType,
      checkOutTime: result.checkOutTime!,
      duration: result.duration || undefined,
    });

    return result;
  }

  /**
   * Auto check-out staff whose check-in is older than `maxHours` (cron job).
   * A forgotten exit scan otherwise leaves them "inside" forever, which blocks the
   * next check-in and shows them as present to residents. Reuses checkOut() so the
   * open attendance record is closed the same way (method AUTO, no resident push).
   */
  async autoCheckoutStaleStaff(maxHours = STALE_CHECK_IN_HOURS): Promise<{ count: number }> {
    const cutoff = new Date(Date.now() - maxHours * 60 * 60 * 1000);
    const staleStaff = await prisma.domesticStaff.findMany({
      where: {
        isCurrentlyWorking: true,
        OR: [{ lastCheckIn: { lt: cutoff } }, { lastCheckIn: null }],
      },
      select: { id: true },
    });

    let count = 0;
    for (const staff of staleStaff) {
      try {
        await this.checkOut(staff.id, undefined, { checkOutMethod: 'AUTO', notify: false });
        count++;
      } catch (error) {
        // Flag set but no open attendance row (legacy data) — just clear the presence flag
        if (error instanceof AppError && error.statusCode === 404) {
          await prisma.domesticStaff.updateMany({
            where: { id: staff.id, isCurrentlyWorking: true },
            data: {
              isCurrentlyWorking: false,
              currentFlatId: null,
              lastCheckOut: new Date(),
              availabilityStatus: 'AVAILABLE',
            },
          });
          count++;
        } else if (!(error instanceof AppError)) {
          throw error;
        }
        // other AppErrors (e.g. already checked out by a guard meanwhile) — skip
      }
    }

    return { count };
  }

  async scanQRCode(qrToken: string, flatId: string, societyId: string, verifiedByGuardId?: string) {
    const staff = await prisma.domesticStaff.findUnique({
      where: { qrToken },
    });

    if (!staff) {
      throw new AppError('Invalid QR code', 404);
    }

    if (!staff.isActive) {
      throw new AppError('Staff is inactive', 400);
    }

    // Check if currently working - if yes, check out; if no, check in
    if (staff.isCurrentlyWorking) {
      return await this.checkOut(staff.id);
    } else {
      return await this.checkIn({
        domesticStaffId: staff.id,
        flatId,
        societyId,
        checkInMethod: 'QR',
      }, verifiedByGuardId);
    }
  }

  async getAttendanceRecords(filters: AttendanceFilters & { startDate?: string; endDate?: string }) {
    const { domesticStaffId, flatId, societyId, startDate, endDate, page = 1, limit = 20 } = filters;

    const where: Prisma.StaffAttendanceWhereInput = {};
    if (domesticStaffId) where.domesticStaffId = domesticStaffId;
    if (flatId) where.flatId = flatId;
    if (societyId) where.societyId = societyId;

    if (startDate && endDate) {
      where.checkInTime = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const [records, total] = await Promise.all([
      prisma.staffAttendance.findMany({
        where,
        include: {
          domesticStaff: true,
          flat: true,
          verifiedByGuard: { select: { id: true, name: true } },
        },
        orderBy: { checkInTime: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.staffAttendance.count({ where }),
    ]);

    return {
      records,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // ============================================
  // BOOKINGS (On-demand/Urgent hiring)
  // ============================================

  async getOpenSlots(domesticStaffId: string, date: string, societyId: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new AppError('Date must be in YYYY-MM-DD format', 400);
    }

    const staff = await prisma.domesticStaff.findFirst({
      where: { id: domesticStaffId, societyId, isActive: true },
      include: { assignedFlats: { where: { isActive: true } } },
    });
    if (!staff) throw new AppError('Staff not found', 404);

    const weekday = weekdayFor(date);
    const assignments = staff.assignedFlats.filter(
      (assignment) => assignment.workStartTime && assignment.workEndTime && dayMatches(assignment.workingDays, weekday),
    );
    const bookings = await prisma.staffBooking.findMany({
      where: {
        domesticStaffId,
        bookingDate: bookingDayRange(date),
        status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] },
      },
      select: { startTime: true, endTime: true },
    });

    const windowStart = timeToMinutes(staff.workStartTime || '07:00');
    const windowEnd = timeToMinutes(staff.workEndTime || '20:00');
    const occupied = [
      ...assignments.map((item) => ({ start: timeToMinutes(item.workStartTime!), end: timeToMinutes(item.workEndTime!) })),
      ...bookings.map((item) => ({ start: timeToMinutes(item.startTime), end: timeToMinutes(item.endTime) })),
    ]
      .filter((item) => item.end > windowStart && item.start < windowEnd)
      .map((item) => ({ start: Math.max(item.start, windowStart), end: Math.min(item.end, windowEnd) }))
      .sort((a, b) => a.start - b.start);

    const merged = occupied.reduce<Array<{ start: number; end: number }>>((result, interval) => {
      const previous = result[result.length - 1];
      if (previous && interval.start <= previous.end) previous.end = Math.max(previous.end, interval.end);
      else result.push({ ...interval });
      return result;
    }, []);
    const freeIntervals: Array<{ start: number; end: number }> = [];
    let cursor = windowStart;
    for (const interval of merged) {
      if (interval.start - cursor >= 30) freeIntervals.push({ start: cursor, end: interval.start });
      cursor = Math.max(cursor, interval.end);
    }
    if (windowEnd - cursor >= 30) freeIntervals.push({ start: cursor, end: windowEnd });
    let slots = freeIntervals.flatMap((interval) => {
      const choices: Array<{ startTime: string; endTime: string; durationMinutes: number }> = [];
      for (let start = interval.start; start + 30 <= interval.end; start += 30) {
        const end = Math.min(start + 60, interval.end);
        choices.push({ startTime: minutesToTime(start), endTime: minutesToTime(end), durationMinutes: end - start });
      }
      return choices;
    });
    const today = new Date();
    const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (date === todayValue) {
      const currentMinutes = today.getHours() * 60 + today.getMinutes();
      slots = slots.filter((slot) => timeToMinutes(slot.startTime) > currentMinutes);
    }

    return { date, workingWindow: { startTime: minutesToTime(windowStart), endTime: minutesToTime(windowEnd) }, slots };
  }

  async createBooking(data: CreateStaffBookingDTO & { requirements?: string; estimatedCost?: number }, bookedById: string) {
    const { domesticStaffId, flatId, societyId, bookingDate, startTime, endTime, durationHours, workType } = data;

    // Validate required fields
    validateRequiredFields(data, ['domesticStaffId', 'flatId', 'societyId', 'bookingDate', 'startTime', 'endTime', 'durationHours', 'workType'], 'Booking');

    // Validate time format and range
    validateTimeRange(startTime, endTime);

    // Validate duration is positive
    validatePositiveNumber(durationHours, 'Duration hours');

    // Check staff availability
    const staff = await prisma.domesticStaff.findUnique({
      where: { id: domesticStaffId },
    });

    if (!staff || !staff.isActive) {
      throw new AppError('Staff not found or inactive', 404);
    }
    if (staff.societyId !== societyId) throw new AppError('Staff does not belong to this society', 403);

    const membership = await prisma.userFlatMembership.findFirst({
      where: { userId: bookedById, flatId, isActive: true },
      select: { id: true },
    });
    const bookingUser = await prisma.user.findUnique({ where: { id: bookedById }, select: { flatId: true } });
    if (!membership && bookingUser?.flatId !== flatId) throw new AppError('You can only book staff for your own flat', 403);

    const dateValue = bookingDate instanceof Date ? bookingDate.toISOString().slice(0, 10) : String(bookingDate).slice(0, 10);
    if (bookingDay(dateValue).getTime() < bookingDay(new Date().toISOString().slice(0, 10)).getTime()) {
      throw new AppError('Booking date cannot be in the past', 400);
    }
    const calculatedDuration = (timeToMinutes(endTime) - timeToMinutes(startTime)) / 60;
    if (Math.abs(calculatedDuration - durationHours) > 0.01) {
      throw new AppError('Booking duration does not match the selected time', 400);
    }
    const today = new Date();
    const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (dateValue === todayValue && timeToMinutes(startTime) <= today.getHours() * 60 + today.getMinutes()) {
      throw new AppError('This time slot has already passed', 400);
    }

    const weekday = weekdayFor(dateValue);
    const overlappingAssignments = await prisma.staffFlatAssignment.findMany({
      where: {
        domesticStaffId,
        isActive: true,
        workStartTime: { lt: endTime },
        workEndTime: { gt: startTime },
      },
      select: { workingDays: true },
    });
    if (overlappingAssignments.some((assignment) => dayMatches(assignment.workingDays, weekday))) {
      throw new AppError('This time is already assigned to another flat', 409);
    }

    // Check for conflicting bookings
    const conflictingBooking = await prisma.staffBooking.findFirst({
      where: {
        domesticStaffId,
        bookingDate: bookingDayRange(dateValue),
        status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] },
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
    });

    if (conflictingBooking) {
      throw new AppError('Staff is not available at this time', 400);
    }

    const booking = await prisma.staffBooking.create({
      data: {
        ...data,
        bookedById,
        bookingDate: bookingDay(dateValue),
        status: 'PENDING',
      },
      include: {
        domesticStaff: true,
        bookedBy: { select: { id: true, name: true, phone: true } },
        flat: true,
      },
    });

    // ARCH-3: Emit event for notification listener
    eventBus.emit('staff.booking-created', {
      bookingId: booking.id,
      staffId: booking.domesticStaffId,
      flatId: booking.flatId,
      societyId: booking.societyId,
      staffName: booking.domesticStaff.name,
      staffType: booking.domesticStaff.staffType,
      bookingDate: booking.bookingDate,
    });

    return booking;
  }

  async getBookings(filters: StaffBookingFilters & { bookingDate?: string }) {
    const { domesticStaffId, bookedById, flatId, status, bookingDate, page = 1, limit = 20 } = filters;

    const where: Prisma.StaffBookingWhereInput = {};
    if (domesticStaffId) where.domesticStaffId = domesticStaffId;
    if (bookedById) where.bookedById = bookedById;
    if (flatId) where.flatId = flatId;
    // Unanswered requests whose day is over can't be accepted any more — keep them out of the list
    where.AND = [notPastPendingWhere(), ...(status ? [bookingStatusWhere(status)] : [])];

    if (bookingDate) {
      const startOfDay = new Date(bookingDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(bookingDate);
      endOfDay.setHours(23, 59, 59, 999);
      where.bookingDate = {
        gte: startOfDay,
        lt: endOfDay,
      };
    }

    const [rawBookings, total] = await Promise.all([
      prisma.staffBooking.findMany({
        where,
        include: {
          domesticStaff: true,
          bookedBy: { select: { id: true, name: true, phone: true } },
          flat: true,
        },
        orderBy: { bookingDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.staffBooking.count({ where }),
    ]);
    // Same-day requests whose start time has passed
    const bookings = rawBookings
      .filter((booking) => booking.status !== 'PENDING' || !isBookingExpired(booking))
      .map(presentStaffBooking);

    return {
      bookings,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async acceptBooking(bookingId: string) {
    const booking = await prisma.staffBooking.findUnique({
      where: { id: bookingId },
      include: { domesticStaff: { select: { name: true, staffType: true } } },
    });

    if (!booking) {
      throw new AppError('Booking not found', 404);
    }

    if (booking.status !== 'PENDING') {
      throw new AppError('Booking is not pending', 400);
    }

    if (isBookingExpired(booking)) {
      throw new AppError(BOOKING_EXPIRED_MESSAGE, 400);
    }

    const updatedBooking = await prisma.staffBooking.update({
      where: { id: bookingId },
      data: {
        status: 'CONFIRMED',
        acceptedAt: new Date(),
      },
    });

    // ARCH-3: Emit event for notification listener
    eventBus.emit('staff.booking-accepted', {
      bookingId: booking.id,
      bookedById: booking.bookedById,
      staffName: booking.domesticStaff.name,
      staffType: booking.domesticStaff.staffType,
      societyId: booking.societyId,
    });

    return updatedBooking;
  }

  async rejectBooking(bookingId: string, rejectionReason: string) {
    const existing = await prisma.staffBooking.findUnique({
      where: { id: bookingId },
      select: { status: true, bookingDate: true, startTime: true },
    });
    if (!existing) {
      throw new AppError('Booking not found', 404);
    }
    if (existing.status !== 'PENDING') {
      throw new AppError('Booking is not pending', 400);
    }
    if (isBookingExpired(existing)) {
      throw new AppError(BOOKING_EXPIRED_MESSAGE, 400);
    }

    const booking = await prisma.staffBooking.update({
      where: { id: bookingId },
      data: {
        // Stored as CANCELLED + rejectedAt (no REJECTED enum value); reported as REJECTED
        status: 'CANCELLED',
        rejectedAt: new Date(),
        rejectionReason,
      },
    });

    return presentStaffBooking(booking);
  }

  async completeBooking(bookingId: string, actualDuration?: number, finalCost?: number) {
    const booking = await prisma.staffBooking.update({
      where: { id: bookingId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        actualDuration,
        finalCost,
      },
    });

    return booking;
  }

  // ============================================
  // REVIEWS & RATINGS
  // ============================================

  // IMP-6: Use transaction to prevent race condition in rating calculation
  async addReview(data: CreateStaffReviewDTO, reviewerId: string) {
    const { domesticStaffId, rating } = data;

    const review = await prisma.$transaction(async (tx) => {
      const createdReview = await tx.staffReview.create({
        data: {
          ...data,
          reviewerId,
        },
        include: {
          reviewer: { select: { id: true, name: true } },
          domesticStaff: true,
        },
      });

      const staff = await tx.domesticStaff.findUnique({
        where: { id: domesticStaffId },
      });

      if (staff) {
        const totalReviews = staff.totalReviews + 1;
        const currentTotal = (staff.rating || 0) * staff.totalReviews;
        const newRating = (currentTotal + rating) / totalReviews;

        await tx.domesticStaff.update({
          where: { id: domesticStaffId },
          data: {
            rating: newRating,
            totalReviews,
          },
        });
      }

      return createdReview;
    });

    return review;
  }

  async getStaffReviews(staffId: string) {
    const reviews = await prisma.staffReview.findMany({
      where: { domesticStaffId: staffId },
      include: {
        reviewer: { select: { id: true, name: true } },
        flat: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return reviews;
  }

  // ============================================
  // AVAILABILITY & SCHEDULING
  // ============================================

  async getAvailableStaff(filters: { societyId: string; staffType?: DomesticStaffType; bookingDate?: string; startTime?: string; endTime?: string }) {
    const { societyId, staffType, bookingDate, startTime, endTime } = filters;

    const where: Prisma.DomesticStaffWhereInput = {
      societyId,
      isActive: true,
      availabilityStatus: 'AVAILABLE',
    };

    if (staffType) where.staffType = staffType;

    const staff = await prisma.domesticStaff.findMany({
      where,
      include: {
        assignedFlats: {
          where: { isActive: true },
          include: { flat: true },
        },
      },
      orderBy: [
        { isVerified: 'desc' },
        { rating: 'desc' },
      ],
    });

    // If date and time provided, filter out staff with conflicting bookings
    if (bookingDate && startTime && endTime) {
      const availableStaff = [];
      for (const s of staff) {
        const hasConflict = await prisma.staffBooking.findFirst({
          where: {
            domesticStaffId: s.id,
            bookingDate: new Date(bookingDate),
            status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
            OR: [
              {
                AND: [
                  { startTime: { lte: startTime } },
                  { endTime: { gt: startTime } },
                ],
              },
              {
                AND: [
                  { startTime: { lt: endTime } },
                  { endTime: { gte: endTime } },
                ],
              },
            ],
          },
        });

        if (!hasConflict) {
          availableStaff.push(s);
        }
      }
      return availableStaff;
    }

    return staff;
  }

  async updateAvailabilityStatus(staffId: string, status: StaffAvailabilityStatus) {
    const staff = await prisma.domesticStaff.update({
      where: { id: staffId },
      data: { availabilityStatus: status },
    });

    return staff;
  }
}
