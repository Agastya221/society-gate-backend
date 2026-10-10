import type { Request, Response } from 'express';
import { PreApprovedEntryService } from './pre-approved-entry.service';
import { getErrorMessage, getErrorStatusCode } from '../../utils/errorHandler';
import { getSocietyId } from '../../utils/scope';
import type {
  PreApprovedEntryType,
  PreApprovedEntryStatus,
} from '../../../prisma/generated/prisma/client';

const service = new PreApprovedEntryService();

/** Coerced/defaulted query from validate({ query }) — Express 5 req.query is raw strings. */
const vq = (req: Request) => (req.validatedQuery ?? {}) as Record<string, unknown>;
const optStr = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
const optNum = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

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
    const q = vq(req);
    const result = await service.list(req.user!.id, {
      type: optStr(q.type) as PreApprovedEntryType | undefined,
      status: optStr(q.status) as PreApprovedEntryStatus | undefined,
      page: optNum(q.page),
      limit: optNum(q.limit),
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
      optNum(vq(req).page),
      optNum(vq(req).limit),
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
    const q = vq(req);
    // getSocietyId never yields undefined — an undefined societyId in a Prisma where means "all societies"
    const result = await service.listForGuard(getSocietyId(req), {
      type: optStr(q.type) as PreApprovedEntryType | undefined,
      flatId: optStr(q.flatId),
      blockId: optStr(q.blockId),
      page: optNum(q.page),
      limit: optNum(q.limit),
    });
    res.json({ success: true, data: result });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

export const searchForGuard = async (req: Request, res: Response) => {
  try {
    const entries = await service.searchForGuard(
      getSocietyId(req),
      String(vq(req).q ?? ''),
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
    const q = vq(req);
    const result = await service.listForAdmin(getSocietyId(req), {
      type: optStr(q.type) as PreApprovedEntryType | undefined,
      status: optStr(q.status) as PreApprovedEntryStatus | undefined,
      flatId: optStr(q.flatId),
      blockId: optStr(q.blockId),
      dateFrom: optStr(q.dateFrom),
      dateTo: optStr(q.dateTo),
      page: optNum(q.page),
      limit: optNum(q.limit),
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
