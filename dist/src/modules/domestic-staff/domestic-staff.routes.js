"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const domestic_staff_controller_1 = require("./domestic-staff.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// ============================================
// IMPORTANT: Specific routes MUST come before parameterized routes
// to avoid Express matching /:id for paths like /available
// ============================================
// ============================================
// STAFF MANAGEMENT - Specific routes first
// ============================================
// All users can view staff list and available staff
router.get('/', auth_middleware_1.authenticate, domestic_staff_controller_1.getStaffList);
router.get('/available', auth_middleware_1.authenticate, domestic_staff_controller_1.getAvailableStaff);
// Residents can add staff
router.post('/', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('RESIDENT', 'ADMIN'), domestic_staff_controller_1.createStaff);
// ============================================
// FLAT ASSIGNMENTS - Specific routes
// ============================================
router.post('/assignments', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('RESIDENT', 'ADMIN'), domestic_staff_controller_1.assignStaffToFlat);
router.patch('/assignments/:id', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('RESIDENT', 'ADMIN'), domestic_staff_controller_1.updateAssignment);
router.delete('/assignments/:id', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('RESIDENT', 'ADMIN'), domestic_staff_controller_1.removeAssignment);
// ============================================
// ATTENDANCE & CHECK-IN/OUT - Specific routes
// ============================================
// Guards and residents can manage check-in/out
router.post('/check-in', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('GUARD', 'RESIDENT'), domestic_staff_controller_1.checkIn);
router.post('/scan', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('GUARD', 'RESIDENT'), domestic_staff_controller_1.scanQRCode);
// View attendance records
router.get('/attendance/records', auth_middleware_1.authenticate, domestic_staff_controller_1.getAttendanceRecords);
// ============================================
// BOOKINGS (On-demand hiring) - Specific routes
// ============================================
// Residents can book staff
router.post('/bookings', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('RESIDENT', 'ADMIN'), domestic_staff_controller_1.createBooking);
router.get('/bookings/list', auth_middleware_1.authenticate, domestic_staff_controller_1.getBookings);
// Staff/Admin can accept/reject bookings (for now, admin manages)
router.patch('/bookings/:id/accept', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('ADMIN', 'RESIDENT'), domestic_staff_controller_1.acceptBooking);
router.patch('/bookings/:id/reject', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('ADMIN', 'RESIDENT'), domestic_staff_controller_1.rejectBooking);
router.patch('/bookings/:id/complete', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('ADMIN', 'RESIDENT'), domestic_staff_controller_1.completeBooking);
// ============================================
// REVIEWS & RATINGS - Specific routes
// ============================================
// Residents can review staff
router.post('/reviews', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('RESIDENT', 'ADMIN'), domestic_staff_controller_1.addReview);
// ============================================
// PARAMETERIZED ROUTES - Must come LAST
// ============================================
// Staff-specific routes (with :id or :staffId)
router.get('/:id', auth_middleware_1.authenticate, domestic_staff_controller_1.getStaffById);
router.get('/:id/qr', auth_middleware_1.authenticate, domestic_staff_controller_1.getStaffQRCode);
router.patch('/:id', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('RESIDENT', 'ADMIN'), domestic_staff_controller_1.updateStaff);
router.delete('/:id', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('RESIDENT', 'ADMIN'), domestic_staff_controller_1.deleteStaff);
router.patch('/:id/verify', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('ADMIN'), domestic_staff_controller_1.verifyStaff);
router.patch('/:id/availability', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('ADMIN', 'RESIDENT'), domestic_staff_controller_1.updateAvailabilityStatus);
// Get specific staff's assignments and reviews
router.get('/:staffId/assignments', auth_middleware_1.authenticate, domestic_staff_controller_1.getStaffAssignments);
router.get('/:staffId/reviews', auth_middleware_1.authenticate, domestic_staff_controller_1.getStaffReviews);
router.post('/:staffId/check-out', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('GUARD', 'RESIDENT'), domestic_staff_controller_1.checkOut);
exports.default = router;
