import cron from 'node-cron';
import { prisma } from '../utils/Client';

/**
 * Cron job to auto-expire pending entry requests
 * Runs every minute
 */
cron.schedule('* * * * *', async () => {
  try {
    const result = await prisma.entryRequest.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    });

    if (result.count > 0) {
      console.log(`[Cron] Auto-expired ${result.count} entry requests`);
    }
  } catch (error) {
    console.error('[Cron] Error expiring entry requests:', error);
  }
});

/**
 * Cron job to auto-expire pre-approvals past their validUntil date
 * Runs every 5 minutes
 */
cron.schedule('*/5 * * * *', async () => {
  try {
    const result = await prisma.preApproval.updateMany({
      where: {
        status: 'ACTIVE',
        validUntil: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    });

    if (result.count > 0) {
      console.log(`[Cron] Auto-expired ${result.count} pre-approvals`);
    }
  } catch (error) {
    console.error('[Cron] Error expiring pre-approvals:', error);
  }
});

/**
 * Cron job to auto-expire gate passes past their validUntil date
 * Runs every 5 minutes
 */
cron.schedule('*/5 * * * *', async () => {
  try {
    const result = await prisma.gatePass.updateMany({
      where: {
        status: { in: ['PENDING', 'APPROVED', 'ACTIVE'] },
        validUntil: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    });

    if (result.count > 0) {
      console.log(`[Cron] Auto-expired ${result.count} gate passes`);
    }
  } catch (error) {
    console.error('[Cron] Error expiring gate passes:', error);
  }
});

/**
 * Cron job to clean up old read notifications (runs daily at 3 AM)
 */
cron.schedule('0 3 * * *', async () => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30); // 30 days old

    const result = await prisma.notification.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        isRead: true,
      },
    });

    if (result.count > 0) {
      console.log(`[Cron] Cleaned up ${result.count} old notifications`);
    }
  } catch (error) {
    console.error('[Cron] Error cleaning up notifications:', error);
  }
});

console.log('[Cron] Expiry and cleanup jobs scheduled');
