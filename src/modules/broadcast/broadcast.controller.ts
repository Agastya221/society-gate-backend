import type { Request, Response } from 'express';
import { broadcastService } from './broadcast.service';
import { getSocietyId, clampPagination } from '../../utils/scope';
import { getErrorMessage, getErrorStatusCode } from '../../utils/errorHandler';

// POST /admin/broadcast
export const sendBroadcast = async (req: Request, res: Response) => {
  try {
    const adminId = req.user!.id;
    const societyId = getSocietyId(req);
    const { title, message, isEmergency, target } = req.body;

    const result = await broadcastService.sendBroadcast(societyId, adminId, {
      title,
      message,
      isEmergency: isEmergency ?? false,
      target: target ?? 'ALL',
    });

    return res.status(201).json({
      success: true,
      message: `Broadcast sent to ${result.recipientCount} resident(s)`,
      data: result,
    });
  } catch (error) {
    return res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

// GET /admin/broadcast
export const getBroadcastHistory = async (req: Request, res: Response) => {
  try {
    const societyId = getSocietyId(req);
    const { page, limit } = clampPagination(req.query.page, req.query.limit, 20);

    const result = await broadcastService.getBroadcastHistory(societyId, page, limit);

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return res.status(getErrorStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};
