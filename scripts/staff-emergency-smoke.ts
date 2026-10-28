/**
 * The domestic staff app (maids, cooks, drivers) hears about the "tell everyone" emergencies, with no names, and
 * hears when they end. Builds a throwaway society; push delivery is captured, nothing leaves the server.
 * Run: npx ts-node --transpile-only scripts/staff-emergency-smoke.ts
 */
import 'dotenv/config';
import { prisma } from '../src/utils/Client';
import '../src/listeners/notification.listener';
import { EmergencyService } from '../src/modules/emergency/emergency.service';
import { pushService } from '../src/services/push.service';

const service = new EmergencyService();
let failed = 0;
const check = (name: string, ok: boolean, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!ok) failed += 1; };
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const PHONES = ['9000000701', '9000000702', '9000000703', '9000000704', '9000000705', '9000000706'];
const [GUARD_PHONE, RESIDENT_PHONE, ADMIN_PHONE, STAFF_A, STAFF_B, STAFF_OFF] = PHONES;

type Call = { ids: string[]; title: string; body: string; data?: Record<string, string>; urgent?: boolean };
const calls: Call[] = [];
(pushService as any).sendToStaffMembers = async (ids: string[], payload: Omit<Call, 'ids'>) => { calls.push({ ids, ...payload }); };

(async () => {
  let societyId = '';
  let otherSocietyId = '';
  try {
    await prisma.staffAccount.deleteMany({ where: { phone: { in: PHONES } } });
    await prisma.domesticStaff.deleteMany({ where: { phone: { in: PHONES } } });
    await prisma.user.deleteMany({ where: { phone: { in: PHONES } } });
    const mk = (name: string) => prisma.society.create({ data: { name, address: 'x', city: 'Test', state: 'Test', pincode: '000000', contactName: 'c', contactPhone: '9000000799', isActive: true, nextDueDate: new Date() } });
    societyId = (await mk('Staff Emergency Test Society')).id;
    otherSocietyId = (await mk('Staff Emergency Other Society')).id;
    const block = await prisma.block.create({ data: { societyId, name: 'A' } });
    const flat = await prisma.flat.create({ data: { societyId, blockId: block.id, flatNumber: '101', isOccupied: true } });
    const guard = await prisma.user.create({ data: { name: 'Gate Guard', phone: GUARD_PHONE, role: 'GUARD', societyId, isActive: true } });
    const resident = await prisma.user.create({ data: { name: 'Priya Resident', phone: RESIDENT_PHONE, role: 'RESIDENT', societyId, flatId: flat.id, isActive: true } });
    const admin = await prisma.user.create({ data: { name: 'Admin', phone: ADMIN_PHONE, role: 'ADMIN', societyId, isActive: true } });

    const mkStaff = async (phone: string, soc: string, isActive = true) => {
      const s = await prisma.domesticStaff.create({ data: { name: 'Staff ' + phone, phone, staffType: 'MAID', societyId: soc, qrToken: 'qr-' + phone, addedById: admin.id, isActive } });
      await prisma.staffAccount.create({ data: { domesticStaffId: s.id, phone, isActive } });
      return s;
    };
    const a = await mkStaff(STAFF_A, societyId);
    const b = await mkStaff(STAFF_B, societyId);
    const off = await mkStaff(STAFF_OFF, societyId, false);
    const foreign = await prisma.domesticStaff.create({ data: { name: 'Elsewhere', phone: '9000000707', staffType: 'COOK', societyId: otherSocietyId, qrToken: 'qr-9000000707', addedById: admin.id } });
    await prisma.staffAccount.create({ data: { domesticStaffId: foreign.id, phone: '9000000707' } });

    const settle = async () => { await wait(1500); const taken = calls.splice(0); return taken; };
    const resolveAll = () => prisma.emergency.updateMany({ where: { societyId }, data: { status: 'RESOLVED' } });

    // ---- who hears about a new emergency ----
    await service.createEmergency({ type: 'FIRE', description: 'Smoke on the 3rd floor', blockId: block.id }, resident.id, societyId);
    const fire = await settle();
    check('a big emergency (fire) is sent to the staff app once', fire.length === 1);
    check('to the active staff of this society only (not inactive, not another society)', fire[0].ids.includes(a.id) && fire[0].ids.includes(b.id) && !fire[0].ids.includes(off.id) && !fire[0].ids.includes(foreign.id));
    check('it rings (urgent)', fire[0].urgent === true && fire[0].data?.type === 'EMERGENCY_ALERT');
    check('it names no person and no flat', !/Priya|101/.test(JSON.stringify(fire[0])));
    check('it says what and roughly where', /fire/i.test(fire[0].body) && fire[0].body.includes('near A'));
    await resolveAll();

    await service.createEmergency({ type: 'LIFT_STUCK', description: 'Lift stuck' }, resident.id, societyId);
    check('a light emergency (lift stuck) is NOT sent to the staff app', (await settle()).length === 0);
    await resolveAll();

    await service.createEmergency({ type: 'HARASSMENT', description: 'Followed', blockId: block.id }, resident.id, societyId);
    check('a harassment alarm is never sent to the staff app', (await settle()).length === 0);
    await resolveAll();

    await service.createEmergency({ type: 'OTHER', description: 'Power cut' }, guard.id, societyId);
    const byGuard = await settle();
    check('anything raised by a guard goes to everyone, so the staff app too', byGuard.length === 1 && byGuard[0].ids.includes(a.id));
    await resolveAll();

    // ---- all clear ----
    const fire2 = await service.createEmergency({ type: 'FIRE', description: 'Smoke' }, resident.id, societyId);
    await settle();
    await service.resolveEmergency(fire2.id, 'Put out', admin.id, societyId);
    const clear = await settle();
    check('when a big emergency is resolved, the staff app is told it is over (quietly)', clear.length === 1 && clear[0].urgent === false && clear[0].data?.type === 'EMERGENCY_ALL_CLEAR' && clear[0].ids.includes(a.id));

    const lift = await service.createEmergency({ type: 'LIFT_STUCK', description: 'Lift' }, resident.id, societyId);
    await settle();
    await service.resolveEmergency(lift.id, 'Fixed', admin.id, societyId);
    check('no all-clear for an emergency the staff app never heard about', (await settle()).length === 0);

    const h = await service.createEmergency({ type: 'HARASSMENT', description: 'Followed' }, resident.id, societyId);
    await settle();
    await service.resolveEmergency(h.id, 'Safe', admin.id, societyId);
    check('no all-clear for a harassment alarm either', (await settle()).length === 0);
  } finally {
    await prisma.notification.deleteMany({ where: { societyId } });
    await prisma.emergency.deleteMany({ where: { societyId } });
    await prisma.staffAccount.deleteMany({ where: { phone: { in: [...PHONES, '9000000707'] } } });
    await prisma.domesticStaff.deleteMany({ where: { phone: { in: [...PHONES, '9000000707'] } } });
    await prisma.userFlatMembership.deleteMany({ where: { societyId } });
    await prisma.user.updateMany({ where: { phone: { in: PHONES } }, data: { flatId: null } });
    await prisma.flat.deleteMany({ where: { societyId } });
    await prisma.block.deleteMany({ where: { societyId } });
    await prisma.user.deleteMany({ where: { phone: { in: PHONES } } });
    await prisma.society.deleteMany({ where: { id: { in: [societyId, otherSocietyId] } } });
    await prisma.$disconnect();
  }
  console.log(failed ? `\n${failed} FAILED` : '\nAll passed');
  process.exit(failed ? 1 : 0);
})();
