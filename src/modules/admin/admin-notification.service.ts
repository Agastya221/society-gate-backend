import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import type { NotificationType } from '../../../prisma/generated/prisma/enums';
import type { Prisma } from '../../types';

// Maps notification types to frontend-friendly categories for the stats endpoint
const CATEGORY_MAP: Record<string, string> = {
  ONBOARDING_STATUS: 'onboarding',
  ENTRY_REQUEST: 'gate',
  DELIVERY_REQUEST: 'gate',
  EMERGENCY_ALERT: 'emergency',
  STAFF_CHECKIN: 'staff',
  STAFF_CHECKOUT: 'staff',
  GUEST_ENTRY: 'gate',
  SYSTEM: 'system',
};

export class AdminNotificationService {

  // -----------------------------------------------------------------------
  // 1. Get paginated list of admin's notifications
  //    Admins receive notifications from existing listeners (emergency, etc.)
  //    PLUS new ones added by this module (onboarding, complaints, billing).
  // -----------------------------------------------------------------------
  async getAdminNotifications(
    adminId: string,
    societyId: string | null,
    opts: {
      page?: number;
      limit?: number;
      unreadOnly?: boolean;
      type?: NotificationType;
      category?: string;
    } = {},
  ) {
    const { page = 1, limit = 20, unreadOnly = false, type, category } = opts;

    const where: {
      userId: string;
      isRead?: boolean;
      type?: NotificationType;
    } = { userId: adminId };

    if (unreadOnly) where.isRead = false;

    // Filter by a specific type
    if (type) where.type = type;

    // If filtering by category, map to one or more types
    let typesForCategory: NotificationType[] | undefined;
    if (category && !type) {
      typesForCategory = (Object.entries(CATEGORY_MAP)
        .filter(([, cat]) => cat === category)
        .map(([t]) => t)) as NotificationType[];
      if (typesForCategory.length > 0) {
        (where as Record<string, unknown>).type = { in: typesForCategory };
      }
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);

    return {
      notifications: notifications.map((n) => ({
        ...n,
        category: CATEGORY_MAP[n.type] ?? 'system',
      })),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // -----------------------------------------------------------------------
  // 2. Get unread count
  // -----------------------------------------------------------------------
  async getUnreadCount(adminId: string): Promise<number> {
    return prisma.notification.count({
      where: { userId: adminId, isRead: false },
    });
  }

  // -----------------------------------------------------------------------
  // 3. Get notification stats grouped by category
  //    Returns { total, unread, byCategory: { onboarding: X, gate: Y, ... } }
  // -----------------------------------------------------------------------
  async getNotificationStats(adminId: string) {
    const notifications = await prisma.notification.findMany({
      where: { userId: adminId },
      select: { type: true, isRead: true },
    });

    const byCategory: Record<string, { total: number; unread: number }> = {};

    for (const n of notifications) {
      const cat = CATEGORY_MAP[n.type] ?? 'system';
      if (!byCategory[cat]) byCategory[cat] = { total: 0, unread: 0 };
      byCategory[cat].total++;
      if (!n.isRead) byCategory[cat].unread++;
    }

    return {
      total: notifications.length,
      unread: notifications.filter((n) => !n.isRead).length,
      byCategory,
    };
  }

  // -----------------------------------------------------------------------
  // 4. Mark single notification as read (ownership verified)
  // -----------------------------------------------------------------------
  async markAsRead(notificationId: string, adminId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) throw new AppError('Notification not found', 404);
    if (notification.userId !== adminId) throw new AppError('Access denied', 403);

    return prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  // -----------------------------------------------------------------------
  // 5. Mark ALL as read for this admin
  // -----------------------------------------------------------------------
  async markAllAsRead(adminId: string): Promise<{ count: number }> {
    const result = await prisma.notification.updateMany({
      where: { userId: adminId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { count: result.count };
  }

  // -----------------------------------------------------------------------
  // 6. Delete a notification (soft/hard — we do hard delete per notification)
  // -----------------------------------------------------------------------
  async deleteNotification(notificationId: string, adminId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) throw new AppError('Notification not found', 404);
    if (notification.userId !== adminId) throw new AppError('Access denied', 403);

    await prisma.notification.delete({ where: { id: notificationId } });
    return { deleted: true };
  }

  // -----------------------------------------------------------------------
  // 7. SEND an admin notification (used internally by other services)
  //    Sends to all ADMIN users in a society synchronously.
  // -----------------------------------------------------------------------
  async notifyAdmins(
    societyId: string,
    payload: {
      type: NotificationType;
      title: string;
      message: string;
      referenceId?: string;
      referenceType?: string;
      data?: Record<string, unknown>;
    },
  ) {
    const admins = await prisma.user.findMany({
      where: { societyId, isActive: true, role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
      select: { id: true },
    });

    if (admins.length === 0) return [];

    // Use createMany for efficiency
    await prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        societyId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        referenceId: payload.referenceId,
        referenceType: payload.referenceType,
        data: (payload.data ?? {}) as Prisma.InputJsonValue,
      })),
      skipDuplicates: false,
    });

    return admins.map((a) => a.id);
  }
}

export const adminNotificationService = new AdminNotificationService();
