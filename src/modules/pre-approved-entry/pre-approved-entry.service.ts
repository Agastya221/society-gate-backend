import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import { accessControlEngine, AccessControlEngine } from '../access-control/access-control.engine';
import { accessControlCache } from '../access-control/access-control.cache';
import { redis, safeRedisOperation } from '../../config/redis';
import { verifyQRToken } from '../../utils/QrGenerate';
import { eventBus } from '../../utils/eventBus';
import logger from '../../utils/logger';
import type {
  CreatePreApprovedEntryDTO,
  UpdatePreApprovedEntryDTO,
  PreApprovedEntryFilters,
  ValidatePreApprovedDTO,
  PreApprovedValidationResult,
  PreApprovedEntryWithRelations,
  GuardPreApprovedFilters,
  AdminPreApprovedFilters,
} from '../../types';

const MAX_ACTIVE_PER_FLAT = 20;

const ENTRY_INCLUDE = {
  schedule: true,
  meta: true,
  verification: true,
  flat: { select: { id: true, flatNumber: true } },
  user: { select: { id: true, name: true } },
} as const;

const ENTRY_WITH_USAGES = {
  ...ENTRY_INCLUDE,
  usages: {
    orderBy: { usedAt: 'desc' as const },
    take: 5,
    include: { guard: { select: { name: true } } },
  },
} as const;

export class PreApprovedEntryService {
  // ============================================
  // RESIDENT METHODS
  // ============================================

  async create(userId: string, dto: CreatePreApprovedEntryDTO) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { flatId: true, societyId: true, name: true },
    });
    if (!user?.flatId || !user?.societyId) {
      throw new AppError('User must be assigned to a flat and society', 400);
    }

    // Entry count limit
    const activeCount = await prisma.preApprovedEntry.count({
      where: { flatId: user.flatId, status: 'ACTIVE' },
    });
    if (activeCount >= MAX_ACTIVE_PER_FLAT) {
      throw new AppError(`Maximum active entries (${MAX_ACTIVE_PER_FLAT}) reached for this flat`, 400);
    }

    // Duplicate check
    if (!dto.skipDuplicateCheck) {
      const duplicate = await this.findDuplicate(user.flatId, dto);
      if (duplicate) {
        return {
          warning: 'DUPLICATE_EXISTS',
          message: 'A similar active entry already exists for this flat',
          existingEntryId: duplicate.id,
          hint: 'Set skipDuplicateCheck=true to create anyway',
        };
      }
    }

    // Determine verification type
    const verificationType = (dto.mode === 'SAFE' && dto.type === 'CAB')
      ? 'VEHICLE_LAST4' as const
      : 'NONE' as const;

    const entry = await prisma.$transaction(async (tx) => {
      const created = await tx.preApprovedEntry.create({
        data: {
          type: dto.type,
          mode: dto.mode ?? 'NORMAL',
          scheduleType: dto.scheduleType ?? 'ONCE',
          visitorName: dto.visitorName,
          visitorPhone: dto.visitorPhone,
          userId,
          flatId: user.flatId!,
          societyId: user.societyId!,
          schedule: {
            create: {
              // ONCE fields
              date: dto.date ? new Date(dto.date) : null,
              startTime: dto.startTime ?? null,
              endTime: dto.endTime ?? null,
              // RECURRING fields
              validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
              validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
              daysOfWeek: dto.daysOfWeek ?? [],
              timeFrom: dto.timeFrom ?? null,
              timeTo: dto.timeTo ?? null,
              entriesPerDay: dto.entriesPerDay ?? 1,
              graceBeforeMinutes: dto.graceBeforeMinutes ?? 15,
              graceAfterMinutes: dto.graceAfterMinutes ?? 30,
            },
          },
          meta: {
            create: {
              vehicleLast4Digits: dto.vehicleLast4Digits ?? null,
              companyName: dto.companyName ?? null,
              isSurprise: dto.isSurprise ?? false,
              category: dto.category ?? null,
              customCategory: dto.customCategory ?? null,
            },
          },
          verification: {
            create: {
              verificationType,
              verificationValue: verificationType === 'VEHICLE_LAST4' ? dto.vehicleLast4Digits : null,
            },
          },
        },
        include: ENTRY_INCLUDE,
      });

      return created;
    });

    // Invalidate cache
    await accessControlCache.invalidate(
      user.societyId!,
      user.flatId!,
      dto.vehicleLast4Digits,
    );

    // Notify other flat members
    eventBus.emit('pre-approved.created', {
      entryId: entry.id,
      flatId: user.flatId!,
      societyId: user.societyId!,
      type: entry.type,
      mode: entry.mode,
      displayLabel: accessControlEngine.getDisplayLabel(entry as PreApprovedEntryWithRelations),
      createdByUserId: userId,
      createdByName: user.name,
    });

    return entry;
  }

  async list(userId: string, filters: PreApprovedEntryFilters) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { flatId: true },
    });
    if (!user?.flatId) throw new AppError('User must be assigned to a flat', 400);

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const where = {
      flatId: user.flatId,
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    };

    const [entries, total] = await Promise.all([
      prisma.preApprovedEntry.findMany({
        where,
        include: ENTRY_WITH_USAGES,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.preApprovedEntry.count({ where }),
    ]);

    return {
      entries,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string, userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { flatId: true },
    });
    if (!user?.flatId) throw new AppError('User must be assigned to a flat', 400);

    const entry = await prisma.preApprovedEntry.findUnique({
      where: { id },
      include: ENTRY_WITH_USAGES,
    });
    if (!entry) throw new AppError('Pre-approved entry not found', 404);
    if (entry.flatId !== user.flatId) throw new AppError('Access denied', 403);

    return entry;
  }

  async update(id: string, userId: string, dto: UpdatePreApprovedEntryDTO) {
    const entry = await this.getById(id, userId);
    if (entry.status !== 'ACTIVE') {
      throw new AppError('Only active entries can be updated', 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Update main entry fields
      if (dto.visitorName !== undefined || dto.visitorPhone !== undefined) {
        await tx.preApprovedEntry.update({
          where: { id },
          data: {
            ...(dto.visitorName !== undefined ? { visitorName: dto.visitorName } : {}),
            ...(dto.visitorPhone !== undefined ? { visitorPhone: dto.visitorPhone } : {}),
          },
        });
      }

      // Update schedule fields
      const scheduleUpdate: Record<string, unknown> = {};
      if (dto.startTime !== undefined) scheduleUpdate.startTime = dto.startTime;
      if (dto.endTime !== undefined) scheduleUpdate.endTime = dto.endTime;
      if (dto.timeFrom !== undefined) scheduleUpdate.timeFrom = dto.timeFrom;
      if (dto.timeTo !== undefined) scheduleUpdate.timeTo = dto.timeTo;
      if (dto.daysOfWeek !== undefined) scheduleUpdate.daysOfWeek = dto.daysOfWeek;
      if (dto.entriesPerDay !== undefined) scheduleUpdate.entriesPerDay = dto.entriesPerDay;
      if (dto.graceBeforeMinutes !== undefined) scheduleUpdate.graceBeforeMinutes = dto.graceBeforeMinutes;
      if (dto.graceAfterMinutes !== undefined) scheduleUpdate.graceAfterMinutes = dto.graceAfterMinutes;

      if (Object.keys(scheduleUpdate).length > 0) {
        await tx.preApprovedSchedule.update({
          where: { entryId: id },
          data: scheduleUpdate,
        });
      }

      // Update vehicle digits if applicable
      if (dto.vehicleLast4Digits !== undefined && entry.mode === 'SAFE') {
        await tx.preApprovedMeta.update({
          where: { entryId: id },
          data: { vehicleLast4Digits: dto.vehicleLast4Digits },
        });
        await tx.preApprovedVerification.update({
          where: { entryId: id },
          data: { verificationValue: dto.vehicleLast4Digits },
        });
      }

      return tx.preApprovedEntry.findUnique({
        where: { id },
        include: ENTRY_INCLUDE,
      });
    });

    await accessControlCache.invalidate(
      entry.societyId,
      entry.flatId,
      entry.meta?.vehicleLast4Digits ?? dto.vehicleLast4Digits,
    );

    return updated;
  }

  async cancel(id: string, userId: string) {
    const entry = await this.getById(id, userId);
    if (entry.status === 'CANCELLED') return entry;
    if (entry.status !== 'ACTIVE') {
      throw new AppError('Only active entries can be cancelled', 400);
    }

    const cancelled = await prisma.preApprovedEntry.update({
      where: { id },
      data: { status: 'CANCELLED', isLocked: false, lockedAt: null, lockedByGuardId: null },
      include: ENTRY_INCLUDE,
    });

    await accessControlCache.invalidate(
      entry.societyId,
      entry.flatId,
      entry.meta?.vehicleLast4Digits,
    );

    return cancelled;
  }

  async delete(id: string, userId: string) {
    const entry = await this.getById(id, userId);
    if (entry.status === 'ACTIVE') {
      throw new AppError('Cannot delete active entries. Cancel first.', 400);
    }

    await prisma.preApprovedEntry.delete({ where: { id } });
    return { message: 'Entry deleted' };
  }

  async repeat(id: string, userId: string) {
    const entry = await this.getById(id, userId);
    return {
      type: entry.type,
      mode: entry.mode,
      scheduleType: entry.scheduleType,
      visitorName: entry.visitorName,
      visitorPhone: entry.visitorPhone,
      vehicleLast4Digits: entry.meta?.vehicleLast4Digits,
      companyName: entry.meta?.companyName,
      isSurprise: entry.meta?.isSurprise,
      category: entry.meta?.category,
      customCategory: entry.meta?.customCategory,
      // Schedule structure (dates cleared)
      daysOfWeek: entry.schedule?.daysOfWeek,
      timeFrom: entry.schedule?.timeFrom,
      timeTo: entry.schedule?.timeTo,
      startTime: entry.schedule?.startTime,
      endTime: entry.schedule?.endTime,
      entriesPerDay: entry.schedule?.entriesPerDay,
      graceBeforeMinutes: entry.schedule?.graceBeforeMinutes,
      graceAfterMinutes: entry.schedule?.graceAfterMinutes,
    };
  }

  async getUsageHistory(entryId: string, userId: string, page = 1, limit = 20) {
    const entry = await this.getById(entryId, userId);

    const [usages, total] = await Promise.all([
      prisma.preApprovedUsage.findMany({
        where: { entryId },
        orderBy: { usedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { guard: { select: { name: true } } },
      }),
      prisma.preApprovedUsage.count({ where: { entryId } }),
    ]);

    return {
      usages: usages.map((u) => ({
        id: u.id,
        usedAt: u.usedAt,
        guardName: u.guard.name,
        gatePointId: u.gatePointId,
        notes: u.notes,
      })),
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  // ============================================
  // GUARD METHODS
  // ============================================

  async validate(dto: ValidatePreApprovedDTO, guardId: string): Promise<PreApprovedValidationResult> {
    const guard = await prisma.user.findUnique({
      where: { id: guardId },
      select: { societyId: true },
    });
    if (!guard?.societyId) throw new AppError('Guard not assigned to society', 400);

    // Rate limit
    await this.checkRateLimit(guardId);

    const context = AccessControlEngine.buildContext(guardId, guard.societyId);

    // Vehicle last 4 digits lookup (CAB SAFE)
    if (dto.vehicleLast4) {
      return this.validateByVehicleDigits(dto.vehicleLast4, context);
    }

    // Flat + type lookup (non-SAFE)
    if (dto.flatId && dto.type) {
      return this.validateByFlat(dto.flatId, dto.type, context);
    }

    // QR token lookup
    if (dto.qrToken) {
      return this.validateByQR(dto.qrToken, context);
    }

    return {
      allowed: false,
      isPrivate: false,
      reason: 'INVALID_INPUT',
      message: 'Provide vehicleLast4, flatId+type, or qrToken',
    };
  }

  private async validateByVehicleDigits(
    last4: string,
    context: import('../../types').AccessControlContext,
  ): Promise<PreApprovedValidationResult> {
    // Query matching entries
    const entries = await prisma.preApprovedEntry.findMany({
      where: {
        societyId: context.societyId,
        status: 'ACTIVE',
        type: 'CAB',
        mode: 'SAFE',
        meta: { vehicleLast4Digits: last4 },
      },
      include: ENTRY_INCLUDE,
    });

    if (entries.length === 0) {
      return {
        allowed: false,
        isPrivate: false,
        reason: 'NO_MATCH',
        message: 'No matching pre-approved cab entry found',
        suggestion: 'CREATE_ENTRY_REQUEST',
      };
    }

    // Evaluate each match
    const validMatches: PreApprovedValidationResult[] = [];
    for (const entry of entries) {
      const result = await accessControlEngine.evaluatePreApproved(
        entry as PreApprovedEntryWithRelations,
        context,
      );
      if (result.allowed) {
        validMatches.push(result);
      }
    }

    if (validMatches.length === 0) {
      return {
        allowed: false,
        isPrivate: false,
        reason: 'NO_VALID_MATCH',
        message: 'Matching entries found but none are valid at this time',
        suggestion: 'CREATE_ENTRY_REQUEST',
      };
    }

    if (validMatches.length === 1) {
      // Lock the single match
      await this.lockEntry(entries.find(e => e.id === validMatches[0].entryId)!.id, context.guardId);
      return validMatches[0];
    }

    // Multiple matches — guard must pick
    return {
      allowed: true,
      isPrivate: true,
      message: 'Multiple matching entries found. Please select one.',
      matches: validMatches,
    };
  }

  private async validateByFlat(
    flatId: string,
    type: string,
    context: import('../../types').AccessControlContext,
  ): Promise<PreApprovedValidationResult> {
    const entries = await prisma.preApprovedEntry.findMany({
      where: {
        societyId: context.societyId,
        flatId,
        status: 'ACTIVE',
        type: type as any,
      },
      include: ENTRY_INCLUDE,
    });

    if (entries.length === 0) {
      return {
        allowed: false,
        isPrivate: false,
        reason: 'NO_MATCH',
        message: `No active ${type} entries for this flat`,
        suggestion: 'CREATE_ENTRY_REQUEST',
      };
    }

    const validMatches: PreApprovedValidationResult[] = [];
    for (const entry of entries) {
      const result = await accessControlEngine.evaluatePreApproved(
        entry as PreApprovedEntryWithRelations,
        context,
      );
      if (result.allowed) {
        validMatches.push(result);
      }
    }

    if (validMatches.length === 0) {
      return {
        allowed: false,
        isPrivate: false,
        reason: 'NO_VALID_MATCH',
        message: 'Entries found but none are valid at this time',
        suggestion: 'CREATE_ENTRY_REQUEST',
      };
    }

    if (validMatches.length === 1) {
      await this.lockEntry(entries.find(e => e.id === validMatches[0].entryId)!.id, context.guardId);
      return validMatches[0];
    }

    return {
      allowed: true,
      isPrivate: false,
      message: 'Multiple matching entries. Please select one.',
      matches: validMatches,
    };
  }

  private async validateByQR(
    qrToken: string,
    context: import('../../types').AccessControlContext,
  ): Promise<PreApprovedValidationResult> {
    let payload: Record<string, unknown>;
    try {
      const decoded = verifyQRToken(qrToken);
      payload = typeof decoded === 'string' ? {} : (decoded as Record<string, unknown>);
    } catch {
      return { allowed: false, isPrivate: false, reason: 'INVALID_QR', message: 'Invalid or expired QR code' };
    }

    if (payload.type !== 'pre_approved' || !payload.entryId) {
      return { allowed: false, isPrivate: false, reason: 'WRONG_QR_TYPE', message: 'QR code is not for a pre-approved entry' };
    }

    const entry = await prisma.preApprovedEntry.findUnique({
      where: { id: payload.entryId as string },
      include: ENTRY_INCLUDE,
    });

    if (!entry || entry.societyId !== context.societyId) {
      return { allowed: false, isPrivate: false, reason: 'NOT_FOUND', message: 'Pre-approved entry not found' };
    }

    const result = await accessControlEngine.evaluatePreApproved(
      entry as PreApprovedEntryWithRelations,
      context,
    );

    if (result.allowed) {
      await this.lockEntry(entry.id, context.guardId);
    }

    return result;
  }

  async markUsed(entryId: string, guardId: string, gatePointId?: string, notes?: string) {
    const guard = await prisma.user.findUnique({
      where: { id: guardId },
      select: { societyId: true },
    });
    if (!guard?.societyId) throw new AppError('Guard not assigned to society', 400);

    const context = AccessControlEngine.buildContext(guardId, guard.societyId);

    const result = await prisma.$transaction(async (tx) => {
      const entry = await tx.preApprovedEntry.findUnique({
        where: { id: entryId },
        include: ENTRY_INCLUDE,
      });

      if (!entry) throw new AppError('Entry not found', 404);
      if (entry.status !== 'ACTIVE') throw new AppError(`Entry is ${entry.status.toLowerCase()}`, 400);

      // Verify lock ownership (skip if not locked — allows direct use without validate)
      if (entry.isLocked && entry.lockedByGuardId !== guardId) {
        throw new AppError('Entry is locked by another guard', 409);
      }

      // Re-validate schedule
      if (entry.schedule) {
        const scheduleCheck = accessControlEngine.checkSchedule(
          entry.schedule,
          entry.scheduleType,
          context,
        );
        if (!scheduleCheck.valid) {
          throw new AppError(scheduleCheck.message || 'Entry not valid at this time', 400);
        }

        // Check daily limit for recurring
        if (entry.scheduleType === 'RECURRING' && entry.schedule.entriesPerDay) {
          const usageCheck = await accessControlEngine.checkUsageLimit(
            entry.id,
            entry.schedule.entriesPerDay,
            context.istNow,
          );
          if (!usageCheck.valid) {
            throw new AppError(usageCheck.message || 'Daily limit reached', 400);
          }
        }
      }

      // Create usage record
      const usage = await tx.preApprovedUsage.create({
        data: { entryId, guardId, gatePointId: gatePointId ?? null, notes: notes ?? null },
      });

      // For ONCE: mark as USED
      const statusUpdate = entry.scheduleType === 'ONCE' ? { status: 'USED' as const } : {};

      // Unlock entry
      await tx.preApprovedEntry.update({
        where: { id: entryId },
        data: {
          ...statusUpdate,
          isLocked: false,
          lockedAt: null,
          lockedByGuardId: null,
        },
      });

      // Create Entry record for unified history
      await tx.entry.create({
        data: {
          type: entry.type === 'CAB' ? 'CAB' : entry.type === 'DELIVERY' ? 'DELIVERY' : 'VENDOR',
          status: 'CHECKED_IN',
          visitorName: entry.visitorName || accessControlEngine.getDisplayLabel(entry as PreApprovedEntryWithRelations),
          visitorPhone: entry.visitorPhone,
          visitorType: entry.type === 'CAB' ? 'CAB_DRIVER' : entry.type === 'DELIVERY' ? 'DELIVERY_PERSON' : 'SERVICE_PROVIDER',
          companyName: entry.meta?.companyName,
          wasAutoApproved: true,
          autoApprovalReason: 'Pre-approved entry',
          flatId: entry.flatId,
          societyId: entry.societyId,
          gatePointId: gatePointId ?? null,
          createdById: guardId,
          approvedById: entry.userId,
          approvedAt: new Date(),
          preApprovedEntryId: entry.id,
        },
      });

      return { usage, entry };
    });

    // Invalidate cache
    await accessControlCache.invalidate(
      result.entry.societyId,
      result.entry.flatId,
      result.entry.meta?.vehicleLast4Digits,
    );

    // Emit notification event (skip SURPRISE)
    if (result.entry.mode !== 'SURPRISE') {
      eventBus.emit('pre-approved.entry-used', {
        entryId: result.entry.id,
        flatId: result.entry.flatId,
        societyId: result.entry.societyId,
        type: result.entry.type,
        mode: result.entry.mode,
        displayLabel: accessControlEngine.getDisplayLabel(result.entry as PreApprovedEntryWithRelations),
        visitorName: result.entry.visitorName ?? undefined,
        companyName: result.entry.meta?.companyName ?? undefined,
        category: result.entry.meta?.category ?? undefined,
        guardId,
      });
    }

    return result.usage;
  }

  async listForGuard(societyId: string, filters: GuardPreApprovedFilters) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 30;

    const where = {
      societyId,
      status: 'ACTIVE' as const,
      ...(filters.type ? { type: filters.type } : {}),
    };

    const [entries, total] = await Promise.all([
      prisma.preApprovedEntry.findMany({
        where,
        include: {
          schedule: true,
          meta: true,
          flat: { select: { id: true, flatNumber: true } },
          user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.preApprovedEntry.count({ where }),
    ]);

    // Apply privacy: SAFE mode entries don't expose flat/resident info
    const safeEntries = entries.map((entry) => {
      if (entry.mode === 'SAFE') {
        return {
          id: entry.id,
          type: entry.type,
          mode: entry.mode,
          scheduleType: entry.scheduleType,
          status: entry.status,
          displayLabel: 'Cab Pickup',
          isPrivate: true,
          schedule: entry.schedule,
          visitorName: null,
          createdAt: entry.createdAt,
        };
      }
      return {
        id: entry.id,
        type: entry.type,
        mode: entry.mode,
        scheduleType: entry.scheduleType,
        status: entry.status,
        displayLabel: accessControlEngine.getDisplayLabel(entry as PreApprovedEntryWithRelations),
        isPrivate: false,
        flatNumber: entry.flat.flatNumber,
        residentName: entry.user.name,
        visitorName: entry.visitorName,
        schedule: entry.schedule,
        meta: entry.meta,
        createdAt: entry.createdAt,
      };
    });

    return {
      entries: safeEntries,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async searchForGuard(societyId: string, query: string) {
    const entries = await prisma.preApprovedEntry.findMany({
      where: {
        societyId,
        status: 'ACTIVE',
        OR: [
          { visitorName: { contains: query, mode: 'insensitive' } },
          { visitorPhone: { contains: query } },
          { meta: { vehicleLast4Digits: { contains: query } } },
        ],
      },
      include: {
        schedule: true,
        meta: true,
        flat: { select: { id: true, flatNumber: true } },
        user: { select: { id: true, name: true } },
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    return entries.map((entry) => {
      if (entry.mode === 'SAFE') {
        return {
          id: entry.id,
          type: entry.type,
          mode: entry.mode,
          displayLabel: 'Cab Pickup',
          isPrivate: true,
          schedule: entry.schedule,
          createdAt: entry.createdAt,
        };
      }
      return {
        id: entry.id,
        type: entry.type,
        mode: entry.mode,
        displayLabel: accessControlEngine.getDisplayLabel(entry as PreApprovedEntryWithRelations),
        isPrivate: false,
        flatNumber: entry.flat.flatNumber,
        residentName: entry.user.name,
        visitorName: entry.visitorName,
        schedule: entry.schedule,
        meta: entry.meta,
        createdAt: entry.createdAt,
      };
    });
  }

  // ============================================
  // ADMIN METHODS
  // ============================================

  async listForAdmin(societyId: string, filters: AdminPreApprovedFilters) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 30;

    const where: Record<string, unknown> = { societyId };
    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;
    if (filters.flatId) where.flatId = filters.flatId;
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {
        ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
      };
    }

    const [entries, total] = await Promise.all([
      prisma.preApprovedEntry.findMany({
        where,
        include: {
          ...ENTRY_INCLUDE,
          _count: { select: { usages: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.preApprovedEntry.count({ where }),
    ]);

    return {
      entries,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async adminCancel(entryId: string, adminId: string, reason?: string) {
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { societyId: true, name: true },
    });
    if (!admin?.societyId) throw new AppError('Admin not assigned to society', 400);

    const entry = await prisma.preApprovedEntry.findUnique({
      where: { id: entryId },
      include: ENTRY_INCLUDE,
    });
    if (!entry) throw new AppError('Entry not found', 404);
    if (entry.societyId !== admin.societyId) throw new AppError('Access denied', 403);
    if (entry.status !== 'ACTIVE') throw new AppError('Only active entries can be cancelled', 400);

    const cancelled = await prisma.preApprovedEntry.update({
      where: { id: entryId },
      data: { status: 'CANCELLED', isLocked: false, lockedAt: null, lockedByGuardId: null },
      include: ENTRY_INCLUDE,
    });

    await accessControlCache.invalidate(
      entry.societyId,
      entry.flatId,
      entry.meta?.vehicleLast4Digits,
    );

    eventBus.emit('pre-approved.cancelled-by-admin', {
      entryId: entry.id,
      flatId: entry.flatId,
      societyId: entry.societyId,
      displayLabel: accessControlEngine.getDisplayLabel(entry as PreApprovedEntryWithRelations),
      adminName: admin.name,
      reason,
      createdByUserId: entry.userId,
    });

    return cancelled;
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private async findDuplicate(flatId: string, dto: CreatePreApprovedEntryDTO) {
    return prisma.preApprovedEntry.findFirst({
      where: {
        flatId,
        type: dto.type,
        mode: dto.mode ?? 'NORMAL',
        status: 'ACTIVE',
      },
      select: { id: true },
    });
  }

  private async lockEntry(entryId: string, guardId: string) {
    try {
      await prisma.preApprovedEntry.update({
        where: { id: entryId, isLocked: false },
        data: { isLocked: true, lockedAt: new Date(), lockedByGuardId: guardId },
      });
    } catch {
      // Entry already locked — non-fatal for validation response
      logger.debug({ entryId, guardId }, 'Could not acquire lock (already locked)');
    }
  }

  private async checkRateLimit(guardId: string) {
    const count = await safeRedisOperation(async () => {
      const key = `ratelimit:guard:preapproved:${guardId}`;
      const current = await redis.incr(key);
      if (current === 1) await redis.expire(key, 60);
      return current;
    }, 0);

    if (count > 30) {
      throw new AppError('Too many validation attempts. Try again in a minute.', 429);
    }
  }
}

export const preApprovedEntryService = new PreApprovedEntryService();
