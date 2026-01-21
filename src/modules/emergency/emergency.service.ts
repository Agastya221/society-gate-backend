import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';

export class EmergencyService {
  async createEmergency(data: any, reportedById: string) {
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

    // TODO: Send alerts to all admins, guards, and emergency contacts
    // This should trigger push notifications, SMS, etc.

    return emergency;
  }

  async getEmergencies(filters: any) {
    const { societyId, status, type, page = 1, limit = 20 } = filters;

    const where: any = { societyId };
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
