import { Request, Response } from 'express';
import { OnboardingService } from './onboarding.service';
import { asyncHandler, AppError } from '../../utils/ResponseHandler';

const onboardingService = new OnboardingService();

export class OnboardingController {
    // ============================================
    // LIST SOCIETIES
    // ============================================
    listSocieties = asyncHandler(async (req: Request, res: Response) => {
        const { city, search } = req.query;

        const societies = await onboardingService.listSocieties({
            city: city as string,
            search: search as string,
        });

        res.json({
            success: true,
            data: societies,
        });
    });

    // ============================================
    // LIST BLOCKS
    // ============================================
    listBlocks = asyncHandler(async (req: Request, res: Response) => {
        const { societyId } = req.params;

        const blocks = await onboardingService.listBlocks(String(societyId));

        res.json({
            success: true,
            data: blocks,
        });
    });

    // ============================================
    // LIST FLATS
    // ============================================
    listFlats = asyncHandler(async (req: Request, res: Response) => {
        const { societyId, blockId } = req.params;

        const flats = await onboardingService.listFlats(String(societyId), String(blockId));

        res.json({
            success: true,
            data: flats,
        });
    });

    // ============================================
    // SUBMIT ONBOARDING REQUEST
    // ============================================
    submitRequest = asyncHandler(async (req: Request, res: Response) => {
        const userId = req.user!.id;
        const { societyId, blockId, flatId, residentType, documents } = req.body;

        if (!societyId || !blockId || !flatId || !residentType || !documents) {
            throw new AppError('Missing required fields', 400);
        }

        if (!['OWNER', 'TENANT'].includes(residentType)) {
            throw new AppError('Invalid resident type. Must be OWNER or TENANT', 400);
        }

        if (!Array.isArray(documents) || documents.length === 0) {
            throw new AppError('At least one document is required', 400);
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
    getStatus = asyncHandler(async (req: Request, res: Response) => {
        const userId = req.user!.id;

        const status = await onboardingService.getOnboardingStatus(userId);

        res.json({
            success: true,
            data: status,
        });
    });

    // ============================================
    // ADMIN: LIST PENDING REQUESTS
    // ============================================
    listPendingRequests = asyncHandler(async (req: Request, res: Response) => {
        const adminSocietyId = req.user!.societyId;

        if (!adminSocietyId) {
            throw new AppError('Admin must be associated with a society', 403);
        }

        const { status, residentType, page, limit } = req.query;

        const result = await onboardingService.listPendingRequests(adminSocietyId, {
            status: status as any,
            residentType: residentType as any,
            page: page ? parseInt(page as string) : undefined,
            limit: limit ? parseInt(limit as string) : undefined,
        });

        res.json({
            success: true,
            data: result,
        });
    });

    // ============================================
    // ADMIN: GET REQUEST DETAILS
    // ============================================
    getRequestDetails = asyncHandler(async (req: Request, res: Response) => {
        const { requestId } = req.params;
        const adminSocietyId = req.user!.societyId;

        if (!adminSocietyId) {
            throw new AppError('Admin must be associated with a society', 403);
        }

        const details = await onboardingService.getRequestDetails(String(requestId), adminSocietyId);

        res.json({
            success: true,
            data: details,
        });
    });

    // ============================================
    // ADMIN: APPROVE REQUEST
    // ============================================
    approveRequest = asyncHandler(async (req: Request, res: Response) => {
        const { requestId } = req.params;
        const adminId = req.user!.id;
        const adminSocietyId = req.user!.societyId;
        const { notes } = req.body;

        if (!adminSocietyId) {
            throw new AppError('Admin must be associated with a society', 403);
        }

        const result = await onboardingService.approveRequest(
            String(requestId),
            adminId,
            adminSocietyId,
            notes
        );

        res.json({
            success: true,
            message: 'Onboarding request approved successfully',
            data: result,
        });
    });

    // ============================================
    // ADMIN: REJECT REQUEST
    // ============================================
    rejectRequest = asyncHandler(async (req: Request, res: Response) => {
        const { requestId } = req.params;
        const adminId = req.user!.id;
        const adminSocietyId = req.user!.societyId;
        const { reason } = req.body;

        if (!adminSocietyId) {
            throw new AppError('Admin must be associated with a society', 403);
        }

        if (!reason) {
            throw new AppError('Rejection reason is required', 400);
        }

        const result = await onboardingService.rejectRequest(
            String(requestId),
            adminId,
            adminSocietyId,
            reason
        );

        res.json({
            success: true,
            message: 'Onboarding request rejected',
            data: result,
        });
    });

    // ============================================
    // ADMIN: REQUEST RESUBMISSION
    // ============================================
    requestResubmission = asyncHandler(async (req: Request, res: Response) => {
        const { requestId } = req.params;
        const adminId = req.user!.id;
        const adminSocietyId = req.user!.societyId;
        const { reason, documentsToResubmit } = req.body;

        if (!adminSocietyId) {
            throw new AppError('Admin must be associated with a society', 403);
        }

        if (!reason) {
            throw new AppError('Resubmission reason is required', 400);
        }

        const result = await onboardingService.requestResubmission(
            String(requestId),
            adminId,
            adminSocietyId,
            reason,
            documentsToResubmit
        );

        res.json({
            success: true,
            message: 'Resubmission requested',
            data: result,
        });
    });
}
