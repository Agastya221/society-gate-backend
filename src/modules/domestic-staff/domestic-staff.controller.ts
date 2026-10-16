import type { Response, Request, NextFunction } from 'express';
import { DomesticStaffService, type StaffCaller } from './domestic-staff.service';
import { getErrorMessage, getErrorStatusCode } from '../../utils/errorHandler';
import { getSocietyId, clampPagination } from '../../utils/scope';
import { AppError } from '../../utils/ResponseHandler';
import { isOwnedUploadKey } from '../../utils/s3';
import type { StaffFilters, StaffBookingFilters, DomesticStaffType, StaffAvailabilityStatus, StaffBookingStatus } from '../../types';

const staffService = new DomesticStaffService();

// Staff fields residents must never receive (QR pass token, gate passCode, ID-proof / Aadhaar details)
const RESIDENT_HIDDEN_STAFF_FIELDS = new Set(['qrToken', 'passCode', 'idProofType', 'idProofNumber', 'idProofUrl']);

function stripHiddenStaffFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripHiddenStaffFields);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (!RESIDENT_HIDDEN_STAFF_FIELDS.has(key)) out[key] = stripHiddenStaffFields(val);
    }
    return out;
  }
  return value;
}

/**
 * Router-level: for non-admin, non-guard callers every JSON response from this module
 * (lists, by-id, bookings/attendance/assignment includes) has QR tokens and ID-proof
 * details removed. Runs at send time, so cached bodies are filtered too.
 */
export const hideSensitiveStaffFields = (req: Request, res: Response, next: NextFunction) => {
  const role = req.user?.role;
  if (role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'GUARD') return next();
  const json = res.json.bind(res);
  // Unfiltered sender for the one route that may hand a resident a QR token (GET /:id/qr)
  res.locals.sendUnfilteredJson = json;
  res.json = ((body: unknown) => json(stripHiddenStaffFields(body))) as typeof res.json;
  next();
};

/** The acting user; society is server-derived (only SUPER_ADMIN may pick one). */
const callerOf = (req: Request): StaffCaller => ({
  userId: req.user!.id,
  role: req.user!.role,
  societyId: getSocietyId(req),
});

/** A staff photo must be a staff-photos key this caller uploaded via /upload. */
function assertOwnedStaffPhoto(photoUrl: unknown, userId: string) {
  if (photoUrl === undefined) return;
  if (!isOwnedUploadKey(photoUrl, userId, ['staff-photos'])) {
    throw new AppError('photoUrl must be a staff photo you uploaded', 400);
  }
}

// ============================================
// STAFF MANAGEMENT
// ============================================

export const createStaff = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const societyId = getSocietyId(req);
    assertOwnedStaffPhoto(req.body?.photoUrl, userId);
    const staff = await staffService.createStaff({ ...req.body, societyId }, userId);

    res.status(201).json({
      success: true,
      message: 'Staff added successfully',
      data: staff,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const getStaffList = async (req: Request, res: Response) => {
  try {
    const { page, limit } = clampPagination(req.query.page, req.query.limit);
    const filters: StaffFilters & { search?: string } = {
      societyId: getSocietyId(req),
      staffType: req.query.staffType as DomesticStaffType | undefined,
      availabilityStatus: req.query.availabilityStatus as StaffAvailabilityStatus | undefined,
      isVerified: req.query.isVerified === 'true' ? true : req.query.isVerified === 'false' ? false : undefined,
      isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
      search: req.query.search as string | undefined,
      page,
      limit,
    };
    const result = await staffService.getStaffList(filters);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const getStaffById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const staff = await staffService.getStaffById(String(id), getSocietyId(req));

    res.status(200).json({
      success: true,
      data: staff,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const updateStaff = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    assertOwnedStaffPhoto(req.body?.photoUrl, req.user!.id);
    const staff = await staffService.updateStaff(String(id), req.body, getSocietyId(req));

    res.status(200).json({
      success: true,
      message: 'Staff updated successfully',
      data: staff,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const deleteStaff = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await staffService.deleteStaff(String(id), getSocietyId(req));

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const verifyStaff = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const staff = await staffService.verifyStaff(String(id), userId, getSocietyId(req));

    res.status(200).json({
      success: true,
      message: staff.isVerified ? 'Staff verified' : 'Staff unverified',
      data: staff,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const getStaffQRCode = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const caller = callerOf(req);
    const staff = await staffService.getStaffQRSource(String(id), caller);

    // Return only the token — frontend renders the QR code
    // Backend generates QR image on-demand only for emails/WhatsApp/PDF.
    // Access was checked above, so bypass the resident field filter for this response.
    const send = (res.locals.sendUnfilteredJson as Response['json'] | undefined) ?? res.json.bind(res);
    res.status(200);
    send({
      success: true,
      data: {
        staffId: staff.id,
        name: staff.name,
        staffType: staff.staffType,
        qrToken: staff.qrToken,
      },
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

// ============================================
// FLAT ASSIGNMENTS
// ============================================

export const assignStaffToFlat = async (req: Request, res: Response) => {
  try {
    const assignment = await staffService.assignStaffToFlat(req.body ?? {}, callerOf(req));

    res.status(201).json({
      success: true,
      message: 'Staff assigned to flat successfully',
      data: assignment,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const updateAssignment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const assignment = await staffService.updateAssignment(String(id), req.body ?? {}, callerOf(req));

    res.status(200).json({
      success: true,
      message: 'Assignment updated successfully',
      data: assignment,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const removeAssignment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await staffService.removeAssignment(String(id), callerOf(req));

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const getStaffAssignments = async (req: Request, res: Response) => {
  try {
    const { staffId } = req.params;
    const assignments = await staffService.getStaffAssignments(String(staffId), getSocietyId(req));

    res.status(200).json({
      success: true,
      data: assignments,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

// ============================================
// ATTENDANCE & CHECK-IN/OUT
// ============================================

export const checkIn = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    const verifiedByGuardId = role === 'GUARD' ? userId : undefined;
    // Body is validated by staffCheckInSchema; society always comes from the caller
    const { domesticStaffId, staffId, flatId, checkInMethod, notes } = req.body;

    const caller = callerOf(req);
    const attendance = await staffService.checkIn(
      {
        domesticStaffId: domesticStaffId ?? staffId,
        flatId,
        societyId: caller.societyId,
        checkInMethod,
        notes,
      },
      verifiedByGuardId,
      caller,
    );

    res.status(200).json({
      success: true,
      message: 'Staff checked in successfully',
      data: attendance,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const checkOut = async (req: Request, res: Response) => {
  try {
    const { staffId } = req.params;
    const { workCompleted } = req.body;
    const caller = callerOf(req);
    const attendance = await staffService.checkOut(String(staffId), workCompleted, { societyId: caller.societyId, caller });

    res.status(200).json({
      success: true,
      message: 'Staff checked out successfully',
      data: attendance,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const scanQRCode = async (req: Request, res: Response) => {
  try {
    const { qrToken, flatId } = req.body;
    const userId = req.user!.id;
    const role = req.user!.role;
    const verifiedByGuardId = role === 'GUARD' ? userId : undefined;
    // ensureSameSociety already rejects a mismatching body.societyId; always use the caller's
    const caller = callerOf(req);

    const result = await staffService.scanQRCode(qrToken, flatId, caller.societyId, verifiedByGuardId, caller);

    res.status(200).json({
      success: true,
      message: result.checkOutTime ? 'Staff checked out successfully' : 'Staff checked in successfully',
      data: result,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const getAttendanceRecords = async (req: Request, res: Response) => {
  try {
    // Society is never taken from the query (only SUPER_ADMIN may pick one, via req.societyId)
    const filters = {
      flatId: req.query.flatId as string | undefined,
      domesticStaffId: req.query.domesticStaffId as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    };
    const result = await staffService.getAttendanceRecords(filters, callerOf(req));

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

// ============================================
// BOOKINGS
// ============================================

export const createBooking = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const caller = callerOf(req);
    const flatId = req.user!.flatId ?? req.body?.flatId;
    const booking = await staffService.createBooking({ ...req.body, flatId, societyId: caller.societyId }, userId, caller);

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: booking,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const getOpenSlots = async (req: Request, res: Response) => {
  try {
    const societyId = getSocietyId(req);
    const result = await staffService.getOpenSlots(String(req.params.id), String(req.query.date ?? ''), societyId);
    res.status(200).json({ success: true, data: result });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const getBookings = async (req: Request, res: Response) => {
  try {
    const filters: StaffBookingFilters & { bookingDate?: string } = {
      domesticStaffId: req.query.domesticStaffId as string | undefined,
      bookedById: req.query.bookedById as string | undefined,
      flatId: req.query.flatId as string | undefined,
      status: req.query.status as StaffBookingStatus | undefined,
      bookingDate: req.query.bookingDate as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    };
    const result = await staffService.getBookings(filters, callerOf(req));

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const acceptBooking = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const booking = await staffService.acceptBooking(String(id), callerOf(req));

    res.status(200).json({
      success: true,
      message: 'Booking accepted successfully',
      data: booking,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const rejectBooking = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body ?? {};
    const booking = await staffService.rejectBooking(String(id), rejectionReason, callerOf(req));

    res.status(200).json({
      success: true,
      message: 'Booking rejected',
      data: booking,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const completeBooking = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { actualDuration, finalCost } = req.body ?? {};
    const booking = await staffService.completeBooking(String(id), callerOf(req), actualDuration, finalCost);

    res.status(200).json({
      success: true,
      message: 'Booking completed successfully',
      data: booking,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

// ============================================
// REVIEWS & RATINGS
// ============================================

export const addReview = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const body = req.body ?? {};
    // The resident app sends { staffId, rating, comment }; default the flat to the caller's own
    const review = await staffService.addReview(
      {
        ...body,
        domesticStaffId: body.domesticStaffId ?? body.staffId,
        flatId: body.flatId ?? req.user!.flatId,
        review: body.review ?? body.comment,
      },
      userId,
      callerOf(req),
    );

    res.status(201).json({
      success: true,
      message: 'Review added successfully',
      data: review,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const getStaffReviews = async (req: Request, res: Response) => {
  try {
    const { staffId } = req.params;
    const reviews = await staffService.getStaffReviews(String(staffId), getSocietyId(req));

    res.status(200).json({
      success: true,
      data: reviews,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

// ============================================
// AVAILABILITY
// ============================================

export const getAvailableStaff = async (req: Request, res: Response) => {
  try {
    const filters = {
      societyId: getSocietyId(req),
      staffType: req.query.staffType as DomesticStaffType | undefined,
      bookingDate: req.query.bookingDate as string | undefined,
      startTime: req.query.startTime as string | undefined,
      endTime: req.query.endTime as string | undefined,
    };
    const staff = await staffService.getAvailableStaff(filters);

    res.status(200).json({
      success: true,
      data: staff,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const updateAvailabilityStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body ?? {};
    const staff = await staffService.updateAvailabilityStatus(String(id), status, getSocietyId(req));

    res.status(200).json({
      success: true,
      message: 'Availability status updated',
      data: staff,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const getTypeSummary = async (req: Request, res: Response) => {
  try {
    const societyId = getSocietyId(req);
    const types = await staffService.getTypeSummary(societyId);

    res.status(200).json({
      success: true,
      data: types,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};
