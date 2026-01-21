"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnboardingController = void 0;
const onboarding_service_1 = require("./onboarding.service");
const ResponseHandler_1 = require("../../utils/ResponseHandler");
const onboardingService = new onboarding_service_1.OnboardingService();
class OnboardingController {
    constructor() {
        // ============================================
        // LIST SOCIETIES
        // ============================================
        this.listSocieties = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const { city, search } = req.query;
            const societies = await onboardingService.listSocieties({
                city: city,
                search: search,
            });
            res.json({
                success: true,
                data: societies,
            });
        });
        // ============================================
        // LIST BLOCKS
        // ============================================
        this.listBlocks = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const { societyId } = req.params;
            const blocks = await onboardingService.listBlocks(societyId);
            res.json({
                success: true,
                data: blocks,
            });
        });
        // ============================================
        // LIST FLATS
        // ============================================
        this.listFlats = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const { societyId, blockId } = req.params;
            const flats = await onboardingService.listFlats(societyId, blockId);
            res.json({
                success: true,
                data: flats,
            });
        });
        // ============================================
        // SUBMIT ONBOARDING REQUEST
        // ============================================
        this.submitRequest = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const userId = req.user.id;
            const { societyId, blockId, flatId, residentType, documents } = req.body;
            if (!societyId || !blockId || !flatId || !residentType || !documents) {
                throw new ResponseHandler_1.AppError('Missing required fields', 400);
            }
            if (!['OWNER', 'TENANT'].includes(residentType)) {
                throw new ResponseHandler_1.AppError('Invalid resident type. Must be OWNER or TENANT', 400);
            }
            if (!Array.isArray(documents) || documents.length === 0) {
                throw new ResponseHandler_1.AppError('At least one document is required', 400);
            }
            const result = await onboardingService.submitOnboardingRequest(userId, {
                societyId,
                blockId,
                flatId,
                residentType,
                documents,
            });
            res.json({
                success: true,
                message: 'Onboarding request submitted successfully',
                data: result,
            });
        });
        // ============================================
        // GET ONBOARDING STATUS
        // ============================================
        this.getStatus = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const userId = req.user.id;
            const status = await onboardingService.getOnboardingStatus(userId);
            res.json({
                success: true,
                data: status,
            });
        });
        // ============================================
        // ADMIN: LIST PENDING REQUESTS
        // ============================================
        this.listPendingRequests = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const adminSocietyId = req.user.societyId;
            if (!adminSocietyId) {
                throw new ResponseHandler_1.AppError('Admin must be associated with a society', 403);
            }
            const { status, residentType, page, limit } = req.query;
            const result = await onboardingService.listPendingRequests(adminSocietyId, {
                status: status,
                residentType: residentType,
                page: page ? parseInt(page) : undefined,
                limit: limit ? parseInt(limit) : undefined,
            });
            res.json({
                success: true,
                data: result,
            });
        });
        // ============================================
        // ADMIN: GET REQUEST DETAILS
        // ============================================
        this.getRequestDetails = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const { requestId } = req.params;
            const adminSocietyId = req.user.societyId;
            if (!adminSocietyId) {
                throw new ResponseHandler_1.AppError('Admin must be associated with a society', 403);
            }
            const details = await onboardingService.getRequestDetails(requestId, adminSocietyId);
            res.json({
                success: true,
                data: details,
            });
        });
        // ============================================
        // ADMIN: APPROVE REQUEST
        // ============================================
        this.approveRequest = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const { requestId } = req.params;
            const adminId = req.user.id;
            const adminSocietyId = req.user.societyId;
            const { notes } = req.body;
            if (!adminSocietyId) {
                throw new ResponseHandler_1.AppError('Admin must be associated with a society', 403);
            }
            const result = await onboardingService.approveRequest(requestId, adminId, adminSocietyId, notes);
            res.json({
                success: true,
                message: 'Onboarding request approved successfully',
                data: result,
            });
        });
        // ============================================
        // ADMIN: REJECT REQUEST
        // ============================================
        this.rejectRequest = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const { requestId } = req.params;
            const adminId = req.user.id;
            const adminSocietyId = req.user.societyId;
            const { reason } = req.body;
            if (!adminSocietyId) {
                throw new ResponseHandler_1.AppError('Admin must be associated with a society', 403);
            }
            if (!reason) {
                throw new ResponseHandler_1.AppError('Rejection reason is required', 400);
            }
            const result = await onboardingService.rejectRequest(requestId, adminId, adminSocietyId, reason);
            res.json({
                success: true,
                message: 'Onboarding request rejected',
                data: result,
            });
        });
        // ============================================
        // ADMIN: REQUEST RESUBMISSION
        // ============================================
        this.requestResubmission = (0, ResponseHandler_1.asyncHandler)(async (req, res) => {
            const { requestId } = req.params;
            const adminId = req.user.id;
            const adminSocietyId = req.user.societyId;
            const { reason, documentsToResubmit } = req.body;
            if (!adminSocietyId) {
                throw new ResponseHandler_1.AppError('Admin must be associated with a society', 403);
            }
            if (!reason) {
                throw new ResponseHandler_1.AppError('Resubmission reason is required', 400);
            }
            const result = await onboardingService.requestResubmission(requestId, adminId, adminSocietyId, reason, documentsToResubmit);
            res.json({
                success: true,
                message: 'Resubmission requested',
                data: result,
            });
        });
    }
}
exports.OnboardingController = OnboardingController;
