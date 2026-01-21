"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreApprovalController = void 0;
const preapproval_service_1 = require("./preapproval.service");
const ResponseHandler_1 = require("../../utils/ResponseHandler");
const preApprovalService = new preapproval_service_1.PreApprovalService();
class PreApprovalController {
    constructor() {
        // Create pre-approval with QR
        this.createPreApproval = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const result = await preApprovalService.createPreApproval(req.body, req.user.id);
            res.status(201).json({
                success: true,
                message: 'Pre-approval created successfully. Share QR code with your guest.',
                data: result,
            });
        });
        // Get all pre-approvals
        this.getPreApprovals = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const { status } = req.query;
            const preApprovals = await preApprovalService.getPreApprovals(req.user.id, { status: status });
            res.json({
                success: true,
                data: preApprovals,
            });
        });
        // Get QR code for specific pre-approval
        this.getPreApprovalQR = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const { id } = req.params;
            const result = await preApprovalService.getPreApprovalQR(id, req.user.id);
            res.json({
                success: true,
                data: result,
            });
        });
        // Cancel pre-approval
        this.cancelPreApproval = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const { id } = req.params;
            const result = await preApprovalService.cancelPreApproval(id, req.user.id);
            res.json({
                success: true,
                message: 'Pre-approval cancelled successfully',
                data: result,
            });
        });
        // Scan pre-approval QR (Guard)
        this.scanPreApprovalQR = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const { qrToken } = req.body;
            const result = await preApprovalService.scanPreApprovalQR(qrToken, req.user.id);
            res.json({
                success: true,
                message: `${result.preApproval.visitorName} pre-approved. Entry created for flat ${result.preApproval.flatNumber}.`,
                data: result,
            });
        });
    }
}
exports.PreApprovalController = PreApprovalController;
