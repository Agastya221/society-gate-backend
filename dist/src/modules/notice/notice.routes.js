"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notice_controller_1 = require("./notice.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Public routes (all authenticated users)
router.get('/', auth_middleware_1.authenticate, notice_controller_1.getNotices);
router.get('/:id', auth_middleware_1.authenticate, notice_controller_1.getNoticeById);
// Admin only routes
router.post('/', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('ADMIN'), notice_controller_1.createNotice);
router.patch('/:id', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('ADMIN'), notice_controller_1.updateNotice);
router.delete('/:id', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('ADMIN'), notice_controller_1.deleteNotice);
router.patch('/:id/toggle-pin', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('ADMIN'), notice_controller_1.togglePinNotice);
exports.default = router;
