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
  getOpenSlots,
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

  // Summary
  getTypeSummary,
  hideSensitiveStaffFields,
} from './domestic-staff.controller';
import { authenticate, authorize, ensureSameSociety } from '../../middlewares/auth.middleware';
import { cache, clearCacheAfter } from '../../middlewares/cache.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { staffCheckInSchema, staffCheckOutSchema } from '../../schemas';
import { createDomesticStaffSchema, updateDomesticStaffSchema, staffAvailabilitySchema } from './domestic-staff.schemas';

const router = Router();

// Apply authentication and society isolation globally
router.use(authenticate);
router.use(ensureSameSociety);
// Residents never receive staff QR tokens or ID-proof details from this module
router.use(hideSensitiveStaffFields);

// ============================================
// IMPORTANT: Specific routes MUST come before parameterized routes
// to avoid Express matching /:id for paths like /available
// ============================================

// ============================================
// STAFF MANAGEMENT - Specific routes first
// ============================================

// All users can view staff list and available staff (cached)
router.get('/', cache({ ttl: 120, keyPrefix: 'staff', varyBy: ['societyId', 'role'] }), getStaffList);
router.get('/available', cache({ ttl: 60, keyPrefix: 'staff', varyBy: ['societyId', 'role'] }), getAvailableStaff);
router.get('/types', cache({ ttl: 300, keyPrefix: 'staff', varyBy: ['societyId'] }), getTypeSummary);

// Residents can add staff
router.post('/', authorize('ADMIN', 'SUPER_ADMIN'), validate({ body: createDomesticStaffSchema }), clearCacheAfter(['staff:*']), createStaff);

// ============================================
// FLAT ASSIGNMENTS - Specific routes
// ============================================

router.post('/assignments', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['staff:*']), assignStaffToFlat);
router.patch('/assignments/:id', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['staff:*']), updateAssignment);
router.delete('/assignments/:id', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['staff:*']), removeAssignment);

// ============================================
// ATTENDANCE & CHECK-IN/OUT - Specific routes
// ============================================

// Guard-only: no RESIDENT-facing screen in any of the 3 apps calls these (grepped the
// whole frontend monorepo) — a resident token could otherwise forge a staff check-in/out.
router.post('/check-in', authorize('GUARD'), validate({ body: staffCheckInSchema }), clearCacheAfter(['staff:*']), checkIn);
router.post('/scan', authorize('GUARD'), clearCacheAfter(['staff:*']), scanQRCode);

// View attendance records (cached)
router.get('/attendance/records', cache({ ttl: 60, keyPrefix: 'staff', varyBy: ['societyId', 'userId'] }), getAttendanceRecords);

// ============================================
// BOOKINGS (On-demand hiring) - Specific routes
// ============================================

// Residents can book staff
router.post('/bookings', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['staff:*']), createBooking);
router.get('/bookings/list', cache({ ttl: 60, keyPrefix: 'staff', varyBy: ['societyId', 'userId'] }), getBookings);
router.get('/:id/open-slots', getOpenSlots);

// Staff accept/decline their own requests in the staff app (/staff-app/bookings/:id/*);
// here only admins may act for them. Residents (the requesters) may only mark complete.
router.patch('/bookings/:id/accept', authorize('ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['staff:*']), acceptBooking);
router.patch('/bookings/:id/reject', authorize('ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['staff:*']), rejectBooking);
router.patch('/bookings/:id/complete', authorize('ADMIN', 'SUPER_ADMIN', 'RESIDENT'), clearCacheAfter(['staff:*']), completeBooking);

// ============================================
// REVIEWS & RATINGS - Specific routes
// ============================================

// Residents can review staff
router.post('/reviews', authorize('RESIDENT', 'ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['staff:*']), addReview);

// ============================================
// PARAMETERIZED ROUTES - Must come LAST
// ============================================

// Staff-specific routes (with :id or :staffId). Cached per society so one society's
// cached response is never served to another (the cache runs before the scoped lookup).
router.get('/:id', cache({ ttl: 120, keyPrefix: 'staff', varyBy: ['societyId', 'role'] }), getStaffById);
// Not cached: access depends on the caller's flat assignments (checked in the service)
router.get('/:id/qr', authorize('ADMIN', 'SUPER_ADMIN', 'GUARD', 'RESIDENT'), getStaffQRCode);
router.patch('/:id', authorize('ADMIN', 'SUPER_ADMIN'), validate({ body: updateDomesticStaffSchema }), clearCacheAfter(['staff:*']), updateStaff);
router.delete('/:id', authorize('ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['staff:*']), deleteStaff);
router.patch('/:id/verify', authorize('ADMIN', 'SUPER_ADMIN'), clearCacheAfter(['staff:*']), verifyStaff);
router.patch('/:id/availability', authorize('ADMIN', 'SUPER_ADMIN'), validate({ body: staffAvailabilitySchema }), clearCacheAfter(['staff:*']), updateAvailabilityStatus);

// Get specific staff's assignments and reviews
router.get('/:staffId/assignments', cache({ ttl: 120, keyPrefix: 'staff', varyBy: ['societyId'] }), getStaffAssignments);
router.get('/:staffId/reviews', cache({ ttl: 180, keyPrefix: 'staff', varyBy: ['societyId'] }), getStaffReviews);
// Guard-only — see the check-in/scan note above; same "no caller" finding applies here.
router.post('/:staffId/check-out', authorize('GUARD'), validate({ body: staffCheckOutSchema }), clearCacheAfter(['staff:*']), checkOut);

export default router;
