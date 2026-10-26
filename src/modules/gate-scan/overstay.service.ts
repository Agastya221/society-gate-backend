import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import { pushService } from '../../services/push.service';
import logger from '../../utils/logger';

// ============================================
// DELIVERY WATCH
// A delivery person who has been inside the society for a long time is either lost, chatting or doing something
// they should not. After OVERSTAY_MINUTES the guards are reminded (again every REMIND_EVERY_MINUTES), and the guard
// can poke the flat or call its resident from the card. After STOP_AFTER_MINUTES the reminders stop: by then it is
// almost certainly a forgotten exit, not a delivery in progress.
// ============================================

export const OVERSTAY_MINUTES = 15;
export const REMIND_EVERY_MINUTES = 15;
export const STOP_AFTER_MINUTES = 180;
export const NUDGE_COOLDOWN_SECONDS = 120;

const minutesAgo = (now: Date, minutes: number) => new Date(now.getTime() - minutes * 60_000);

const describe = (entry: { visitorName: string; companyName: string | null }) =>
  entry.companyName?.trim() || entry.visitorName?.trim() || 'Delivery';

const flatLabel = (flat: { flatNumber: string; block?: { name: string } | null } | null) =>
  flat ? [flat.block?.name, flat.flatNumber].filter(Boolean).join(' ') : 'the society';

/** Run every minute: tells the society's guards about deliveries that have been inside too long. */
export async function remindOverstayingDeliveries(now: Date = new Date()): Promise<number> {
  try {
    const dueBefore = minutesAgo(now, OVERSTAY_MINUTES);
    const dueAgain = minutesAgo(now, REMIND_EVERY_MINUTES);
    const dueWhere = {
      type: 'DELIVERY' as const,
      status: 'CHECKED_IN' as const,
      checkOutTime: null,
      checkInTime: { lte: dueBefore, gte: minutesAgo(now, STOP_AFTER_MINUTES) },
      OR: [{ overstayAlertedAt: null }, { overstayAlertedAt: { lte: dueAgain } }],
    };

    const due = await prisma.entry.findMany({
      where: dueWhere,
      select: {
        id: true, societyId: true, visitorName: true, companyName: true, checkInTime: true,
        flat: { select: { flatNumber: true, block: { select: { name: true } } } },
      },
      orderBy: { checkInTime: 'asc' },
      take: 200,
    });

    let reminded = 0;
    for (const entry of due) {
      // Claim it first, so two server instances (or two runs) never remind about the same delivery twice
      const claimed = await prisma.entry.updateMany({
        where: { id: entry.id, ...dueWhere },
        data: { overstayAlertedAt: now },
      });
      if (claimed.count !== 1) continue;

      const inside = Math.round((now.getTime() - entry.checkInTime.getTime()) / 60_000);
      void pushService.sendToSocietyStaff(entry.societyId, ['GUARD'], {
        title: 'Delivery still inside',
        body: `${describe(entry)} at ${flatLabel(entry.flat)} has been inside for ${inside} min`,
        data: { type: 'DELIVERY_OVERSTAY', entryId: entry.id, screen: 'TodayEntries' },
        urgent: false,
      });
      reminded += 1;
    }
    if (reminded > 0) logger.info({ reminded }, 'Reminded guards about deliveries still inside');
    return reminded;
  } catch (error) {
    logger.error({ error }, 'Error reminding guards about overstaying deliveries');
    return 0;
  }
}

/** The guard pokes the flat about the person who is inside: its residents get a notification. One poke per 2 minutes. */
export async function nudgeFlat(entryId: string, societyId: string, now: Date = new Date()) {
  const entry = await prisma.entry.findFirst({
    where: { id: entryId, societyId },
    select: {
      id: true, flatId: true, status: true, visitorName: true, companyName: true, checkInTime: true,
      flat: { select: { flatNumber: true, block: { select: { name: true } } } },
    },
  });
  if (!entry) throw new AppError('Entry not found', 404);
  if (entry.status !== 'CHECKED_IN') throw new AppError('This person has already left', 409);
  if (!entry.flatId) throw new AppError('This entry is not linked to a flat', 400);

  const claimed = await prisma.entry.updateMany({
    where: {
      id: entry.id,
      OR: [{ lastNudgeAt: null }, { lastNudgeAt: { lte: new Date(now.getTime() - NUDGE_COOLDOWN_SECONDS * 1000) } }],
    },
    data: { lastNudgeAt: now },
  });
  if (claimed.count !== 1) throw new AppError('The flat was poked a moment ago. Please wait two minutes.', 429);

  const minutes = Math.max(1, Math.round((now.getTime() - entry.checkInTime.getTime()) / 60_000));
  const who = describe(entry);
  void pushService.sendToFlats([entry.flatId], {
    title: `${who} is still inside`,
    body: `Security checked: ${who} has been inside for ${minutes} min. Please look in, or call the gate.`,
    data: { type: 'GATE_NUDGE', entryId: entry.id, screen: 'Visitors' },
    urgent: false,
  });
  return { sent: true, minutes };
}

/** Who to call about this entry: the flat's primary resident. Only for entries of the guard's own society. */
export async function flatContact(entryId: string, societyId: string, guardId: string) {
  const entry = await prisma.entry.findFirst({
    where: { id: entryId, societyId },
    select: { id: true, flatId: true },
  });
  if (!entry) throw new AppError('Entry not found', 404);
  if (!entry.flatId) return { contact: null };

  const membership = await prisma.userFlatMembership.findFirst({
    where: { flatId: entry.flatId, isActive: true, role: 'RESIDENT', user: { isActive: true, phone: { not: '' } } },
    orderBy: [{ isPrimary: 'desc' }, { isOwner: 'desc' }, { createdAt: 'asc' }],
    select: { user: { select: { name: true, phone: true } } },
  });
  logger.info({ entryId, guardId, found: !!membership }, 'Guard asked for a flat contact');
  return { contact: membership ? { name: membership.user.name, phone: membership.user.phone } : null };
}
