import { Request, Response } from 'express';
import { PreApprovalService } from './preapproval.service';
import { asyncHandler } from '../../utils/ResponseHandler';
import type { PreApprovalStatus, EntryStatus, EntryType } from '../../../prisma/generated/prisma/client';

const preApprovalService = new PreApprovalService();

export class PreApprovalController {
  // ============================================
  // QR CODE PRE-APPROVAL HANDLERS
  // ============================================

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
      { status: status as PreApprovalStatus | undefined }
    );

    res.json({
      success: true,
      data: preApprovals,
    });
  });

  // Get QR code for specific pre-approval
  getPreApprovalQR = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await preApprovalService.getPreApprovalQR(String(id), req.user!.id);

    res.json({
      success: true,
      data: result,
    });
  });

  // Cancel pre-approval
  cancelPreApproval = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await preApprovalService.cancelPreApproval(String(id), req.user!.id);

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

  // ============================================
  // DELIVERY AUTO-APPROVAL HANDLERS
  // ============================================

  // Create expected delivery
  createExpectedDelivery = asyncHandler(async (req: Request, res: Response) => {
    const delivery = await preApprovalService.createExpectedDelivery(
      req.body,
      req.user!.id
    );

    res.status(201).json({
      success: true,
      message: 'Expected delivery added. It will be auto-approved when arrives.',
      data: delivery,
    });
  });

  // Get expected deliveries
  getExpectedDeliveries = asyncHandler(async (req: Request, res: Response) => {
    const deliveries = await preApprovalService.getExpectedDeliveries(
      req.user!.flatId!
    );

    res.json({
      success: true,
      data: deliveries,
    });
  });

  // Create auto-approve rule
  createAutoApproveRule = asyncHandler(async (req: Request, res: Response) => {
    const rule = await preApprovalService.createAutoApproveRule(
      req.body,
      req.user!.id
    );

    res.status(201).json({
      success: true,
      message: 'Auto-approve rule created',
      data: rule,
    });
  });

  // Get auto-approve rules
  getAutoApproveRules = asyncHandler(async (req: Request, res: Response) => {
    const rules = await preApprovalService.getAutoApproveRules(req.user!.flatId!);

    res.json({
      success: true,
      data: rules,
    });
  });

  // Toggle rule
  toggleAutoApproveRule = asyncHandler(async (req: Request, res: Response) => {
    const { isActive } = req.body;
    const rule = await preApprovalService.toggleAutoApproveRule(
      String(req.params.id),
      isActive
    );

    res.json({
      success: true,
      message: isActive ? 'Rule activated' : 'Rule deactivated',
      data: rule,
    });
  });

  // Delete rule
  deleteAutoApproveRule = asyncHandler(async (req: Request, res: Response) => {
    await preApprovalService.deleteAutoApproveRule(String(req.params.id));

    res.json({
      success: true,
      message: 'Auto-approve rule deleted',
    });
  });

  // Get popular companies (for dropdown)
  getPopularCompanies = asyncHandler(async (req: Request, res: Response) => {
    const companies = preApprovalService.getPopularCompanies();

    res.json({
      success: true,
      data: companies,
    });
  });

  // ============================================
  // ENTRY QUERY HANDLERS (Read-only + Checkout)
  // ============================================

  // Guard does checkout when visitor leaves
  checkoutEntry = asyncHandler(async (req: Request, res: Response) => {
    const entry = await preApprovalService.checkoutEntry(String(req.params.id));

    res.json({
      success: true,
      message: 'Visitor checked out',
      data: entry,
    });
  });

  // Get all entries (with filters)
  getEntries = asyncHandler(async (req: Request, res: Response) => {
    const result = await preApprovalService.getEntries({
      societyId: req.user!.societyId as string,
      flatId: req.query.flatId as string,
      status: req.query.status as EntryStatus | undefined,
      type: req.query.type as EntryType | undefined,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
    });

    res.json({
      success: true,
      data: result,
    });
  });

  // Get pending approvals for resident
  getPendingApprovals = asyncHandler(async (req: Request, res: Response) => {
    const entries = await preApprovalService.getPendingEntries(
      req.user!.societyId!,
      req.user!.flatId ?? undefined
    );

    res.json({
      success: true,
      data: entries,
    });
  });

  // Today's entries for guard dashboard
  getTodayEntries = asyncHandler(async (req: Request, res: Response) => {
    const entries = await preApprovalService.getTodayEntries(req.user!.societyId!);

    res.json({
      success: true,
      data: entries,
    });
  });
}
