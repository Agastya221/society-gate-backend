"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const gatepass_controller_1 = require("./gatepass.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// ============================================
// IMPORTANT: Specific routes before parameterized routes
// ============================================
// Resident/Admin routes - specific paths first
router.post('/', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('RESIDENT', 'ADMIN'), gatepass_controller_1.createGatePass);
router.get('/', auth_middleware_1.authenticate, gatepass_controller_1.getGatePasses);
// Guard routes - specific /scan path before /:id
router.post('/scan', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('GUARD'), gatepass_controller_1.scanGatePass);
// Parameterized routes come LAST
router.get('/:id', auth_middleware_1.authenticate, gatepass_controller_1.getGatePassById);
router.get('/:id/qr', auth_middleware_1.authenticate, gatepass_controller_1.getGatePassQR);
router.patch('/:id/approve', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('ADMIN'), gatepass_controller_1.approveGatePass);
router.patch('/:id/reject', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('ADMIN'), gatepass_controller_1.rejectGatePass);
router.delete('/:id', auth_middleware_1.authenticate, gatepass_controller_1.cancelGatePass);
exports.default = router;
