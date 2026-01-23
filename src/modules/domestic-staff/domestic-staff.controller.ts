import type { Response, Request } from 'express';
import { DomesticStaffService } from './domestic-staff.service';
import { generateQRImage } from '../../utils/QrGenerate';

const staffService = new DomesticStaffService();

// ============================================
// STAFF MANAGEMENT
// ============================================

export const createStaff = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const staff = await staffService.createStaff(req.body, userId);

    res.status(201).json({
      success: true,
      message: 'Staff added successfully',
      data: staff,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to add staff',
    });
  }
};

export const getStaffList = async (req: Request, res: Response) => {
  try {
    const filters = req.query;
    const result = await staffService.getStaffList(filters);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to fetch staff list',
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
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to fetch staff details',
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
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to update staff',
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
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to delete staff',
    });
  }
};

export const verifyStaff = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;
    const staff = await staffService.verifyStaff(String(id), userId);

    res.status(200).json({
      success: true,
      message: staff.isVerified ? 'Staff verified' : 'Staff unverified',
      data: staff,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to verify staff',
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
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to generate QR code',
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
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to assign staff',
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
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to update assignment',
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
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to remove assignment',
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
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to fetch assignments',
    });
  }
};

// ============================================
// ATTENDANCE & CHECK-IN/OUT
// ============================================

export const checkIn = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const role = (req as any).user.role;
    const verifiedByGuardId = role === 'GUARD' ? userId : undefined;

    const attendance = await staffService.checkIn(req.body, verifiedByGuardId);

    res.status(200).json({
      success: true,
      message: 'Staff checked in successfully',
      data: attendance,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to check in',
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
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to check out',
    });
  }
};

export const scanQRCode = async (req: Request, res: Response) => {
  try {
    const { qrToken, flatId, societyId } = req.body;
    const userId = (req as any).user.id;
    const role = (req as any).user.role;
    const verifiedByGuardId = role === 'GUARD' ? userId : undefined;

    const result = await staffService.scanQRCode(qrToken, flatId, societyId, verifiedByGuardId);

    res.status(200).json({
      success: true,
      message: result.checkOutTime ? 'Staff checked out successfully' : 'Staff checked in successfully',
      data: result,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to scan QR code',
    });
  }
};

export const getAttendanceRecords = async (req: Request, res: Response) => {
  try {
    const filters = req.query;
    const result = await staffService.getAttendanceRecords(filters);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to fetch attendance records',
    });
  }
};

// ============================================
// BOOKINGS
// ============================================

export const createBooking = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const booking = await staffService.createBooking(req.body, userId);

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: booking,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to create booking',
    });
  }
};

export const getBookings = async (req: Request, res: Response) => {
  try {
    const filters = req.query;
    const result = await staffService.getBookings(filters);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to fetch bookings',
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
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to accept booking',
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
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to reject booking',
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
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to complete booking',
    });
  }
};

// ============================================
// REVIEWS & RATINGS
// ============================================

export const addReview = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const review = await staffService.addReview(req.body, userId);

    res.status(201).json({
      success: true,
      message: 'Review added successfully',
      data: review,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to add review',
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
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to fetch reviews',
    });
  }
};

// ============================================
// AVAILABILITY
// ============================================

export const getAvailableStaff = async (req: Request, res: Response) => {
  try {
    const filters = req.query;
    const staff = await staffService.getAvailableStaff(filters);

    res.status(200).json({
      success: true,
      data: staff,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to fetch available staff',
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
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to update availability status',
    });
  }
};
