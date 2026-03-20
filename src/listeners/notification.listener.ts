import { eventBus } from '../utils/eventBus';
import { notificationService } from '../modules/notification/notification.service';
import { pushService } from '../services/push.service';
import { emitToSociety, SOCKET_EVENTS } from '../utils/socket';
import { prisma } from '../utils/Client';
import logger from '../utils/logger';

// ARCH-3: Notification listeners decoupled from business logic.
// Each handler listens for a domain event and sends the appropriate notifications.

eventBus.on('entry-request.created', async (payload) => {
  try {
    const providerName = payload.providerTag || payload.type;
    await notificationService.sendToFlat(payload.flatId, {
      type: 'ENTRY_REQUEST',
      title: `${providerName} at Gate`,
      message: payload.visitorName
        ? `${payload.visitorName} (${providerName}) is waiting at the gate`
        : `${providerName} delivery is waiting at the gate`,
      data: { entryRequestId: payload.entryRequestId },
      referenceId: payload.entryRequestId,
      referenceType: 'EntryRequest',
      societyId: payload.societyId,
    });

    pushService.sendToFlat(payload.flatId, {
      title: 'Visitor at gate',
      body: payload.visitorName
        ? `${payload.visitorName} is waiting`
        : `${payload.type} is waiting at the gate`,
      data: { screen: 'EntryRequest', entryRequestId: payload.entryRequestId },
    }).catch((err) => logger.error({ err }, 'Push failed: entry-request.created'));
  } catch (error) {
    logger.error({ error, event: 'entry-request.created', payload }, 'Failed to send entry request notification');
  }
});

eventBus.on('emergency.created', async (payload) => {
  try {
    const locationInfo = payload.location ? ` at ${payload.location}` : '';
    const descriptionInfo = payload.description ? ` - ${payload.description}` : '';

    const staffNotifications = await notificationService.sendToSocietyStaff(
      payload.societyId,
      ['ADMIN', 'GUARD'],
      {
        type: 'EMERGENCY_ALERT',
        title: `Emergency: ${payload.type}`,
        message: `${payload.reporterName} reported a ${payload.type} emergency${locationInfo}${descriptionInfo}`,
        data: {
          emergencyId: payload.emergencyId,
          type: payload.type,
          location: payload.location,
          reportedBy: payload.reporterName,
        },
        referenceId: payload.emergencyId,
        referenceType: 'Emergency',
        societyId: payload.societyId,
      }
    );

    emitToSociety(payload.societyId, SOCKET_EVENTS.EMERGENCY_ALERT, {
      id: payload.emergencyId,
      type: payload.type,
      location: payload.location,
      reportedBy: payload.reporterName,
    });

    const notifiedUserIds = staffNotifications.map((n) => n.userId);
    await prisma.emergency.update({
      where: { id: payload.emergencyId },
      data: {
        alertsSent: true,
        notifiedUsers: notifiedUserIds,
      },
    });

    const ALERT_ALL = ['FIRE', 'LIFT_STUCK'];
    const emergencyRoles = ALERT_ALL.includes(payload.type)
      ? ['ADMIN', 'GUARD', 'RESIDENT'] as ('ADMIN' | 'GUARD' | 'RESIDENT')[]
      : ['ADMIN', 'GUARD'] as ('ADMIN' | 'GUARD')[];

    pushService.sendToSocietyStaff(payload.societyId, emergencyRoles, {
      title: `Emergency: ${payload.type}`,
      body: payload.description ?? 'Immediate response required',
      data: { screen: 'EmergencyDetail', emergencyId: payload.emergencyId, type: payload.type },
    }).catch((err) => logger.error({ err }, 'Push failed: emergency.created'));
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
    await notificationService.sendToUser(payload.reporterId, {
      type: 'EMERGENCY_ALERT',
      title: 'Emergency Resolved',
      message: `Your emergency has been resolved by ${payload.resolverName}`,
      referenceId: payload.emergencyId,
      referenceType: 'Emergency',
      societyId: payload.societyId,
    });

    emitToSociety(payload.societyId, SOCKET_EVENTS.EMERGENCY_UPDATE, {
      id: payload.emergencyId,
      status: 'RESOLVED',
    });

    pushService.sendToUser(payload.reporterId, {
      title: 'Emergency resolved',
      body: `Your emergency has been resolved by ${payload.resolverName}`,
      data: { screen: 'EmergencyDetail', emergencyId: payload.emergencyId },
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

logger.info('Notification event listeners registered');
