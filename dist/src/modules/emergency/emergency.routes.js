"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const emergency_controller_1 = require("./emergency.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// All authenticated users can create emergencies
router.post('/', auth_middleware_1.authenticate, emergency_controller_1.createEmergency);
// Resident route - get their own emergencies (must be before /:id)
router.get('/my', auth_middleware_1.authenticate, emergency_controller_1.getMyEmergencies);
// Admin and Guard routes
router.get('/', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('ADMIN', 'GUARD'), emergency_controller_1.getEmergencies);
router.get('/active', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('ADMIN', 'GUARD'), emergency_controller_1.getActiveEmergencies);
router.get('/:id', auth_middleware_1.authenticate, emergency_controller_1.getEmergencyById);
router.patch('/:id/respond', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('ADMIN', 'GUARD'), emergency_controller_1.respondToEmergency);
router.patch('/:id/resolve', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('ADMIN'), emergency_controller_1.resolveEmergency);
router.patch('/:id/false-alarm', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('ADMIN'), emergency_controller_1.markAsFalseAlarm);
exports.default = router;
