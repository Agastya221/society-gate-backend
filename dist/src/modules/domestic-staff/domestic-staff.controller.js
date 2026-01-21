"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateAvailabilityStatus = exports.getAvailableStaff = exports.getStaffReviews = exports.addReview = exports.completeBooking = exports.rejectBooking = exports.acceptBooking = exports.getBookings = exports.createBooking = exports.getAttendanceRecords = exports.scanQRCode = exports.checkOut = exports.checkIn = exports.getStaffAssignments = exports.removeAssignment = exports.updateAssignment = exports.assignStaffToFlat = exports.getStaffQRCode = exports.verifyStaff = exports.deleteStaff = exports.updateStaff = exports.getStaffById = exports.getStaffList = exports.createStaff = void 0;
const domestic_staff_service_1 = require("./domestic-staff.service");
const QrGenerate_1 = require("../../utils/QrGenerate");
const staffService = new domestic_staff_service_1.DomesticStaffService();
// ============================================
// STAFF MANAGEMENT
// ============================================
const createStaff = async (req, res) => {
    try {
        const userId = req.user.id;
        const staff = await staffService.createStaff(req.body, userId);
        res.status(201).json({
            success: true,
            message: 'Staff added successfully',
            data: staff,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to add staff',
        });
    }
};
exports.createStaff = createStaff;
const getStaffList = async (req, res) => {
    try {
        const filters = req.query;
        const result = await staffService.getStaffList(filters);
        res.status(200).json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch staff list',
        });
    }
};
exports.getStaffList = getStaffList;
const getStaffById = async (req, res) => {
    try {
        const { id } = req.params;
        const staff = await staffService.getStaffById(id);
        res.status(200).json({
            success: true,
            data: staff,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch staff details',
        });
    }
};
exports.getStaffById = getStaffById;
const updateStaff = async (req, res) => {
    try {
        const { id } = req.params;
        const staff = await staffService.updateStaff(id, req.body);
        res.status(200).json({
            success: true,
            message: 'Staff updated successfully',
            data: staff,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to update staff',
        });
    }
};
exports.updateStaff = updateStaff;
const deleteStaff = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await staffService.deleteStaff(id);
        res.status(200).json({
            success: true,
            ...result,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to delete staff',
        });
    }
};
exports.deleteStaff = deleteStaff;
const verifyStaff = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const staff = await staffService.verifyStaff(id, userId);
        res.status(200).json({
            success: true,
            message: staff.isVerified ? 'Staff verified' : 'Staff unverified',
            data: staff,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to verify staff',
        });
    }
};
exports.verifyStaff = verifyStaff;
const getStaffQRCode = async (req, res) => {
    try {
        const { id } = req.params;
        const staff = await staffService.getStaffById(id);
        const qrCodeImage = await (0, QrGenerate_1.generateQRImage)(staff.qrToken);
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
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to generate QR code',
        });
    }
};
exports.getStaffQRCode = getStaffQRCode;
// ============================================
// FLAT ASSIGNMENTS
// ============================================
const assignStaffToFlat = async (req, res) => {
    try {
        const assignment = await staffService.assignStaffToFlat(req.body);
        res.status(201).json({
            success: true,
            message: 'Staff assigned to flat successfully',
            data: assignment,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to assign staff',
        });
    }
};
exports.assignStaffToFlat = assignStaffToFlat;
const updateAssignment = async (req, res) => {
    try {
        const { id } = req.params;
        const assignment = await staffService.updateAssignment(id, req.body);
        res.status(200).json({
            success: true,
            message: 'Assignment updated successfully',
            data: assignment,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to update assignment',
        });
    }
};
exports.updateAssignment = updateAssignment;
const removeAssignment = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await staffService.removeAssignment(id);
        res.status(200).json({
            success: true,
            ...result,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to remove assignment',
        });
    }
};
exports.removeAssignment = removeAssignment;
const getStaffAssignments = async (req, res) => {
    try {
        const { staffId } = req.params;
        const assignments = await staffService.getStaffAssignments(staffId);
        res.status(200).json({
            success: true,
            data: assignments,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch assignments',
        });
    }
};
exports.getStaffAssignments = getStaffAssignments;
// ============================================
// ATTENDANCE & CHECK-IN/OUT
// ============================================
const checkIn = async (req, res) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;
        const verifiedByGuardId = role === 'GUARD' ? userId : undefined;
        const attendance = await staffService.checkIn(req.body, verifiedByGuardId);
        res.status(200).json({
            success: true,
            message: 'Staff checked in successfully',
            data: attendance,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to check in',
        });
    }
};
exports.checkIn = checkIn;
const checkOut = async (req, res) => {
    try {
        const { staffId } = req.params;
        const { workCompleted } = req.body;
        const attendance = await staffService.checkOut(staffId, workCompleted);
        res.status(200).json({
            success: true,
            message: 'Staff checked out successfully',
            data: attendance,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to check out',
        });
    }
};
exports.checkOut = checkOut;
const scanQRCode = async (req, res) => {
    try {
        const { qrToken, flatId, societyId } = req.body;
        const userId = req.user.id;
        const role = req.user.role;
        const verifiedByGuardId = role === 'GUARD' ? userId : undefined;
        const result = await staffService.scanQRCode(qrToken, flatId, societyId, verifiedByGuardId);
        res.status(200).json({
            success: true,
            message: result.checkOutTime ? 'Staff checked out successfully' : 'Staff checked in successfully',
            data: result,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to scan QR code',
        });
    }
};
exports.scanQRCode = scanQRCode;
const getAttendanceRecords = async (req, res) => {
    try {
        const filters = req.query;
        const result = await staffService.getAttendanceRecords(filters);
        res.status(200).json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch attendance records',
        });
    }
};
exports.getAttendanceRecords = getAttendanceRecords;
// ============================================
// BOOKINGS
// ============================================
const createBooking = async (req, res) => {
    try {
        const userId = req.user.id;
        const booking = await staffService.createBooking(req.body, userId);
        res.status(201).json({
            success: true,
            message: 'Booking created successfully',
            data: booking,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to create booking',
        });
    }
};
exports.createBooking = createBooking;
const getBookings = async (req, res) => {
    try {
        const filters = req.query;
        const result = await staffService.getBookings(filters);
        res.status(200).json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch bookings',
        });
    }
};
exports.getBookings = getBookings;
const acceptBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const booking = await staffService.acceptBooking(id);
        res.status(200).json({
            success: true,
            message: 'Booking accepted successfully',
            data: booking,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to accept booking',
        });
    }
};
exports.acceptBooking = acceptBooking;
const rejectBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const { rejectionReason } = req.body;
        const booking = await staffService.rejectBooking(id, rejectionReason);
        res.status(200).json({
            success: true,
            message: 'Booking rejected',
            data: booking,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to reject booking',
        });
    }
};
exports.rejectBooking = rejectBooking;
const completeBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const { actualDuration, finalCost } = req.body;
        const booking = await staffService.completeBooking(id, actualDuration, finalCost);
        res.status(200).json({
            success: true,
            message: 'Booking completed successfully',
            data: booking,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to complete booking',
        });
    }
};
exports.completeBooking = completeBooking;
// ============================================
// REVIEWS & RATINGS
// ============================================
const addReview = async (req, res) => {
    try {
        const userId = req.user.id;
        const review = await staffService.addReview(req.body, userId);
        res.status(201).json({
            success: true,
            message: 'Review added successfully',
            data: review,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to add review',
        });
    }
};
exports.addReview = addReview;
const getStaffReviews = async (req, res) => {
    try {
        const { staffId } = req.params;
        const reviews = await staffService.getStaffReviews(staffId);
        res.status(200).json({
            success: true,
            data: reviews,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch reviews',
        });
    }
};
exports.getStaffReviews = getStaffReviews;
// ============================================
// AVAILABILITY
// ============================================
const getAvailableStaff = async (req, res) => {
    try {
        const filters = req.query;
        const staff = await staffService.getAvailableStaff(filters);
        res.status(200).json({
            success: true,
            data: staff,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch available staff',
        });
    }
};
exports.getAvailableStaff = getAvailableStaff;
const updateAvailabilityStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const staff = await staffService.updateAvailabilityStatus(id, status);
        res.status(200).json({
            success: true,
            message: 'Availability status updated',
            data: staff,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to update availability status',
        });
    }
};
exports.updateAvailabilityStatus = updateAvailabilityStatus;
