
import { Request, Response } from 'express';
import { PreApprovalService } from './preapproval.service';
import { asyncHandler } from '../../utils/ResponseHandler';

const preApprovalService = new PreApprovalService();

export class PreApprovalController {
  // Create pre-approval with QR
  createPreApproval = asyncHandler(async (req: Request, res: Response) => {
    const result = await preApprovalService.createPreApproval(
      req.body,
      req.user!.id
    );

    res.status(201).json({
      success: true,
      message: 'Pre-approval created successfully. Share QR code with your guest.',
      data: result,
    });
  });

  // Get all pre-approvals
  getPreApprovals = asyncHandler(async (req: Request, res: Response) => {
    const { status } = req.query;
    const preApprovals = await preApprovalService.getPreApprovals(
      req.user!.id,
      { status: status as string }
    );

    res.json({
      success: true,
      data: preApprovals,
    });
  });

  // Get QR code for specific pre-approval
  getPreApprovalQR = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await preApprovalService.getPreApprovalQR(id, req.user!.id);

    res.json({
      success: true,
      data: result,
    });
  });

  // Cancel pre-approval
  cancelPreApproval = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await preApprovalService.cancelPreApproval(id, req.user!.id);

    res.json({
      success: true,
      message: 'Pre-approval cancelled successfully',
      data: result,
    });
  });

  // Scan pre-approval QR (Guard)
  scanPreApprovalQR = asyncHandler(async (req: Request, res: Response) => {
    const { qrToken } = req.body;
    const result = await preApprovalService.scanPreApprovalQR(
      qrToken,
      req.user!.id
    );

    res.json({
      success: true,
      message: `${result.preApproval.visitorName} pre-approved. Entry created for flat ${result.preApproval.flatNumber}.`,
      data: result,
    });
  });
}