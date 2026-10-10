import type { Request, Response } from 'express';
import { adminNotificationService } from './admin-notification.service';
import { NotificationType } from '../../../prisma/generated/prisma/enums';
import { clampPagination } from '../../utils/scope';

function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'An unexpected error occurred';
}

// GET /admin/notifications
export const getAdminNotifications = async (req: Request, res: Response) => {
  try {
    const adminId = req.user!.id;
    const societyId = req.user!.societyId ?? null;
    const { page, limit, unreadOnly, type, category } = req.query;
    const paging = clampPagination(page, limit, 20);
    const validType =
      typeof type === 'string' && (Object.values(NotificationType) as string[]).includes(type)
        ? (type as NotificationType)
        : undefined;

    const result = await adminNotificationService.getAdminNotifications(adminId, societyId, {
      page: paging.page,
      limit: paging.limit,
      unreadOnly: unreadOnly === 'true',
      type: validType,
      category: typeof category === 'string' ? category : undefined,
    });

    return res.status(200).json({ success: true, data: result });
  } catch (e) {
    return res.status(500).json({ success: false, message: getErrorMessage(e) });
  }
};

// GET /admin/notifications/unread-count
export const getAdminUnreadCount = async (req: Request, res: Response) => {
  try {
    const count = await adminNotificationService.getUnreadCount(req.user!.id);
    return res.status(200).json({ success: true, data: { unreadCount: count } });
  } catch (e) {
    return res.status(500).json({ success: false, message: getErrorMessage(e) });
  }
};

// GET /admin/notifications/stats
export const getAdminNotificationStats = async (req: Request, res: Response) => {
  try {
    const stats = await adminNotificationService.getNotificationStats(req.user!.id);
    return res.status(200).json({ success: true, data: stats });
  } catch (e) {
    return res.status(500).json({ success: false, message: getErrorMessage(e) });
  }
};

// PATCH /admin/notifications/:id/read
export const markAdminNotificationRead = async (req: Request, res: Response) => {
  try {
    const notification = await adminNotificationService.markAsRead(req.params.id as string, req.user!.id);
    return res.status(200).json({ success: true, data: notification });
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode ?? 400;
    return res.status(status).json({ success: false, message: getErrorMessage(e) });
  }
};

// PATCH /admin/notifications/read-all
export const markAllAdminNotificationsRead = async (req: Request, res: Response) => {
  try {
    const result = await adminNotificationService.markAllAsRead(req.user!.id);
    return res.status(200).json({
      success: true,
      message: `${result.count} notification(s) marked as read`,
      data: result,
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: getErrorMessage(e) });
  }
};

// DELETE /admin/notifications/:id
export const deleteAdminNotification = async (req: Request, res: Response) => {
  try {
    await adminNotificationService.deleteNotification(req.params.id as string, req.user!.id);
    return res.status(200).json({ success: true, message: 'Notification deleted' });
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode ?? 400;
    return res.status(status).json({ success: false, message: getErrorMessage(e) });
  }
};
