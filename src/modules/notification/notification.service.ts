import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import { emitToUser, emitToFlat, emitToUsers } from '../../utils/socket';
import { NotificationType } from '../../../prisma/generated/prisma/enums';

interface CreateNotificationData {
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  referenceId?: string;
  referenceType?: string;
  societyId?: string;
}

export class NotificationService {
  /**
   * Create and send notification to a specific user
   */
  async sendToUser(
    userId: string,
    notificationData: CreateNotificationData
  ): Promise<any> {
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
    emitToUser(userId, 'notification', notification);

    return notification;
  }

  /**
   * Send notification to all active residents of a flat
   */
  async sendToFlat(
    flatId: string,
    notificationData: CreateNotificationData
  ): Promise<any[]> {
    // Get all active residents of the flat
    const residents = await prisma.user.findMany({
      where: {
        flatId,
        isActive: true,
        role: 'RESIDENT',
      },
      select: { id: true },
    });

    if (residents.length === 0) {
      return [];
    }

    // Create notifications for each resident
    const notifications = await Promise.all(
      residents.map((resident) =>
        prisma.notification.create({
          data: {
            type: notificationData.type,
            title: notificationData.title,
            message: notificationData.message,
            data: notificationData.data || {},
            referenceId: notificationData.referenceId,
            referenceType: notificationData.referenceType,
            userId: resident.id,
            societyId: notificationData.societyId,
          },
        })
      )
    );

    // Emit to flat room via Socket.IO
    emitToFlat(flatId, 'notification', {
      type: notificationData.type,
      title: notificationData.title,
      message: notificationData.message,
      data: notificationData.data,
    });

    return notifications;
  }

  /**
   * Send notification to society staff (admins/guards)
   */
  async sendToSocietyStaff(
    societyId: string,
    roles: ('ADMIN' | 'GUARD')[],
    notificationData: CreateNotificationData
  ): Promise<any[]> {
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

    // Emit to each user
    emitToUsers(
      staff.map((s) => s.id),
      'notification',
      {
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        data: notificationData.data,
      }
    );

    return notifications;
  }

  /**
   * Get user's notifications with pagination
   */
  async getUserNotifications(
    userId: string,
    filters: { page?: number; limit?: number; unreadOnly?: boolean }
  ): Promise<{ notifications: any[]; pagination: any }> {
    const { page = 1, limit = 20, unreadOnly = false } = filters;

    const where: any = { userId };
    if (unreadOnly) {
      where.isRead = false;
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
  async markAsRead(notificationId: string, userId: string): Promise<any> {
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
