"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const vendor_controller_1 = require("./vendor.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// All authenticated users can view vendors
router.get('/', auth_middleware_1.authenticate, vendor_controller_1.getVendors);
router.get('/by-category', auth_middleware_1.authenticate, vendor_controller_1.getVendorsByCategory);
router.get('/:id', auth_middleware_1.authenticate, vendor_controller_1.getVendorById);
// Residents can rate vendors
router.post('/:id/rate', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('RESIDENT', 'ADMIN'), vendor_controller_1.rateVendor);
// Admin routes
router.post('/', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('ADMIN'), vendor_controller_1.createVendor);
router.patch('/:id', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('ADMIN'), vendor_controller_1.updateVendor);
router.patch('/:id/verify', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('ADMIN'), vendor_controller_1.verifyVendor);
router.delete('/:id', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('ADMIN'), vendor_controller_1.deleteVendor);
exports.default = router;
