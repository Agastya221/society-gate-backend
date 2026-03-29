import { prisma } from '../../utils/Client';
import type {
  AccessControlContext,
  ScheduleCheckResult,
  PreApprovedValidationResult,
  PreApprovedEntryWithRelations,
} from '../../types';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export class AccessControlEngine {
  /**
   * Build IST-aware context for all validation checks.
   */
  static buildContext(guardId: string, societyId: string): AccessControlContext {
    const now = new Date();
    const istNow = new Date(now.getTime() + IST_OFFSET_MS);
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const currentDay = dayNames[istNow.getUTCDay()];
    const currentTime = istNow.toISOString().slice(11, 16); // "HH:MM"

    return { now, istNow, currentDay, currentTime, guardId, societyId };
  }

  /**
   * Evaluate a pre-approved entry against current context.
   * Returns explicit safe/normal response objects — never strips fields.
   */
  async evaluatePreApproved(
    entry: PreApprovedEntryWithRelations,
    context: AccessControlContext,
  ): Promise<PreApprovedValidationResult> {
    // 1. Check status
    if (entry.status !== 'ACTIVE') {
      return {
        allowed: false,
        isPrivate: false,
        reason: entry.status,
        message: `This entry is ${entry.status.toLowerCase()}`,
      };
    }

    // 2. Check if locked by another guard
    if (entry.isLocked && entry.lockedByGuardId !== context.guardId) {
      return {
        allowed: false,
        isPrivate: false,
        reason: 'ENTRY_LOCKED',
        message: 'Another guard is processing this entry',
      };
    }

    // 3. Check schedule validity
    if (entry.schedule) {
      const scheduleResult = this.checkSchedule(
        entry.schedule,
        entry.scheduleType,
        context,
      );
      if (!scheduleResult.valid) {
        return {
          allowed: false,
          isPrivate: false,
          reason: scheduleResult.reason,
          message: scheduleResult.message,
        };
      }

      // 4. Check daily usage limit for recurring
      if (entry.scheduleType === 'RECURRING' && entry.schedule.entriesPerDay) {
        const usageResult = await this.checkUsageLimit(
          entry.id,
          entry.schedule.entriesPerDay,
          context.istNow,
        );
        if (!usageResult.valid) {
          return {
            allowed: false,
            isPrivate: false,
            reason: usageResult.reason,
            message: usageResult.message,
          };
        }
      }
    }

    // 5. Build response based on mode
    if (entry.mode === 'SAFE') {
      return this.buildSafeResponse(entry);
    }
    return this.buildNormalResponse(entry);
  }

  /**
   * Check schedule validity with configurable grace periods.
   */
  checkSchedule(
    schedule: PreApprovedEntryWithRelations['schedule'] & object,
    scheduleType: string,
    context: AccessControlContext,
  ): ScheduleCheckResult {
    if (scheduleType === 'ONCE') {
      return this.checkOnceSchedule(schedule, context);
    }
    return this.checkRecurringSchedule(schedule, context);
  }

  private checkOnceSchedule(
    schedule: PreApprovedEntryWithRelations['schedule'] & object,
    context: AccessControlContext,
  ): ScheduleCheckResult {
    if (!schedule.date || !schedule.startTime || !schedule.endTime) {
      return { valid: false, reason: 'INVALID_SCHEDULE', message: 'Incomplete schedule data' };
    }

    // Check date matches today (IST)
    const entryDate = new Date(schedule.date);
    const istDate = new Date(context.istNow.getTime());
    const entryDateStr = entryDate.toISOString().slice(0, 10);
    const todayStr = istDate.toISOString().slice(0, 10);

    if (entryDateStr !== todayStr) {
      return { valid: false, reason: 'WRONG_DATE', message: `This entry is for ${entryDateStr}, not today` };
    }

    // Check time window with grace periods
    const graceBefore = schedule.graceBeforeMinutes ?? 15;
    const graceAfter = schedule.graceAfterMinutes ?? 30;
    const windowStart = this.subtractMinutes(schedule.startTime, graceBefore);
    const windowEnd = this.addMinutes(schedule.endTime, graceAfter);

    if (context.currentTime < windowStart) {
      return { valid: false, reason: 'TOO_EARLY', message: `Entry is valid from ${schedule.startTime}` };
    }
    if (context.currentTime > windowEnd) {
      return { valid: false, reason: 'TOO_LATE', message: `Entry expired at ${schedule.endTime}` };
    }

    return { valid: true };
  }

  private checkRecurringSchedule(
    schedule: PreApprovedEntryWithRelations['schedule'] & object,
    context: AccessControlContext,
  ): ScheduleCheckResult {
    // Check validity period
    if (schedule.validFrom && context.now < new Date(schedule.validFrom)) {
      return { valid: false, reason: 'NOT_YET_VALID', message: 'This recurring entry has not started yet' };
    }
    if (schedule.validUntil && context.now > new Date(schedule.validUntil)) {
      return { valid: false, reason: 'EXPIRED', message: 'This recurring entry has expired' };
    }

    // Check day of week
    if (schedule.daysOfWeek.length > 0 && !schedule.daysOfWeek.includes(context.currentDay)) {
      return {
        valid: false,
        reason: 'WRONG_DAY',
        message: `This entry is not allowed on ${context.currentDay}`,
      };
    }

    // Check time window with grace
    if (schedule.timeFrom && schedule.timeTo) {
      const graceBefore = schedule.graceBeforeMinutes ?? 15;
      const graceAfter = schedule.graceAfterMinutes ?? 30;
      const windowStart = this.subtractMinutes(schedule.timeFrom, graceBefore);
      const windowEnd = this.addMinutes(schedule.timeTo, graceAfter);

      if (context.currentTime < windowStart) {
        return { valid: false, reason: 'OUTSIDE_HOURS', message: `Allowed from ${schedule.timeFrom}` };
      }
      if (context.currentTime > windowEnd) {
        return { valid: false, reason: 'OUTSIDE_HOURS', message: `Allowed until ${schedule.timeTo}` };
      }
    }

    return { valid: true };
  }

  /**
   * Check daily usage limits for recurring entries.
   */
  async checkUsageLimit(
    entryId: string,
    entriesPerDay: number,
    istNow: Date,
  ): Promise<ScheduleCheckResult> {
    const todayUsages = await this.countTodayUsages(entryId, istNow);
    if (todayUsages >= entriesPerDay) {
      return {
        valid: false,
        reason: 'DAILY_LIMIT_REACHED',
        message: `Daily entry limit (${entriesPerDay}) reached`,
      };
    }
    return { valid: true };
  }

  /**
   * Count usages for today (IST day boundaries).
   */
  async countTodayUsages(entryId: string, istNow: Date): Promise<number> {
    const istDateStr = istNow.toISOString().slice(0, 10);
    // Start of IST day in UTC
    const dayStartUtc = new Date(`${istDateStr}T00:00:00.000Z`);
    dayStartUtc.setTime(dayStartUtc.getTime() - IST_OFFSET_MS);
    const dayEndUtc = new Date(dayStartUtc.getTime() + 24 * 60 * 60 * 1000);

    return prisma.preApprovedUsage.count({
      where: {
        entryId,
        usedAt: { gte: dayStartUtc, lt: dayEndUtc },
      },
    });
  }

  /**
   * Build SAFE mode response — explicit object, flat/resident info never included.
   */
  private buildSafeResponse(entry: PreApprovedEntryWithRelations): PreApprovedValidationResult {
    return {
      allowed: true,
      entryId: entry.id,
      type: entry.type,
      mode: 'SAFE',
      displayLabel: 'Cab Pickup',
      isPrivate: true,
    };
  }

  /**
   * Build NORMAL/SURPRISE mode response — includes flat/resident info.
   */
  private buildNormalResponse(entry: PreApprovedEntryWithRelations): PreApprovedValidationResult {
    return {
      allowed: true,
      entryId: entry.id,
      type: entry.type,
      mode: entry.mode,
      displayLabel: this.getDisplayLabel(entry),
      isPrivate: false,
      flatId: entry.flat.id,
      flatNumber: entry.flat.flatNumber,
      residentName: entry.user.name,
    };
  }

  /**
   * Build display label based on entry type and meta.
   */
  getDisplayLabel(entry: PreApprovedEntryWithRelations): string {
    if (entry.type === 'CAB') {
      if (entry.mode === 'SAFE') return 'Cab Pickup';
      return entry.visitorName ? `Cab for ${entry.visitorName}` : 'Cab';
    }
    if (entry.type === 'DELIVERY') {
      if (entry.mode === 'SURPRISE') return 'Surprise Delivery';
      if (entry.meta?.companyName) return `${entry.meta.companyName} Delivery`;
      return 'Delivery';
    }
    if (entry.type === 'HELP') {
      if (entry.meta?.category === 'OTHER' && entry.meta?.customCategory) {
        return entry.meta.customCategory;
      }
      if (entry.meta?.category) {
        return entry.meta.category.charAt(0) + entry.meta.category.slice(1).toLowerCase().replace(/_/g, ' ');
      }
      return 'Visiting Help';
    }
    return 'Pre-approved Entry';
  }

  /**
   * Subtract minutes from "HH:MM" time string.
   */
  private subtractMinutes(time: string, minutes: number): string {
    const [h, m] = time.split(':').map(Number);
    const totalMin = Math.max(0, h * 60 + m - minutes);
    return `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
  }

  /**
   * Add minutes to "HH:MM" time string.
   */
  private addMinutes(time: string, minutes: number): string {
    const [h, m] = time.split(':').map(Number);
    const totalMin = Math.min(23 * 60 + 59, h * 60 + m + minutes);
    return `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
  }
}

export const accessControlEngine = new AccessControlEngine();
