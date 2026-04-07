import { prisma } from '../../utils/Client';
import { pushService } from '../../services/push.service';
import logger from '../../utils/logger';

// ============================================
// BROADCAST SERVICE
// ============================================

export class BroadcastService {

  /**
   * Send a broadcast to all or targeted residents.
   * - Saves to the Notice table for historical record.
   * - Triggers FCM push notifications immediately via pushService.
   */
  async sendBroadcast(
    societyId: string,
    adminId: string,
    payload: {
      title: string;
      message: string;
      isEmergency: boolean;
      target: string; // 'ALL' or a block ID
    },
  ) {
    const { title, message, isEmergency, target } = payload;

    // 1. Persist to Notice table for the in-app notice board
    const notice = await prisma.notice.create({
      data: {
        societyId,
        createdById: adminId,
        title,
        description: message,
        type: isEmergency ? 'EMERGENCY' : 'GENERAL',
        priority: isEmergency ? 'CRITICAL' : 'MEDIUM',
        isUrgent: isEmergency,
        publishAt: new Date(), // Publish immediately
      },
    });

    logger.info(
      { societyId, noticeId: notice.id, target, isEmergency },
      '📢 [BROADCAST] Notice saved to DB',
    );

    // 2. Build user ID list based on target
    let userIds: string[] = [];

    if (target === 'ALL') {
      const residents = await prisma.user.findMany({
        where: {
          societyId,
          isActive: true,
          role: { in: ['RESIDENT', 'ADMIN'] },
          fcmToken: { not: null },
        },
        select: { id: true },
      });
      userIds = residents.map((r) => r.id);
    } else {
      // target is a blockId — get residents in that block's flats
      const residents = await prisma.user.findMany({
        where: {
          societyId,
          isActive: true,
          role: { in: ['RESIDENT', 'ADMIN'] },
          fcmToken: { not: null },
          flat: {
            blockId: target,
          },
        },
        select: { id: true },
      });
      userIds = residents.map((r) => r.id);
    }

    logger.info(
      { societyId, target, recipientCount: userIds.length },
      '📲 [BROADCAST] Sending FCM push notifications',
    );

    // 3. Send FCM push notifications (non-blocking)
    pushService.sendToUsers(userIds, {
      title,
      body: message,
      data: {
        type: 'BROADCAST',
        noticeId: notice.id,
        isEmergency: String(isEmergency),
      },
    }).catch((err) => {
      logger.error({ err, societyId }, '❌ [BROADCAST] FCM push failed');
    });

    // 4. Create in-app notifications in DB for each resident
    if (userIds.length > 0) {
      await prisma.notification.createMany({
        data: userIds.map((userId) => ({
          userId,
          societyId,
          type: 'SYSTEM' as const,
          title,
          message,
          referenceId: notice.id,
          referenceType: 'Notice',
        })),
        skipDuplicates: true,
      });
    }

    return {
      noticeId: notice.id,
      recipientCount: userIds.length,
      target,
      isEmergency,
    };
  }

  /**
   * List past broadcast notices for the admin dashboard history view.
   */
  async getBroadcastHistory(societyId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [notices, total] = await Promise.all([
      prisma.notice.findMany({
        where: {
          societyId,
          type: { in: ['GENERAL', 'EMERGENCY', 'URGENT'] },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          createdBy: { select: { name: true, role: true } },
        },
      }),
      prisma.notice.count({
        where: { societyId, type: { in: ['GENERAL', 'EMERGENCY', 'URGENT'] } },
      }),
    ]);

    return {
      data: notices,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }
}

export const broadcastService = new BroadcastService();
