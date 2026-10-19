import { prisma } from '../../utils/Client';
import type { Prisma } from '../../../prisma/generated/prisma/client';
import type {
  AccessControlContext,
  ScheduleCheckResult,
  PreApprovedValidationResult,
  PreApprovedEntryWithRelations,
} from '../../types';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const MINUTES_PER_DAY = 24 * 60;

const toMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Resolve a ONCE schedule into an absolute window, expressed in minutes since IST
 * midnight of the schedule date. When endTime < startTime the pass crosses midnight
 * and ends on the following day. `istNow` is the IST-shifted "now" (see buildContext).
 * Returns null when the schedule is incomplete.
 */
export function getOnceWindow(
  schedule: {
    date: Date | string | null;
    startTime: string | null;
    endTime: string | null;
    graceBeforeMinutes?: number | null;
    graceAfterMinutes?: number | null;
  },
  istNow: Date,
): { nowMin: number; windowStart: number; windowEnd: number; dateStr: string } | null {
  if (!schedule.date || !schedule.startTime || !schedule.endTime) return null;

  // Calendar date of the pass in IST. Works whether the date was stored as UTC
  // midnight ("2026-10-02T00:00Z") or IST midnight ("2026-10-01T18:30Z").
  const dateStr = new Date(new Date(schedule.date).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
  const dayStartIstShifted = Date.parse(`${dateStr}T00:00:00.000Z`);
  const nowMin = Math.floor((istNow.getTime() - dayStartIstShifted) / 60000);

  const start = toMinutes(schedule.startTime);
  let end = toMinutes(schedule.endTime);
  if (end < start) end += MINUTES_PER_DAY; // overnight window

  return {
    nowMin,
    windowStart: start - (schedule.graceBeforeMinutes ?? 15),
    windowEnd: end + (schedule.graceAfterMinutes ?? 30),
    dateStr,
  };
}

/**
 * True once a ONCE pass's window (incl. grace, incl. next-day overnight end) is over.
 */
export function isOnceScheduleOver(
  schedule: Parameters<typeof getOnceWindow>[0],
  now: Date = new Date(),
): boolean {
  const window = getOnceWindow(schedule, new Date(now.getTime() + IST_OFFSET_MS));
  if (!window) return false;
  return window.nowMin > window.windowEnd;
}

// ============================================
// RECURRING SCHEDULES (incl. overnight windows)
// ============================================

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/** Normalised denial reasons for the guard UI (returned as `reasonCode` / `reasons[].reason`). */
export type PassDenialReason =
  | 'NOT_STARTED'
  | 'WRONG_DAY'
  | 'OUTSIDE_HOURS'
  | 'DAILY_LIMIT_REACHED'
  | 'EXPIRED'
  | 'USED'
  | 'CANCELLED'
  | 'INVALID_SCHEDULE';

export interface RecurringScheduleInput {
  validFrom?: Date | string | null;
  validUntil?: Date | string | null;
  daysOfWeek?: string[] | null;
  timeFrom?: string | null;
  timeTo?: string | null;
  graceBeforeMinutes?: number | null;
  graceAfterMinutes?: number | null;
}

/**
 * One concrete occurrence of a recurring window, anchored on the IST calendar day it
 * STARTS on. For an overnight window (22:00 -> 06:00) the early-morning part belongs to
 * the previous day's occurrence, so daysOfWeek and per-day limits use the anchor day.
 */
export interface RecurringOccurrence {
  anchorDate: string; // YYYY-MM-DD (IST) the occurrence starts on
  day: string; // MON..SUN of anchorDate
  nominalStart: Date; // timeFrom on anchorDate
  nominalEnd: Date; // timeTo (next day when overnight)
  start: Date; // nominalStart - graceBefore
  end: Date; // nominalEnd + graceAfter (inclusive)
}

export interface RecurringEvaluation {
  valid: boolean;
  reasonCode?: PassDenialReason;
  legacyReason?: string;
  message?: string;
  /** Eligible occurrences containing `now` (normally one). Usage limits count inside these. */
  occurrences: RecurringOccurrence[];
  overnight: boolean;
  nextStart?: Date;
}

const istDateStr = (d: Date): string => new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
const addDaysStr = (dateStr: string, n: number): string =>
  new Date(Date.parse(`${dateStr}T00:00:00.000Z`) + n * DAY_MS).toISOString().slice(0, 10);
/** Absolute instant `minutes` after IST midnight of dateStr. */
const istInstant = (dateStr: string, minutes: number): Date =>
  new Date(Date.parse(`${dateStr}T00:00:00.000Z`) - IST_OFFSET_MS + minutes * 60000);
const dayOf = (dateStr: string): string => DAY_NAMES[new Date(`${dateStr}T00:00:00.000Z`).getUTCDay()];

/** "Mon 3 Oct, 22:00" in IST. */
export function formatIst(d: Date): string {
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = DAY_NAMES[ist.getUTCDay()];
  return `${day.charAt(0)}${day.slice(1).toLowerCase()} ${ist.getUTCDate()} ${months[ist.getUTCMonth()]}, ${ist.toISOString().slice(11, 16)}`;
}

/** timeTo <= timeFrom means the window crosses midnight (equal = full 24h). */
export function isOvernightWindow(timeFrom?: string | null, timeTo?: string | null): boolean {
  if (!timeFrom || !timeTo) return false;
  return toMinutes(timeTo) <= toMinutes(timeFrom);
}

export function getRecurringOccurrence(schedule: RecurringScheduleInput, anchorDate: string): RecurringOccurrence {
  const day = dayOf(anchorDate);
  if (!schedule.timeFrom || !schedule.timeTo) {
    // No time window: the whole IST calendar day, no grace.
    const nominalStart = istInstant(anchorDate, 0);
    const nominalEnd = new Date(istInstant(anchorDate, MINUTES_PER_DAY).getTime() - 1);
    return { anchorDate, day, nominalStart, nominalEnd, start: nominalStart, end: nominalEnd };
  }
  const startMin = toMinutes(schedule.timeFrom);
  let endMin = toMinutes(schedule.timeTo);
  if (endMin <= startMin) endMin += MINUTES_PER_DAY; // overnight
  const nominalStart = istInstant(anchorDate, startMin);
  const nominalEnd = istInstant(anchorDate, endMin);
  return {
    anchorDate,
    day,
    nominalStart,
    nominalEnd,
    start: new Date(nominalStart.getTime() - (schedule.graceBeforeMinutes ?? 15) * 60000),
    end: new Date(nominalEnd.getTime() + (schedule.graceAfterMinutes ?? 30) * 60000),
  };
}

const dayAllowed = (schedule: RecurringScheduleInput, day: string): boolean =>
  !schedule.daysOfWeek || schedule.daysOfWeek.length === 0 || schedule.daysOfWeek.includes(day);

/**
 * validUntil rule: a regular window must be used before validUntil (unchanged). An
 * overnight occurrence that STARTED (nominally) on or before validUntil may run to its
 * end, so the last night of a pass isn't cut off at validUntil.
 */
function occurrenceWithinValidity(
  schedule: RecurringScheduleInput,
  occ: RecurringOccurrence,
  now: Date,
  overnight: boolean,
): boolean {
  if (!schedule.validUntil) return true;
  const until = new Date(schedule.validUntil);
  if (now <= until) return true;
  return overnight && occ.nominalStart <= until;
}

/**
 * Pure evaluation of a RECURRING schedule at `now` (absolute instant).
 * Usage limits are NOT checked here (see AccessControlEngine.checkUsageLimit).
 */
export function evaluateRecurringSchedule(schedule: RecurringScheduleInput, now: Date = new Date()): RecurringEvaluation {
  const overnight = isOvernightWindow(schedule.timeFrom, schedule.timeTo);
  const base = { occurrences: [] as RecurringOccurrence[], overnight };

  if (schedule.validFrom && now < new Date(schedule.validFrom)) {
    const from = new Date(schedule.validFrom);
    return {
      ...base,
      valid: false,
      reasonCode: 'NOT_STARTED',
      legacyReason: 'NOT_YET_VALID',
      message: `This pass starts on ${formatIst(from)}`,
      nextStart: from,
    };
  }

  const today = istDateStr(now);
  const containing = [-1, 0, 1]
    .map((offset) => getRecurringOccurrence(schedule, addDaysStr(today, offset)))
    .filter((occ) => now >= occ.start && now <= occ.end);
  const eligible = containing.filter(
    (occ) => dayAllowed(schedule, occ.day) && occurrenceWithinValidity(schedule, occ, now, overnight),
  );
  if (eligible.length > 0) {
    return { ...base, valid: true, occurrences: eligible };
  }

  if (schedule.validUntil && now > new Date(schedule.validUntil)) {
    return {
      ...base,
      valid: false,
      reasonCode: 'EXPIRED',
      legacyReason: 'EXPIRED',
      message: `This pass expired on ${formatIst(new Date(schedule.validUntil))}`,
    };
  }

  // Next occurrence the visitor could use (nominal start), within the next 8 days
  let nextStart: Date | undefined;
  for (let offset = 0; offset <= 8 && !nextStart; offset++) {
    const occ = getRecurringOccurrence(schedule, addDaysStr(today, offset));
    if (occ.start <= now || !dayAllowed(schedule, occ.day)) continue;
    if (schedule.validUntil && occ.nominalStart > new Date(schedule.validUntil)) break;
    nextStart = occ.nominalStart;
  }
  const nextText = nextStart ? `. Next allowed from ${formatIst(nextStart)}` : '';
  const hours = schedule.timeFrom && schedule.timeTo
    ? `${schedule.timeFrom}–${schedule.timeTo}${overnight ? ' overnight' : ''}`
    : 'all day';

  // Inside the hours, but that window belongs to a day that isn't allowed — or no
  // window is running and today isn't an allowed day → WRONG_DAY
  const blockedByDay = containing.find((occ) => !dayAllowed(schedule, occ.day));
  const todayDay = dayOf(today);
  if (blockedByDay || (containing.length === 0 && !dayAllowed(schedule, todayDay))) {
    const day = blockedByDay?.day ?? todayDay;
    return {
      ...base,
      valid: false,
      reasonCode: 'WRONG_DAY',
      legacyReason: 'WRONG_DAY',
      message: `This pass is not valid on ${day} (allowed ${(schedule.daysOfWeek ?? []).join(', ')}, ${hours})${nextText}`,
      nextStart,
    };
  }

  return {
    ...base,
    valid: false,
    reasonCode: 'OUTSIDE_HOURS',
    legacyReason: 'OUTSIDE_HOURS',
    message: `This pass is valid ${hours} only${nextText}`,
    nextStart,
  };
}

/**
 * True when a recurring pass can never be used again: validUntil is past and no
 * overnight occurrence that started before validUntil is still running.
 */
export function isRecurringScheduleOver(schedule: RecurringScheduleInput, now: Date = new Date()): boolean {
  if (!schedule.validUntil) return false;
  const until = new Date(schedule.validUntil);
  if (now <= until) return false;
  if (!isOvernightWindow(schedule.timeFrom, schedule.timeTo)) return true;
  const untilDay = istDateStr(until);
  const latestEnd = [-1, 0]
    .map((offset) => getRecurringOccurrence(schedule, addDaysStr(untilDay, offset)))
    .filter((occ) => occ.nominalStart <= until && dayAllowed(schedule, occ.day))
    .reduce((max, occ) => Math.max(max, occ.end.getTime()), until.getTime());
  return now.getTime() > latestEnd;
}

type AnySchedule = RecurringScheduleInput & {
  date?: Date | string | null;
  startTime?: string | null;
  endTime?: string | null;
};

/** Window description returned to the guard app alongside a denial. */
export function describeScheduleWindow(
  schedule: AnySchedule | null | undefined,
  scheduleType: string,
  nextStart?: Date,
): Record<string, unknown> | null {
  if (!schedule) return null;
  if (scheduleType === 'ONCE') {
    const w = getOnceWindow(
      { date: schedule.date ?? null, startTime: schedule.startTime ?? null, endTime: schedule.endTime ?? null },
      new Date(),
    );
    const startsAt = w ? istInstant(w.dateStr, toMinutes(schedule.startTime!)) : null;
    const endsAt = w ? istInstant(w.dateStr, w.windowEnd - (schedule.graceAfterMinutes ?? 30)) : null;
    return {
      scheduleType,
      date: w?.dateStr ?? null,
      startTime: schedule.startTime ?? null,
      endTime: schedule.endTime ?? null,
      overnight: isOvernightWindow(schedule.startTime, schedule.endTime),
      graceBeforeMinutes: schedule.graceBeforeMinutes ?? 15,
      graceAfterMinutes: schedule.graceAfterMinutes ?? 30,
      startsAt: startsAt?.toISOString() ?? null,
      endsAt: endsAt?.toISOString() ?? null,
    };
  }
  return {
    scheduleType,
    timeFrom: schedule.timeFrom ?? null,
    timeTo: schedule.timeTo ?? null,
    overnight: isOvernightWindow(schedule.timeFrom, schedule.timeTo),
    daysOfWeek: schedule.daysOfWeek ?? [],
    validFrom: schedule.validFrom ? new Date(schedule.validFrom).toISOString() : null,
    validUntil: schedule.validUntil ? new Date(schedule.validUntil).toISOString() : null,
    graceBeforeMinutes: schedule.graceBeforeMinutes ?? 15,
    graceAfterMinutes: schedule.graceAfterMinutes ?? 30,
    nextStart: nextStart ? nextStart.toISOString() : null,
  };
}

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
   * Denials keep the legacy `reason` and add `reasonCode` (normalised) + `window`.
   */
  async evaluatePreApproved(
    entry: PreApprovedEntryWithRelations,
    context: AccessControlContext,
  ): Promise<PreApprovedValidationResult> {
    const deny = (reason: string, reasonCode: string | undefined, message: string, nextStart?: Date): PreApprovedValidationResult => ({
      allowed: false,
      isPrivate: false,
      reason,
      reasonCode,
      message,
      window: describeScheduleWindow(entry.schedule, entry.scheduleType, nextStart),
    });

    // 0. Defence in depth: a pass from another society never validates at this gate
    if (entry.societyId !== context.societyId) {
      return { allowed: false, isPrivate: false, reason: 'NOT_FOUND', message: 'Pre-approved entry not found' };
    }

    // 1. Check status
    if (entry.status !== 'ACTIVE') {
      const statusMessages: Record<string, string> = {
        USED: 'This pass has already been used',
        EXPIRED: 'This pass has expired',
        CANCELLED: 'This pass was cancelled by the resident',
      };
      return deny(
        entry.status,
        entry.status,
        statusMessages[entry.status] ?? `This entry is ${entry.status.toLowerCase()}`,
      );
    }

    // 2. No lock check: validation is read-only. Double use is prevented atomically
    //    in markUsed (conditional status update / row lock inside the transaction).

    // 3. Check schedule validity
    if (entry.schedule) {
      const scheduleResult = this.checkSchedule(
        entry.schedule,
        entry.scheduleType,
        context,
      );
      if (!scheduleResult.valid) {
        return deny(
          scheduleResult.reason ?? 'INVALID_SCHEDULE',
          scheduleResult.reasonCode,
          scheduleResult.message ?? 'Entry not valid at this time',
          scheduleResult.nextStart,
        );
      }

      // 4. Check daily usage limit for recurring (counted per occurrence of the window)
      if (entry.scheduleType === 'RECURRING' && entry.schedule.entriesPerDay) {
        const usageResult = await this.checkUsageLimit(
          entry.id,
          entry.schedule.entriesPerDay,
          context.istNow,
          scheduleResult.occurrences,
        );
        if (!usageResult.valid) {
          return deny(
            usageResult.reason ?? 'DAILY_LIMIT_REACHED',
            usageResult.reasonCode,
            usageResult.message ?? 'Daily entry limit reached',
          );
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
    const window = getOnceWindow(schedule, context.istNow);
    if (!window) {
      return { valid: false, reason: 'INVALID_SCHEDULE', reasonCode: 'INVALID_SCHEDULE', message: 'Incomplete schedule data' };
    }

    // All values are minutes since IST midnight of the schedule date. An overnight
    // pass (e.g. 17:45 → 01:45) ends on the next calendar day, grace included.
    const { nowMin, windowStart, windowEnd, dateStr } = window;
    if (nowMin >= windowStart && nowMin <= windowEnd) {
      return { valid: true };
    }

    const hhmm = (min: number) => {
      const m = ((min % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
      return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    };
    const span = `${schedule.startTime}–${schedule.endTime}`;
    const nextStart = istInstant(dateStr, toMinutes(schedule.startTime!));

    const todayStartMin = Math.floor(nowMin / MINUTES_PER_DAY) * MINUTES_PER_DAY;
    if (nowMin < windowStart) {
      if (nowMin < 0) {
        return {
          valid: false,
          reason: 'WRONG_DATE',
          reasonCode: 'NOT_STARTED',
          message: `This pass is for ${dateStr} (${span}), not today`,
          nextStart,
        };
      }
      return {
        valid: false,
        reason: 'TOO_EARLY',
        reasonCode: 'NOT_STARTED',
        message: `Pass is valid ${span} — entry allowed from ${hhmm(windowStart)}`,
        nextStart,
      };
    }
    // Past the window: if it already ended before today began, it's simply another day's pass
    if (windowEnd < todayStartMin) {
      return { valid: false, reason: 'WRONG_DATE', reasonCode: 'EXPIRED', message: `This pass was for ${dateStr} (${span}) and has expired` };
    }
    return { valid: false, reason: 'TOO_LATE', reasonCode: 'EXPIRED', message: `Pass expired at ${schedule.endTime} (grace until ${hhmm(windowEnd)})` };
  }

  private checkRecurringSchedule(
    schedule: PreApprovedEntryWithRelations['schedule'] & object,
    context: AccessControlContext,
  ): ScheduleCheckResult {
    // Overnight-aware (22:00 → 06:00): see evaluateRecurringSchedule
    const result = evaluateRecurringSchedule(schedule, context.now);
    if (result.valid) {
      return { valid: true, occurrences: result.occurrences };
    }
    return {
      valid: false,
      reason: result.legacyReason,
      reasonCode: result.reasonCode,
      message: result.message,
      nextStart: result.nextStart,
    };
  }

  /**
   * Check daily usage limits for recurring entries. With `occurrences` (from
   * checkSchedule) usages are counted inside the current occurrence of the window, so
   * an overnight pass used at 23:00 and 02:00 counts both against the same night.
   * Without them it falls back to the IST calendar day. `client` lets markUsed count
   * inside its transaction.
   */
  async checkUsageLimit(
    entryId: string,
    entriesPerDay: number,
    istNow: Date,
    occurrences?: { start: Date; end: Date }[],
    client: Pick<Prisma.TransactionClient, 'preApprovedUsage'> = prisma,
  ): Promise<ScheduleCheckResult> {
    let allowed: boolean;
    if (occurrences && occurrences.length > 0) {
      allowed = false;
      for (const occ of occurrences) {
        const used = await client.preApprovedUsage.count({
          where: { entryId, usedAt: { gte: occ.start, lte: occ.end } },
        });
        if (used < entriesPerDay) {
          allowed = true;
          break;
        }
      }
    } else {
      allowed = (await this.countTodayUsages(entryId, istNow, client)) < entriesPerDay;
    }
    if (!allowed) {
      return {
        valid: false,
        reason: 'DAILY_LIMIT_REACHED',
        reasonCode: 'DAILY_LIMIT_REACHED',
        message: `Daily entry limit (${entriesPerDay}) already used for this window`,
      };
    }
    return { valid: true };
  }

  /**
   * Count usages for today (IST day boundaries).
   */
  async countTodayUsages(
    entryId: string,
    istNow: Date,
    client: Pick<Prisma.TransactionClient, 'preApprovedUsage'> = prisma,
  ): Promise<number> {
    const istDateStr = istNow.toISOString().slice(0, 10);
    // Start of IST day in UTC
    const dayStartUtc = new Date(`${istDateStr}T00:00:00.000Z`);
    dayStartUtc.setTime(dayStartUtc.getTime() - IST_OFFSET_MS);
    const dayEndUtc = new Date(dayStartUtc.getTime() + 24 * 60 * 60 * 1000);

    return client.preApprovedUsage.count({
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
      vehicleNumber: entry.meta?.vehicleNumber ?? null,
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
      vehicleNumber: entry.meta?.vehicleNumber ?? null,
      guestCount: entry.guestCount ?? 1,
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
}

export const accessControlEngine = new AccessControlEngine();
