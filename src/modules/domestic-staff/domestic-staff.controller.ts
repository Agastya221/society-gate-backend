import type { Response, Request } from 'express';
import { DomesticStaffService } from './domestic-staff.service';
import { generateQRImage } from '../../utils/QrGenerate';
import { getErrorMessage, getErrorStatusCode } from '../../utils/errorHandler';
import type { StaffFilters, StaffBookingFilters, DomesticStaffType, StaffAvailabilityStatus, StaffBookingStatus } from '../../types';

const staffService = new DomesticStaffService();

// ============================================
// STAFF MANAGEMENT
// ============================================

export const createStaff = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const staff = await staffService.createStaff(req.body, userId);

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
    const filters: StaffFilters & { search?: string } = {
      societyId: req.user!.societyId!,
      staffType: req.query.staffType as DomesticStaffType | undefined,
      availabilityStatus: req.query.availabilityStatus as StaffAvailabilityStatus | undefined,
      isVerified: req.query.isVerified === 'true' ? true : req.query.isVerified === 'false' ? false : undefined,
      isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
      search: req.query.search as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
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
    const staff = await staffService.getStaffById(String(id));

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
    const staff = await staffService.updateStaff(String(id), req.body);

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
    const result = await staffService.deleteStaff(String(id));

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
    const staff = await staffService.verifyStaff(String(id), userId);

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
    const staff = await staffService.getStaffById(String(id));

    const qrCodeImage = await generateQRImage(staff.qrToken);

    res.status(200).json({
      success: true,
      data: {
        staffId: staff.id,
        name: staff.name,
        staffType: staff.staffType,
        qrToken: staff.qrToken,
        qrCodeImage,
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
    const assignment = await staffService.assignStaffToFlat(req.body);

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
    const assignment = await staffService.updateAssignment(String(id), req.body);

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
    const result = await staffService.removeAssignment(String(id));

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
    const assignments = await staffService.getStaffAssignments(String(staffId));

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

    const attendance = await staffService.checkIn(req.body, verifiedByGuardId);

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
    const attendance = await staffService.checkOut(String(staffId), workCompleted);

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
    const { qrToken, flatId, societyId } = req.body;
    const userId = req.user!.id;
    const role = req.user!.role;
    const verifiedByGuardId = role === 'GUARD' ? userId : undefined;

    const result = await staffService.scanQRCode(qrToken, flatId, societyId, verifiedByGuardId);

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
    const filters = {
      societyId: req.query.societyId as string | undefined,
      flatId: req.query.flatId as string | undefined,
      domesticStaffId: req.query.domesticStaffId as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    };
    const result = await staffService.getAttendanceRecords(filters);

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
    const booking = await staffService.createBooking(req.body, userId);

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
    const result = await staffService.getBookings(filters);

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
    const booking = await staffService.acceptBooking(String(id));

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
    const { rejectionReason } = req.body;
    const booking = await staffService.rejectBooking(String(id), rejectionReason);

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
    const { actualDuration, finalCost } = req.body;
    const booking = await staffService.completeBooking(String(id), actualDuration, finalCost);

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
    const review = await staffService.addReview(req.body, userId);

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
    const reviews = await staffService.getStaffReviews(String(staffId));

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
      societyId: req.user!.societyId!,
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
    const { status } = req.body;
    const staff = await staffService.updateAvailabilityStatus(String(id), status);

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
