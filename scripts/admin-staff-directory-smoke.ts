/**
 * The admin's staff directory: guards with their shift, whether they are on duty and at which gate, and the other
 * staff with their flats. Builds a throwaway society, then removes it.
 * Run: npx ts-node --transpile-only scripts/admin-staff-directory-smoke.ts
 */
import 'dotenv/config';
import { prisma } from '../src/utils/Client';
import { getAdminStaffDirectory } from '../src/modules/admin/admin-staff.controller';

let failed = 0;
const check = (name: string, ok: boolean, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!ok) failed += 1; };

const PHONES = ['9000000801', '9000000802', '9000000803', '9000000804', '9000000805', '9000000806', '9000000807', '9000000808'];
const [ADMIN, G_ONE, G_TWO, G_OFF, G_FAR, G_DUAL, G_STALE, G_OTHER] = PHONES;
const STAFF_PHONE = '9000000809';

const directory = async (societyId: string) => {
  let body: any = null;
  const res: any = { status() { return res; }, json(b: unknown) { body = b; return res; } };
  await getAdminStaffDirectory({ user: { societyId } } as never, res);
  return body;
};

(async () => {
  const societyIds: string[] = [];
  try {
    await prisma.staffFlatAssignment.deleteMany({ where: { domesticStaff: { phone: STAFF_PHONE } } });
    await prisma.domesticStaff.deleteMany({ where: { phone: STAFF_PHONE } });
    await prisma.user.deleteMany({ where: { phone: { in: PHONES } } });
    const mk = async (name: string) => { const s = await prisma.society.create({ data: { name, address: 'x', city: 'Test', state: 'Test', pincode: '000000', contactName: 'c', contactPhone: '9000000899', isActive: true, nextDueDate: new Date() } }); societyIds.push(s.id); return s; };
    const society = await mk('Directory Test Society');
    const other = await mk('Directory Other Society');
    const societyId = society.id;

    const mainGate = await prisma.gatePoint.create({ data: { societyId, name: 'Main gate', latitude: 22.8, longitude: 86.2, radiusMeters: 100 } });
    await prisma.gatePoint.create({ data: { societyId, name: 'Back gate', latitude: 22.805, longitude: 86.205, radiusMeters: 100 } });
    const morning = await prisma.guardShift.create({ data: { societyId, name: 'Morning', startTime: '06:00', endTime: '14:00', graceMinutes: 10 } });
    const block = await prisma.block.create({ data: { societyId, name: 'A' } });
    const flat = await prisma.flat.create({ data: { societyId, blockId: block.id, flatNumber: '101', isOccupied: true } });

    const admin = await prisma.user.create({ data: { name: 'Admin', phone: ADMIN, role: 'ADMIN', societyId, isActive: true } });
    const mkGuard = (phone: string, name: string, extra: Record<string, unknown> = {}) => prisma.user.create({ data: { name, phone, role: 'GUARD', societyId, isActive: true, ...extra } });
    const one = await mkGuard(G_ONE, 'Guard At Main Gate', { guardShiftId: morning.id, email: 'one@example.com', lastLogin: new Date() });
    const two = await mkGuard(G_TWO, 'Guard Near Back Gate');
    const off = await mkGuard(G_OFF, 'Guard Off Duty');
    const far = await mkGuard(G_FAR, 'Guard Far Away');
    const stale = await mkGuard(G_STALE, 'Guard With Old Shift');
    const dual = await prisma.user.create({ data: { name: 'Guard Who Lives Here', phone: G_DUAL, role: 'RESIDENT', societyId, flatId: flat.id, isActive: true, guardShiftId: morning.id } });
    await prisma.userFlatMembership.create({ data: { userId: dual.id, societyId, role: 'GUARD', isActive: true, isDefault: false } });
    await prisma.user.create({ data: { name: 'Guard Of Another Society', phone: G_OTHER, role: 'GUARD', societyId: other.id, isActive: true } });

    const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);
    await prisma.guardDuty.create({ data: { guardId: one.id, societyId, gatePointId: mainGate.id, startedAt: hoursAgo(2) } });
    await prisma.guardDuty.create({ data: { guardId: two.id, societyId, startedAt: hoursAgo(1), startLatitude: 22.80502, startLongitude: 86.20499 } });
    await prisma.guardDuty.create({ data: { guardId: far.id, societyId, startedAt: hoursAgo(1), startLatitude: 22.9, startLongitude: 86.4 } });
    await prisma.guardDuty.create({ data: { guardId: stale.id, societyId, startedAt: hoursAgo(20), startLatitude: 22.8, startLongitude: 86.2 } });
    await prisma.guardDuty.create({ data: { guardId: dual.id, societyId, gatePointId: mainGate.id, startedAt: hoursAgo(1) } });
    await prisma.guardDuty.create({ data: { guardId: off.id, societyId, gatePointId: mainGate.id, startedAt: hoursAgo(10), endedAt: hoursAgo(2), endedBy: 'GUARD' } });

    const staff = await prisma.domesticStaff.create({ data: { name: 'Savita Maid', phone: STAFF_PHONE, staffType: 'MAID', societyId, qrToken: 'qr-dir-' + Date.now(), addedById: admin.id, email: 'savita@example.com', workingDays: ['MON', 'TUE'], isCurrentlyWorking: true, workStartTime: '09:00', workEndTime: '12:00', monthlyRate: 3000 } });
    await prisma.staffFlatAssignment.create({ data: { domesticStaffId: staff.id, flatId: flat.id, isActive: true } });

    const body = await directory(societyId);
    const people: any[] = body.data;
    const named = (n: string) => people.find((p) => p.name === n);

    check('the directory lists the guards of this society and not those of another', body.meta.guards === 6 && !named('Guard Of Another Society'));
    check('a guard who also lives here is listed as a guard', named('Guard Who Lives Here')?.role === 'GUARD');
    check('the other staff are listed apart, by source', named('Savita Maid')?.source === 'DOMESTIC' && body.meta.domesticStaff === 1);

    const a = named('Guard At Main Gate');
    check('a guard shows the shift they work, with times and grace', a.shift?.name === 'Morning' && a.shift.startTime === '06:00' && a.shift.endTime === '14:00' && a.shift.graceMinutes === 10);
    check('and the old shift fields are filled too (older apps)', a.shiftStart === '06:00' && a.shiftEnd === '14:00');
    check('a guard on duty shows the gate recorded when the shift started', a.dutyNow?.gate === 'Main gate' && !!a.dutyNow.since);
    check('their profile carries email and last sign-in', a.email === 'one@example.com' && !!a.lastLogin);
    check('a guard whose gate was not recorded gets the nearest gate within its radius', named('Guard Near Back Gate').dutyNow?.gate === 'Back gate');
    check('a guard on duty far from every gate is on duty with no gate named', named('Guard Far Away').dutyNow !== null && named('Guard Far Away').dutyNow.gate === null);
    check('a guard whose shift ended is off duty', named('Guard Off Duty').dutyNow === null);
    check('a shift left open for over 16 hours does not count as on duty', named('Guard With Old Shift').dutyNow === null);
    check('a guard with no shift assigned shows none', named('Guard Near Back Gate').shift === null);
    check('a guard who also lives here has their shift and duty too', named('Guard Who Lives Here').shift?.name === 'Morning' && named('Guard Who Lives Here').dutyNow?.gate === 'Main gate');

    const s = named('Savita Maid');
    check('staff show the flats they are assigned to', s.assignedFlats.includes('A-101'));
    check('and their profile: type, email, days, working hours, inside now', s.role === 'MAID' && s.email === 'savita@example.com' && s.workingDays.join() === 'MON,TUE' && s.insideNow === true && s.shiftStart === '09:00');
  } finally {
    await prisma.guardDuty.deleteMany({ where: { societyId: { in: societyIds } } });
    await prisma.staffFlatAssignment.deleteMany({ where: { domesticStaff: { phone: STAFF_PHONE } } });
    await prisma.domesticStaff.deleteMany({ where: { phone: STAFF_PHONE } });
    await prisma.userFlatMembership.deleteMany({ where: { societyId: { in: societyIds } } });
    await prisma.user.updateMany({ where: { phone: { in: PHONES } }, data: { flatId: null, guardShiftId: null } });
    await prisma.flat.deleteMany({ where: { societyId: { in: societyIds } } });
    await prisma.block.deleteMany({ where: { societyId: { in: societyIds } } });
    await prisma.guardShift.deleteMany({ where: { societyId: { in: societyIds } } });
    await prisma.gatePoint.deleteMany({ where: { societyId: { in: societyIds } } });
    await prisma.user.deleteMany({ where: { phone: { in: PHONES } } });
    await prisma.society.deleteMany({ where: { id: { in: societyIds } } });
    await prisma.$disconnect();
  }
  console.log(failed ? `\n${failed} FAILED` : '\nAll passed');
  process.exit(failed ? 1 : 0);
})();
