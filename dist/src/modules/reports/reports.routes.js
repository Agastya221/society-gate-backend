"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reports_controller_1 = require("./reports.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// All reports require admin authorization
router.get('/dashboard', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('ADMIN'), reports_controller_1.getDashboardStats);
router.get('/entries', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('ADMIN'), reports_controller_1.getEntryStatistics);
router.get('/peak-hours', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('ADMIN'), reports_controller_1.getPeakHoursAnalysis);
router.get('/delivery-patterns', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('ADMIN'), reports_controller_1.getDeliveryPatterns);
router.get('/complaints', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('ADMIN'), reports_controller_1.getComplaintStatistics);
router.get('/visitor-frequency', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('ADMIN'), reports_controller_1.getVisitorFrequencyReport);
router.get('/health-score', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('ADMIN'), reports_controller_1.getSocietyHealthScore);
exports.default = router;
