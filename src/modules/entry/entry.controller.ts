import { Request, Response } from 'express';
import { EntryService } from './entry.service';
import { asyncHandler } from '../../utils/ResponseHandler';

const entryService = new EntryService();

export class EntryController {
  // Guard creates entry at gate
  createEntry = asyncHandler(async (req: Request, res: Response) => {
    const entry = await entryService.createEntry(req.body, req.user!.id);

    res.status(201).json({
      success: true,
      message: entry.wasAutoApproved 
        ? 'Entry auto-approved' 
        : 'Approval request sent to resident',
      data: entry,
    });
  });

  // Resident approves/rejects from app
  approveEntry = asyncHandler(async (req: Request, res: Response) => {
    const entry = await entryService.approveEntry(
      req.params.id,
      req.user!.id
    );

    res.json({
      success: true,
      message: 'Entry approved successfully',
      data: entry,
    });
  });

  rejectEntry = asyncHandler(async (req: Request, res: Response) => {
    const { reason } = req.body;
    const entry = await entryService.rejectEntry(
      req.params.id,
      reason,
      req.user!.id
    );

    res.json({
      success: true,
      message: 'Entry rejected',
      data: entry,
    });
  });

  // Guard does checkout when visitor leaves
  checkoutEntry = asyncHandler(async (req: Request, res: Response) => {
    const entry = await entryService.checkoutEntry(req.params.id);

    res.json({
      success: true,
      message: 'Visitor checked out',
      data: entry,
    });
  });

  // Get all entries (with filters)
  getEntries = asyncHandler(async (req: Request, res: Response) => {
    const result = await entryService.getEntries({
      societyId: req.user!.societyId,
      flatId: req.query.flatId as string,
      status: req.query.status as string,
      type: req.query.type as string,
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
    const entries = await entryService.getPendingEntries(
      req.user!.societyId,
      req.user!.flatId || undefined
    );

    res.json({
      success: true,
      data: entries,
    });
  });

  // Today's entries for guard dashboard
  getTodayEntries = asyncHandler(async (req: Request, res: Response) => {
    const entries = await entryService.getTodayEntries(req.user!.societyId);

    res.json({
      success: true,
      data: entries,
    });
  });
}