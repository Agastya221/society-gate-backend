"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntryController = void 0;
const entry_service_1 = require("./entry.service");
const ResponseHandler_1 = require("../../utils/ResponseHandler");
const entryService = new entry_service_1.EntryService();
class EntryController {
    constructor() {
        // Guard creates entry at gate
        this.createEntry = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const entry = await entryService.createEntry(req.body, req.user.id);
            res.status(201).json({
                success: true,
                message: entry.wasAutoApproved
                    ? 'Entry auto-approved'
                    : 'Approval request sent to resident',
                data: entry,
            });
        });
        // Resident approves/rejects from app
        this.approveEntry = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const entry = await entryService.approveEntry(req.params.id, req.user.id);
            res.json({
                success: true,
                message: 'Entry approved successfully',
                data: entry,
            });
        });
        this.rejectEntry = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const { reason } = req.body;
            const entry = await entryService.rejectEntry(req.params.id, reason, req.user.id);
            res.json({
                success: true,
                message: 'Entry rejected',
                data: entry,
            });
        });
        // Guard does checkout when visitor leaves
        this.checkoutEntry = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const entry = await entryService.checkoutEntry(req.params.id);
            res.json({
                success: true,
                message: 'Visitor checked out',
                data: entry,
            });
        });
        // Get all entries (with filters)
        this.getEntries = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const result = await entryService.getEntries({
                societyId: req.user.societyId,
                flatId: req.query.flatId,
                status: req.query.status,
                type: req.query.type,
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 20,
            });
            res.json({
                success: true,
                data: result,
            });
        });
        // Get pending approvals for resident
        this.getPendingApprovals = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const entries = await entryService.getPendingEntries(req.user.societyId, req.user.flatId || undefined);
            res.json({
                success: true,
                data: entries,
            });
        });
        // Today's entries for guard dashboard
        this.getTodayEntries = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const entries = await entryService.getTodayEntries(req.user.societyId);
            res.json({
                success: true,
                data: entries,
            });
        });
    }
}
exports.EntryController = EntryController;
