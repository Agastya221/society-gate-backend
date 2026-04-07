import type { Request, Response } from 'express';
import { broadcastService } from './broadcast.service';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred';
}

// POST /admin/broadcast
export const sendBroadcast = async (req: Request, res: Response) => {
  try {
    const adminId = req.user!.id;
    const societyId = req.user!.societyId!;
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
    return res.status(500).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

// GET /admin/broadcast
export const getBroadcastHistory = async (req: Request, res: Response) => {
  try {
    const societyId = req.user!.societyId!;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    const result = await broadcastService.getBroadcastHistory(societyId, page, limit);

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};
