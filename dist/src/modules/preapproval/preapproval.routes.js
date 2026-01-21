"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const preapproval_controller_1 = require("./preapproval.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const router = (0, express_1.Router)();
const preApprovalController = new preapproval_controller_1.PreApprovalController();
// ============================================
// RESIDENT APP ROUTES
// ============================================
// Create pre-approval
router.post('/', auth_middleware_1.authenticateResidentApp, preApprovalController.createPreApproval);
// Get all pre-approvals
router.get('/', auth_middleware_1.authenticateResidentApp, preApprovalController.getPreApprovals);
// Get QR code
router.get('/:id/qr', auth_middleware_1.authenticateResidentApp, preApprovalController.getPreApprovalQR);
// Cancel pre-approval
router.delete('/:id', auth_middleware_1.authenticateResidentApp, preApprovalController.cancelPreApproval);
// ============================================
// GUARD APP ROUTES
// ============================================
// Scan QR code
router.post('/scan', auth_middleware_1.authenticateGuardApp, preApprovalController.scanPreApprovalQR);
exports.default = router;
