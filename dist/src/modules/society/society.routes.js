"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const society_controller_1 = require("./society.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const router = (0, express_1.Router)();
const societyController = new society_controller_1.SocietyController();
router.use(auth_middleware_1.authenticate);
// SUPER_ADMIN only
router.post('/', (0, auth_middleware_1.authorize)('SUPER_ADMIN'), societyController.createSociety);
router.get('/', (0, auth_middleware_1.authorize)('SUPER_ADMIN'), societyController.getSocieties);
router.patch('/:id/payment-paid', (0, auth_middleware_1.authorize)('SUPER_ADMIN'), societyController.markPaymentPaid);
// SUPER_ADMIN and ADMIN
router.get('/:id', (0, auth_middleware_1.authorize)('SUPER_ADMIN', 'ADMIN'), societyController.getSociety);
router.patch('/:id', (0, auth_middleware_1.authorize)('SUPER_ADMIN', 'ADMIN'), societyController.updateSociety);
router.get('/:id/stats', (0, auth_middleware_1.authorize)('SUPER_ADMIN', 'ADMIN'), societyController.getSocietyStats);
exports.default = router;
