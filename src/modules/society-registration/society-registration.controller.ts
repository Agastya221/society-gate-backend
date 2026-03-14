import { Request, Response } from 'express';
import { SocietyRegistrationService } from './society-registration.service';
import { asyncHandler, AppError } from '../../utils/ResponseHandler';

const service = new SocietyRegistrationService();

export class SocietyRegistrationController {

  submitRequest = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const result = await service.submitRequest(userId, req.body);

    res.status(201).json({
      success: true,
      message: 'Society registration request submitted. Awaiting SUPER_ADMIN review.',
      data: result,
    });
  });

  getMyStatus = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const result = await service.getMyRequestStatus(userId);

    res.json({ success: true, data: result });
  });

  listRequests = asyncHandler(async (req: Request, res: Response) => {
    const { status, page, limit } = req.query;

    const result = await service.listRequests({
      status: status as 'PENDING' | 'APPROVED' | 'REJECTED' | undefined,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({ success: true, data: result });
  });

  getRequestById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await service.getRequestById(String(id));

    res.json({ success: true, data: result });
  });

  approveRequest = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const reviewerId = req.user!.id;
    const result = await service.approveRequest(String(id), reviewerId);

    res.json({
      success: true,
      message: 'Society registration approved. Society created and admin assigned.',
      data: result,
    });
  });

  rejectRequest = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const reviewerId = req.user!.id;
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      throw new AppError('Rejection reason is required', 400);
    }

    const result = await service.rejectRequest(String(id), reviewerId, rejectionReason);

    res.json({
      success: true,
      message: 'Society registration request rejected.',
      data: result,
    });
  });
}
