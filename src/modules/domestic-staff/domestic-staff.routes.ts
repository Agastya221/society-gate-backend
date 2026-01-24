import { Router } from 'express';
import {
  // Staff Management
  createStaff,
  getStaffList,
  getStaffById,
  updateStaff,
  deleteStaff,
  verifyStaff,
  getStaffQRCode,

  // Flat Assignments
  assignStaffToFlat,
  updateAssignment,
  removeAssignment,
  getStaffAssignments,

  // Attendance
  checkIn,
  checkOut,
  scanQRCode,
  getAttendanceRecords,

  // Bookings
  createBooking,
  getBookings,
  acceptBooking,
  rejectBooking,
  completeBooking,

  // Reviews
  addReview,
  getStaffReviews,

  // Availability
  getAvailableStaff,
  updateAvailabilityStatus,
} from './domestic-staff.controller';
import { authenticate, authorize, ensureSameSociety } from '../../middlewares/auth.middleware';

const router = Router();

// Apply authentication and society isolation globally
router.use(authenticate);
router.use(ensureSameSociety);

// ============================================
// IMPORTANT: Specific routes MUST come before parameterized routes
// to avoid Express matching /:id for paths like /available
// ============================================

// ============================================
// STAFF MANAGEMENT - Specific routes first
// ============================================

// All users can view staff list and available staff
router.get('/', getStaffList);
router.get('/available', getAvailableStaff);

// Residents can add staff
router.post('/', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), createStaff);

// ============================================
// FLAT ASSIGNMENTS - Specific routes
// ============================================

router.post('/assignments', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), assignStaffToFlat);
router.patch('/assignments/:id', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), updateAssignment);
router.delete('/assignments/:id', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), removeAssignment);

// ============================================
// ATTENDANCE & CHECK-IN/OUT - Specific routes
// ============================================

// Guards and residents can manage check-in/out
router.post('/check-in', authorize('GUARD', 'RESIDENT'), checkIn);
router.post('/scan', authorize('GUARD', 'RESIDENT'), scanQRCode);

// View attendance records
router.get('/attendance/records', getAttendanceRecords);

// ============================================
// BOOKINGS (On-demand hiring) - Specific routes
// ============================================

// Residents can book staff
router.post('/bookings', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), createBooking);
router.get('/bookings/list', getBookings);

// Staff/Admin can accept/reject bookings (for now, admin manages)
router.patch('/bookings/:id/accept', authorize('ADMIN', 'SUPER_ADMIN', 'RESIDENT'), acceptBooking);
router.patch('/bookings/:id/reject', authorize('ADMIN', 'SUPER_ADMIN', 'RESIDENT'), rejectBooking);
router.patch('/bookings/:id/complete', authorize('ADMIN', 'SUPER_ADMIN', 'RESIDENT'), completeBooking);

// ============================================
// REVIEWS & RATINGS - Specific routes
// ============================================

// Residents can review staff
router.post('/reviews', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), addReview);

// ============================================
// PARAMETERIZED ROUTES - Must come LAST
// ============================================

// Staff-specific routes (with :id or :staffId)
router.get('/:id', getStaffById);
router.get('/:id/qr', getStaffQRCode);
router.patch('/:id', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), updateStaff);
router.delete('/:id', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), deleteStaff);
router.patch('/:id/verify', authorize('ADMIN', 'SUPER_ADMIN'), verifyStaff);
router.patch('/:id/availability', authorize('ADMIN', 'SUPER_ADMIN', 'RESIDENT'), updateAvailabilityStatus);

// Get specific staff's assignments and reviews
router.get('/:staffId/assignments', getStaffAssignments);
router.get('/:staffId/reviews', getStaffReviews);
router.post('/:staffId/check-out', authorize('GUARD', 'RESIDENT'), checkOut);

export default router;
