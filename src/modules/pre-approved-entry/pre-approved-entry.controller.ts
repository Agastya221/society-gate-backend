import type { Request, Response } from 'express';
import { PreApprovedEntryService } from './pre-approved-entry.service';
import { getErrorMessage, getErrorStatusCode } from '../../utils/errorHandler';
import type {
  PreApprovedEntryType,
  PreApprovedEntryStatus,
} from '../../../prisma/generated/prisma/client';

const service = new PreApprovedEntryService();

// ============================================
// RESIDENT HANDLERS
// ============================================

export const createEntry = async (req: Request, res: Response) => {
  try {
    const result = await service.create(req.user!.id, req.body);
    const status = 'warning' in result ? 200 : 201;
    res.status(status).json({ success: true, data: result });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const listEntries = async (req: Request, res: Response) => {
  try {
    const result = await service.list(req.user!.id, {
      type: req.query.type as PreApprovedEntryType | undefined,
      status: req.query.status as PreApprovedEntryStatus | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ success: true, data: result });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const getEntry = async (req: Request, res: Response) => {
  try {
    const entry = await service.getById(String(req.params.id), req.user!.id);
    res.json({ success: true, data: entry });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const updateEntry = async (req: Request, res: Response) => {
  try {
    const entry = await service.update(String(req.params.id), req.user!.id, req.body);
    res.json({ success: true, data: entry });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const cancelEntry = async (req: Request, res: Response) => {
  try {
    const entry = await service.cancel(String(req.params.id), req.user!.id);
    res.json({ success: true, data: entry });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const deleteEntry = async (req: Request, res: Response) => {
  try {
    const result = await service.delete(String(req.params.id), req.user!.id);
    res.json({ success: true, ...result });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const repeatEntry = async (req: Request, res: Response) => {
  try {
    const template = await service.repeat(String(req.params.id), req.user!.id);
    res.json({ success: true, data: template });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const getUsageHistory = async (req: Request, res: Response) => {
  try {
    const result = await service.getUsageHistory(
      String(req.params.id),
      req.user!.id,
      req.query.page ? Number(req.query.page) : undefined,
      req.query.limit ? Number(req.query.limit) : undefined,
    );
    res.json({ success: true, data: result });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

// ============================================
// GUARD HANDLERS
// ============================================

export const validateEntry = async (req: Request, res: Response) => {
  try {
    const result = await service.validate(req.body, req.user!.id);
    res.json({ success: true, data: result });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const markEntryUsed = async (req: Request, res: Response) => {
  try {
    const usage = await service.markUsed(
      String(req.params.id),
      req.user!.id,
      req.body.gatePointId,
      req.body.notes,
    );
    res.json({ success: true, data: usage });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const listForGuard = async (req: Request, res: Response) => {
  try {
    const guard = req.user!;
    const result = await service.listForGuard(guard.societyId!, {
      type: req.query.type as PreApprovedEntryType | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ success: true, data: result });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const searchForGuard = async (req: Request, res: Response) => {
  try {
    const guard = req.user!;
    const entries = await service.searchForGuard(
      guard.societyId!,
      req.query.q as string,
    );
    res.json({ success: true, data: entries });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

// ============================================
// ADMIN HANDLERS
// ============================================

export const listForAdmin = async (req: Request, res: Response) => {
  try {
    const admin = req.user!;
    const result = await service.listForAdmin(admin.societyId!, {
      type: req.query.type as PreApprovedEntryType | undefined,
      status: req.query.status as PreApprovedEntryStatus | undefined,
      flatId: req.query.flatId as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ success: true, data: result });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const adminCancelEntry = async (req: Request, res: Response) => {
  try {
    const entry = await service.adminCancel(
      String(req.params.id),
      req.user!.id,
      req.body.reason,
    );
    res.json({ success: true, data: entry });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};
