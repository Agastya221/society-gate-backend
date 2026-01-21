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
router.get('/', authenticate, getStaffList);
router.get('/available', authenticate, getAvailableStaff);

// Residents can add staff
router.post('/', authenticate, authorize('RESIDENT', 'ADMIN'), createStaff);

// ============================================
// FLAT ASSIGNMENTS - Specific routes
// ============================================

router.post('/assignments', authenticate, authorize('RESIDENT', 'ADMIN'), assignStaffToFlat);
router.patch('/assignments/:id', authenticate, authorize('RESIDENT', 'ADMIN'), updateAssignment);
router.delete('/assignments/:id', authenticate, authorize('RESIDENT', 'ADMIN'), removeAssignment);

// ============================================
// ATTENDANCE & CHECK-IN/OUT - Specific routes
// ============================================

// Guards and residents can manage check-in/out
router.post('/check-in', authenticate, authorize('GUARD', 'RESIDENT'), checkIn);
router.post('/scan', authenticate, authorize('GUARD', 'RESIDENT'), scanQRCode);

// View attendance records
router.get('/attendance/records', authenticate, getAttendanceRecords);

// ============================================
// BOOKINGS (On-demand hiring) - Specific routes
// ============================================

// Residents can book staff
router.post('/bookings', authenticate, authorize('RESIDENT', 'ADMIN'), createBooking);
router.get('/bookings/list', authenticate, getBookings);

// Staff/Admin can accept/reject bookings (for now, admin manages)
router.patch('/bookings/:id/accept', authenticate, authorize('ADMIN', 'RESIDENT'), acceptBooking);
router.patch('/bookings/:id/reject', authenticate, authorize('ADMIN', 'RESIDENT'), rejectBooking);
router.patch('/bookings/:id/complete', authenticate, authorize('ADMIN', 'RESIDENT'), completeBooking);

// ============================================
// REVIEWS & RATINGS - Specific routes
// ============================================

// Residents can review staff
router.post('/reviews', authenticate, authorize('RESIDENT', 'ADMIN'), addReview);

// ============================================
// PARAMETERIZED ROUTES - Must come LAST
// ============================================

// Staff-specific routes (with :id or :staffId)
router.get('/:id', authenticate, getStaffById);
router.get('/:id/qr', authenticate, getStaffQRCode);
router.patch('/:id', authenticate, authorize('RESIDENT', 'ADMIN'), updateStaff);
router.delete('/:id', authenticate, authorize('RESIDENT', 'ADMIN'), deleteStaff);
router.patch('/:id/verify', authenticate, authorize('ADMIN'), verifyStaff);
router.patch('/:id/availability', authenticate, authorize('ADMIN', 'RESIDENT'), updateAvailabilityStatus);

// Get specific staff's assignments and reviews
router.get('/:staffId/assignments', authenticate, getStaffAssignments);
router.get('/:staffId/reviews', authenticate, getStaffReviews);
router.post('/:staffId/check-out', authenticate, authorize('GUARD', 'RESIDENT'), checkOut);

export default router;
