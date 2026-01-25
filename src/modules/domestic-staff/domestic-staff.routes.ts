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
import { cache, clearCacheAfter } from '../../middlewares/cache.middleware';

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

// All users can view staff list and available staff (cached)
router.get('/', cache({ ttl: 120, keyPrefix: 'staff', varyBy: ['societyId'] }), getStaffList);
router.get('/available', cache({ ttl: 60, keyPrefix: 'staff', varyBy: ['societyId'] }), getAvailableStaff);

// Residents can add staff
router.post('/', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['staff:*']), createStaff);

// ============================================
// FLAT ASSIGNMENTS - Specific routes
// ============================================

router.post('/assignments', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['staff:*']), assignStaffToFlat);
router.patch('/assignments/:id', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['staff:*']), updateAssignment);
router.delete('/assignments/:id', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['staff:*']), removeAssignment);

// ============================================
// ATTENDANCE & CHECK-IN/OUT - Specific routes
// ============================================

// Guards and residents can manage check-in/out
router.post('/check-in', authorize('GUARD', 'RESIDENT'), clearCacheAfter(['staff:*']), checkIn);
router.post('/scan', authorize('GUARD', 'RESIDENT'), clearCacheAfter(['staff:*']), scanQRCode);

// View attendance records (cached)
router.get('/attendance/records', cache({ ttl: 60, keyPrefix: 'staff', varyBy: ['societyId', 'userId'] }), getAttendanceRecords);

// ============================================
// BOOKINGS (On-demand hiring) - Specific routes
// ============================================

// Residents can book staff
router.post('/bookings', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['staff:*']), createBooking);
router.get('/bookings/list', cache({ ttl: 60, keyPrefix: 'staff', varyBy: ['societyId', 'userId'] }), getBookings);

// Staff/Admin can accept/reject bookings (for now, admin manages)
router.patch('/bookings/:id/accept', authorize('ADMIN', 'SUPER_ADMIN', 'RESIDENT'), clearCacheAfter(['staff:*']), acceptBooking);
router.patch('/bookings/:id/reject', authorize('ADMIN', 'SUPER_ADMIN', 'RESIDENT'), clearCacheAfter(['staff:*']), rejectBooking);
router.patch('/bookings/:id/complete', authorize('ADMIN', 'SUPER_ADMIN', 'RESIDENT'), clearCacheAfter(['staff:*']), completeBooking);

// ============================================
// REVIEWS & RATINGS - Specific routes
// ============================================

// Residents can review staff
router.post('/reviews', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['staff:*']), addReview);

// ============================================
// PARAMETERIZED ROUTES - Must come LAST
// ============================================

// Staff-specific routes (with :id or :staffId)
router.get('/:id', cache({ ttl: 120, keyPrefix: 'staff' }), getStaffById);
router.get('/:id/qr', cache({ ttl: 300, keyPrefix: 'staff' }), getStaffQRCode);
router.patch('/:id', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['staff:*']), updateStaff);
router.delete('/:id', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['staff:*']), deleteStaff);
router.patch('/:id/verify', authorize('ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['staff:*']), verifyStaff);
router.patch('/:id/availability', authorize('ADMIN', 'SUPER_ADMIN', 'RESIDENT'), clearCacheAfter(['staff:*']), updateAvailabilityStatus);

// Get specific staff's assignments and reviews
router.get('/:staffId/assignments', cache({ ttl: 120, keyPrefix: 'staff' }), getStaffAssignments);
router.get('/:staffId/reviews', cache({ ttl: 180, keyPrefix: 'staff' }), getStaffReviews);
router.post('/:staffId/check-out', authorize('GUARD', 'RESIDENT'), clearCacheAfter(['staff:*']), checkOut);

export default router;
