"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const complaint_controller_1 = require("./complaint.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Resident routes
router.post('/', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('RESIDENT', 'ADMIN'), complaint_controller_1.createComplaint);
router.get('/', auth_middleware_1.authenticate, complaint_controller_1.getComplaints);
router.get('/:id', auth_middleware_1.authenticate, complaint_controller_1.getComplaintById);
router.delete('/:id', auth_middleware_1.authenticate, complaint_controller_1.deleteComplaint);
// Admin routes
router.patch('/:id/status', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('ADMIN'), complaint_controller_1.updateComplaintStatus);
router.patch('/:id/assign', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('ADMIN'), complaint_controller_1.assignComplaint);
router.patch('/:id/resolve', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('ADMIN'), complaint_controller_1.resolveComplaint);
exports.default = router;
