import { prisma } from '../../utils/Client';
import { guardUsersWhere } from '../../utils/guard-access';

/**
 * A guard's shift. "Start duty" is only accepted from the gate (the geofence check runs on the route), and where a
 * society has set a gate location, gate actions need an open shift. A shift the guard forgot to close ends by itself.
 */
export const MAX_SHIFT_MS = 16 * 60 * 60 * 1000;

const dutySelect = {
  id: true, startedAt: true, endedAt: true, endedBy: true,
  gatePoint: { select: { id: true, name: true } },
} as const;

/** The guard's open shift, or null. A shift older than MAX_SHIFT_MS is closed here and does not count. */
export async function currentDuty(guardId: string) {
  const open = await prisma.guardDuty.findFirst({
    where: { guardId, endedAt: null },
    orderBy: { startedAt: 'desc' },
    select: dutySelect,
  });
  if (!open) return null;
  if (Date.now() - open.startedAt.getTime() > MAX_SHIFT_MS) {
    await prisma.guardDuty.update({
      where: { id: open.id },
      data: { endedAt: new Date(open.startedAt.getTime() + MAX_SHIFT_MS), endedBy: 'AUTO' },
    });
    return null;
  }
  return open;
}

export async function startDuty(
  guardId: string,
  societyId: string,
  where: { gatePointId?: string | null; latitude?: number | null; longitude?: number | null },
) {
  const existing = await currentDuty(guardId);
  if (existing) return existing;
  return prisma.guardDuty.create({
    data: {
      guardId,
      societyId,
      gatePointId: where.gatePointId ?? null,
      startLatitude: where.latitude ?? null,
      startLongitude: where.longitude ?? null,
    },
    select: dutySelect,
  });
}

export async function endDuty(guardId: string) {
  const open = await currentDuty(guardId);
  if (!open) return null;
  return prisma.guardDuty.update({
    where: { id: open.id },
    data: { endedAt: new Date(), endedBy: 'GUARD' },
    select: dutySelect,
  });
}

export async function listShifts(societyId: string, limit = 30) {
  const rows = await prisma.guardDuty.findMany({
    where: { societyId },
    orderBy: { startedAt: 'desc' },
    take: limit,
    select: { id: true, startedAt: true, endedAt: true, endedBy: true, guard: { select: { id: true, name: true } }, gatePoint: { select: { name: true } } },
  });
  return rows.map((r) => ({
    ...r,
    minutes: Math.round(((r.endedAt?.getTime() ?? Date.now()) - r.startedAt.getTime()) / 60000),
  }));
}

export interface ShiftSchedule {
  name: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Compares one real shift with the guard's scheduled shift. The scheduled start is the one closest to when the
 * guard actually started (today's, yesterday's or tomorrow's), and only counts when it is within 6 hours: a guard who
 * works at some other time is simply not flagged. Late / early only count beyond the grace minutes.
 */
export function compareWithSchedule(startedAt: Date, endedAt: Date | null, endedBy: string | null, schedule: ShiftSchedule | null) {
  if (!schedule) return { scheduledStart: null, scheduledEnd: null, lateMinutes: 0, earlyMinutes: 0 };
  const startMinutes = toMinutes(schedule.startTime);
  let length = toMinutes(schedule.endTime) - startMinutes;
  if (length <= 0) length += 24 * 60;

  let best: Date | null = null;
  for (const dayShift of [-1, 0, 1]) {
    const candidate = new Date(startedAt.getFullYear(), startedAt.getMonth(), startedAt.getDate() + dayShift, 0, startMinutes);
    if (!best || Math.abs(candidate.getTime() - startedAt.getTime()) < Math.abs(best.getTime() - startedAt.getTime())) best = candidate;
  }
  if (!best || Math.abs(best.getTime() - startedAt.getTime()) > 6 * 3_600_000) {
    return { scheduledStart: null, scheduledEnd: null, lateMinutes: 0, earlyMinutes: 0 };
  }
  const scheduledEnd = new Date(best.getTime() + length * 60_000);
  const lateBy = Math.round((startedAt.getTime() - best.getTime()) / 60_000);
  // An auto-closed shift is not "left early": the guard just forgot to end it
  const earlyBy = endedAt && endedBy === 'GUARD' ? Math.round((scheduledEnd.getTime() - endedAt.getTime()) / 60_000) : 0;
  return {
    scheduledStart: best,
    scheduledEnd,
    lateMinutes: lateBy > schedule.graceMinutes ? lateBy : 0,
    earlyMinutes: earlyBy > schedule.graceMinutes ? earlyBy : 0,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * Attendance for one month (YYYY-MM): every guard of the society with the days they were on duty, total hours and
 * their shifts. A day counts as present when a shift started that day. Server time is India time (see config/timezone).
 */
export async function monthlyAttendance(societyId: string, month: string) {
  const [yearText, monthText] = month.split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const from = new Date(year, monthIndex, 1);
  const to = new Date(year, monthIndex + 1, 1);

  const [guards, shifts] = await Promise.all([
    prisma.user.findMany({
      where: { ...guardUsersWhere(societyId), isActive: true },
      select: { id: true, name: true, phone: true, guardShift: { select: { name: true, startTime: true, endTime: true, graceMinutes: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.guardDuty.findMany({
      where: { societyId, startedAt: { gte: from, lt: to } },
      orderBy: { startedAt: 'asc' },
      select: { id: true, guardId: true, startedAt: true, endedAt: true, endedBy: true, gatePoint: { select: { name: true } } },
    }),
  ]);

  const now = Date.now();
  return {
    month,
    guards: guards.map((guard) => {
      const mine = shifts.filter((s) => s.guardId === guard.id).map((s) => {
        const flags = compareWithSchedule(s.startedAt, s.endedAt, s.endedBy, guard.guardShift);
        return {
          id: s.id,
          date: dayKey(s.startedAt),
          startedAt: s.startedAt,
          endedAt: s.endedAt,
          endedBy: s.endedBy,
          gate: s.gatePoint?.name ?? null,
          minutes: Math.max(0, Math.round(((s.endedAt?.getTime() ?? now) - s.startedAt.getTime()) / 60000)),
          onDuty: s.endedAt === null,
          lateMinutes: flags.lateMinutes,
          earlyMinutes: flags.earlyMinutes,
        };
      });
      return {
        guardId: guard.id,
        name: guard.name,
        phone: guard.phone,
        daysPresent: new Set(mine.map((s) => s.date)).size,
        totalMinutes: mine.reduce((sum, s) => sum + s.minutes, 0),
        shiftCount: mine.length,
        scheduledShift: guard.guardShift ? { name: guard.guardShift.name, startTime: guard.guardShift.startTime, endTime: guard.guardShift.endTime } : null,
        lateCount: mine.filter((x) => x.lateMinutes > 0).length,
        earlyCount: mine.filter((x) => x.earlyMinutes > 0).length,
        onDutyNow: mine.some((s) => s.onDuty),
        shifts: mine,
      };
    }),
  };
}
