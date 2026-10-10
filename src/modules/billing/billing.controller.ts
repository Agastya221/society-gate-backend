import { AppError } from '../../utils/ResponseHandler';
import type { Request, Response } from 'express';
import { billingService } from './billing.service';
import { clampPagination, getSocietyId } from '../../utils/scope';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred';
}

// POST /admin/billing/generate
export const generateInvoices = async (req: Request, res: Response) => {
  try {
    const societyId = getSocietyId(req);
    const { month, amountPerFlat, description, dueDate } = req.body;

    const result = await billingService.generateBulkInvoices(
      societyId,
      month,
      amountPerFlat,
      description || 'Monthly Maintenance',
      dueDate ? new Date(dueDate) : undefined,
    );

    return res.status(201).json({ success: true, ...result });
  } catch (error) {
    const status = error instanceof AppError ? error.statusCode : 500;
    return res.status(status).json({ success: false, message: getErrorMessage(error) });
  }
};

// POST /admin/billing/penalty
export const applyPenalty = async (req: Request, res: Response) => {
  try {
    const societyId = getSocietyId(req);
    const { amount } = req.body;

    const result = await billingService.applyLatePenalty(societyId, amount);

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    const status = error instanceof AppError ? error.statusCode : 500;
    return res.status(status).json({ success: false, message: getErrorMessage(error) });
  }
};

// GET /admin/dues
export const listDues = async (req: Request, res: Response) => {
  try {
    const societyId = getSocietyId(req);
    const { status, month, page, limit } = req.query;
    const allowedStatuses = ['PENDING', 'PAID', 'OVERDUE', 'WAIVED'] as const;
    type DueStatus = (typeof allowedStatuses)[number];
    const pagination = clampPagination(page, limit, 50);

    const result = await billingService.listDues(societyId, {
      status: typeof status === 'string' && (allowedStatuses as readonly string[]).includes(status)
        ? (status as DueStatus)
        : undefined,
      month: typeof month === 'string' && month ? month : undefined,
      page: pagination.page,
      limit: pagination.limit,
    });

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    const status = error instanceof AppError ? error.statusCode : 500;
    return res.status(status).json({ success: false, message: getErrorMessage(error) });
  }
};

// PATCH /admin/billing/invoices/:id/paid
export const markInvoicePaid = async (req: Request, res: Response) => {
  try {
    const societyId = getSocietyId(req);
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
    const societyId = getSocietyId(req);
    const id = req.params.id as string;
    const invoice = await billingService.waiveInvoice(id, societyId);
    return res.status(200).json({ success: true, data: invoice });
  } catch (error) {
    return res.status(400).json({ success: false, message: getErrorMessage(error) });
  }
};

// POST /admin/billing/invoices/:id/reminder
export const sendInvoiceReminder = async (req: Request, res: Response) => {
  try {
    const societyId = getSocietyId(req);
    const id = req.params.id as string;
    const result = await billingService.sendInvoiceReminder(id, societyId);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return res.status(400).json({ success: false, message: getErrorMessage(error) });
  }
};
