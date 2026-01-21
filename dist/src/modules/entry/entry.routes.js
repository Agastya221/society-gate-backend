"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const entry_controller_1 = require("./entry.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const router = (0, express_1.Router)();
const entryController = new entry_controller_1.EntryController();
// All routes require authentication
router.use(auth_middleware_1.authenticate);
// Guard creates entry
router.post('/', (0, auth_middleware_1.authorize)('GUARD'), entryController.createEntry);
// Resident/Admin approves or rejects
router.patch('/:id/approve', (0, auth_middleware_1.authorize)('RESIDENT', 'ADMIN'), entryController.approveEntry);
router.patch('/:id/reject', (0, auth_middleware_1.authorize)('RESIDENT', 'ADMIN'), entryController.rejectEntry);
// Guard does checkout
router.patch('/:id/checkout', (0, auth_middleware_1.authorize)('GUARD'), entryController.checkoutEntry);
// Get entries (all roles)
router.get('/', entryController.getEntries);
// Get pending approvals (resident/admin only)
router.get('/pending', (0, auth_middleware_1.authorize)('RESIDENT', 'ADMIN'), entryController.getPendingApprovals);
// Today's entries (guard dashboard)
router.get('/today', (0, auth_middleware_1.authorize)('GUARD'), entryController.getTodayEntries);
exports.default = router;
