import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import { emitToUser, emitToUsers, SOCKET_EVENTS } from '../../utils/socket';
import { NotificationType } from '../../../prisma/generated/prisma/enums';
import type { Prisma } from '../../types';

interface CreateNotificationData {
  type: NotificationType;
  title: string;
  message: string;
  data?: Prisma.InputJsonValue;
  referenceId?: string;
  referenceType?: string;
  societyId?: string;
}

interface FlatDeliveryOptions {
  excludeUserIds?: string[];
}

export class NotificationService {
  /**
   * Create and send notification to a specific user
   */
  async sendToUser(
    userId: string,
    notificationData: CreateNotificationData
  ) {
    const notification = await prisma.notification.create({
      data: {
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        data: notificationData.data || {},
        referenceId: notificationData.referenceId,
        referenceType: notificationData.referenceType,
        userId,
        societyId: notificationData.societyId,
      },
    });

    // Emit via Socket.IO
    emitToUser(userId, SOCKET_EVENTS.NOTIFICATION, notification);

    return notification;
  }

  /**
   * Send notification to all active residents of a flat
   */
  async sendToFlat(
    flatId: string,
    notificationData: CreateNotificationData,
    options: FlatDeliveryOptions = {}
  ) {
    return this.sendToFlats([flatId], notificationData, options);
  }

  /**
   * Send notification to all active residents linked to any target flat.
   * Uses UserFlatMembership so residents receive alerts for every society/flat
   * they belong to, not only their current active flat context.
   */
  async sendToFlats(
    flatIds: string[],
    notificationData: CreateNotificationData,
    options: FlatDeliveryOptions = {}
  ) {
    const uniqueFlatIds = [...new Set(flatIds.filter(Boolean))];
    if (uniqueFlatIds.length === 0) {
      return [];
    }

    const excludedIds = new Set(options.excludeUserIds ?? []);

    const memberships = await prisma.userFlatMembership.findMany({
      where: {
        flatId: { in: uniqueFlatIds },
        isActive: true,
        role: 'RESIDENT',
        user: {
          isActive: true,
          role: 'RESIDENT',
        },
      },
      select: { userId: true },
    });

    const residentIds = [
      ...new Set(memberships.map((membership) => membership.userId)),
    ].filter((userId) => !excludedIds.has(userId));

    if (residentIds.length === 0) {
      return [];
    }

    const notifications = await Promise.all(
      residentIds.map((userId) =>
        prisma.notification.create({
          data: {
            type: notificationData.type,
            title: notificationData.title,
            message: notificationData.message,
            data: notificationData.data || {},
            referenceId: notificationData.referenceId,
            referenceType: notificationData.referenceType,
            userId,
            societyId: notificationData.societyId,
          },
        })
      )
    );

    emitToUsers(residentIds, SOCKET_EVENTS.NOTIFICATION, notifications[0]);

    return notifications;
  }

  /**
   * Send notification to society staff (admins/guards)
   */
  async sendToSocietyStaff(
    societyId: string,
    roles: ('ADMIN' | 'GUARD')[],
    notificationData: CreateNotificationData
  ) {
    // Get all active staff with specified roles
    const staff = await prisma.user.findMany({
      where: {
        societyId,
        isActive: true,
        role: { in: roles },
      },
      select: { id: true },
    });

    if (staff.length === 0) {
      return [];
    }

    // Create notifications for each staff member
    const notifications = await Promise.all(
      staff.map((member) =>
        prisma.notification.create({
          data: {
            type: notificationData.type,
            title: notificationData.title,
            message: notificationData.message,
            data: notificationData.data || {},
            referenceId: notificationData.referenceId,
            referenceType: notificationData.referenceType,
            userId: member.id,
            societyId,
          },
        })
      )
    );

    // Emit to each staff member (send first notification as representative shape)
    emitToUsers(
      staff.map((s) => s.id),
      SOCKET_EVENTS.NOTIFICATION,
      notifications[0]
    );

    return notifications;
  }

  /**
   * Get user's notifications with pagination
   */
  async getUserNotifications(
    userId: string,
    filters: { page?: number; limit?: number; unreadOnly?: boolean; societyId?: string }
  ) {
    const { page = 1, limit = 20, unreadOnly = false, societyId } = filters;

    const where: Prisma.NotificationWhereInput = { userId };
    if (unreadOnly) {
      where.isRead = false;
    }
    if (societyId) {
      where.societyId = societyId;
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
      notifications,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Global resident inbox grouped by society for multi-society accounts.
   */
  async getGroupedUserNotifications(
    userId: string,
    filters: { page?: number; limit?: number; unreadOnly?: boolean; societyId?: string }
  ) {
    const result = await this.getUserNotifications(userId, filters);

    const societyIds = [
      ...new Set(
        result.notifications
          .map((notification) => notification.societyId)
          .filter((id): id is string => Boolean(id))
      ),
    ];

    const societies = societyIds.length
      ? await prisma.society.findMany({
          where: { id: { in: societyIds } },
          select: { id: true, name: true },
        })
      : [];
    const societyNameById = new Map(societies.map((society) => [society.id, society.name]));

    const groupsById = new Map<
      string,
      {
        societyId: string | null;
        societyName: string;
        unreadCount: number;
        notificationCount: number;
        notifications: typeof result.notifications;
      }
    >();

    for (const notification of result.notifications) {
      const groupId = notification.societyId ?? 'GLOBAL';
      const group = groupsById.get(groupId) ?? {
        societyId: notification.societyId,
        societyName: notification.societyId
          ? societyNameById.get(notification.societyId) ?? 'Society'
          : 'General',
        unreadCount: 0,
        notificationCount: 0,
        notifications: [],
      };

      group.notificationCount += 1;
      if (!notification.isRead) {
        group.unreadCount += 1;
      }
      group.notifications.push(notification);
      groupsById.set(groupId, group);
    }

    return {
      groups: [...groupsById.values()],
      pagination: result.pagination,
    };
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string, userId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new AppError('Notification not found', 404);
    }

    if (notification.userId !== userId) {
      throw new AppError('Access denied', 403);
    }

    return prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<{ count: number }> {
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { count: result.count };
  }

  /**
   * Delete old notifications (cleanup job)
   */
  async deleteOldNotifications(daysOld: number = 30): Promise<{ count: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await prisma.notification.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        isRead: true,
      },
    });

    return { count: result.count };
  }
}

// Export a singleton instance for use across the application
export const notificationService = new NotificationService();
