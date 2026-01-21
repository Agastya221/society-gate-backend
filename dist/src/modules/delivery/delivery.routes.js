"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const delivery_controller_1 = require("./delivery.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const router = (0, express_1.Router)();
const deliveryController = new delivery_controller_1.DeliveryController();
router.use(auth_middleware_1.authenticate);
router.use((0, auth_middleware_1.authorize)('RESIDENT', 'ADMIN'));
// Expected deliveries
router.post('/expected', deliveryController.createExpectedDelivery);
router.get('/expected', deliveryController.getExpectedDeliveries);
// Auto-approve rules
router.post('/auto-approve', deliveryController.createAutoApproveRule);
router.get('/auto-approve', deliveryController.getAutoApproveRules);
router.patch('/auto-approve/:id', deliveryController.toggleAutoApproveRule);
router.delete('/auto-approve/:id', deliveryController.deleteAutoApproveRule);
// Popular companies list
router.get('/companies', deliveryController.getPopularCompanies);
exports.default = router;
