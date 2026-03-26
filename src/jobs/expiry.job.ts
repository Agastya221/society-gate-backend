import cron from 'node-cron';
import { prisma } from '../utils/Client';
import { emitToUser, SOCKET_EVENTS } from '../utils/socket';
import { notificationService } from '../modules/notification/notification.service';
import logger from '../utils/logger';

// ARCH-4: Each job is an exported function for future worker extraction

export async function expireEntryRequests() {
  try {
    const expiredRequests = await prisma.entryRequest.findMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: new Date() },
      },
      select: {
        id: true,
        guardId: true,
        flatId: true,
        societyId: true,
        visitorName: true,
        flat: { select: { flatNumber: true } },
      },
    });

    if (expiredRequests.length === 0) return;

    await prisma.entryRequest.updateMany({
      where: {
        id: { in: expiredRequests.map((r) => r.id) },
      },
      data: { status: 'EXPIRED' },
    });

    for (const request of expiredRequests) {
      emitToUser(request.guardId, SOCKET_EVENTS.ENTRY_REQUEST_STATUS, {
        id: request.id,
        status: 'EXPIRED',
        flatNumber: request.flat.flatNumber,
      });

      notificationService.sendToFlat(request.flatId, {
        type: 'ENTRY_REQUEST',
        title: 'Missed visitor',
        message: request.visitorName
          ? `${request.visitorName} was waiting at the gate — request expired`
          : 'Someone was waiting at the gate — request expired',
        referenceId: request.id,
        referenceType: 'EntryRequest',
        societyId: request.societyId,
      }).catch((err: unknown) => logger.error({ err }, 'Failed to send missed visitor notification'));
    }

    logger.info({ count: expiredRequests.length }, 'Auto-expired entry requests');
  } catch (error) {
    logger.error({ error }, 'Error expiring entry requests');
  }
}

export async function expireGatePasses() {
  try {
    const result = await prisma.gatePass.updateMany({
      where: {
        status: { in: ['PENDING', 'APPROVED', 'ACTIVE'] },
        validUntil: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    });

    if (result.count > 0) {
      logger.info({ count: result.count }, 'Auto-expired gate passes');
    }
  } catch (error) {
    logger.error({ error }, 'Error expiring gate passes');
  }
}

export async function expireGuestInvites() {
  try {
    const result = await prisma.guestInvite.updateMany({
      where: {
        status: 'ACTIVE',
        validUntil: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    });

    if (result.count > 0) {
      logger.info({ count: result.count }, 'Auto-expired guest invites');
    }
  } catch (error) {
    logger.error({ error }, 'Error expiring guest invites');
  }
}

export async function expirePartyInvites() {
  try {
    const result = await prisma.partyInvite.updateMany({
      where: {
        status: 'ACTIVE',
        validUntil: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    });

    if (result.count > 0) {
      logger.info({ count: result.count }, 'Auto-expired party invites');
    }
  } catch (error) {
    logger.error({ error }, 'Error expiring party invites');
  }
}

export async function cleanupOldNotifications() {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);

    const result = await prisma.notification.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        isRead: true,
      },
    });

    if (result.count > 0) {
      logger.info({ count: result.count }, 'Cleaned up old notifications');
    }
  } catch (error) {
    logger.error({ error }, 'Error cleaning up notifications');
  }
}

// Schedule jobs
cron.schedule('* * * * *', expireEntryRequests);
cron.schedule('*/5 * * * *', expireGatePasses);
cron.schedule('*/5 * * * *', expireGuestInvites);
cron.schedule('*/5 * * * *', expirePartyInvites);
cron.schedule('0 3 * * *', cleanupOldNotifications);

logger.info('Cron jobs scheduled');
