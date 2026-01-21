"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeliveryController = void 0;
const delivery_service_1 = require("./delivery.service");
const ResponseHandler_1 = require("../../utils/ResponseHandler");
const deliveryService = new delivery_service_1.DeliveryService();
class DeliveryController {
    constructor() {
        // Create expected delivery
        this.createExpectedDelivery = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const delivery = await deliveryService.createExpectedDelivery(req.body, req.user.id);
            res.status(201).json({
                success: true,
                message: 'Expected delivery added. It will be auto-approved when arrives.',
                data: delivery,
            });
        });
        // Create auto-approve rule
        this.createAutoApproveRule = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const rule = await deliveryService.createAutoApproveRule(req.body, req.user.id);
            res.status(201).json({
                success: true,
                message: 'Auto-approve rule created',
                data: rule,
            });
        });
        // Get auto-approve rules
        this.getAutoApproveRules = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const rules = await deliveryService.getAutoApproveRules(req.user.flatId);
            res.json({
                success: true,
                data: rules,
            });
        });
        // Toggle rule
        this.toggleAutoApproveRule = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const { isActive } = req.body;
            const rule = await deliveryService.toggleAutoApproveRule(req.params.id, isActive);
            res.json({
                success: true,
                message: isActive ? 'Rule activated' : 'Rule deactivated',
                data: rule,
            });
        });
        // Delete rule
        this.deleteAutoApproveRule = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            await deliveryService.deleteAutoApproveRule(req.params.id);
            res.json({
                success: true,
                message: 'Auto-approve rule deleted',
            });
        });
        // Get expected deliveries
        this.getExpectedDeliveries = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const deliveries = await deliveryService.getExpectedDeliveries(req.user.flatId);
            res.json({
                success: true,
                data: deliveries,
            });
        });
        // Get popular companies (for dropdown)
        this.getPopularCompanies = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const companies = deliveryService.getPopularCompanies();
            res.json({
                success: true,
                data: companies,
            });
        });
    }
}
exports.DeliveryController = DeliveryController;
