import type { Response, Request } from 'express';
import { EntryRequestService } from './entry-request.service';
import { UploadService } from '../upload/upload.service';
import { getErrorMessage, getErrorStatusCode } from '../../utils/errorHandler';
import type { EntryRequestStatus } from '../../types';

const entryRequestService = new EntryRequestService();
const uploadService = new UploadService();

/**
 * Create a new entry request (Guard)
 */
export const createEntryRequest = async (req: Request, res: Response) => {
  try {
    const guardId = req.user!.id;
    const { type, flatId, visitorName, visitorPhone, providerTag, photoKey } = req.body;

    if (!type || !flatId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: type, flatId',
      });
    }

    const entryRequest = await entryRequestService.createEntryRequest(
      { type, flatId, visitorName, visitorPhone, providerTag, photoKey },
      guardId
    );

    res.status(201).json({
      success: true,
      message: 'Entry request created. Notification sent to residents.',
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
 * Get entry requests
 */
export const getEntryRequests = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { status, flatId, page, limit } = req.query;

    const result = await entryRequestService.getEntryRequests(userId, {
      status: status as EntryRequestStatus | undefined,
      flatId: flatId as string,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
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

    const entryRequest = await entryRequestService.getEntryRequestById(String(id), userId);

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

    const entryRequest = await entryRequestService.approveEntryRequest(String(id), userId);

    res.status(200).json({
      success: true,
      message: 'Entry request approved. Visitor can enter.',
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
 * Reject an entry request (Resident)
 */
export const rejectEntryRequest = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { reason } = req.body;

    const entryRequest = await entryRequestService.rejectEntryRequest(String(id), userId, reason);

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
