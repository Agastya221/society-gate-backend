"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelBooking = exports.approveBooking = exports.getBookings = exports.createBooking = exports.deleteAmenity = exports.updateAmenity = exports.getAmenityById = exports.getAmenities = exports.createAmenity = void 0;
const amenity_service_1 = require("./amenity.service");
const amenityService = new amenity_service_1.AmenityService();
// Amenity management
const createAmenity = async (req, res) => {
    try {
        const amenity = await amenityService.createAmenity(req.body);
        res.status(201).json({
            success: true,
            message: 'Amenity created successfully',
            data: amenity,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to create amenity',
        });
    }
};
exports.createAmenity = createAmenity;
const getAmenities = async (req, res) => {
    try {
        const filters = req.query;
        const amenities = await amenityService.getAmenities(filters);
        res.status(200).json({
            success: true,
            data: amenities,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch amenities',
        });
    }
};
exports.getAmenities = getAmenities;
const getAmenityById = async (req, res) => {
    try {
        const { id } = req.params;
        const amenity = await amenityService.getAmenityById(id);
        res.status(200).json({
            success: true,
            data: amenity,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch amenity',
        });
    }
};
exports.getAmenityById = getAmenityById;
const updateAmenity = async (req, res) => {
    try {
        const { id } = req.params;
        const amenity = await amenityService.updateAmenity(id, req.body);
        res.status(200).json({
            success: true,
            message: 'Amenity updated successfully',
            data: amenity,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to update amenity',
        });
    }
};
exports.updateAmenity = updateAmenity;
const deleteAmenity = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await amenityService.deleteAmenity(id);
        res.status(200).json({
            success: true,
            ...result,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to delete amenity',
        });
    }
};
exports.deleteAmenity = deleteAmenity;
// Booking management
const createBooking = async (req, res) => {
    try {
        const userId = req.user.id;
        const booking = await amenityService.createBooking(req.body, userId);
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
        const result = await amenityService.getBookings(filters);
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
const approveBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const booking = await amenityService.approveBooking(id);
        res.status(200).json({
            success: true,
            message: 'Booking approved successfully',
            data: booking,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to approve booking',
        });
    }
};
exports.approveBooking = approveBooking;
const cancelBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const userId = req.user.id;
        const booking = await amenityService.cancelBooking(id, reason, userId);
        res.status(200).json({
            success: true,
            message: 'Booking cancelled successfully',
            data: booking,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to cancel booking',
        });
    }
};
exports.cancelBooking = cancelBooking;
