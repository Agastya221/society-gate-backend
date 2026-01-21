"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const amenity_controller_1 = require("./amenity.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Amenity routes
router.get('/amenities', auth_middleware_1.authenticate, amenity_controller_1.getAmenities);
router.get('/amenities/:id', auth_middleware_1.authenticate, amenity_controller_1.getAmenityById);
router.post('/amenities', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('ADMIN'), amenity_controller_1.createAmenity);
router.patch('/amenities/:id', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('ADMIN'), amenity_controller_1.updateAmenity);
router.delete('/amenities/:id', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('ADMIN'), amenity_controller_1.deleteAmenity);
// Booking routes
router.post('/bookings', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('RESIDENT', 'ADMIN'), amenity_controller_1.createBooking);
router.get('/bookings', auth_middleware_1.authenticate, amenity_controller_1.getBookings);
router.patch('/bookings/:id/approve', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('ADMIN'), amenity_controller_1.approveBooking);
router.patch('/bookings/:id/cancel', auth_middleware_1.authenticate, amenity_controller_1.cancelBooking);
exports.default = router;
