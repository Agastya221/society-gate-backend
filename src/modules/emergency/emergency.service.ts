import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import { eventBus } from '../../utils/eventBus';
import type {
  CreateEmergencyDTO,
  EmergencyFilters,
  Prisma,
} from '../../types';

export class EmergencyService {
  async createEmergency(data: CreateEmergencyDTO, reportedById: string) {
    // auto-attach reporter's flat if frontend didn't send one
    if (!data.flatId) {
      const reporter = await prisma.user.findUnique({
        where: { id: reportedById },
        select: { flatId: true },
      });
      if (reporter?.flatId) {
        data.flatId = reporter.flatId;
      }
    }

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

    // ARCH-3: Emit event - listener handles notifications, socket broadcast, and alert tracking
    eventBus.emit('emergency.created', {
      emergencyId: emergency.id,
      societyId: data.societyId,
      type: emergency.type,
      location: emergency.location || undefined,
      description: emergency.description || undefined,
      reporterName: emergency.reportedBy?.name || 'A resident',
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

    // ARCH-3: Emit event - listener handles notification and socket broadcast
    eventBus.emit('emergency.responded', {
      emergencyId,
      reporterId: emergency.reportedById,
      responderName: updatedEmergency.respondedBy?.name || 'A responder',
      societyId: emergency.societyId,
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

    // ARCH-3: Emit event - listener handles notification and socket broadcast
    eventBus.emit('emergency.resolved', {
      emergencyId,
      reporterId: emergency.reportedById,
      resolverName: updatedEmergency.respondedBy?.name || 'Staff',
      societyId: emergency.societyId,
    });

    return updatedEmergency;
  }

  async markAsFalseAlarm(emergencyId: string, notes: string, userId: string) {
    const emergency = await prisma.emergency.findUnique({
      where: { id: emergencyId },
    });

    if (!emergency) {
      throw new AppError('Emergency not found', 404);
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    const isReporter = emergency.reportedById === userId;
    const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

    if (!isReporter && !isAdmin) {
      throw new AppError('Only the reporter or an admin can mark this as false alarm', 403);
    }

    const updatedEmergency = await prisma.emergency.update({
      where: { id: emergencyId },
      data: {
        status: 'FALSE_ALARM',
        resolvedAt: new Date(),
        notes,
      },
    });

    eventBus.emit('emergency.false-alarm', {
      emergencyId,
      societyId: emergency.societyId,
      type: emergency.type,
      notifiedUsers: emergency.notifiedUsers,
      cancelledByReporter: isReporter,
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
