import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import { eventBus } from '../../utils/eventBus';
import type {
  CreateEmergencyDTO,
  EmergencyFilters,
  Prisma,
} from '../../types';

// ─── Severity Tiers ────────────────────────────────────────────────────────
// CRITICAL → broadcast to ALL users in the society (residents + staff)
// STANDARD → staff (ADMIN/GUARD) + reporter's block residents only
const CRITICAL_TYPES = ['FIRE', 'MEDICAL', 'SECURITY', 'VIOLENCE'] as const;
export type EmergencySeverity = 'CRITICAL' | 'STANDARD';

export function getEmergencySeverity(type: string): EmergencySeverity {
  return (CRITICAL_TYPES as readonly string[]).includes(type) ? 'CRITICAL' : 'STANDARD';
}

export class EmergencyService {
  async createEmergency(data: CreateEmergencyDTO, reportedById: string) {
    // ── Point 1: Rate limiting ──────────────────────────────────────────────
    // Residents may not create a second emergency if they already have one
    // ACTIVE in the last 5 minutes (admins/guards are exempt).
    const reporter = await prisma.user.findUnique({
      where: { id: reportedById },
      select: { flatId: true, role: true },
    });

    if (reporter?.role === 'RESIDENT') {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recentActive = await prisma.emergency.findFirst({
        where: {
          reportedById,
          status: 'ACTIVE',
          createdAt: { gte: fiveMinutesAgo },
        },
        select: { id: true },
      });
      if (recentActive) {
        throw new AppError(
          'You already have an active emergency. Please resolve it or wait 5 minutes before reporting another.',
          429
        );
      }
    }

    // Auto-attach reporter's flat if frontend didn't send one
    if (!data.flatId && reporter?.flatId) {
      data.flatId = reporter.flatId;
    }

    const emergency = await prisma.emergency.create({
      data: {
        ...data,
        reportedById,
        status: 'ACTIVE',
      },
      include: {
        reportedBy: { select: { id: true, name: true, phone: true } },
        flat: { include: { block: { select: { id: true, name: true } } } },
        society: { select: { id: true, name: true } },
      },
    });

    const severity = getEmergencySeverity(emergency.type);

    // ARCH-3: Emit event — listener handles notifications, socket broadcast, alert tracking
    eventBus.emit('emergency.created', {
      emergencyId: emergency.id,
      societyId: data.societyId,
      type: emergency.type,
      severity,
      blockId: emergency.flat?.block?.id ?? null,
      location: emergency.location ?? undefined,
      description: emergency.description ?? undefined,
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

  async getEmergencyById(emergencyId: string, societyId: string) {
    const emergency = await prisma.emergency.findFirst({
      where: { id: emergencyId, societyId },
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

    // ARCH-3: Emit event — listener handles notification and socket broadcast
    eventBus.emit('emergency.responded', {
      emergencyId,
      reporterId: emergency.reportedById,
      responderName: updatedEmergency.respondedBy?.name || 'A responder',
      societyId: emergency.societyId,
    });

    return updatedEmergency;
  }

  // ── Point 4: Idempotent atomic resolve ──────────────────────────────────
  // Uses updateMany with status guard so concurrent requests cannot both
  // succeed — only one transitions ACTIVE → RESOLVED. The second gets 409.
  async resolveEmergency(emergencyId: string, notes: string, respondedById: string) {
    const existing = await prisma.emergency.findUnique({
      where: { id: emergencyId },
      select: { id: true, status: true, reportedById: true, societyId: true, respondedById: true, notifiedUsers: true },
    });

    if (!existing) {
      throw new AppError('Emergency not found', 404);
    }

    const result = await prisma.emergency.updateMany({
      where: { id: emergencyId, status: 'ACTIVE' },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        notes,
        respondedById: respondedById || existing.respondedById,
      },
    });

    if (result.count === 0) {
      throw new AppError('Emergency is already resolved or closed', 409);
    }

    const updatedEmergency = await prisma.emergency.findUnique({
      where: { id: emergencyId },
      include: {
        reportedBy: { select: { id: true, name: true, phone: true } },
        respondedBy: { select: { id: true, name: true, phone: true } },
      },
    });

    // ARCH-3: Emit event — listener handles notification and socket broadcast
    eventBus.emit('emergency.resolved', {
      emergencyId,
      reporterId: existing.reportedById,
      resolverName: updatedEmergency?.respondedBy?.name || 'Staff',
      societyId: existing.societyId,
      notifiedUsers: existing.notifiedUsers as string[],
    });

    return updatedEmergency;
  }

  // ── Point 4: Idempotent atomic false alarm ──────────────────────────────
  async markAsFalseAlarm(emergencyId: string, notes: string, userId: string) {
    const emergency = await prisma.emergency.findUnique({
      where: { id: emergencyId },
      select: { id: true, status: true, reportedById: true, societyId: true, type: true, notifiedUsers: true },
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

    const result = await prisma.emergency.updateMany({
      where: { id: emergencyId, status: 'ACTIVE' },
      data: {
        status: 'FALSE_ALARM',
        resolvedAt: new Date(),
        notes,
      },
    });

    if (result.count === 0) {
      throw new AppError('Emergency is already resolved or closed', 409);
    }

    eventBus.emit('emergency.false-alarm', {
      emergencyId,
      societyId: emergency.societyId,
      type: emergency.type,
      notifiedUsers: emergency.notifiedUsers as string[],
      cancelledByReporter: isReporter,
    });

    return prisma.emergency.findUnique({ where: { id: emergencyId } });
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

  // ── Point 3: Auto-expiry ────────────────────────────────────────────────
  // Called by a scheduled job every 15 minutes.
  // Any emergency ACTIVE for > 2 hours is auto-resolved.
  async expireStaleEmergencies() {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const stale = await prisma.emergency.findMany({
      where: { status: 'ACTIVE', createdAt: { lt: twoHoursAgo } },
      select: { id: true, societyId: true, type: true, notifiedUsers: true, reportedById: true },
    });

    if (stale.length === 0) return { expired: 0 };

    await prisma.emergency.updateMany({
      where: { id: { in: stale.map((e) => e.id) }, status: 'ACTIVE' },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        notes: 'Auto-expired after 2 hours of inactivity',
      },
    });

    // Fire resolution events so all-clear sockets/pushes are sent
    for (const e of stale) {
      eventBus.emit('emergency.resolved', {
        emergencyId: e.id,
        reporterId: e.reportedById,
        resolverName: 'System',
        societyId: e.societyId,
        notifiedUsers: e.notifiedUsers as string[],
      });
    }

    return { expired: stale.length };
  }
}
