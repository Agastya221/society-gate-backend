/**
 * Tasks for staff: a guard or the admin gives a job to a staff member of the staff app; they accept and finish it;
 * the giver is told. Builds a throwaway society; push delivery is captured, nothing leaves the server.
 * Run: npx ts-node --transpile-only scripts/staff-task-smoke.ts
 */
import 'dotenv/config';
import { prisma } from '../src/utils/Client';
import { pushService } from '../src/services/push.service';
import { createStaffTaskSchema } from '../src/modules/staff-task/staff-task.controller';
import {
  acceptTask, cancelTask, createTask, finishTask, listAssignableStaff, listTasks, remindUnacceptedTasks, tasksForStaff,
} from '../src/modules/staff-task/staff-task.service';

let failed = 0;
const check = (name: string, ok: boolean, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!ok) failed += 1; };
const status = async (fn: () => Promise<unknown>) => { try { await fn(); return 200; } catch (e: any) { return e?.statusCode ?? e?.status ?? 500; } };

type Sent = { to: string; kind: 'staff' | 'user'; title: string; body: string; data?: Record<string, string>; urgent?: boolean };
const sent: Sent[] = [];
(pushService as any).sendToStaff = async (id: string, p: any) => { sent.push({ to: id, kind: 'staff', ...p }); };
(pushService as any).sendToUser = async (id: string, p: any) => { sent.push({ to: id, kind: 'user', ...p }); };
const take = () => sent.splice(0);

const PHONES = ['9000000901', '9000000902', '9000000903', '9000000904', '9000000905', '9000000906', '9000000907', '9000000908'];
const [ADMIN, GUARD, GUARD2, CLEANER, GARDENER, NO_APP, OFF, FOREIGN] = PHONES;

(async () => {
  const societyIds: string[] = [];
  try {
    await prisma.staffTask.deleteMany({ where: { domesticStaff: { phone: { in: PHONES } } } });
    await prisma.staffAccount.deleteMany({ where: { phone: { in: PHONES } } });
    await prisma.domesticStaff.deleteMany({ where: { phone: { in: PHONES } } });
    await prisma.user.deleteMany({ where: { phone: { in: PHONES } } });
    const mk = async (name: string) => { const s = await prisma.society.create({ data: { name, address: 'x', city: 'Test', state: 'Test', pincode: '000000', contactName: 'c', contactPhone: '9000000999', isActive: true, nextDueDate: new Date() } }); societyIds.push(s.id); return s; };
    const society = await mk('Task Test Society');
    const other = await mk('Task Other Society');
    const societyId = society.id;
    const block = await prisma.block.create({ data: { societyId, name: 'Tower A' } });
    const foreignBlock = await prisma.block.create({ data: { societyId: other.id, name: 'Tower Z' } });

    const admin = await prisma.user.create({ data: { name: 'Society Admin', phone: ADMIN, role: 'ADMIN', societyId, isActive: true } });
    const guard = await prisma.user.create({ data: { name: 'Gate Guard', phone: GUARD, role: 'GUARD', societyId, isActive: true } });
    const guard2 = await prisma.user.create({ data: { name: 'Second Guard', phone: GUARD2, role: 'GUARD', societyId, isActive: true } });

    const mkStaff = async (phone: string, name: string, staffType: any, opts: { account?: boolean; active?: boolean; soc?: string; inside?: boolean } = {}) => {
      const s = await prisma.domesticStaff.create({ data: { name, phone, staffType, societyId: opts.soc ?? societyId, qrToken: 'qr-task-' + phone, addedById: admin.id, isActive: opts.active ?? true, isCurrentlyWorking: opts.inside ?? false } });
      if (opts.account !== false) await prisma.staffAccount.create({ data: { domesticStaffId: s.id, phone } });
      return s;
    };
    const cleaner = await mkStaff(CLEANER, 'Sunita Sweeper', 'CLEANER', { inside: true });
    const gardener = await mkStaff(GARDENER, 'Gopal Gardener', 'GARDENER');
    const noApp = await mkStaff(NO_APP, 'Tara Without App', 'CLEANER', { account: false });
    const off = await mkStaff(OFF, 'Omkar Switched Off', 'CLEANER', { active: false });
    const foreign = await mkStaff(FOREIGN, 'Elsewhere Cleaner', 'CLEANER', { soc: other.id });

    // ---- who can be given a task ----
    const list = await listAssignableStaff(societyId);
    check('only staff of this society who use the staff app are listed', list.length === 2 && list.every((s) => [cleaner.id, gardener.id].includes(s.id)));
    check('the cleaner comes before the gardener, and shows they are inside', list[0].id === cleaner.id && list[0].insideNow === true);

    // ---- validation of what is typed ----
    check('a task needs a few words to say what to do', !createStaffTaskSchema.safeParse({ domesticStaffId: cleaner.id, title: 'x' }).success);
    check('a good task passes', createStaffTaskSchema.safeParse({ domesticStaffId: cleaner.id, title: 'Clean the lobby', location: 'Main gate' }).success);

    // ---- giving a task ----
    const task = await createTask(societyId, { id: guard.id }, { domesticStaffId: cleaner.id, title: 'Clean the lobby', blockId: block.id, location: 'Ground floor' });
    const created = take();
    check('a guard can give a task: it starts as ASSIGNED', task.status === 'ASSIGNED' && task.createdById === guard.id);
    check('the staff member is told at once, loudly, with what and where', created.length === 1 && created[0].kind === 'staff' && created[0].to === cleaner.id && created[0].urgent === true && created[0].data?.type === 'STAFF_TASK_NEW' && created[0].body.includes('Clean the lobby') && created[0].body.includes('Tower A'));
    const byAdmin = await createTask(societyId, { id: admin.id }, { domesticStaffId: gardener.id, title: 'Water the lawn' });
    take();
    check('the admin can give tasks too', byAdmin.createdById === admin.id);
    check('a staff member who does not use the staff app is refused (call them instead)', (await status(() => createTask(societyId, { id: guard.id }, { domesticStaffId: noApp.id, title: 'Clean' }))) === 409);
    check('a switched-off staff member is refused', (await status(() => createTask(societyId, { id: guard.id }, { domesticStaffId: off.id, title: 'Clean' }))) === 409);
    check('staff of another society are not found', (await status(() => createTask(societyId, { id: guard.id }, { domesticStaffId: foreign.id, title: 'Clean' }))) === 404);
    check('a block of another society is refused', (await status(() => createTask(societyId, { id: guard.id }, { domesticStaffId: cleaner.id, title: 'Clean', blockId: foreignBlock.id }))) !== 200);

    // ---- the staff member's side ----
    check('they see their own tasks and nobody else does', (await tasksForStaff(cleaner.id)).some((t) => t.id === task.id) && !(await tasksForStaff(gardener.id)).some((t) => t.id === task.id));
    check('another staff member cannot accept it', (await status(() => acceptTask(gardener.id, task.id))) === 404);
    const accepted = await acceptTask(cleaner.id, task.id);
    const afterAccept = take();
    check('accepting moves it to ACCEPTED', accepted.status === 'ACCEPTED' && !!accepted.acceptedAt);
    check('the guard who gave it is told, quietly', afterAccept.length === 1 && afterAccept[0].kind === 'user' && afterAccept[0].to === guard.id && afterAccept[0].urgent === false && /accepted/.test(afterAccept[0].title));
    check('accepting twice is harmless and does not notify again', (await acceptTask(cleaner.id, task.id)).status === 'ACCEPTED' && take().length === 0);
    const done = await finishTask(cleaner.id, task.id);
    const afterDone = take();
    check('marking it done moves it to DONE', done.status === 'DONE' && !!done.doneAt);
    check('the guard is told it is done', afterDone.length === 1 && afterDone[0].to === guard.id && /is done/.test(afterDone[0].title));
    check('finishing twice is harmless', (await finishTask(cleaner.id, task.id)).status === 'DONE' && take().length === 0);
    check('a finished task cannot be accepted again', (await status(() => acceptTask(cleaner.id, task.id))) === 409);

    // ---- done without accepting first ----
    const quick = await createTask(societyId, { id: guard.id }, { domesticStaffId: cleaner.id, title: 'Pick up the garbage' });
    take();
    check('a staff member may finish a task straight away without accepting', (await finishTask(cleaner.id, quick.id)).status === 'DONE');
    take();

    // ---- cancelling ----
    const t2 = await createTask(societyId, { id: guard.id }, { domesticStaffId: cleaner.id, title: 'Wipe the stairs' });
    take();
    check('another guard cannot cancel it (403)', (await status(() => cancelTask(societyId, t2.id, { id: guard2.id, role: 'GUARD' }))) === 403);
    const cancelled = await cancelTask(societyId, t2.id, { id: guard.id, role: 'GUARD' });
    const afterCancel = take();
    check('the guard who gave it can cancel it', cancelled.status === 'CANCELLED');
    check('the staff member is told it was cancelled', afterCancel.length === 1 && afterCancel[0].kind === 'staff' && afterCancel[0].data?.type === 'STAFF_TASK_CANCELLED');
    check('a cancelled task cannot be accepted', (await status(() => acceptTask(cleaner.id, t2.id))) === 409);
    check('a finished task cannot be cancelled (409)', (await status(() => cancelTask(societyId, task.id, { id: admin.id, role: 'ADMIN' }))) === 409);
    const t3 = await createTask(societyId, { id: guard.id }, { domesticStaffId: cleaner.id, title: 'Clear the drain' });
    take();
    check('the admin can cancel a task a guard gave', (await cancelTask(societyId, t3.id, { id: admin.id, role: 'ADMIN' })).status === 'CANCELLED');
    take();

    // ---- the list ----
    const open = await listTasks(societyId, 'open');
    check('the open list has only what is still to do', open.every((t) => ['ASSIGNED', 'ACCEPTED'].includes(t.status)) && open.some((t) => t.id === byAdmin.id) && !open.some((t) => t.id === task.id));
    check('the full list also has what was finished or cancelled recently', (await listTasks(societyId, 'all')).some((t) => t.id === task.id) && (await listTasks(societyId, 'all')).some((t) => t.id === t2.id));
    check('a task shows the staff member, who gave it and where', open[0].domesticStaff.name.length > 0 && open[0].createdBy.name.length > 0);

    // ---- reminder when nobody accepts ----
    const stale = await createTask(societyId, { id: guard.id }, { domesticStaffId: cleaner.id, title: 'Sweep the parking' });
    take();
    await prisma.staffTask.update({ where: { id: stale.id }, data: { createdAt: new Date(Date.now() - 11 * 60_000) } });
    const fresh = await createTask(societyId, { id: guard.id }, { domesticStaffId: cleaner.id, title: 'Fresh task' });
    take();
    check('after 10 minutes the one who gave it is reminded, once', (await remindUnacceptedTasks()) === 1);
    const reminder = take();
    check('the reminder goes to the giver and names the staff member', reminder.length === 1 && reminder[0].to === guard.id && reminder[0].body.includes('Sunita Sweeper'));
    check('it is not repeated', (await remindUnacceptedTasks()) === 0);
    check('a task that is only a minute old is left alone', (await prisma.staffTask.findUniqueOrThrow({ where: { id: fresh.id } })).remindedAt === null);
    const quiet = await createTask(societyId, { id: guard.id }, { domesticStaffId: cleaner.id, title: 'Accepted in time' });
    take();
    await acceptTask(cleaner.id, quiet.id);
    take();
    await prisma.staffTask.update({ where: { id: quiet.id }, data: { createdAt: new Date(Date.now() - 30 * 60_000) } });
    check('an accepted task is never reminded about', (await remindUnacceptedTasks()) === 0);
  } finally {
    await prisma.staffTask.deleteMany({ where: { societyId: { in: societyIds } } });
    await prisma.staffAccount.deleteMany({ where: { phone: { in: PHONES } } });
    await prisma.domesticStaff.deleteMany({ where: { phone: { in: PHONES } } });
    await prisma.block.deleteMany({ where: { societyId: { in: societyIds } } });
    await prisma.user.deleteMany({ where: { phone: { in: PHONES } } });
    await prisma.society.deleteMany({ where: { id: { in: societyIds } } });
    await prisma.$disconnect();
  }
  console.log(failed ? `\n${failed} FAILED` : '\nAll passed');
  process.exit(failed ? 1 : 0);
})();
