import type { Response, Request } from 'express';
import { EntryRequestService } from './entry-request.service';
import { UploadService } from '../upload/upload.service';
import { getErrorMessage, getErrorStatusCode } from '../../utils/errorHandler';
import type { EntryRequestStatus } from '../../types';

const entryRequestService = new EntryRequestService();
const uploadService = new UploadService();

/**
 * Create a new entry request (Guard)
 *
 * Returns different shapes depending on auto-approval:
 *  - autoApproved: true  → ready for the guard to admit, resident notified after
 *  - autoApproved: false → PENDING request created, resident gets push to approve/reject
 */
export const createEntryRequest = async (req: Request, res: Response) => {
  try {
    const guardId = req.user!.id;
    const { type, flatId, flatIds, visitorName, visitorPhone, providerTag, purpose, photoKey, peopleCount, vehicleNumber } = req.body;

    if (!type || (!flatId && (!Array.isArray(flatIds) || flatIds.length === 0))) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: type and flatId or flatIds',
      });
    }

    const result = await entryRequestService.createEntryRequest(
      { type, flatId, flatIds, visitorName, visitorPhone, providerTag, purpose, photoKey, peopleCount, vehicleNumber },
      guardId
    );

    res.status(201).json({
      success: true,
      message: result.autoApproved
        ? 'Entry auto-approved by society settings. Guard must confirm arrival.'
        : 'Entry request created. Notification sent to residents.',
      data: { entryRequest: result.entryRequest, autoApproved: result.autoApproved },
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

/**
 * Get entry requests (all roles, filtered by role)
 */
export const getEntryRequests = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    // validate({ query: entryRequestQuerySchema }) puts the coerced values here
    const { status, flatId, page, limit, awaitingEntry, order, since } = (req.validatedQuery ?? {}) as {
      status?: EntryRequestStatus;
      flatId?: string;
      page?: number;
      limit?: number;
      awaitingEntry?: 'true';
      order?: 'oldest' | 'newest';
      since?: string;
    };

    const result = await entryRequestService.getEntryRequests(userId, {
      status,
      flatId,
      page,
      limit,
      awaitingEntry: awaitingEntry === 'true',
      order,
      since,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

/**
 * Get a single entry request
 */
export const getEntryRequestById = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const entryRequest = await entryRequestService.getEntryRequestById(
      String(id),
      userId
    );

    res.status(200).json({
      success: true,
      data: entryRequest,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

/**
 * Get entry request photo view URL
 */
export const getEntryRequestPhoto = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const viewUrl = await uploadService.getEntryPhotoViewUrl(String(id), userId);

    res.status(200).json({
      success: true,
      data: { viewUrl },
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

/**
 * Approve an entry request (Resident)
 */
export const approveEntryRequest = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const entryRequest = await entryRequestService.approveEntryRequest(
      String(id),
      userId,
      { count: req.body?.count },
    );

    res.status(200).json({
      success: true,
      message: 'Entry request approved. Guard must confirm entry.',
      data: entryRequest,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

/** Guard records physical admission after the resident or society rule approves. */
export const admitEntryRequest = async (req: Request, res: Response) => {
  try {
    const result = await entryRequestService.admitEntryRequest(String(req.params.id), req.user!.id);
    res.status(200).json({ success: true, message: 'Visitor checked in', data: result });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

/** Guard removes an approved person who left without entering. */
export const markEntryRequestNoShow = async (req: Request, res: Response) => {
  try {
    const result = await entryRequestService.markNoShow(String(req.params.id), req.user!.id);
    res.status(200).json({ success: true, message: 'Visitor marked as left', data: result });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};

/**
 * Reject an entry request (Resident)
 */
export const rejectEntryRequest = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { reason } = req.body;

    const entryRequest = await entryRequestService.rejectEntryRequest(
      String(id),
      userId,
      reason
    );

    res.status(200).json({
      success: true,
      message: 'Entry request rejected.',
      data: entryRequest,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

/**
 * GET /gate/entry-requests/queue
 * One-call gate queue for the guard home screen: waiting / ready / stopped + inside count.
 */
export const getGateQueue = async (req: Request, res: Response) => {
  try {
    const guardId = req.user!.id;
    const result = await entryRequestService.getGateQueue(guardId);
    res.status(200).json({ success: true, data: result });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

/**
 * Get pending count for guard
 */
export const getPendingCount = async (req: Request, res: Response) => {
  try {
    const guardId = req.user!.id;

    const count = await entryRequestService.getPendingCountForGuard(guardId);

    res.status(200).json({
      success: true,
      data: { pendingCount: count },
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

/**
 * Cancel a pending entry request (Guard — own society only)
 */
export const cancelEntryRequest = async (req: Request, res: Response) => {
  try {
    const guardId = req.user!.id;
    const { id } = req.params;

    const entryRequest = await entryRequestService.cancelEntryRequest(String(id), guardId);

    res.status(200).json({
      success: true,
      message: 'Entry request cancelled.',
      data: entryRequest,
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const moveEntryRequest = async (req: Request, res: Response) => {
  try {
    const result = await entryRequestService.moveEntryRequest(String(req.params.id), req.user!.id, req.body.flatId);
    res.status(201).json({
      success: true,
      message: 'Request sent to the other flat.',
      data: { entryRequest: result.entryRequest, autoApproved: result.autoApproved },
    });
  } catch (error: unknown) {
    res.status(getErrorStatusCode(error)).json({ success: false, message: getErrorMessage(error) });
  }
};
