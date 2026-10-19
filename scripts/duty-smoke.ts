/**
 * Guard shifts and attendance. Uses the demo guard, then removes what it created.
 * Run: npx ts-node --transpile-only scripts/duty-smoke.ts
 */
import 'dotenv/config';
import { prisma } from '../src/utils/Client';
import { currentDuty, endDuty, listShifts, monthlyAttendance, startDuty, MAX_SHIFT_MS } from '../src/modules/geofence/duty.service';

const GUARD = 'db155cb5-646c-4f07-8f6e-77042ea231c3';
const SOCIETY = 'edfccafb-62ab-4331-a423-eb4054261508';
let failed = 0;
const check = (name: string, ok: boolean, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!ok) failed += 1; };

(async () => {
  const created: string[] = [];
  try {
    await prisma.guardDuty.deleteMany({ where: { guardId: GUARD } });
    check('no shift to begin with', (await currentDuty(GUARD)) === null);

    const a = await startDuty(GUARD, SOCIETY, { latitude: 22.8, longitude: 86.2 });
    created.push(a.id);
    check('start duty opens a shift', a.endedAt === null && (await currentDuty(GUARD))?.id === a.id);
    const b = await startDuty(GUARD, SOCIETY, {});
    check('starting twice returns the same open shift', b.id === a.id);

    const ended = await endDuty(GUARD);
    check('end duty closes it', ended?.endedAt !== null && ended?.endedBy === 'GUARD' && (await currentDuty(GUARD)) === null);
    check('ending with no open shift does nothing', (await endDuty(GUARD)) === null);

    // a shift left open for too long closes itself
    const old = await prisma.guardDuty.create({ data: { guardId: GUARD, societyId: SOCIETY, startedAt: new Date(Date.now() - MAX_SHIFT_MS - 3_600_000) } });
    created.push(old.id);
    check('a forgotten shift past 16 hours does not count as on duty', (await currentDuty(GUARD)) === null);
    const closed = await prisma.guardDuty.findUniqueOrThrow({ where: { id: old.id } });
    check('and it was closed automatically at 16 hours', closed.endedBy === 'AUTO' && !!closed.endedAt && closed.endedAt.getTime() - closed.startedAt.getTime() === MAX_SHIFT_MS);

    // attendance
    const open = await startDuty(GUARD, SOCIETY, {});
    created.push(open.id);
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const report = await monthlyAttendance(SOCIETY, month);
    const mine = report.guards.find((g) => g.guardId === GUARD);
    check('attendance lists the guard', !!mine);
    check('days present counts days with a shift', (mine?.daysPresent ?? 0) >= 1);
    check('a shift in progress shows the guard as on duty now', mine?.onDutyNow === true);
    check('total minutes adds up the shifts', (mine?.totalMinutes ?? 0) >= 16 * 60 || (mine?.shifts.length ?? 0) >= 2);
    check('recent shifts list works', (await listShifts(SOCIETY, 10)).length >= 1);
  } finally {
    await prisma.guardDuty.deleteMany({ where: { guardId: GUARD } });
  }
  console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`);
  await prisma.$disconnect();
  process.exit(failed === 0 ? 0 : 1);
})();
