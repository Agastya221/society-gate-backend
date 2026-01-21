"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocietyController = void 0;
const society_service_1 = require("./society.service");
const ResponseHandler_1 = require("../../utils/ResponseHandler");
const societyService = new society_service_1.SocietyService();
class SocietyController {
    constructor() {
        this.createSociety = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const society = await societyService.createSociety(req.body);
            res.status(201).json({
                success: true,
                message: 'Society created successfully',
                data: society,
            });
        });
        this.getSocieties = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const result = await societyService.getSocieties(req.query);
            res.json({
                success: true,
                data: result,
            });
        });
        this.getSociety = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const society = await societyService.getSocietyById(req.params.id);
            res.json({
                success: true,
                data: society,
            });
        });
        this.updateSociety = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const society = await societyService.updateSociety(req.params.id, req.body);
            res.json({
                success: true,
                message: 'Society updated successfully',
                data: society,
            });
        });
        this.markPaymentPaid = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const society = await societyService.markPaymentPaid(req.params.id);
            res.json({
                success: true,
                message: 'Payment marked as paid',
                data: society,
            });
        });
        this.getSocietyStats = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const stats = await societyService.getSocietyStats(req.params.id);
            res.json({
                success: true,
                data: stats,
            });
        });
    }
}
exports.SocietyController = SocietyController;
