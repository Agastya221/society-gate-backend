"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelGatePass = exports.getGatePassQR = exports.getGatePassById = exports.getGatePasses = exports.scanGatePass = exports.rejectGatePass = exports.approveGatePass = exports.createGatePass = void 0;
const gatepass_service_1 = require("./gatepass.service");
const QrGenerate_1 = require("../../utils/QrGenerate");
const gatePassService = new gatepass_service_1.GatePassService();
const createGatePass = async (req, res) => {
    try {
        const userId = req.user.id;
        const gatePass = await gatePassService.createGatePass(req.body, userId);
        res.status(201).json({
            success: true,
            message: 'Gate pass created successfully',
            data: gatePass,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to create gate pass',
        });
    }
};
exports.createGatePass = createGatePass;
const approveGatePass = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const gatePass = await gatePassService.approveGatePass(id, userId);
        res.status(200).json({
            success: true,
            message: 'Gate pass approved successfully',
            data: gatePass,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to approve gate pass',
        });
    }
};
exports.approveGatePass = approveGatePass;
const rejectGatePass = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const userId = req.user.id;
        const gatePass = await gatePassService.rejectGatePass(id, reason, userId);
        res.status(200).json({
            success: true,
            message: 'Gate pass rejected successfully',
            data: gatePass,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to reject gate pass',
        });
    }
};
exports.rejectGatePass = rejectGatePass;
const scanGatePass = async (req, res) => {
    try {
        const { qrToken } = req.body;
        const userId = req.user.id;
        const gatePass = await gatePassService.scanGatePass(qrToken, userId);
        res.status(200).json({
            success: true,
            message: 'Gate pass scanned successfully',
            data: gatePass,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to scan gate pass',
        });
    }
};
exports.scanGatePass = scanGatePass;
const getGatePasses = async (req, res) => {
    try {
        const filters = req.query;
        const result = await gatePassService.getGatePasses(filters);
        res.status(200).json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch gate passes',
        });
    }
};
exports.getGatePasses = getGatePasses;
const getGatePassById = async (req, res) => {
    try {
        const { id } = req.params;
        const gatePass = await gatePassService.getGatePassById(id);
        res.status(200).json({
            success: true,
            data: gatePass,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch gate pass',
        });
    }
};
exports.getGatePassById = getGatePassById;
const getGatePassQR = async (req, res) => {
    try {
        const { id } = req.params;
        const gatePassData = await gatePassService.getGatePassQR(id);
        // Generate QR code image
        const qrCodeImage = await (0, QrGenerate_1.generateQRImage)(gatePassData.qrToken);
        res.status(200).json({
            success: true,
            data: {
                ...gatePassData,
                qrCodeImage, // Base64 encoded image
            },
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to generate QR code',
        });
    }
};
exports.getGatePassQR = getGatePassQR;
const cancelGatePass = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const gatePass = await gatePassService.cancelGatePass(id, userId);
        res.status(200).json({
            success: true,
            message: 'Gate pass cancelled successfully',
            data: gatePass,
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to cancel gate pass',
        });
    }
};
exports.cancelGatePass = cancelGatePass;
