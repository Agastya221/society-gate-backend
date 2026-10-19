import { eventBus } from '../utils/eventBus';
import { notificationService } from '../modules/notification/notification.service';
import { pushService } from '../services/push.service';
import { emitToSociety, SOCKET_EVENTS } from '../utils/socket';
import { prisma } from '../utils/Client';
import logger from '../utils/logger';
import { getEmergencySeverity } from '../modules/emergency/emergency.service';

// ARCH-3: Notification listeners decoupled from business logic.
// Each handler listens for a domain event and sends the appropriate notifications.

eventBus.on('entry-request.approved', async (payload) => {
  try {
    const autoApproved = payload.autoApproved === true;
    const title = autoApproved ? 'Entry auto-approved' : 'Entry approved';
    const flatLabels = payload.flats.map((flat) => flat.flatNumber);
    const allowed = payload.approvedCount ?? payload.peopleCount ?? 1;
    const partial = payload.peopleCount && payload.approvedCount && payload.approvedCount < payload.peopleCount;
    const group = allowed > 1 ? ` + ${allowed - 1} more` : '';
    const visitorLabel = `${payload.visitorName}${group} (${humanizeEnum(payload.visitorType).toLowerCase()})`;
    const body = autoApproved
      ? `${visitorLabel} was approved by your society settings and is waiting at the gate`
      : partial
        ? `${payload.approvedByName} allowed ${allowed} of ${payload.peopleCount} for ${payload.visitorName}; the guard will confirm entry`
        : `${payload.approvedByName} approved ${visitorLabel}; the guard will confirm entry`;

    await notificationService.sendToFlats(payload.flatIds, {
      type: 'ENTRY_REQUEST',
      title,
      message: body,
      data: {
        entryRequestId: payload.entryRequestId,
        societyId: payload.societyId,
        flatIds: payload.flatIds,
        flatLabels,
        visitorName: payload.visitorName,
        approvedBy: payload.approvedByName,
        status: 'APPROVED',
        autoApproved,
      },
      referenceId: payload.entryRequestId,
      referenceType: 'EntryRequest',
      societyId: payload.societyId,
    }, { excludeUserIds: [payload.approvedById] });

    pushService.sendToFlats(payload.flatIds, {
      title,
      body,
      data: {
        type: 'GATE_APPROVED',
        screen: 'EntryRequest',
        requestId: payload.entryRequestId,
        entryRequestId: payload.entryRequestId,
        societyId: payload.societyId,
        flatIds: payload.flatIds.join(','),
        approvedBy: payload.approvedByName,
        autoApproved: autoApproved ? 'true' : 'false',
      },
    }, { excludeUserIds: [payload.approvedById] }).catch((err) => logger.error({ err }, 'Push failed: entry-request.approved (residents)'));

    // Auto-approved: the guard already got APPROVED in the create response
    if (autoApproved) return;

    // Notify the guard that entry was approved
    pushService.sendToUser(payload.guardId, {
      title: 'Entry approved',
      body: partial
        ? `${payload.approvedByName} allowed only ${allowed} of ${payload.peopleCount} for ${payload.visitorName}. The others wait outside.`
        : `${payload.approvedByName} approved ${payload.visitorName}${group}. Let them in.`,
      data: { type: 'GATE_APPROVED', requestId: payload.entryRequestId, entryRequestId: payload.entryRequestId },
    }).catch((err) => logger.error({ err }, 'Push failed: entry-request.approved (guard)'));
  } catch (error) {
    logger.error({ error, event: 'entry-request.approved', payload }, 'Failed to send approval notification');
  }
});

eventBus.on('entry-request.admitted', async (payload) => {
  try {
    const body = `${payload.visitorName} entered the society`;
    await notificationService.sendToFlats([payload.flatId], {
      type: 'ENTRY_REQUEST',
      title: 'Visitor entered',
      message: body,
      data: { entryRequestId: payload.entryRequestId, societyId: payload.societyId, status: 'CHECKED_IN' },
      referenceId: payload.entryRequestId,
      referenceType: 'EntryRequest',
      societyId: payload.societyId,
    });
    pushService.sendToFlats([payload.flatId], {
      title: 'Visitor entered', body,
      data: { type: 'GATE_APPROVED', screen: 'EntryRequest', requestId: payload.entryRequestId, entryRequestId: payload.entryRequestId },
    }).catch((err) => logger.error({ err }, 'Push failed: entry-request.admitted'));
  } catch (error) {
    logger.error({ error, event: 'entry-request.admitted', payload }, 'Failed to send entry notification');
  }
});

eventBus.on('entry-request.rejected', async (payload) => {
  try {
    const title = 'Entry rejected';
    const flatLabels = payload.flats.map((flat) => flat.flatNumber);
    const body = payload.reason
      ? `${payload.rejectedByName} rejected ${payload.visitorName} — "${payload.reason}"`
      : `${payload.rejectedByName} rejected ${payload.visitorName} (${humanizeEnum(payload.visitorType).toLowerCase()})`;

    await notificationService.sendToFlats(payload.flatIds, {
      type: 'ENTRY_REQUEST',
      title,
      message: body,
      data: {
        entryRequestId: payload.entryRequestId,
        societyId: payload.societyId,
        flatIds: payload.flatIds,
        flatLabels,
        visitorName: payload.visitorName,
        rejectedBy: payload.rejectedByName,
        reason: payload.reason,
        status: 'REJECTED',
      },
      referenceId: payload.entryRequestId,
      referenceType: 'EntryRequest',
      societyId: payload.societyId,
    }, { excludeUserIds: [payload.rejectedById] });

    pushService.sendToFlats(payload.flatIds, {
      title,
      body,
      data: {
        type: 'GATE_DENIED',
        screen: 'EntryRequest',
        requestId: payload.entryRequestId,
        entryRequestId: payload.entryRequestId,
        societyId: payload.societyId,
        flatIds: payload.flatIds.join(','),
        rejectedBy: payload.rejectedByName,
      },
    }, { excludeUserIds: [payload.rejectedById] }).catch((err) => logger.error({ err }, 'Push failed: entry-request.rejected (residents)'));

    // Notify the guard that entry was denied
    pushService.sendToUser(payload.guardId, {
      title: 'Entry denied',
      body: payload.reason
        ? `${payload.rejectedByName} denied ${payload.visitorName} — "${payload.reason}"`
        : `${payload.rejectedByName} denied ${payload.visitorName}`,
      data: { type: 'GATE_DENIED', requestId: payload.entryRequestId, entryRequestId: payload.entryRequestId },
    }).catch((err) => logger.error({ err }, 'Push failed: entry-request.rejected (guard)'));
  } catch (error) {
    logger.error({ error, event: 'entry-request.rejected', payload }, 'Failed to send rejection notification');
  }
});

eventBus.on('entry-request.no-show', async (payload) => {
  try {
    const flatLabels = payload.flats.map((flat) => flat.flatNumber);
    const title = 'Visitor left without entering';
    const body = `${payload.visitorName} (${humanizeEnum(payload.visitorType).toLowerCase()}) left the gate without entering`;

    await notificationService.sendToFlats(payload.flatIds, {
      type: 'ENTRY_REQUEST',
      title,
      message: body,
      data: {
        entryRequestId: payload.entryRequestId,
        societyId: payload.societyId,
        flatIds: payload.flatIds,
        flatLabels,
        visitorName: payload.visitorName,
        status: 'EXPIRED',
      },
      referenceId: payload.entryRequestId,
      referenceType: 'EntryRequest',
      societyId: payload.societyId,
    });

    pushService.sendToFlats(payload.flatIds, {
      title,
      body,
      data: {
        type: 'GATE_DENIED',
        screen: 'EntryRequest',
        requestId: payload.entryRequestId,
        entryRequestId: payload.entryRequestId,
        societyId: payload.societyId,
        flatIds: payload.flatIds.join(','),
      },
    }).catch((err) => logger.error({ err }, 'Push failed: entry-request.no-show'));
  } catch (error) {
    logger.error({ error, event: 'entry-request.no-show', payload }, 'Failed to send no-show notification');
  }
});

// Cron-driven (expiry.job.ts): an approval sat unused past the ready window. Uses a
// dedicated push type (GATE_EXPIRED) rather than GATE_DENIED since nobody denied
// anything — the resident's permission simply lapsed before the visitor arrived.
eventBus.on('entry-request.approval-expired', async (payload) => {
  try {
    const flatLabels = payload.flats.map((flat) => flat.flatNumber);
    const title = 'Approval expired';
    const body = `Your approval for ${payload.visitorName} (${humanizeEnum(payload.visitorType).toLowerCase()}) expired — they never reached the gate`;

    await notificationService.sendToFlats(payload.flatIds, {
      type: 'ENTRY_REQUEST',
      title,
      message: body,
      data: {
        entryRequestId: payload.entryRequestId,
        societyId: payload.societyId,
        flatIds: payload.flatIds,
        flatLabels,
        visitorName: payload.visitorName,
        status: 'EXPIRED',
      },
      referenceId: payload.entryRequestId,
      referenceType: 'EntryRequest',
      societyId: payload.societyId,
    });

    pushService.sendToFlats(payload.flatIds, {
      title,
      body,
      data: {
        type: 'GATE_EXPIRED',
        screen: 'EntryRequest',
        requestId: payload.entryRequestId,
        entryRequestId: payload.entryRequestId,
        societyId: payload.societyId,
        flatIds: payload.flatIds.join(','),
      },
    }).catch((err) => logger.error({ err }, 'Push failed: entry-request.approval-expired'));
  } catch (error) {
    logger.error({ error, event: 'entry-request.approval-expired', payload }, 'Failed to send approval-expired notification');
  }
});

// Raw enums ("VISITOR", "SWIGGY") read badly in notifications — map them to words.
const ENTRY_TYPE_SUBJECT: Record<string, string> = {
  VISITOR: 'A visitor',
  DELIVERY: 'A delivery',
  DOMESTIC_STAFF: 'Your staff',
  CAB: 'A cab',
  VENDOR: 'A vendor',
};

const humanizeEnum = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1).toLowerCase().replace(/_/g, ' ');

/** "Swiggy delivery", "Delivery", "Visitor", "Cab" … used as the request's purpose */
const describePurpose = (type: string, providerTag?: string | null) => {
  if (providerTag && providerTag !== 'OTHER') {
    return type === 'DELIVERY' ? `${humanizeEnum(providerTag)} delivery` : humanizeEnum(providerTag);
  }
  return humanizeEnum(type);
};

/** "Rahul is waiting at the gate" / "A Swiggy delivery is waiting at the gate" / "A visitor is waiting…" */
const describeWaiting = (type: string, visitorName?: string | null, providerTag?: string | null) => {
  if (visitorName) return `${visitorName} is waiting at the gate`;
  if (providerTag && providerTag !== 'OTHER') {
    return `${type === 'DELIVERY' ? 'A ' : ''}${describePurpose(type, providerTag)} is waiting at the gate`;
  }
  return `${ENTRY_TYPE_SUBJECT[type] ?? 'Someone'} is waiting at the gate`;
};

eventBus.on('entry-request.created', async (payload) => {
  try {
    const providerName = payload.purpose || describePurpose(payload.type, payload.providerTag);
    const flatLabels = payload.flats.map((flat) => flat.flatNumber);
    const flatLabel = flatLabels.length > 1
      ? `${flatLabels.length} Flats`
      : `Flat ${flatLabels[0] ?? ''}`.trim();
    await notificationService.sendToFlats(payload.flatIds, {
      type: 'ENTRY_REQUEST',
      title: `${payload.societyName ?? 'Society'} · ${flatLabel}`,
      message: payload.visitorName
        ? `${payload.visitorName}${(payload.peopleCount ?? 1) > 1 ? ` + ${(payload.peopleCount ?? 1) - 1} more` : ''} requested entry. Purpose: ${providerName}`
        : describeWaiting(payload.type, null, payload.providerTag),
      data: {
        entryRequestId: payload.entryRequestId,
        societyId: payload.societyId,
        societyName: payload.societyName,
        flatIds: payload.flatIds,
        flatLabels,
        visitorName: payload.visitorName,
        purpose: payload.purpose || payload.providerTag || payload.type,
        requestType: payload.type,
        status: 'PENDING',
      },
      referenceId: payload.entryRequestId,
      referenceType: 'EntryRequest',
      societyId: payload.societyId,
    });

    pushService.sendToFlats(payload.flatIds, {
      title: payload.societyName
        ? `New request in ${payload.societyName}`
        : 'Visitor at gate',
      body: payload.visitorName
        ? `${payload.visitorName}${(payload.peopleCount ?? 1) > 1 ? ` + ${(payload.peopleCount ?? 1) - 1} more` : ''} requested entry for ${flatLabels.join(', ')}`
        : describeWaiting(payload.type, null, payload.providerTag),
      data: {
        type: 'GATE_REQUEST',
        screen: 'EntryRequest',
        requestId: payload.entryRequestId,
        entryRequestId: payload.entryRequestId,
        societyId: payload.societyId,
        flatIds: payload.flatIds.join(','),
      },
    }).catch((err) => logger.error({ err }, 'Push failed: entry-request.created'));
  } catch (error) {
    logger.error({ error, event: 'entry-request.created', payload }, 'Failed to send entry request notification');
  }
});

eventBus.on('emergency.created', async (payload) => {
  try {
    const locationInfo = payload.location ? ` at ${payload.location}` : '';
    const descriptionInfo = payload.description ? ` - ${payload.description}` : '';
    const severity = payload.severity ?? getEmergencySeverity(payload.type);

    // ── Point 2: Severity-tiered audience ──────────────────────────────────
    // CRITICAL → all active society users
    // STANDARD → staff (ADMIN/SUPER_ADMIN/GUARD) + same-block residents only
    let targetUserIds: string[];

    if (severity === 'CRITICAL') {
      const users = await prisma.user.findMany({
        where: { societyId: payload.societyId, isActive: true, role: { in: ['RESIDENT', 'ADMIN', 'SUPER_ADMIN', 'GUARD'] } },
        select: { id: true },
      });
      targetUserIds = users.map((u) => u.id);
    } else {
      // Staff always gets it
      const staff = await prisma.user.findMany({
        where: { societyId: payload.societyId, isActive: true, role: { in: ['ADMIN', 'SUPER_ADMIN', 'GUARD'] } },
        select: { id: true },
      });
      // Same-block residents (if blockId is known), otherwise no residents
      const blockResidents = payload.blockId
        ? await prisma.user.findMany({
            where: {
              societyId: payload.societyId,
              isActive: true,
              role: 'RESIDENT',
              flat: { blockId: payload.blockId },
            },
            select: { id: true },
          })
        : [];
      const staffIds = new Set(staff.map((u) => u.id));
      targetUserIds = [
        ...staff.map((u) => u.id),
        ...blockResidents.filter((u) => !staffIds.has(u.id)).map((u) => u.id),
      ];
    }

    const title = `🚨 Emergency: ${payload.type}`;
    const message = `${payload.reporterName} reported a ${payload.type} emergency${locationInfo}${descriptionInfo}`;
    const notifPayload = {
      type: 'EMERGENCY_ALERT' as const,
      title,
      message,
      data: {
        emergencyId: payload.emergencyId,
        type: payload.type,
        severity,
        location: payload.location,
        reportedBy: payload.reporterName,
      },
      referenceId: payload.emergencyId,
      referenceType: 'Emergency',
      societyId: payload.societyId,
    };

    // ── Point 5: Batched in-app notification insert ────────────────────────
    // One DB round-trip for all users instead of N individual inserts.
    if (targetUserIds.length > 0) {
      await prisma.notification.createMany({
        data: targetUserIds.map((userId) => ({
          userId,
          societyId: payload.societyId,
          type: notifPayload.type,
          title: notifPayload.title,
          message: notifPayload.message,
          data: notifPayload.data as object,
          referenceId: notifPayload.referenceId,
          referenceType: notifPayload.referenceType,
        })),
        skipDuplicates: true,
      });
    }

    emitToSociety(payload.societyId, SOCKET_EVENTS.EMERGENCY_ALERT, {
      id: payload.emergencyId,
      type: payload.type,
      severity,
      location: payload.location,
      reportedBy: payload.reporterName,
    });

    // Store notified user IDs so all-clear reaches the exact same audience
    await prisma.emergency.update({
      where: { id: payload.emergencyId },
      data: { alertsSent: true, notifiedUsers: targetUserIds },
    });

    // FCM push — best-effort, chunked in batches of 500 by sendToUsers
    if (targetUserIds.length > 0) {
      pushService.sendToUsers(targetUserIds, {
        title,
        body: payload.description ?? 'Immediate response required',
        data: { screen: 'EmergencyDetail', emergencyId: payload.emergencyId, type: payload.type, severity },
        urgent: true, // an emergency always rings, whatever its kind
      }).catch((err) => logger.error({ err }, 'Push failed: emergency.created'));
    }
  } catch (error) {
    logger.error({ error, event: 'emergency.created', payload }, 'Failed to send emergency notification');
  }
});

eventBus.on('emergency.responded', async (payload) => {
  try {
    await notificationService.sendToUser(payload.reporterId, {
      type: 'EMERGENCY_ALERT',
      title: 'Emergency Response',
      message: `${payload.responderName} is responding to your emergency`,
      referenceId: payload.emergencyId,
      referenceType: 'Emergency',
      societyId: payload.societyId,
    });

    pushService.sendToUser(payload.reporterId, {
      title: 'Help is on the way',
      body: `${payload.responderName} is responding to your emergency`,
      data: { screen: 'EmergencyDetail', emergencyId: payload.emergencyId },
    }).catch((err) => logger.error({ err }, 'Push failed: emergency.responded'));
  } catch (error) {
    logger.error({ error, event: 'emergency.responded', payload }, 'Failed to send emergency response notification');
  }
});

eventBus.on('emergency.resolved', async (payload) => {
  try {
    // ── Point 6: All-clear guarantee ────────────────────────────────────────
    // Fan out to the exact same audience that received the original alert.
    const resolverLabel = payload.resolverName === 'System' ? 'auto-expired after 2 hours' : `resolved by ${payload.resolverName}`;
    const notifiedUsers: string[] = Array.isArray(payload.notifiedUsers) && payload.notifiedUsers.length > 0
      ? payload.notifiedUsers
      : [payload.reporterId];

    // Batched all-clear insert
    await prisma.notification.createMany({
      data: notifiedUsers.map((userId) => ({
        userId,
        societyId: payload.societyId,
        type: 'EMERGENCY_ALERT' as const,
        title: '✅ Emergency Resolved',
        message: `The emergency has been ${resolverLabel}.`,
        referenceId: payload.emergencyId,
        referenceType: 'Emergency',
      })),
      skipDuplicates: true,
    });

    emitToSociety(payload.societyId, SOCKET_EVENTS.EMERGENCY_UPDATE, {
      id: payload.emergencyId,
      status: 'RESOLVED',
      resolvedBy: payload.resolverName,
    });

    // FCM all-clear push to full notified audience
    pushService.sendToUsers(notifiedUsers, {
      title: '✅ Emergency Resolved',
      body: `The emergency has been ${resolverLabel}.`,
      data: { screen: 'EmergencyDetail', emergencyId: payload.emergencyId, status: 'RESOLVED' },
    }).catch((err) => logger.error({ err }, 'Push failed: emergency.resolved'));
  } catch (error) {
    logger.error({ error, event: 'emergency.resolved', payload }, 'Failed to send emergency resolved notification');
  }
});

eventBus.on('emergency.false-alarm', async (payload) => {
  try {
    if (payload.notifiedUsers?.length > 0) {
      await Promise.all(
        payload.notifiedUsers.map((userId: string) =>
          notificationService.sendToUser(userId, {
            type: 'EMERGENCY_ALERT',
            title: 'False Alarm — All Clear',
            message: `The ${payload.type} emergency alert was a false alarm. Everything is fine.`,
            referenceId: payload.emergencyId,
            referenceType: 'Emergency',
            societyId: payload.societyId,
          })
        )
      );
    }

    emitToSociety(payload.societyId, SOCKET_EVENTS.EMERGENCY_UPDATE, {
      id: payload.emergencyId,
      status: 'FALSE_ALARM',
    });

    if (payload.notifiedUsers?.length > 0) {
      pushService.sendToUsers(payload.notifiedUsers, {
        title: 'False Alarm — All Clear',
        body: `The ${payload.type} alert has been cancelled. No action needed.`,
        data: { screen: 'EmergencyDetail', emergencyId: payload.emergencyId, status: 'FALSE_ALARM' },
      }).catch((err) => logger.error({ err }, 'Push failed: emergency.false-alarm'));
    }
  } catch (error) {
    logger.error({ error, event: 'emergency.false-alarm', payload }, 'Failed to send false alarm notification');
  }
});

eventBus.on('staff.checked-in', async (payload) => {
  try {
    const flatIds = [...new Set([...(payload.flatIds ?? []), payload.flatId].filter((id): id is string => Boolean(id)))];
    if (flatIds.length === 0) return;
    await notificationService.sendToFlats(flatIds, {
      type: 'STAFF_CHECKIN',
      title: 'Staff Check-in',
      message: `${payload.staffName} (${payload.staffType}) has entered the society`,
      data: {
        staffId: payload.staffId,
        staffName: payload.staffName,
        staffType: payload.staffType,
        checkInTime: payload.checkInTime,
      },
      referenceId: payload.attendanceId,
      referenceType: 'StaffAttendance',
      societyId: payload.societyId,
    });

    pushService.sendToFlats(flatIds, {
      title: 'Staff arrived',
      body: `${payload.staffName} (${payload.staffType}) has entered the society`,
      data: { screen: 'StaffAttendance', attendanceId: payload.attendanceId },
    }).catch((err) => logger.error({ err }, 'Push failed: staff.checked-in'));
  } catch (error) {
    logger.error({ error, event: 'staff.checked-in', payload }, 'Failed to send staff check-in notification');
  }
});

eventBus.on('staff.checked-out', async (payload) => {
  try {
    const flatIds = [...new Set([...(payload.flatIds ?? []), payload.flatId].filter((id): id is string => Boolean(id)))];
    if (flatIds.length === 0) return;
    await notificationService.sendToFlats(flatIds, {
      type: 'STAFF_CHECKOUT',
      title: 'Staff Check-out',
      message: `${payload.staffName} (${payload.staffType}) has left the society${payload.duration ? ` after ${payload.duration} minutes` : ''}`,
      data: {
        staffId: payload.staffId,
        staffName: payload.staffName,
        staffType: payload.staffType,
        checkOutTime: payload.checkOutTime,
        duration: payload.duration,
      },
      referenceId: payload.attendanceId,
      referenceType: 'StaffAttendance',
      societyId: payload.societyId,
    });

    pushService.sendToFlats(flatIds, {
      title: 'Staff left',
      body: `${payload.staffName} has left the society${payload.duration ? ` after ${payload.duration} mins` : ''}`,
      data: { screen: 'StaffAttendance', attendanceId: payload.attendanceId },
    }).catch((err) => logger.error({ err }, 'Push failed: staff.checked-out'));
  } catch (error) {
    logger.error({ error, event: 'staff.checked-out', payload }, 'Failed to send staff check-out notification');
  }
});

eventBus.on('staff.booking-created', async (payload) => {
  try {
    await notificationService.sendToFlat(payload.flatId, {
      type: 'SYSTEM',
      title: 'Staff Booking Created',
      message: `Booking created for ${payload.staffName} (${payload.staffType}) on ${new Date(payload.bookingDate).toLocaleDateString()}`,
      data: {
        bookingId: payload.bookingId,
        staffName: payload.staffName,
        staffType: payload.staffType,
        bookingDate: payload.bookingDate,
      },
      referenceId: payload.bookingId,
      referenceType: 'StaffBooking',
      societyId: payload.societyId,
      });
      pushService.sendToStaff(payload.staffId, {
        title: 'New work request',
        body: `${payload.staffType} work requested for ${new Date(payload.bookingDate).toLocaleDateString()}`,
        data: { type: 'STAFF_BOOKING', screen: 'Bookings', bookingId: payload.bookingId },
      }).catch((err) => logger.error({ err }, 'Push failed: staff.booking-created'));
  } catch (error) {
    logger.error({ error, event: 'staff.booking-created', payload }, 'Failed to send booking notification');
  }
});

eventBus.on('staff.booking-accepted', async (payload) => {
  try {
    await notificationService.sendToUser(payload.bookedById, {
      type: 'SYSTEM',
      title: 'Booking Confirmed',
      message: `Your booking for ${payload.staffName} (${payload.staffType}) has been confirmed`,
      referenceId: payload.bookingId,
      referenceType: 'StaffBooking',
      societyId: payload.societyId,
    });

    pushService.sendToUser(payload.bookedById, {
      title: 'Booking confirmed',
      body: `${payload.staffName} confirmed your booking`,
      data: { screen: 'StaffBooking', bookingId: payload.bookingId },
    }).catch((err) => logger.error({ err }, 'Push failed: staff.booking-accepted'));
  } catch (error) {
    logger.error({ error, event: 'staff.booking-accepted', payload }, 'Failed to send booking accepted notification');
  }
});

eventBus.on('staff.booking-rejected', async (payload) => {
  try {
    await notificationService.sendToUser(payload.bookedById, {
      type: 'SYSTEM',
      title: 'Booking declined',
      message: `${payload.staffName} could not accept your booking${payload.reason ? `: ${payload.reason}` : ''}`,
      referenceId: payload.bookingId,
      referenceType: 'StaffBooking',
      societyId: payload.societyId,
    });
    pushService.sendToUser(payload.bookedById, {
      title: 'Booking declined',
      body: `${payload.staffName} could not accept your booking`,
      data: { screen: 'StaffBooking', bookingId: payload.bookingId },
    }).catch((err) => logger.error({ err }, 'Push failed: staff.booking-rejected'));
  } catch (error) {
    logger.error({ error, event: 'staff.booking-rejected', payload }, 'Failed to send booking rejected notification');
  }
});

// ============================================
// PRE-APPROVED ENTRY EVENTS
// ============================================

// ============================================
// GUEST INVITE USED — notify flat on entry
// PRIVATE invites are skipped (silent entry, no alert to family)
// ============================================

eventBus.on('guest-invite.used', async (payload) => {
  try {
    // PRIVATE = silent entry — no notification to anyone in the flat
    if (payload.isPrivate) return;

    const title = 'Guest arrived at gate';
    const body = payload.visitorPhone
      ? `${payload.visitorName} (${payload.visitorPhone}) was let in by ${payload.guardName}`
      : `${payload.visitorName} was let in by ${payload.guardName}`;
    const subtext = `Pre-approved by ${payload.residentName}`;

    await notificationService.sendToFlat(payload.flatId, {
      type: 'GUEST_ENTRY',
      title,
      message: `${body}. ${subtext}`,
      data: {
        inviteId: payload.inviteId,
        inviteType: payload.inviteType,
        visitorName: payload.visitorName,
        guardName: payload.guardName,
        allowedBy: payload.residentName,
      },
      referenceId: payload.inviteId,
      referenceType: 'GuestInvite',
      societyId: payload.societyId,
    });

    pushService.sendToFlat(payload.flatId, {
      title,
      body,
      data: {
        screen: 'GuestInvite',
        inviteId: payload.inviteId,
        allowedBy: payload.residentName,
        guardName: payload.guardName,
      },
    }).catch((err) => logger.error({ err }, 'Push failed: guest-invite.used'));
  } catch (error) {
    logger.error({ error, event: 'guest-invite.used', payload }, 'Failed to send guest entry notification');
  }
});

eventBus.on('pre-approved.created', async (payload) => {
  try {
    await notificationService.sendToFlat(payload.flatId, {
      type: 'SYSTEM',
      title: 'New pre-approved entry',
      message: `${payload.createdByName} added a ${payload.displayLabel} entry`,
      data: { preApprovedEntryId: payload.entryId },
      referenceId: payload.entryId,
      referenceType: 'PreApprovedEntry',
      societyId: payload.societyId,
    }, { excludeUserIds: [payload.createdByUserId] });
  } catch (error) {
    logger.error({ error, event: 'pre-approved.created', payload }, 'Failed to send pre-approved created notification');
  }
});

eventBus.on('pre-approved.entry-used', async (payload) => {
  try {
    if (payload.mode === 'SURPRISE') return;

    await notificationService.sendToFlat(payload.flatId, {
      type: 'ENTRY_REQUEST',
      title: `${payload.displayLabel} arrived`,
      message: `${payload.displayLabel} has entered the society`,
      data: { preApprovedEntryId: payload.entryId },
      referenceId: payload.entryId,
      referenceType: 'PreApprovedEntry',
      societyId: payload.societyId,
    });

    pushService.sendToFlat(payload.flatId, {
      title: `${payload.displayLabel} arrived`,
      body: `${payload.displayLabel} has entered the society`,
      data: { screen: 'PreApprovedEntry', entryId: payload.entryId },
    }).catch((err) => logger.error({ err }, 'Push failed: pre-approved.entry-used'));
  } catch (error) {
    logger.error({ error, event: 'pre-approved.entry-used', payload }, 'Failed to send entry-used notification');
  }
});

eventBus.on('pre-approved.cancelled-by-admin', async (payload) => {
  try {
    await notificationService.sendToUser(payload.createdByUserId, {
      type: 'SYSTEM',
      title: 'Entry cancelled by admin',
      message: `Your ${payload.displayLabel} entry was cancelled by ${payload.adminName}${payload.reason ? ': ' + payload.reason : ''}`,
      referenceId: payload.entryId,
      referenceType: 'PreApprovedEntry',
      societyId: payload.societyId,
    });

    pushService.sendToUser(payload.createdByUserId, {
      title: 'Entry cancelled',
      body: `Your ${payload.displayLabel} entry was cancelled by admin`,
      data: { screen: 'PreApprovedEntry', entryId: payload.entryId },
    }).catch((err) => logger.error({ err }, 'Push failed: pre-approved.cancelled-by-admin'));
  } catch (error) {
    logger.error({ error, event: 'pre-approved.cancelled-by-admin', payload }, 'Failed to send admin cancel notification');
  }
});

eventBus.on('pre-approved.expiring-soon', async (payload) => {
  try {
    await notificationService.sendToFlat(payload.flatId, {
      type: 'SYSTEM',
      title: 'Entry expiring soon',
      message: `Your ${payload.displayLabel} entry expires in 1 hour`,
      referenceId: payload.entryId,
      referenceType: 'PreApprovedEntry',
      societyId: payload.societyId,
    });
  } catch (error) {
    logger.error({ error, event: 'pre-approved.expiring-soon', payload }, 'Failed to send expiry notification');
  }
});

// ============================================
// ADMIN-SPECIFIC NOTIFICATION LISTENERS
// Note: Admin can also be a resident — the same Notification table is used.
//       These listeners send to ADMIN/SUPER_ADMIN users via notifyAdmins().
//       If an admin is also a resident, they'll receive both types in their feed.
// ============================================

import { adminNotificationService } from '../modules/admin/admin-notification.service';

// New onboarding request submitted — alert all admins of that society
eventBus.on('onboarding.submitted', async (payload) => {
  try {
    const location = [payload.blockName, payload.flatNumber].filter(Boolean).join('-');
    const locationPart = location ? ` for ${payload.residentType.toLowerCase()} of ${location}` : '';

    await adminNotificationService.notifyAdmins(payload.societyId, {
      type: 'ONBOARDING_STATUS',
      title: '🏠 New Onboarding Request',
      message: `A new ${payload.residentType.toLowerCase()} onboarding request${locationPart} is pending your review`,
      referenceId: payload.requestId,
      referenceType: 'OnboardingRequest',
      data: {
        type: 'ONBOARDING_STATUS',
        screen: 'AdminOnboardingRequests',
        route: '/(admin)/onboarding-requests',
        requestId: payload.requestId,
        status: 'PENDING_APPROVAL',
        residentType: payload.residentType,
        flatNumber: payload.flatNumber,
        blockName: payload.blockName,
        societyName: payload.societyName,
      },
    });

    logger.info({ societyId: payload.societyId, requestId: payload.requestId }, '🔔 [ADMIN NOTIF] Onboarding request submitted alert sent');
  } catch (error) {
    logger.error({ error, event: 'onboarding.submitted', payload }, 'Failed to send admin onboarding notification');
  }
});

// Onboarding approved — notify the resident
eventBus.on('onboarding.approved', async (payload) => {
  try {
    await notificationService.sendToUser(payload.userId, {
      type: 'ONBOARDING_STATUS',
      title: '✅ Onboarding Approved!',
      message: 'Welcome to your society! Your onboarding request has been approved. You now have full access.',
      referenceId: payload.requestId,
      referenceType: 'OnboardingRequest',
      societyId: payload.societyId,
    });

    pushService.sendToUser(payload.userId, {
      title: '✅ You\'re approved!',
      body: 'Welcome! Your onboarding request has been approved by the admin.',
      data: { screen: 'Home', type: 'ONBOARDING_APPROVED' },
    }).catch((err) => logger.error({ err }, 'Push failed: onboarding.approved'));
  } catch (error) {
    logger.error({ error, event: 'onboarding.approved', payload }, 'Failed to send onboarding approved notification');
  }
});

// Onboarding rejected — notify the resident
eventBus.on('onboarding.rejected', async (payload) => {
  try {
    await notificationService.sendToUser(payload.userId, {
      type: 'ONBOARDING_STATUS',
      title: '❌ Onboarding Request Rejected',
      message: payload.reason
        ? `Your onboarding request was rejected: ${payload.reason}`
        : 'Your onboarding request was rejected. Please contact the society admin.',
      referenceId: payload.requestId,
      referenceType: 'OnboardingRequest',
      societyId: payload.societyId,
    });

    pushService.sendToUser(payload.userId, {
      title: 'Request rejected',
      body: payload.reason || 'Your onboarding request was rejected by admin.',
      data: { screen: 'OnboardingStatus', type: 'ONBOARDING_REJECTED' },
    }).catch((err) => logger.error({ err }, 'Push failed: onboarding.rejected'));
  } catch (error) {
    logger.error({ error, event: 'onboarding.rejected', payload }, 'Failed to send onboarding rejected notification');
  }
});

// New onboarding request submitted to flat owner
eventBus.on('onboarding.submitted_to_owner', async (payload) => {
  try {
    const location = [payload.blockName, payload.flatNumber].filter(Boolean).join('-');
    const title = '🏠 Tenant Approval Request';
    const message = `${payload.tenantName} is requesting access as a tenant to Flat ${location}. Please review.`;

    await notificationService.sendToUser(payload.ownerUserId, {
      type: 'ONBOARDING_STATUS',
      title,
      message,
      referenceId: payload.requestId,
      referenceType: 'OnboardingRequest',
      societyId: payload.societyId,
    });

    pushService.sendToUser(payload.ownerUserId, {
      title,
      body: message,
      data: { screen: 'OwnerPendingRequests', requestId: payload.requestId, type: 'TENANT_APPROVAL_REQUEST' },
    }).catch((err) => logger.error({ err }, 'Push failed: onboarding.submitted_to_owner'));

    logger.info({ ownerUserId: payload.ownerUserId, requestId: payload.requestId }, '🔔 [OWNER NOTIF] Tenant onboarding request alert sent');
  } catch (error) {
    logger.error({ error, event: 'onboarding.submitted_to_owner', payload }, 'Failed to send owner onboarding notification');
  }
});

// Tenant onboarding request approved by flat owner
eventBus.on('onboarding.tenant_approved_by_owner', async (payload) => {
  try {
    const location = [payload.blockName, payload.flatNumber].filter(Boolean).join('-');
    const title = '🏠 Tenant Approved by Owner';
    const message = `New tenant ${payload.tenantName} was approved by owner ${payload.ownerName} in Flat ${location}.`;

    await adminNotificationService.notifyAdmins(payload.societyId, {
      type: 'ONBOARDING_STATUS',
      title,
      message,
      referenceId: payload.requestId,
      referenceType: 'OnboardingRequest',
      data: {
        type: 'ONBOARDING_STATUS',
        screen: 'AdminOnboardingRequests',
        requestId: payload.requestId,
        status: 'APPROVED',
        flatNumber: payload.flatNumber,
        blockName: payload.blockName,
      },
    });

    logger.info({ societyId: payload.societyId, requestId: payload.requestId }, '🔔 [ADMIN NOTIF] Tenant approved by owner alert sent');
  } catch (error) {
    logger.error({ error, event: 'onboarding.tenant_approved_by_owner', payload }, 'Failed to send admin notification for owner approval');
  }
});

// Onboarding request resubmission requested
eventBus.on('onboarding.resubmit_requested', async (payload) => {
  try {
    const title = '📝 Document Resubmission Requested';
    const message = `Your onboarding request requires action: ${payload.reason}`;

    await notificationService.sendToUser(payload.userId, {
      type: 'ONBOARDING_STATUS',
      title,
      message,
      referenceId: payload.requestId,
      referenceType: 'OnboardingRequest',
      societyId: payload.societyId,
    });

    pushService.sendToUser(payload.userId, {
      title,
      body: message,
      data: { screen: 'OnboardingStatus', type: 'ONBOARDING_RESUBMIT_REQUESTED' },
    }).catch((err) => logger.error({ err }, 'Push failed: onboarding.resubmit_requested'));
  } catch (error) {
    logger.error({ error, event: 'onboarding.resubmit_requested', payload }, 'Failed to send onboarding resubmit notification');
  }
});

// Family member added by tenant
eventBus.on('family.member_added_by_tenant', async (payload) => {
  try {
    const location = [payload.blockName, payload.flatNumber].filter(Boolean).join('-');
    const title = '👨‍👩‍👧‍👦 Family Member Added';
    const message = `Tenant ${payload.tenantName} added family member ${payload.memberName} to Flat ${location}.`;

    await notificationService.sendToUser(payload.ownerId, {
      type: 'SYSTEM',
      title,
      message,
      societyId: payload.societyId,
    });

    pushService.sendToUser(payload.ownerId, {
      title,
      body: message,
      data: { screen: 'Home' },
    }).catch((err) => logger.error({ err }, 'Push failed: family.member_added_by_tenant'));
  } catch (error) {
    logger.error({ error, event: 'family.member_added_by_tenant', payload }, 'Failed to send owner notification for family addition');
  }
});

// New complaint submitted — notify all admins
eventBus.on('complaint.created', async (payload) => {
  try {
    const location = [payload.blockName, payload.flatNumber].filter(Boolean).join('-');
    const locationPart = location ? ` from ${location}` : '';
    const priorityEmoji = payload.priority === 'URGENT' ? '🚨' : payload.priority === 'HIGH' ? '⚠️' : '📋';

    await adminNotificationService.notifyAdmins(payload.societyId, {
      type: 'SYSTEM',
      title: `${priorityEmoji} New ${payload.category} Complaint`,
      message: `"${payload.title}"${locationPart} — ${payload.priority} priority`,
      referenceId: payload.complaintId,
      referenceType: 'Complaint',
      data: {
        complaintId: payload.complaintId,
        category: payload.category,
        priority: payload.priority,
        isAnonymous: payload.isAnonymous,
      },
    });

    logger.info({ societyId: payload.societyId, complaintId: payload.complaintId }, '🔔 [ADMIN NOTIF] New complaint alert sent to admins');
  } catch (error) {
    logger.error({ error, event: 'complaint.created', payload }, 'Failed to send admin complaint notification');
  }
});

logger.info('Notification event listeners registered');
