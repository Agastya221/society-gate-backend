import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import { notificationService } from '../notification/notification.service';
import { emitToSociety, SOCKET_EVENTS } from '../../utils/socket';
import type {
  CreateEmergencyDTO,
  EmergencyFilters,
  Prisma,
} from '../../types';

export class EmergencyService {
  async createEmergency(data: CreateEmergencyDTO, reportedById: string) {
    const emergency = await prisma.emergency.create({
      data: {
        ...data,
        reportedById,
        status: 'ACTIVE',
      },
      include: {
        reportedBy: { select: { id: true, name: true, phone: true } },
        flat: true,
        society: { select: { id: true, name: true } },
      },
    });

    // Send alerts to all admins and guards in the society
    const reporterName = emergency.reportedBy?.name || 'A resident';
    const locationInfo = emergency.location ? ` at ${emergency.location}` : '';
    const descriptionInfo = emergency.description ? ` - ${emergency.description}` : '';

    const staffNotifications = await notificationService.sendToSocietyStaff(
      data.societyId,
      ['ADMIN', 'GUARD'],
      {
        type: 'EMERGENCY_ALERT',
        title: `Emergency: ${emergency.type}`,
        message: `${reporterName} reported a ${emergency.type} emergency${locationInfo}${descriptionInfo}`,
        data: {
          emergencyId: emergency.id,
          type: emergency.type,
          location: emergency.location,
          reportedBy: reporterName,
        },
        referenceId: emergency.id,
        referenceType: 'Emergency',
        societyId: data.societyId,
      }
    );

    // Broadcast to all connected society members via Socket.IO
    emitToSociety(data.societyId, SOCKET_EVENTS.EMERGENCY_ALERT, emergency);

    // Track that alerts were sent
    const notifiedUserIds = staffNotifications.map((n) => n.userId);
    await prisma.emergency.update({
      where: { id: emergency.id },
      data: {
        alertsSent: true,
        notifiedUsers: notifiedUserIds,
      },
    });

    return emergency;
  }

  async getEmergencies(filters: EmergencyFilters) {
    const { societyId, status, type, page = 1, limit = 20 } = filters;

    const where: Prisma.EmergencyWhereInput = { societyId };
    if (status) where.status = status;
    if (type) where.type = type;

    const [emergencies, total] = await Promise.all([
      prisma.emergency.findMany({
        where,
        include: {
          reportedBy: { select: { id: true, name: true, phone: true } },
          flat: true,
          respondedBy: { select: { id: true, name: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.emergency.count({ where }),
    ]);

    return {
      emergencies,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getMyEmergencies(userId: string) {
    const emergencies = await prisma.emergency.findMany({
      where: {
        reportedById: userId,
      },
      include: {
        flat: true,
        respondedBy: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return { emergencies };
  }

  async getEmergencyById(emergencyId: string) {
    const emergency = await prisma.emergency.findUnique({
      where: { id: emergencyId },
      include: {
        reportedBy: { select: { id: true, name: true, phone: true } },
        flat: true,
        respondedBy: { select: { id: true, name: true, phone: true } },
      },
    });

    if (!emergency) {
      throw new AppError('Emergency not found', 404);
    }

    return emergency;
  }

  async respondToEmergency(emergencyId: string, respondedById: string) {
    const emergency = await prisma.emergency.findUnique({
      where: { id: emergencyId },
    });

    if (!emergency) {
      throw new AppError('Emergency not found', 404);
    }

    if (emergency.status !== 'ACTIVE') {
      throw new AppError('Emergency is not active', 400);
    }

    const updatedEmergency = await prisma.emergency.update({
      where: { id: emergencyId },
      data: {
        respondedById,
        respondedAt: new Date(),
      },
      include: {
        reportedBy: { select: { id: true, name: true, phone: true } },
        respondedBy: { select: { id: true, name: true, phone: true } },
      },
    });

    // Notify the reporter that someone is responding
    const responderName = updatedEmergency.respondedBy?.name || 'A responder';
    await notificationService.sendToUser(emergency.reportedById, {
      type: 'EMERGENCY_ALERT',
      title: 'Emergency Response',
      message: `${responderName} is responding to your ${emergency.type} emergency`,
      data: { emergencyId, respondedBy: responderName },
      referenceId: emergencyId,
      referenceType: 'Emergency',
      societyId: emergency.societyId,
    });

    // Broadcast update to the society
    emitToSociety(emergency.societyId, SOCKET_EVENTS.EMERGENCY_UPDATE, updatedEmergency);

    return updatedEmergency;
  }

  async resolveEmergency(emergencyId: string, notes: string, respondedById: string) {
    const emergency = await prisma.emergency.findUnique({
      where: { id: emergencyId },
    });

    if (!emergency) {
      throw new AppError('Emergency not found', 404);
    }

    const updatedEmergency = await prisma.emergency.update({
      where: { id: emergencyId },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        notes,
        respondedById: respondedById || emergency.respondedById,
      },
      include: {
        reportedBy: { select: { id: true, name: true, phone: true } },
        respondedBy: { select: { id: true, name: true, phone: true } },
      },
    });

    // Notify the reporter that the emergency has been resolved
    await notificationService.sendToUser(emergency.reportedById, {
      type: 'EMERGENCY_ALERT',
      title: 'Emergency Resolved',
      message: `Your ${emergency.type} emergency has been resolved`,
      data: { emergencyId, notes },
      referenceId: emergencyId,
      referenceType: 'Emergency',
      societyId: emergency.societyId,
    });

    // Broadcast update to the society
    emitToSociety(emergency.societyId, SOCKET_EVENTS.EMERGENCY_UPDATE, updatedEmergency);

    return updatedEmergency;
  }

  async markAsFalseAlarm(emergencyId: string, notes: string) {
    const emergency = await prisma.emergency.findUnique({
      where: { id: emergencyId },
    });

    if (!emergency) {
      throw new AppError('Emergency not found', 404);
    }

    const updatedEmergency = await prisma.emergency.update({
      where: { id: emergencyId },
      data: {
        status: 'FALSE_ALARM',
        resolvedAt: new Date(),
        notes,
      },
    });

    return updatedEmergency;
  }

  async getActiveEmergencies(societyId: string) {
    const emergencies = await prisma.emergency.findMany({
      where: {
        societyId,
        status: 'ACTIVE',
      },
      include: {
        reportedBy: { select: { id: true, name: true, phone: true } },
        flat: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return emergencies;
  }
}
