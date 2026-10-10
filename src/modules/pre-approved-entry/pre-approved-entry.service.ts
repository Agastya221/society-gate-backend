import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import { clampPagination } from '../../utils/scope';
import { accessControlEngine, AccessControlEngine, formatIst } from '../access-control/access-control.engine';
import type { Prisma, PreApprovedEntryType } from '../../../prisma/generated/prisma/client';
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
  AccessControlContext,
  PreApprovedDenialReason,
} from '../../types';

const MAX_ACTIVE_PER_FLAT = 20;

const ENTRY_INCLUDE = {
  schedule: true,
  meta: true,
  verification: true,
  flat: { select: { id: true, flatNumber: true, block: { select: { id: true, name: true } } } },
  user: { select: { id: true, name: true } },
} as const;

// Lists for guard/admin: flat with its block so the UI can show "A-101" and filter by flat
const LIST_INCLUDE = {
  schedule: true,
  meta: true,
  flat: { select: { id: true, flatNumber: true, block: { select: { id: true, name: true } } } },
  user: { select: { id: true, name: true } },
} as const;

// Normalised denial reasons, most actionable first (used to pick the top-level message)
const REASON_PRIORITY = [
  'NOT_STARTED',
  'OUTSIDE_HOURS',
  'DAILY_LIMIT_REACHED',
  'WRONG_DAY',
  'USED',
  'EXPIRED',
  'CANCELLED',
  'INVALID_SCHEDULE',
];

// Recently finished passes (USED/EXPIRED/CANCELLED) are reported when nothing is ACTIVE
const RECENT_INACTIVE_MS = 24 * 60 * 60 * 1000;

/** Pagination block (existing fields + additive hasMore / nextPage). */
const paginationOf = (total: number, page: number, limit: number) => {
  const pages = Math.ceil(total / limit);
  return { total, page, limit, pages, hasMore: page < pages, nextPage: page < pages ? page + 1 : null };
};

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
      select: { flatId: true, societyId: true, name: true, role: true },
    });
    if (!user?.societyId) {
      throw new AppError('User must be assigned to a society', 400);
    }
    const isSocietyAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
    if (!isSocietyAdmin && !user.flatId) throw new AppError('Resident must be assigned to a flat', 400);

    // Entry count limit
    const activeCount = await prisma.preApprovedEntry.count({
      where: isSocietyAdmin
        ? { societyId: user.societyId, flatId: null, status: 'ACTIVE' }
        : { flatId: user.flatId!, status: 'ACTIVE' },
    });
    if (activeCount >= MAX_ACTIVE_PER_FLAT) {
      throw new AppError(`Maximum active entries (${MAX_ACTIVE_PER_FLAT}) reached for this flat`, 400);
    }

    // Duplicate check
    if (!isSocietyAdmin && !dto.skipDuplicateCheck) {
      const duplicate = await this.findDuplicate(user.flatId!, dto);
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
          flatId: isSocietyAdmin ? null : user.flatId!,
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
    if (user.flatId) {
      await accessControlCache.invalidate(user.societyId, user.flatId, dto.vehicleLast4Digits);
    }

    // Notify other flat members
    if (user.flatId) {
      eventBus.emit('pre-approved.created', {
        entryId: entry.id,
        flatId: user.flatId,
        societyId: user.societyId,
        type: entry.type,
        mode: entry.mode,
        displayLabel: accessControlEngine.getDisplayLabel(entry as PreApprovedEntryWithRelations),
        createdByUserId: userId,
        createdByName: user.name,
      });
    }

    return entry;
  }

  async list(userId: string, filters: PreApprovedEntryFilters) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { flatId: true },
    });
    if (!user?.flatId) throw new AppError('User must be assigned to a flat', 400);

    const { page, limit, skip } = clampPagination(filters.page, filters.limit, 20);

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
        skip,
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

    // Ownership in the query itself: only passes for the caller's own flat
    const entry = await prisma.preApprovedEntry.findFirst({
      where: { id, flatId: user.flatId },
      include: ENTRY_WITH_USAGES,
    });
    if (!entry) throw new AppError('Pre-approved entry not found', 404);

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
      entry.flatId ?? '',
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
      entry.flatId ?? '',
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

  async getUsageHistory(entryId: string, userId: string, rawPage?: number, rawLimit?: number) {
    await this.getById(entryId, userId);
    const { page, limit, skip } = clampPagination(rawPage, rawLimit, 20);

    const [usages, total] = await Promise.all([
      prisma.preApprovedUsage.findMany({
        where: { entryId },
        orderBy: { usedAt: 'desc' },
        skip,
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
    context: AccessControlContext,
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
      const recent = await this.findRecentInactive({
        societyId: context.societyId,
        type: 'CAB',
        mode: 'SAFE',
        meta: { vehicleLast4Digits: last4 },
      }, context);
      return this.buildDenial(
        recent,
        'NO_MATCH',
        'No matching pre-approved cab entry found',
      );
    }

    // Evaluate each match
    const { valid: validMatches, denied } = await this.evaluateAll(entries, context);

    if (validMatches.length === 0) {
      return this.buildDenial(
        denied,
        'NO_VALID_MATCH',
        'Matching entries found but none are valid at this time',
      );
    }

    if (validMatches.length === 1) {
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
    context: AccessControlContext,
  ): Promise<PreApprovedValidationResult> {
    const entries = await prisma.preApprovedEntry.findMany({
      where: {
        societyId: context.societyId,
        flatId,
        status: 'ACTIVE',
        type: type as PreApprovedEntryType,
      },
      include: ENTRY_INCLUDE,
    });

    if (entries.length === 0) {
      // Nothing active — say why if the flat had a pass that was just used/expired/cancelled
      const recent = await this.findRecentInactive({
        societyId: context.societyId,
        flatId,
        type: type as PreApprovedEntryType,
      }, context);
      return this.buildDenial(
        recent,
        'NO_MATCH',
        `No active ${type} entries for this flat`,
      );
    }

    const { valid: validMatches, denied } = await this.evaluateAll(entries, context);

    if (validMatches.length === 0) {
      return this.buildDenial(
        denied,
        'NO_VALID_MATCH',
        'Entries found but none are valid at this time',
      );
    }

    if (validMatches.length === 1) {
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
    context: AccessControlContext,
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

    // Read-only: no lock is taken (double use is prevented in markUsed)
    return accessControlEngine.evaluatePreApproved(
      entry as PreApprovedEntryWithRelations,
      context,
    );
  }

  /** Evaluate candidates, splitting usable matches from denials (kept with their entry). */
  private async evaluateAll(
    entries: Array<PreApprovedEntryWithRelations | (Record<string, unknown> & { id: string })>,
    context: AccessControlContext,
  ) {
    const valid: PreApprovedValidationResult[] = [];
    const denied: Array<{ entry: PreApprovedEntryWithRelations; result: PreApprovedValidationResult }> = [];
    for (const raw of entries) {
      const entry = raw as PreApprovedEntryWithRelations;
      const result = await accessControlEngine.evaluatePreApproved(entry, context);
      if (result.allowed) valid.push(result);
      else denied.push({ entry, result });
    }
    return { valid, denied };
  }

  /** USED / EXPIRED / CANCELLED passes touched in the last 24h matching `where`. */
  private async findRecentInactive(
    where: Prisma.PreApprovedEntryWhereInput,
    context: AccessControlContext,
  ) {
    const entries = await prisma.preApprovedEntry.findMany({
      where: {
        ...where,
        status: { in: ['USED', 'EXPIRED', 'CANCELLED'] },
        updatedAt: { gte: new Date(context.now.getTime() - RECENT_INACTIVE_MS) },
      },
      include: {
        ...ENTRY_INCLUDE,
        usages: { orderBy: { usedAt: 'desc' as const }, take: 1, select: { usedAt: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });
    return Promise.all(entries.map(async (entry) => {
      const result = await accessControlEngine.evaluatePreApproved(
        entry as unknown as PreApprovedEntryWithRelations,
        context,
      );
      const usedAt = entry.usages[0]?.usedAt ?? null;
      if (entry.status === 'USED' && usedAt) {
        result.message = `Already used at ${formatIst(usedAt)}`;
      }
      return { entry: entry as unknown as PreApprovedEntryWithRelations, result, usedAt };
    }));
  }

  /**
   * Denial for a flat / vehicle lookup. Keeps the legacy `reason`/`message`/`suggestion`
   * and adds `reasons` (one per candidate) + `primaryReason`; when candidates exist the
   * top-level `message` explains the most relevant one instead of a generic sentence.
   */
  private buildDenial(
    denied: Array<{ entry: PreApprovedEntryWithRelations; result: PreApprovedValidationResult; usedAt?: Date | null }>,
    reason: 'NO_MATCH' | 'NO_VALID_MATCH',
    fallbackMessage: string,
  ): PreApprovedValidationResult {
    const reasons: PreApprovedDenialReason[] = denied.map(({ entry, result, usedAt }) => ({
      entryId: entry.id,
      reason: result.reasonCode ?? result.reason ?? 'UNKNOWN',
      legacyReason: result.reason,
      message: result.message ?? 'Not valid at this time',
      displayLabel: accessControlEngine.getDisplayLabel(entry),
      status: entry.status,
      usedAt: usedAt ?? null,
      window: result.window ?? null,
    }));

    const rank = (r: PreApprovedDenialReason) => {
      const i = REASON_PRIORITY.indexOf(r.reason);
      return i === -1 ? REASON_PRIORITY.length : i;
    };
    const nextStartOf = (r: PreApprovedDenialReason) => {
      const v = r.window?.nextStart ?? r.window?.startsAt;
      return typeof v === 'string' ? Date.parse(v) : Number.POSITIVE_INFINITY;
    };
    const primary = [...reasons].sort((a, b) => rank(a) - rank(b) || nextStartOf(a) - nextStartOf(b))[0];

    let message = fallbackMessage;
    if (primary) {
      const detail = `${primary.displayLabel ? `${primary.displayLabel}: ` : ''}${primary.message}`;
      message = reason === 'NO_MATCH'
        ? `${fallbackMessage}. ${detail}`
        : reasons.length === 1
          ? detail
          : `${reasons.length} passes found, none valid now. ${detail}`;
    }

    return {
      allowed: false,
      isPrivate: false,
      reason,
      message,
      suggestion: 'CREATE_ENTRY_REQUEST',
      ...(primary ? { primaryReason: primary.reason, reasons } : { reasons: [] }),
    };
  }

  async markUsed(entryId: string, guardId: string, gatePointId?: string, notes?: string) {
    const guard = await prisma.user.findUnique({
      where: { id: guardId },
      select: { societyId: true },
    });
    if (!guard?.societyId) throw new AppError('Guard not assigned to society', 400);

    const context = AccessControlEngine.buildContext(guardId, guard.societyId);

    const result = await prisma.$transaction(async (tx) => {
      const entry = await tx.preApprovedEntry.findFirst({
        where: { id: entryId, societyId: guard.societyId! },
        include: ENTRY_INCLUDE,
      });

      if (!entry) throw new AppError('Entry not found', 404);
      if (entry.status === 'USED') throw new AppError('This pass has already been used', 409);
      if (entry.status !== 'ACTIVE') throw new AppError(`Entry is ${entry.status.toLowerCase()}`, 400);

      // Re-validate schedule
      let occurrences: { start: Date; end: Date }[] | undefined;
      if (entry.schedule) {
        const scheduleCheck = accessControlEngine.checkSchedule(
          entry.schedule,
          entry.scheduleType,
          context,
        );
        if (!scheduleCheck.valid) {
          throw new AppError(scheduleCheck.message || 'Entry not valid at this time', 400);
        }
        occurrences = scheduleCheck.occurrences;
      }

      // Atomic claim instead of a guard lock. The conditional UPDATE takes a row lock that
      // is held until commit, so a concurrent /use on the same pass waits here and then
      // sees the committed result:
      //  - ONCE: status ACTIVE → USED; the loser matches 0 rows → 409.
      //  - RECURRING: status stays ACTIVE, but the row lock serialises the usage count
      //    below, so two guards can't both slip under entriesPerDay.
      const isOnce = entry.scheduleType === 'ONCE';
      const claimed = await tx.preApprovedEntry.updateMany({
        where: { id: entryId, societyId: entry.societyId, status: 'ACTIVE' },
        data: {
          ...(isOnce ? { status: 'USED' as const } : {}),
          // Clear any legacy lock left by older builds
          isLocked: false,
          lockedAt: null,
          lockedByGuardId: null,
        },
      });
      if (claimed.count === 0) {
        throw new AppError('This pass was just used or changed by another guard', 409);
      }

      // Check limit for recurring (counted inside the current window occurrence)
      if (entry.scheduleType === 'RECURRING' && entry.schedule?.entriesPerDay) {
        const usageCheck = await accessControlEngine.checkUsageLimit(
          entry.id,
          entry.schedule.entriesPerDay,
          context.istNow,
          occurrences,
          tx,
        );
        if (!usageCheck.valid) {
          throw new AppError(usageCheck.message || 'Daily limit reached', 400);
        }
      }

      // Create usage record
      const usage = await tx.preApprovedUsage.create({
        data: { entryId, guardId, gatePointId: gatePointId ?? null, notes: notes ?? null },
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
      result.entry.flatId ?? '',
      result.entry.meta?.vehicleLast4Digits,
    );

    // Emit notification event (skip SURPRISE)
    if (result.entry.mode !== 'SURPRISE') {
      eventBus.emit('pre-approved.entry-used', {
        entryId: result.entry.id,
        flatId: result.entry.flatId ?? '',
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
    if (!societyId) throw new AppError('Society context required', 403);
    const { page, limit, skip } = clampPagination(filters.page, filters.limit, 30);
    const byFlat = !!(filters.flatId || filters.blockId);

    const where: Prisma.PreApprovedEntryWhereInput = {
      societyId,
      status: 'ACTIVE',
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.flatId ? { flatId: filters.flatId } : {}),
      ...(filters.blockId ? { flat: { blockId: filters.blockId } } : {}),
      // A flat/block filter must not reveal which flat a SAFE (private) cab belongs to
      ...(byFlat ? { mode: { not: 'SAFE' } } : {}),
    };

    const [entries, total] = await Promise.all([
      prisma.preApprovedEntry.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
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
        displayLabel: accessControlEngine.getDisplayLabel(entry as unknown as PreApprovedEntryWithRelations),
        isPrivate: false,
        flatId: entry.flatId,
        flatNumber: entry.flat?.flatNumber ?? '',
        flat: entry.flat, // { id, flatNumber, block: { id, name } | null }
        residentName: entry.user.name,
        visitorName: entry.visitorName,
        schedule: entry.schedule,
        meta: entry.meta,
        createdAt: entry.createdAt,
      };
    });

    return {
      entries: safeEntries,
      pagination: paginationOf(total, page, limit),
    };
  }

  async searchForGuard(societyId: string, query: string) {
    if (!societyId) throw new AppError('Society context required', 403);
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
      include: LIST_INCLUDE,
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
        displayLabel: accessControlEngine.getDisplayLabel(entry as unknown as PreApprovedEntryWithRelations),
        isPrivate: false,
        flatId: entry.flatId,
        flatNumber: entry.flat?.flatNumber ?? '',
        flat: entry.flat,
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
    if (!societyId) throw new AppError('Society context required', 403);
    const { page, limit, skip } = clampPagination(filters.page, filters.limit, 30);

    const where: Prisma.PreApprovedEntryWhereInput = { societyId };
    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;
    if (filters.flatId) where.flatId = filters.flatId;
    if (filters.blockId) where.flat = { blockId: filters.blockId };
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
          ...ENTRY_INCLUDE, // flat now carries block { id, name }
          _count: { select: { usages: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.preApprovedEntry.count({ where }),
    ]);

    return {
      entries,
      pagination: paginationOf(total, page, limit),
    };
  }

  async adminCancel(entryId: string, adminId: string, reason?: string) {
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { societyId: true, name: true },
    });
    if (!admin?.societyId) throw new AppError('Admin not assigned to society', 400);

    const entry = await prisma.preApprovedEntry.findFirst({
      where: { id: entryId, societyId: admin.societyId },
      include: ENTRY_INCLUDE,
    });
    if (!entry) throw new AppError('Entry not found', 404);
    if (entry.status !== 'ACTIVE') throw new AppError('Only active entries can be cancelled', 400);

    const cancelled = await prisma.preApprovedEntry.update({
      where: { id: entryId },
      data: { status: 'CANCELLED', isLocked: false, lockedAt: null, lockedByGuardId: null },
      include: ENTRY_INCLUDE,
    });

    await accessControlCache.invalidate(
      entry.societyId,
      entry.flatId ?? '',
      entry.meta?.vehicleLast4Digits,
    );

    eventBus.emit('pre-approved.cancelled-by-admin', {
      entryId: entry.id,
      flatId: entry.flatId ?? '',
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
