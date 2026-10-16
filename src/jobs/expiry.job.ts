import cron from 'node-cron';
import { prisma } from '../utils/Client';
import { emitToUser, SOCKET_EVENTS } from '../utils/socket';
import { notificationService } from '../modules/notification/notification.service';
import { eventBus } from '../utils/eventBus';
import { accessControlEngine, isOnceScheduleOver, isRecurringScheduleOver } from '../modules/access-control/access-control.engine';
import { accessControlCache } from '../modules/access-control/access-control.cache';
import { EmergencyService } from '../modules/emergency/emergency.service';
import { DomesticStaffService } from '../modules/domestic-staff/domestic-staff.service';
import { ENTRY_REQUEST_APPROVAL_EXPIRED_REASON } from '../modules/entry-request/entry-request.service';
import type { PreApprovedEntryWithRelations } from '../types';
import logger from '../utils/logger';
import { clearCacheByPattern } from '../middlewares/cache.middleware';

const emergencyService = new EmergencyService();
const domesticStaffService = new DomesticStaffService();

// ARCH-4: Each job is an exported function for future worker extraction

export async function expireEntryRequests() {
  try {
    // An approval is permission to enter, not proof of arrival. Unused permission
    // leaves the gate queue after an hour and cannot be admitted later.
    const staleReadyCandidates = await prisma.entryRequest.findMany({
      where: {
        status: 'APPROVED', entryId: null,
        approvedAt: { lt: new Date(Date.now() - 60 * 60 * 1000) },
      },
      select: {
        id: true,
        guardId: true,
        flatId: true,
        societyId: true,
        visitorName: true,
        type: true,
        flat: { select: { flatNumber: true } },
        targets: { include: { flat: { select: { flatNumber: true } } } },
      },
    });

    const expiredApprovals: typeof staleReadyCandidates = [];
    for (const request of staleReadyCandidates) {
      const changed = await prisma.entryRequest.updateMany({
        where: { id: request.id, status: 'APPROVED', entryId: null },
        data: { status: 'EXPIRED', rejectionReason: ENTRY_REQUEST_APPROVAL_EXPIRED_REASON },
      });
      if (changed.count === 1) expiredApprovals.push(request);
    }
    if (expiredApprovals.length > 0) void clearCacheByPattern('entry-requests:*');

    for (const request of expiredApprovals) {
      const targetFlatIds = request.targets.length > 0
        ? request.targets.map((target) => target.flatId)
        : [request.flatId];
      const targetFlats = request.targets.length > 0
        ? request.targets.map((target) => ({ flatId: target.flatId, flatNumber: target.flat.flatNumber, blockName: null }))
        : [{ flatId: request.flatId, flatNumber: request.flat.flatNumber, blockName: null }];

      eventBus.emit('entry-request.approval-expired', {
        entryRequestId: request.id,
        flatId: request.flatId,
        flatIds: targetFlatIds,
        flats: targetFlats,
        societyId: request.societyId,
        visitorName: request.visitorName || 'Visitor',
        visitorType: request.type,
      });
    }

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
        targets: {
          include: {
            flat: { select: { flatNumber: true } },
          },
        },
      },
    });

    if (expiredRequests.length === 0) return;

    const actuallyExpired: typeof expiredRequests = [];
    for (const request of expiredRequests) {
      // A resident may approve between the SELECT and UPDATE. Never replace
      // that approval with EXPIRED or send a false missed-visitor notice.
      const changed = await prisma.entryRequest.updateMany({
        where: { id: request.id, status: 'PENDING', expiresAt: { lt: new Date() } },
        data: { status: 'EXPIRED' },
      });
      if (changed.count === 1) actuallyExpired.push(request);
    }

    // Lists are cached (20s); drop them so guards/residents see EXPIRED right away
    if (actuallyExpired.length > 0) void clearCacheByPattern('entry-requests:*');

    for (const request of actuallyExpired) {
      emitToUser(request.guardId, SOCKET_EVENTS.ENTRY_REQUEST_STATUS, {
        id: request.id,
        status: 'EXPIRED',
        flatNumber: request.flat.flatNumber,
      });

      const targetFlatIds = request.targets.length > 0
        ? request.targets.map((target) => target.flatId)
        : [request.flatId];
      const flatLabels = request.targets.length > 0
        ? request.targets.map((target) => target.flat.flatNumber)
        : [request.flat.flatNumber];

      notificationService.sendToFlats(targetFlatIds, {
        type: 'ENTRY_REQUEST',
        title: 'Missed visitor',
        message: request.visitorName
          ? `${request.visitorName} was waiting at the gate — request expired`
          : 'Someone was waiting at the gate — request expired',
        data: {
          entryRequestId: request.id,
          societyId: request.societyId,
          flatIds: targetFlatIds,
          flatLabels,
          status: 'EXPIRED',
        },
        referenceId: request.id,
        referenceType: 'EntryRequest',
        societyId: request.societyId,
      }).catch((err: unknown) => logger.error({ err }, 'Failed to send missed visitor notification'));
    }

    logger.info({ count: actuallyExpired.length }, 'Auto-expired entry requests');
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

    // 1. Expire ONCE entries whose window is over. Candidates are dated before today,
    // but an overnight pass (e.g. 17:45 → 01:45) stays valid into the next morning,
    // so the actual end (incl. grace) is checked per entry.
    const onceCandidates = await prisma.preApprovedEntry.findMany({
      where: {
        status: 'ACTIVE',
        scheduleType: 'ONCE',
        schedule: {
          date: { lt: new Date(todayStr) },
        },
      },
      select: {
        id: true,
        societyId: true,
        flatId: true,
        meta: { select: { vehicleLast4Digits: true } },
        schedule: {
          select: { date: true, startTime: true, endTime: true, graceBeforeMinutes: true, graceAfterMinutes: true },
        },
      },
    });
    const expiredOnce = onceCandidates.filter(
      (entry) => !entry.schedule?.startTime || !entry.schedule?.endTime || isOnceScheduleOver(entry.schedule, now),
    );

    // 2. Expire RECURRING entries where validUntil has passed — except an overnight
    // window (22:00 → 06:00) whose last night started before validUntil and is still running.
    const recurringCandidates = await prisma.preApprovedEntry.findMany({
      where: {
        status: 'ACTIVE',
        scheduleType: 'RECURRING',
        schedule: {
          validUntil: { lt: now },
        },
      },
      select: {
        id: true,
        societyId: true,
        flatId: true,
        meta: { select: { vehicleLast4Digits: true } },
        schedule: {
          select: {
            validFrom: true, validUntil: true, daysOfWeek: true, timeFrom: true, timeTo: true,
            graceBeforeMinutes: true, graceAfterMinutes: true,
          },
        },
      },
    });
    const expiredRecurring = recurringCandidates.filter(
      (entry) => !entry.schedule || isRecurringScheduleOver(entry.schedule, now),
    );

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
        await accessControlCache.invalidate(entry.societyId, entry.flatId ?? '', entry.meta?.vehicleLast4Digits);
      }
    }

    logger.info({ count: allExpired.length }, 'Auto-expired pre-approved entries');
  } catch (error) {
    logger.error({ error }, 'Error expiring pre-approved entries');
  }
}

// Validation no longer locks passes (double use is prevented atomically in markUsed);
// this only clears locks left behind by older builds.
export async function releaseStaleEntryLocks() {
  try {
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);

    const result = await prisma.preApprovedEntry.updateMany({
      where: {
        isLocked: true,
        OR: [{ lockedAt: null }, { lockedAt: { lt: thirtySecondsAgo } }],
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
        flatId: entry.flatId ?? '',
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

// ============================================
// DOMESTIC STAFF
// ============================================

/**
 * CONFIRMED staff bookings whose end (IST date + endTime, +grace) has passed are marked
 * COMPLETED so they leave "upcoming/active" lists. completedAt is left null so an
 * automatic completion can be told apart from one confirmed by a resident/admin
 * (PATCH /bookings/:id/complete sets completedAt). PENDING requests that are past
 * their start can't be accepted any more; they are already hidden from lists and
 * rejected on action (isBookingExpired / notPastPendingWhere) — StaffBookingStatus has
 * no EXPIRED value, so they are not re-labelled here.
 */
const BOOKING_COMPLETE_GRACE_MS = 60 * 60 * 1000;

export function staffBookingEndsAt(booking: { bookingDate: Date | string; startTime: string; endTime: string }): number {
  const istDate = new Date(new Date(booking.bookingDate).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
  const valid = (t: string) => /^\d{2}:\d{2}$/.test(t);
  const end = valid(booking.endTime) ? booking.endTime : '23:59';
  let endsAt = Date.parse(`${istDate}T${end}:00.000+05:30`);
  // Overnight booking (e.g. 22:00 → 02:00) ends the next day
  if (valid(booking.startTime) && end <= booking.startTime) endsAt += 24 * 60 * 60 * 1000;
  return endsAt;
}

export async function completePastStaffBookings() {
  try {
    const now = Date.now();
    // Day-level prefilter (bookingDate is stored as UTC or IST midnight); exact end checked per row
    const candidates = await prisma.staffBooking.findMany({
      where: { status: 'CONFIRMED', bookingDate: { lt: new Date(now) } },
      select: { id: true, bookingDate: true, startTime: true, endTime: true },
    });
    const ids = candidates
      .filter((b) => {
        const endsAt = staffBookingEndsAt(b);
        return Number.isFinite(endsAt) && endsAt + BOOKING_COMPLETE_GRACE_MS < now;
      })
      .map((b) => b.id);
    if (ids.length === 0) return;

    // status guard: never overwrite a booking that changed since it was read
    const result = await prisma.staffBooking.updateMany({
      where: { id: { in: ids }, status: 'CONFIRMED' },
      data: { status: 'COMPLETED' },
    });
    if (result.count > 0) {
      void clearCacheByPattern('staff:*');
      logger.info({ count: result.count }, 'Auto-completed past confirmed staff bookings');
    }
  } catch (error) {
    logger.error({ error }, 'Error auto-completing past staff bookings');
  }
}

export async function autoCheckoutStaleStaff() {
  try {
    const result = await domesticStaffService.autoCheckoutStaleStaff();
    if (result.count > 0) {
      void clearCacheByPattern('staff:*');
      logger.info({ count: result.count }, 'Auto checked-out stale domestic staff');
    }
  } catch (error) {
    logger.error({ error }, 'Error auto checking-out stale domestic staff');
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
cron.schedule('*/30 * * * *', autoCheckoutStaleStaff);
cron.schedule('*/15 * * * *', completePastStaffBookings);
cron.schedule('*/15 * * * *', async () => {
  try {
    const result = await emergencyService.expireStaleEmergencies();
    if (result.expired > 0) {
      logger.info({ count: result.expired }, 'Auto-expired stale emergencies');
    }
  } catch (error) {
    logger.error({ error }, 'Error auto-expiring stale emergencies');
  }
});

logger.info('Cron jobs scheduled');
