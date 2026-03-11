import cron from 'node-cron';
import { prisma } from '../utils/Client';
import { emitToUser, SOCKET_EVENTS } from '../utils/socket';
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
    }

    logger.info({ count: expiredRequests.length }, 'Auto-expired entry requests');
  } catch (error) {
    logger.error({ error }, 'Error expiring entry requests');
  }
}

export async function expirePreApprovals() {
  try {
    const result = await prisma.preApproval.updateMany({
      where: {
        status: 'ACTIVE',
        validUntil: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    });

    if (result.count > 0) {
      logger.info({ count: result.count }, 'Auto-expired pre-approvals');
    }
  } catch (error) {
    logger.error({ error }, 'Error expiring pre-approvals');
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
cron.schedule('*/5 * * * *', expirePreApprovals);
cron.schedule('*/5 * * * *', expireGatePasses);
cron.schedule('0 3 * * *', cleanupOldNotifications);

logger.info('Cron jobs scheduled');
