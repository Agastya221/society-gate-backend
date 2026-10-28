import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import { findInSociety } from '../../utils/scope';
import { pushService } from '../../services/push.service';
import logger from '../../utils/logger';

// ============================================
// TASKS FOR STAFF
// A guard or the admin sees something that needs doing (dirt in the lobby, garbage, a dry lawn) and gives the job to
// a staff member of the society who uses the staff app: a sweeper, a gardener... They accept it, then mark it done.
// The one who gave the job sees where it stands, and is reminded when nobody has accepted it.
// ============================================

export const REMIND_UNACCEPTED_MINUTES = 10;

/** Staff who usually do society work come first in the list the guard picks from. */
const SOCIETY_WORK_ORDER = ['CLEANER', 'GARDENER', 'CARETAKER', 'MAID', 'OTHER'];

export interface CreateTaskInput {
  domesticStaffId: string;
  title: string;
  note?: string;
  blockId?: string;
  location?: string;
}

const taskInclude = {
  domesticStaff: { select: { id: true, name: true, phone: true, staffType: true, photoUrl: true } },
  createdBy: { select: { id: true, name: true } },
  block: { select: { id: true, name: true } },
} as const;

const whereText = (task: { block?: { name: string } | null; location?: string | null }) =>
  [task.block?.name, task.location].filter(Boolean).join(' · ');

/** The staff a guard or admin can hand a job to. Only people who use the staff app can be reached, so only they are listed. */
export async function listAssignableStaff(societyId: string) {
  const staff = await prisma.domesticStaff.findMany({
    where: { societyId, isActive: true, account: { is: { isActive: true } } },
    select: { id: true, name: true, phone: true, staffType: true, photoUrl: true, isCurrentlyWorking: true },
    orderBy: { name: 'asc' },
  });
  const rank = (type: string) => { const i = SOCIETY_WORK_ORDER.indexOf(type); return i === -1 ? SOCIETY_WORK_ORDER.length : i; };
  return staff
    .map((s) => ({ id: s.id, name: s.name, phone: s.phone, staffType: s.staffType, photoUrl: s.photoUrl, insideNow: s.isCurrentlyWorking }))
    .sort((a, b) => rank(a.staffType) - rank(b.staffType) || Number(b.insideNow) - Number(a.insideNow) || a.name.localeCompare(b.name));
}

export async function createTask(societyId: string, creator: { id: string }, input: CreateTaskInput) {
  const staff = await prisma.domesticStaff.findFirst({
    where: { id: input.domesticStaffId, societyId },
    select: { id: true, name: true, isActive: true, account: { select: { isActive: true } } },
  });
  if (!staff) throw new AppError('Staff member not found in this society', 404);
  if (!staff.isActive) throw new AppError('This staff member is switched off', 409);
  if (!staff.account?.isActive) throw new AppError('This staff member does not use the staff app yet, so the task cannot reach them. Call them instead.', 409);
  if (input.blockId) await findInSociety(prisma.block, input.blockId, societyId, { entity: 'Block', select: { id: true } });

  const task = await prisma.staffTask.create({
    data: {
      societyId,
      domesticStaffId: staff.id,
      createdById: creator.id,
      title: input.title,
      note: input.note || null,
      blockId: input.blockId || null,
      location: input.location || null,
    },
    include: taskInclude,
  });

  const where = whereText(task);
  void pushService.sendToStaff(staff.id, {
    title: 'New task',
    body: `${task.title}${where ? ` · ${where}` : ''}`,
    data: { type: 'STAFF_TASK_NEW', taskId: task.id, screen: 'Tasks' },
    urgent: true,
  });
  return task;
}

/** open = still to do (assigned or accepted); all = also what was finished or cancelled in the last two days. */
export async function listTasks(societyId: string, scope: 'open' | 'all' = 'open') {
  const recent = new Date(Date.now() - 2 * 24 * 3_600_000);
  return prisma.staffTask.findMany({
    where: scope === 'open'
      ? { societyId, status: { in: ['ASSIGNED', 'ACCEPTED'] } }
      : { societyId, OR: [{ status: { in: ['ASSIGNED', 'ACCEPTED'] } }, { updatedAt: { gte: recent } }] },
    include: taskInclude,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

/** The one who gave the job, or any admin, can take it back before it is done. */
export async function cancelTask(societyId: string, taskId: string, actor: { id: string; role: string }) {
  const task = await prisma.staffTask.findFirst({ where: { id: taskId, societyId }, include: taskInclude });
  if (!task) throw new AppError('Task not found', 404);
  if (actor.role !== 'ADMIN' && actor.role !== 'SUPER_ADMIN' && task.createdById !== actor.id) {
    throw new AppError('Only the person who gave this task, or the admin, can cancel it', 403);
  }
  const changed = await prisma.staffTask.updateMany({
    where: { id: taskId, status: { in: ['ASSIGNED', 'ACCEPTED'] } },
    data: { status: 'CANCELLED', cancelledAt: new Date() },
  });
  if (changed.count !== 1) throw new AppError('This task is already finished or cancelled', 409);

  void pushService.sendToStaff(task.domesticStaffId, {
    title: 'Task cancelled',
    body: task.title,
    data: { type: 'STAFF_TASK_CANCELLED', taskId: task.id, screen: 'Tasks' },
    urgent: false,
  });
  return prisma.staffTask.findUniqueOrThrow({ where: { id: taskId }, include: taskInclude });
}

// ---------- the staff member's side ----------

/** Their open tasks, and what they finished or had cancelled in the last day. */
export async function tasksForStaff(domesticStaffId: string) {
  const since = new Date(Date.now() - 24 * 3_600_000);
  return prisma.staffTask.findMany({
    where: { domesticStaffId, OR: [{ status: { in: ['ASSIGNED', 'ACCEPTED'] } }, { updatedAt: { gte: since } }] },
    include: { createdBy: { select: { id: true, name: true, role: true } }, block: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

async function staffStep(domesticStaffId: string, taskId: string, step: 'accept' | 'done') {
  const task = await prisma.staffTask.findFirst({ where: { id: taskId, domesticStaffId }, include: taskInclude });
  if (!task) throw new AppError('Task not found', 404);
  if (task.status === 'CANCELLED') throw new AppError('This task was cancelled', 409);

  const now = new Date();
  const changed = step === 'accept'
    ? await prisma.staffTask.updateMany({ where: { id: taskId, status: 'ASSIGNED' }, data: { status: 'ACCEPTED', acceptedAt: now } })
    : await prisma.staffTask.updateMany({ where: { id: taskId, status: { in: ['ASSIGNED', 'ACCEPTED'] } }, data: { status: 'DONE', doneAt: now, ...(task.acceptedAt ? {} : { acceptedAt: now }) } });
  if (changed.count !== 1) {
    // Already in the state asked for: answering twice is harmless
    if ((step === 'accept' && task.status === 'ACCEPTED') || (step === 'done' && task.status === 'DONE')) return task;
    throw new AppError(step === 'accept' ? 'This task was already accepted or finished' : 'This task is already finished', 409);
  }

  const who = task.domesticStaff.name;
  void pushService.sendToUser(task.createdById, {
    title: step === 'accept' ? `${who} accepted the task` : `${task.title} is done`,
    body: step === 'accept' ? task.title : `${who} finished it`,
    data: { type: 'STAFF_TASK_UPDATE', taskId: task.id, status: step === 'accept' ? 'ACCEPTED' : 'DONE', screen: 'Tasks' },
    urgent: false,
  });
  return prisma.staffTask.findUniqueOrThrow({ where: { id: taskId }, include: taskInclude });
}

export const acceptTask = (domesticStaffId: string, taskId: string) => staffStep(domesticStaffId, taskId, 'accept');
export const finishTask = (domesticStaffId: string, taskId: string) => staffStep(domesticStaffId, taskId, 'done');

/** Run every minute: whoever gave a job is told once when nobody has accepted it after a few minutes. */
export async function remindUnacceptedTasks(now: Date = new Date()): Promise<number> {
  try {
    const waiting = await prisma.staffTask.findMany({
      where: { status: 'ASSIGNED', remindedAt: null, createdAt: { lte: new Date(now.getTime() - REMIND_UNACCEPTED_MINUTES * 60_000) } },
      include: taskInclude,
      take: 100,
    });
    let reminded = 0;
    for (const task of waiting) {
      const claimed = await prisma.staffTask.updateMany({ where: { id: task.id, status: 'ASSIGNED', remindedAt: null }, data: { remindedAt: now } });
      if (claimed.count !== 1) continue;
      void pushService.sendToUser(task.createdById, {
        title: 'Nobody has accepted this task',
        body: `${task.title}: ${task.domesticStaff.name} has not responded in ${REMIND_UNACCEPTED_MINUTES} min. You may want to call them.`,
        data: { type: 'STAFF_TASK_UPDATE', taskId: task.id, status: 'UNACCEPTED', screen: 'Tasks' },
        urgent: false,
      });
      reminded += 1;
    }
    if (reminded > 0) logger.info({ reminded }, 'Reminded about staff tasks nobody accepted');
    return reminded;
  } catch (error) {
    logger.error({ error }, 'Error reminding about unaccepted staff tasks');
    return 0;
  }
}
