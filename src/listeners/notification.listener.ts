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
    const title = 'Entry approved';
    const flatLabels = payload.flats.map((flat) => flat.flatNumber);
    const body = `${payload.approvedByName} allowed ${payload.visitorName} (${payload.visitorType.toLowerCase()}) to enter`;

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
      },
    }, { excludeUserIds: [payload.approvedById] }).catch((err) => logger.error({ err }, 'Push failed: entry-request.approved (residents)'));

    // Notify the guard that entry was approved
    pushService.sendToUser(payload.guardId, {
      title: 'Entry approved',
      body: `${payload.approvedByName} approved ${payload.visitorName}. Let them in.`,
      data: { type: 'GATE_APPROVED', requestId: payload.entryRequestId, entryRequestId: payload.entryRequestId },
    }).catch((err) => logger.error({ err }, 'Push failed: entry-request.approved (guard)'));
  } catch (error) {
    logger.error({ error, event: 'entry-request.approved', payload }, 'Failed to send approval notification');
  }
});

eventBus.on('entry-request.rejected', async (payload) => {
  try {
    const title = 'Entry rejected';
    const flatLabels = payload.flats.map((flat) => flat.flatNumber);
    const body = payload.reason
      ? `${payload.rejectedByName} rejected ${payload.visitorName} — "${payload.reason}"`
      : `${payload.rejectedByName} rejected ${payload.visitorName} (${payload.visitorType.toLowerCase()})`;

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

eventBus.on('entry-request.created', async (payload) => {
  try {
    const providerName = payload.providerTag || payload.type;
    const flatLabels = payload.flats.map((flat) => flat.flatNumber);
    const flatLabel = flatLabels.length > 1
      ? `${flatLabels.length} Flats`
      : `Flat ${flatLabels[0] ?? ''}`.trim();
    await notificationService.sendToFlats(payload.flatIds, {
      type: 'ENTRY_REQUEST',
      title: `${payload.societyName ?? 'Society'} · ${flatLabel}`,
      message: payload.visitorName
        ? `${payload.visitorName} requested entry. Purpose: ${providerName}`
        : `${providerName} is waiting at the gate`,
      data: {
        entryRequestId: payload.entryRequestId,
        societyId: payload.societyId,
        societyName: payload.societyName,
        flatIds: payload.flatIds,
        flatLabels,
        visitorName: payload.visitorName,
        purpose: providerName,
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
        ? `${payload.visitorName} requested entry for ${flatLabels.join(', ')}`
        : `${payload.type} is waiting at the gate`,
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
    await notificationService.sendToFlat(payload.flatId, {
      type: 'STAFF_CHECKIN',
      title: 'Staff Check-in',
      message: `${payload.staffName} (${payload.staffType}) has checked in`,
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

    pushService.sendToFlat(payload.flatId, {
      title: 'Staff arrived',
      body: `${payload.staffName} (${payload.staffType}) has checked in`,
      data: { screen: 'StaffAttendance', attendanceId: payload.attendanceId },
    }).catch((err) => logger.error({ err }, 'Push failed: staff.checked-in'));
  } catch (error) {
    logger.error({ error, event: 'staff.checked-in', payload }, 'Failed to send staff check-in notification');
  }
});

eventBus.on('staff.checked-out', async (payload) => {
  try {
    await notificationService.sendToFlat(payload.flatId, {
      type: 'STAFF_CHECKOUT',
      title: 'Staff Check-out',
      message: `${payload.staffName} (${payload.staffType}) has checked out${payload.duration ? ` after ${payload.duration} minutes` : ''}`,
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

    pushService.sendToFlat(payload.flatId, {
      title: 'Staff left',
      body: `${payload.staffName} has checked out${payload.duration ? ` after ${payload.duration} mins` : ''}`,
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
        requestId: payload.requestId,
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
