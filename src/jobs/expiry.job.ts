import cron from 'node-cron';
import { prisma } from '../utils/Client';
import { emitToUser, SOCKET_EVENTS } from '../utils/socket';
import { notificationService } from '../modules/notification/notification.service';
import { eventBus } from '../utils/eventBus';
import { accessControlEngine } from '../modules/access-control/access-control.engine';
import { accessControlCache } from '../modules/access-control/access-control.cache';
import type { PreApprovedEntryWithRelations } from '../types';
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

// ============================================
// PRE-APPROVED ENTRY JOBS
// ============================================

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export async function expirePreApprovedEntries() {
  try {
    const now = new Date();
    const istNow = new Date(now.getTime() + IST_OFFSET_MS);
    const todayStr = istNow.toISOString().slice(0, 10);
    const currentTime = istNow.toISOString().slice(11, 16);

    // 1. Expire ONCE entries where date has passed
    const expiredOnce = await prisma.preApprovedEntry.findMany({
      where: {
        status: 'ACTIVE',
        scheduleType: 'ONCE',
        schedule: {
          date: { lt: new Date(todayStr) },
        },
      },
      select: { id: true, societyId: true, flatId: true, meta: { select: { vehicleLast4Digits: true } } },
    });

    // 2. Expire RECURRING entries where validUntil has passed
    const expiredRecurring = await prisma.preApprovedEntry.findMany({
      where: {
        status: 'ACTIVE',
        scheduleType: 'RECURRING',
        schedule: {
          validUntil: { lt: now },
        },
      },
      select: { id: true, societyId: true, flatId: true, meta: { select: { vehicleLast4Digits: true } } },
    });

    const allExpired = [...expiredOnce, ...expiredRecurring];
    if (allExpired.length === 0) return;

    await prisma.preApprovedEntry.updateMany({
      where: { id: { in: allExpired.map((e) => e.id) } },
      data: { status: 'EXPIRED', isLocked: false, lockedAt: null, lockedByGuardId: null },
    });

    // Invalidate caches for affected societies/flats
    const invalidations = new Set<string>();
    for (const entry of allExpired) {
      const key = `${entry.societyId}:${entry.flatId}:${entry.meta?.vehicleLast4Digits ?? ''}`;
      if (!invalidations.has(key)) {
        invalidations.add(key);
        await accessControlCache.invalidate(entry.societyId, entry.flatId, entry.meta?.vehicleLast4Digits);
      }
    }

    logger.info({ count: allExpired.length }, 'Auto-expired pre-approved entries');
  } catch (error) {
    logger.error({ error }, 'Error expiring pre-approved entries');
  }
}

export async function releaseStaleEntryLocks() {
  try {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

    const result = await prisma.preApprovedEntry.updateMany({
      where: {
        isLocked: true,
        lockedAt: { lt: twoMinutesAgo },
      },
      data: {
        isLocked: false,
        lockedAt: null,
        lockedByGuardId: null,
      },
    });

    if (result.count > 0) {
      logger.info({ count: result.count }, 'Released stale pre-approved entry locks');
    }
  } catch (error) {
    logger.error({ error }, 'Error releasing stale entry locks');
  }
}

export async function notifyExpiringEntries() {
  try {
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
    const fiftyMinFromNow = new Date(Date.now() + 50 * 60 * 1000);

    const expiring = await prisma.preApprovedEntry.findMany({
      where: {
        status: 'ACTIVE',
        scheduleType: 'RECURRING',
        schedule: {
          validUntil: { gte: fiftyMinFromNow, lte: oneHourFromNow },
        },
      },
      include: { schedule: true, meta: true, flat: { select: { id: true, flatNumber: true } }, user: { select: { id: true, name: true } } },
    });

    for (const entry of expiring) {
      eventBus.emit('pre-approved.expiring-soon', {
        entryId: entry.id,
        flatId: entry.flatId,
        societyId: entry.societyId,
        displayLabel: accessControlEngine.getDisplayLabel(entry as PreApprovedEntryWithRelations),
        expiresAt: entry.schedule!.validUntil!,
      });
    }

    if (expiring.length > 0) {
      logger.info({ count: expiring.length }, 'Sent expiry notifications for pre-approved entries');
    }
  } catch (error) {
    logger.error({ error }, 'Error notifying expiring entries');
  }
}

// Schedule jobs
cron.schedule('* * * * *', expireEntryRequests);
cron.schedule('*/5 * * * *', expireGatePasses);
cron.schedule('*/5 * * * *', expireGuestInvites);
cron.schedule('*/5 * * * *', expirePartyInvites);
cron.schedule('0 3 * * *', cleanupOldNotifications);
cron.schedule('*/5 * * * *', expirePreApprovedEntries);
cron.schedule('* * * * *', releaseStaleEntryLocks);
cron.schedule('*/10 * * * *', notifyExpiringEntries);

logger.info('Cron jobs scheduled');
