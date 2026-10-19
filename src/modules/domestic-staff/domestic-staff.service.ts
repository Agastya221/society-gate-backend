import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import { findInSociety, clampPagination } from '../../utils/scope';
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

/** Who is acting on a domestic-staff resource. societyId is always server-derived. */
export interface StaffCaller {
  userId: string;
  role: string;
  societyId: string;
}

export const isStaffAdminRole = (role: string) => role === 'ADMIN' || role === 'SUPER_ADMIN';

/**
 * Flats in `societyId` the user belongs to: their primary flat plus any active
 * flat memberships. Used to restrict residents to their own flat's records.
 */
export async function getCallerFlatIds(userId: string, societyId: string): Promise<string[]> {
  const [memberships, user] = await Promise.all([
    prisma.userFlatMembership.findMany({
      where: { userId, societyId, isActive: true, flatId: { not: null } },
      select: { flatId: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { flatId: true, flat: { select: { societyId: true } } },
    }),
  ]);
  const ids = memberships.map((m) => m.flatId).filter((id): id is string => Boolean(id));
  if (user?.flatId && user.flat?.societyId === societyId) ids.push(user.flatId);
  return [...new Set(ids)];
}

/** Non-admins may only act on records belonging to one of their own flats. */
async function assertOwnFlat(
  caller: StaffCaller,
  flatId: string | null | undefined,
  entity: string,
  forbiddenMessage?: string,
) {
  if (isStaffAdminRole(caller.role)) return;
  const flatIds = await getCallerFlatIds(caller.userId, caller.societyId);
  if (!flatId || !flatIds.includes(flatId)) {
    // Existing records: 404 so other flats' ids are indistinguishable from missing ones
    if (forbiddenMessage) throw new AppError(forbiddenMessage, 403);
    throw new AppError(`${entity} not found`, 404);
  }
}

/** Load an active-or-inactive staff member only if they belong to the society. */
const findStaffInSociety = (staffId: string, societyId: string, where?: object) =>
  findInSociety(prisma.domesticStaff, staffId, societyId, { entity: 'Staff', where });

// No 0/O/1/I/L — read aloud or typed at the gate, so visually/aurally ambiguous
// characters are dropped on purpose.
const PASS_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PASS_CODE_LENGTH = 8;

export function generatePassCodeCandidate(): string {
  let code = '';
  for (let i = 0; i < PASS_CODE_LENGTH; i++) {
    code += PASS_CODE_ALPHABET[Math.floor(Math.random() * PASS_CODE_ALPHABET.length)];
  }
  return code;
}

/** Generates a passCode guaranteed unique in the DB, retrying on the rare collision. */
export async function generateUniqueStaffPassCode(maxAttempts = 10): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = generatePassCodeCandidate();
    const existing = await prisma.domesticStaff.findUnique({
      where: { passCode: candidate }, select: { id: true },
    });
    if (!existing) return candidate;
  }
  throw new AppError('Could not generate a unique staff pass code', 500);
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
    // Spoken/typed fallback for when the guard has no camera handy
    const passCode = await generateUniqueStaffPassCode();

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
          passCode,
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

  async getStaffById(staffId: string, societyId: string) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Society-scoped lookup (findFirst keeps the include typing)
    const staff = await prisma.domesticStaff.findFirst({
      where: { id: staffId, societyId },
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

  /**
   * Staff QR pass source. Admins and guards may fetch any staff in the society; a
   * resident only staff assigned (active) to one of their flats.
   */
  async getStaffQRSource(staffId: string, caller: StaffCaller) {
    const staff = await prisma.domesticStaff.findFirst({
      where: { id: staffId, societyId: caller.societyId },
      select: { id: true, name: true, staffType: true, qrToken: true },
    });
    if (!staff) throw new AppError('Staff not found', 404);
    if (!isStaffAdminRole(caller.role) && caller.role !== 'GUARD') {
      const flatIds = await getCallerFlatIds(caller.userId, caller.societyId);
      const assigned = await prisma.staffFlatAssignment.findFirst({
        where: { domesticStaffId: staffId, isActive: true, flatId: { in: flatIds } },
        select: { id: true },
      });
      if (!assigned) throw new AppError('Staff not found', 404);
    }
    return staff;
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
    passCode?: string | null;
  }>(staff: T, now: Date) {
    // passCode is a gate-only secret (lets anyone claim to be this staff member at
    // the gate) — never let it leak into a resident/admin-facing staff list or profile.
    const { phone, createdAt, assignedFlats, reviews, attendanceRecords, passCode: _passCode, ...rest } = staff;

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
    const staff = await findStaffInSociety(staffId, societyId);

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
    await findStaffInSociety(staffId, societyId);

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

  async verifyStaff(staffId: string, verifiedBy: string, societyId: string) {
    const staff = await findStaffInSociety(staffId, societyId);

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

  async assignStaffToFlat(input: CreateStaffAssignmentDTO, caller: StaffCaller) {
    const { domesticStaffId, flatId } = input;
    if (!domesticStaffId || !flatId) {
      throw new AppError('domesticStaffId and flatId are required', 400);
    }

    // Both the staff member and the flat must be in the caller's society,
    // and a resident may only assign staff to their own flat
    await findStaffInSociety(domesticStaffId, caller.societyId);
    await findInSociety(prisma.flat, flatId, caller.societyId, { entity: 'Flat', select: { id: true } });
    await assertOwnFlat(caller, flatId, 'Flat', 'You can only assign staff to your own flat');

    // Only known assignment fields are client-settable
    const data: CreateStaffAssignmentDTO = {
      domesticStaffId,
      flatId,
      isPrimary: input.isPrimary,
      workingDays: input.workingDays,
      workStartTime: input.workStartTime,
      workEndTime: input.workEndTime,
      agreedRate: input.agreedRate,
      rateType: input.rateType,
    };

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

  /** Assignment by id, only if its flat is in the society (and, for residents, is their own flat). */
  private async _findAssignmentForCaller(assignmentId: string, caller: StaffCaller) {
    const assignment = await findInSociety(prisma.staffFlatAssignment, assignmentId, caller.societyId, {
      entity: 'Assignment',
      societyWhere: { flat: { societyId: caller.societyId } },
    });
    await assertOwnFlat(caller, assignment.flatId, 'Assignment');
    return assignment;
  }

  async updateAssignment(assignmentId: string, input: UpdateStaffAssignmentDTO, caller: StaffCaller) {
    await this._findAssignmentForCaller(assignmentId, caller);

    // Only known assignment fields are client-settable (never domesticStaffId/flatId)
    const data: UpdateStaffAssignmentDTO = {
      isPrimary: input.isPrimary,
      workingDays: input.workingDays,
      workStartTime: input.workStartTime,
      workEndTime: input.workEndTime,
      agreedRate: input.agreedRate,
      rateType: input.rateType,
      isActive: input.isActive,
    };

    const assignment = await prisma.staffFlatAssignment.update({
      where: { id: assignmentId },
      data,
    });

    return assignment;
  }

  async removeAssignment(assignmentId: string, caller: StaffCaller) {
    await this._findAssignmentForCaller(assignmentId, caller);

    await prisma.staffFlatAssignment.delete({
      where: { id: assignmentId },
    });

    return { message: 'Assignment removed successfully' };
  }

  async getStaffAssignments(staffId: string, societyId: string) {
    await findStaffInSociety(staffId, societyId);
    const assignments = await prisma.staffFlatAssignment.findMany({
      where: { domesticStaffId: staffId, flat: { societyId } },
      include: {
        flat: true,
      },
    });

    return assignments;
  }

  // ============================================
  // ATTENDANCE & CHECK-IN/OUT
  // ============================================

  async checkIn(data: StaffCheckInDTO & { notes?: string }, verifiedByGuardId?: string, caller?: StaffCaller) {
    const { domesticStaffId, flatId, societyId, checkInMethod = 'QR', notes } = data;

    // A resident must name one of their own flats (guards: any flat in the society, or none)
    if (caller && caller.role !== 'GUARD') {
      if (!flatId) {
        throw new AppError('flatId is required', 400);
      }
      await assertOwnFlat(caller, flatId, 'Flat', 'You can only check staff in to your own flat');
    }

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
    options: { checkOutMethod?: string; notify?: boolean; societyId?: string; caller?: StaffCaller } = {},
  ) {
    const { checkOutMethod = 'QR', notify = true, societyId, caller } = options;
    // Residents may only check out a visit to one of their own flats (guards: society-wide)
    const restrictToFlatIds = caller && caller.role !== 'GUARD' && !isStaffAdminRole(caller.role)
      ? await getCallerFlatIds(caller.userId, caller.societyId)
      : null;
    // Use transaction to prevent race conditions
    const result = await prisma.$transaction(async (tx) => {
      const staff = await tx.domesticStaff.findUnique({
        where: { id: domesticStaffId },
      });

      // Interactive callers pass their society; staff elsewhere are reported as not found
      if (!staff || (societyId && staff.societyId !== societyId)) {
        throw new AppError('Staff not found', 404);
      }
      if (!staff.isCurrentlyWorking) {
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
      if (restrictToFlatIds && (!attendance.flatId || !restrictToFlatIds.includes(attendance.flatId))) {
        throw new AppError('You can only check out staff working at your own flat', 403);
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

  async scanQRCode(qrToken: string, flatId: string, societyId: string, verifiedByGuardId?: string, caller?: StaffCaller) {
    if (!qrToken || typeof qrToken !== 'string') {
      throw new AppError('Invalid QR code', 404);
    }
    // A QR from another society is treated as unknown
    const staff = await prisma.domesticStaff.findFirst({
      where: { qrToken, societyId },
    });

    if (!staff) {
      throw new AppError('Invalid QR code', 404);
    }

    if (!staff.isActive) {
      throw new AppError('Staff is inactive', 400);
    }

    // Check if currently working - if yes, check out; if no, check in
    if (staff.isCurrentlyWorking) {
      return await this.checkOut(staff.id, undefined, { societyId, caller });
    } else {
      return await this.checkIn({
        domesticStaffId: staff.id,
        flatId,
        societyId,
        checkInMethod: 'QR',
      }, verifiedByGuardId, caller);
    }
  }

  async getAttendanceRecords(
    filters: Omit<AttendanceFilters, 'societyId'> & { startDate?: string; endDate?: string },
    caller: StaffCaller,
  ) {
    const { domesticStaffId, flatId, startDate, endDate } = filters;
    const { page, limit, skip } = clampPagination(filters.page, filters.limit);

    // Always pinned to the caller's society (never a client-supplied one)
    const where: Prisma.StaffAttendanceWhereInput = { societyId: caller.societyId };
    if (domesticStaffId) where.domesticStaffId = domesticStaffId;
    if (flatId) where.flatId = flatId;

    // Residents only see visits to their own flats (not their staff's attendance elsewhere)
    if (caller.role === 'RESIDENT') {
      const flatIds = await getCallerFlatIds(caller.userId, caller.societyId);
      where.AND = [{ flatId: { in: flatIds } }];
    }

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
        skip,
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

  async createBooking(
    input: CreateStaffBookingDTO & { requirements?: string; estimatedCost?: number },
    bookedById: string,
    caller: StaffCaller,
  ) {
    // Society always comes from the caller; only known booking fields are client-settable
    const societyId = caller.societyId;
    const data = {
      domesticStaffId: input.domesticStaffId,
      flatId: input.flatId,
      societyId,
      bookingDate: input.bookingDate,
      startTime: input.startTime,
      endTime: input.endTime,
      durationHours: input.durationHours,
      workType: input.workType,
      requirements: input.requirements,
      estimatedCost: input.estimatedCost,
    };
    const { domesticStaffId, flatId, bookingDate, startTime, endTime, durationHours, workType } = data;

    // Validate required fields
    validateRequiredFields(data, ['domesticStaffId', 'flatId', 'societyId', 'bookingDate', 'startTime', 'endTime', 'durationHours', 'workType'], 'Booking');

    // Validate time format and range
    validateTimeRange(startTime, endTime);

    // Validate duration is positive
    validatePositiveNumber(durationHours, 'Duration hours');

    // Staff and flat must both be in the caller's society; residents book only for their own flat
    const staff = await prisma.domesticStaff.findFirst({
      where: { id: domesticStaffId, societyId },
    });

    if (!staff || !staff.isActive) {
      throw new AppError('Staff not found or inactive', 404);
    }

    await findInSociety(prisma.flat, flatId, societyId, { entity: 'Flat', select: { id: true } });
    await assertOwnFlat(caller, flatId, 'Flat', 'You can only book staff for your own flat');

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

  async getBookings(filters: Omit<StaffBookingFilters, 'societyId'> & { bookingDate?: string }, caller: StaffCaller) {
    const { domesticStaffId, bookedById, flatId, status, bookingDate } = filters;
    const { page, limit, skip } = clampPagination(filters.page, filters.limit);

    // Always pinned to the caller's society (never a client-supplied one)
    const where: Prisma.StaffBookingWhereInput = { societyId: caller.societyId };
    if (domesticStaffId) where.domesticStaffId = domesticStaffId;
    if (bookedById) where.bookedById = bookedById;
    if (flatId) where.flatId = flatId;

    // Non-admins only see bookings for their own flats or ones they made themselves
    const ownership: Prisma.StaffBookingWhereInput[] = [];
    if (!isStaffAdminRole(caller.role)) {
      const flatIds = await getCallerFlatIds(caller.userId, caller.societyId);
      ownership.push({ OR: [{ flatId: { in: flatIds } }, { bookedById: caller.userId }] });
    }

    // Unanswered requests whose day is over can't be accepted any more — keep them out of the list
    where.AND = [notPastPendingWhere(), ...ownership, ...(status ? [bookingStatusWhere(status)] : [])];

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
        skip,
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

  /** Booking by id, only if it is in the caller's society (and, for residents, for their own flat). */
  private async _findBookingForCaller(bookingId: string, caller: StaffCaller) {
    const booking = await findInSociety(prisma.staffBooking, bookingId, caller.societyId, { entity: 'Booking' });
    if (!isStaffAdminRole(caller.role) && booking.bookedById !== caller.userId) {
      await assertOwnFlat(caller, booking.flatId, 'Booking');
    }
    return booking;
  }

  async acceptBooking(bookingId: string, caller: StaffCaller) {
    const booking = await prisma.staffBooking.findFirst({
      where: { id: bookingId, societyId: caller.societyId },
      include: { domesticStaff: { select: { name: true, staffType: true } } },
    });
    if (!booking) {
      throw new AppError('Booking not found', 404);
    }
    if (!isStaffAdminRole(caller.role) && booking.bookedById !== caller.userId) {
      await assertOwnFlat(caller, booking.flatId, 'Booking');
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

  async rejectBooking(bookingId: string, rejectionReason: string, caller: StaffCaller) {
    const existing = await this._findBookingForCaller(bookingId, caller);
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

  /**
   * The resident (or an admin) cancels a booking before the work is done. Stored as CANCELLED with no rejectedAt,
   * which is how the list tells it apart from a booking the staff member declined.
   */
  async cancelBooking(bookingId: string, caller: StaffCaller) {
    const existing = await this._findBookingForCaller(bookingId, caller);
    if (existing.status !== 'PENDING' && existing.status !== 'CONFIRMED') {
      throw new AppError(`This booking is already ${String(existing.status).toLowerCase().replace('_', ' ')} and cannot be cancelled`, 400);
    }
    const changed = await prisma.staffBooking.updateMany({
      where: { id: bookingId, status: { in: ['PENDING', 'CONFIRMED'] } },
      data: { status: 'CANCELLED', rejectionReason: 'Cancelled by the resident' },
    });
    if (changed.count !== 1) throw new AppError('This booking changed meanwhile. Refresh and try again.', 409);

    const booking = await prisma.staffBooking.findUniqueOrThrow({
      where: { id: bookingId },
      include: { domesticStaff: { select: { id: true, name: true, staffType: true } } },
    });
    eventBus.emit('staff.booking-cancelled', {
      bookingId: booking.id,
      staffId: booking.domesticStaff.id,
      societyId: booking.societyId,
      staffName: booking.domesticStaff.name,
      staffType: String(booking.domesticStaff.staffType),
      bookingDate: booking.bookingDate,
    });
    return booking;
  }

  async completeBooking(bookingId: string, caller: StaffCaller, actualDuration?: number, finalCost?: number) {
    const existing = await this._findBookingForCaller(bookingId, caller);

    // Only work the staff accepted can be completed: a pending, declined or cancelled
    // booking marked "completed" would put work that never happened in the staff history.
    if (existing.status !== 'CONFIRMED') {
      throw new AppError(
        existing.status === 'COMPLETED'
          ? 'This booking is already completed'
          : `Only a confirmed booking can be completed (this one is ${String(existing.status).toLowerCase()})`,
        400,
      );
    }

    // Conditional update so a concurrent cancel or the auto-complete job can't be overwritten
    const changed = await prisma.staffBooking.updateMany({
      where: { id: bookingId, status: 'CONFIRMED' },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        actualDuration,
        finalCost,
      },
    });
    if (changed.count !== 1) throw new AppError('This booking changed meanwhile. Refresh and try again.', 409);

    return prisma.staffBooking.findUniqueOrThrow({ where: { id: bookingId } });
  }

  // ============================================
  // REVIEWS & RATINGS
  // ============================================

  // IMP-6: Use transaction to prevent race condition in rating calculation
  async addReview(input: CreateStaffReviewDTO, reviewerId: string, caller: StaffCaller) {
    const { domesticStaffId, flatId } = input;
    const rating = Number(input.rating);
    if (!domesticStaffId || !flatId) {
      throw new AppError('domesticStaffId and flatId are required', 400);
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new AppError('Rating must be between 1 and 5', 400);
    }

    // Staff and flat must be in the caller's society; residents review from their own flat
    await findStaffInSociety(domesticStaffId, caller.societyId);
    await findInSociety(prisma.flat, flatId, caller.societyId, { entity: 'Flat', select: { id: true } });
    await assertOwnFlat(caller, flatId, 'Flat', 'You can only review staff from your own flat');

    // Only known review fields are client-settable
    const data: CreateStaffReviewDTO = {
      domesticStaffId,
      flatId,
      rating,
      review: input.review,
      workQuality: input.workQuality,
      punctuality: input.punctuality,
      behavior: input.behavior,
      workType: input.workType,
      workDate: input.workDate,
    };

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

  async getStaffReviews(staffId: string, societyId: string) {
    await findStaffInSociety(staffId, societyId);
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

  async updateAvailabilityStatus(staffId: string, status: StaffAvailabilityStatus, societyId: string) {
    await findStaffInSociety(staffId, societyId);
    const staff = await prisma.domesticStaff.update({
      where: { id: staffId },
      data: { availabilityStatus: status },
    });

    return staff;
  }
}
