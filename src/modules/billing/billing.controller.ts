import type { Request, Response } from 'express';
import { billingService } from './billing.service';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred';
}

// POST /admin/billing/generate
export const generateInvoices = async (req: Request, res: Response) => {
  try {
    const societyId = req.user!.societyId!;
    const { month, amountPerFlat, description, dueDate } = req.body;

    const result = await billingService.generateBulkInvoices(
      societyId,
      month,
      amountPerFlat,
      description || 'Monthly Maintenance',
      new Date(dueDate),
    );

    return res.status(201).json({ success: true, ...result });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

// POST /admin/billing/penalty
export const applyPenalty = async (req: Request, res: Response) => {
  try {
    const societyId = req.user!.societyId!;
    const { amount } = req.body;

    const result = await billingService.applyLatePenalty(societyId, amount);

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

// GET /admin/dues
export const listDues = async (req: Request, res: Response) => {
  try {
    const societyId = req.user!.societyId!;
    const {
      status,
      month,
      page,
      limit,
    } = req.query as Record<string, string>;

    const result = await billingService.listDues(societyId, {
      status: status as 'PENDING' | 'PAID' | 'OVERDUE' | 'WAIVED' | undefined,
      month,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

// PATCH /admin/billing/invoices/:id/paid
export const markInvoicePaid = async (req: Request, res: Response) => {
  try {
    const societyId = req.user!.societyId as string;
    const id = req.params.id as string;
    const invoice = await billingService.markAsPaid(id, societyId);
    return res.status(200).json({ success: true, data: invoice });
  } catch (error) {
    return res.status(400).json({ success: false, message: getErrorMessage(error) });
  }
};

// PATCH /admin/billing/invoices/:id/waive
export const waiveInvoice = async (req: Request, res: Response) => {
  try {
    const societyId = req.user!.societyId as string;
    const id = req.params.id as string;
    const invoice = await billingService.waiveInvoice(id, societyId);
    return res.status(200).json({ success: true, data: invoice });
  } catch (error) {
    return res.status(400).json({ success: false, message: getErrorMessage(error) });
  }
};
