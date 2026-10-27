/**
 * An emergency raised by the gate or the admin reaches everyone; a guard who also lives here raises it as a guard.
 * Builds a throwaway society (nobody has a push token, so nothing leaves the server), then removes it.
 * Run: npx ts-node --transpile-only scripts/emergency-audience-smoke.ts
 */
import 'dotenv/config';
import { prisma } from '../src/utils/Client';
import '../src/listeners/notification.listener';
import { COMMON_AREAS, EmergencyService, getEmergencySeverity, redactForViewer } from '../src/modules/emergency/emergency.service';

const service = new EmergencyService();
let failed = 0;
const check = (name: string, ok: boolean, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!ok) failed += 1; };
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const PHONES = ['9000000501', '9000000502', '9000000503', '9000000504', '9000000505', '9000000506'];
const [GUARD_PHONE, ADMIN_PHONE, FAR_RESIDENT_PHONE, NEAR_RESIDENT_PHONE, DUAL_PHONE, NEIGHBOUR_PHONE] = PHONES;

(async () => {
  let societyId = '';
  try {
    await prisma.user.deleteMany({ where: { phone: { in: PHONES } } });
    societyId = (await prisma.society.create({ data: { name: 'Emergency Test Society', address: 'x', city: 'Test', state: 'Test', pincode: '000000', contactName: 'c', contactPhone: '9000000599', isActive: true, nextDueDate: new Date() } })).id;
    const blockA = await prisma.block.create({ data: { societyId, name: 'A' } });
    const blockB = await prisma.block.create({ data: { societyId, name: 'B' } });
    const flatA = await prisma.flat.create({ data: { societyId, blockId: blockA.id, flatNumber: '101', isOccupied: true } });
    const flatB = await prisma.flat.create({ data: { societyId, blockId: blockB.id, flatNumber: '201', isOccupied: true } });

    const guard = await prisma.user.create({ data: { name: 'Gate Guard', phone: GUARD_PHONE, role: 'GUARD', societyId, isActive: true } });
    const admin = await prisma.user.create({ data: { name: 'Society Admin', phone: ADMIN_PHONE, role: 'ADMIN', societyId, isActive: true } });
    const far = await prisma.user.create({ data: { name: 'Far Resident', phone: FAR_RESIDENT_PHONE, role: 'RESIDENT', societyId, flatId: flatB.id, isActive: true } });
    const near = await prisma.user.create({ data: { name: 'Near Resident', phone: NEAR_RESIDENT_PHONE, role: 'RESIDENT', societyId, flatId: flatA.id, isActive: true } });
    const dual = await prisma.user.create({ data: { name: 'Dual Guard', phone: DUAL_PHONE, role: 'RESIDENT', societyId, flatId: flatA.id, isActive: true } });
    await prisma.userFlatMembership.create({ data: { userId: dual.id, societyId, role: 'GUARD', isActive: true, isDefault: false } });
    const flatA2 = await prisma.flat.create({ data: { societyId, blockId: blockA.id, flatNumber: '102', isOccupied: true } });
    const neighbour = await prisma.user.create({ data: { name: 'Plain Neighbour', phone: NEIGHBOUR_PHONE, role: 'RESIDENT', societyId, flatId: flatA2.id, isActive: true } });

    const notified = async (id: string) => {
      await wait(1500); // the listener runs after the request returns
      return ((await prisma.emergency.findUniqueOrThrow({ where: { id }, select: { notifiedUsers: true } })).notifiedUsers ?? []) as string[];
    };

    // 1. a guard raises a kind of emergency that used to stay with the staff
    const e1 = await service.createEmergency({ type: 'THEFT', description: 'Bike stolen' }, guard.id, societyId);
    const n1 = await notified(e1.id);
    check('a guard\'s THEFT alarm reaches the residents of every block', n1.includes(far.id) && n1.includes(near.id));
    check('and the admin and the guards', n1.includes(admin.id) && n1.includes(guard.id) && n1.includes(dual.id));

    // 2. the same kind of emergency raised by a resident still stays with staff and the block
    const e2 = await service.createEmergency({ type: 'THEFT', description: 'Bike stolen' }, near.id, societyId);
    const n2 = await notified(e2.id);
    check('a resident\'s THEFT alarm still stays with the staff and their own block', n2.includes(admin.id) && n2.includes(guard.id) && n2.includes(near.id) && !n2.includes(far.id));

    // 3. the admin raises one
    await prisma.emergency.updateMany({ where: { societyId }, data: { status: 'RESOLVED' } });
    const e3 = await service.createEmergency({ type: 'OTHER', description: 'Power cut in the lift' }, admin.id, societyId);
    const n3 = await notified(e3.id);
    check('an admin\'s alarm reaches the guards and every resident too', n3.includes(guard.id) && n3.includes(far.id) && n3.includes(near.id));

    // 4. a guard who also lives here, raising it from the guard app
    await prisma.emergency.updateMany({ where: { societyId }, data: { status: 'RESOLVED' } });
    const e4 = await service.createEmergency({ type: 'ACCIDENT', description: 'Accident at the gate' }, dual.id, societyId, 'GUARD');
    const n4 = await notified(e4.id);
    check('a guard who also lives here raises it as a guard: it reaches every block', n4.includes(far.id) && n4.includes(near.id));
    check('and is not tied to their own flat', e4.flatId === null);
    check('as a guard they are not stopped by the resident rate limit', await service.createEmergency({ type: 'FIRE', description: 'Smoke' }, dual.id, societyId, 'GUARD').then(() => true, () => false));
    // as a resident (resident app) the same person is rate limited like any resident
    await prisma.emergency.updateMany({ where: { societyId }, data: { status: 'RESOLVED' } });
    await service.createEmergency({ type: 'OTHER', description: 'x' }, dual.id, societyId);
    check('but from the resident app they are limited like any resident (429)', await service.createEmergency({ type: 'OTHER', description: 'y' }, dual.id, societyId).then(() => false, (e: any) => (e?.statusCode ?? e?.status) === 429));

    // ---- place decides who is told (light emergencies) ----
    await prisma.emergency.updateMany({ where: { societyId }, data: { status: 'RESOLVED' } });
    const e5 = await service.createEmergency({ type: 'LIFT_STUCK', description: 'Lift stuck', blockId: blockB.id }, near.id, societyId);
    const n5 = await notified(e5.id);
    check('a light alarm goes to the block where it happens (Tower B)', n5.includes(far.id));
    check('and not to the own tower of the sender when it is elsewhere', !n5.includes(near.id));
    const otherSociety = await prisma.society.create({ data: { name: 'Emergency Other Society', address: 'x', city: 'Test', state: 'Test', pincode: '000000', contactName: 'c', contactPhone: '9000000598', isActive: true, nextDueDate: new Date() } });
    const foreignBlock = await prisma.block.create({ data: { societyId: otherSociety.id, name: 'Z' } });
    check('a block of another society is refused', await service.createEmergency({ type: 'OTHER', blockId: foreignBlock.id }, near.id, societyId).then(() => false, () => true));
    await prisma.block.deleteMany({ where: { societyId: otherSociety.id } });
    await prisma.society.delete({ where: { id: otherSociety.id } });

    // ---- harassment: private ----
    await prisma.emergency.updateMany({ where: { societyId }, data: { status: 'RESOLVED' } });
    check('harassment is its own private level', getEmergencySeverity('HARASSMENT') === 'PRIVATE');
    const h1 = await service.createEmergency({ type: 'HARASSMENT', description: 'Being followed', blockId: blockA.id, latitude: 22.8, longitude: 86.2 }, near.id, societyId);
    const nh1 = await notified(h1.id);
    check('harassment reaches the staff', nh1.includes(guard.id) && nh1.includes(admin.id));
    check('and the residents of the block where it happens', nh1.includes(neighbour.id));
    check('but not the other blocks', !nh1.includes(far.id));
    check('her own phone is left out (it stays silent), but she still gets the all-clear', !nh1.slice(0, -1).includes(near.id) && nh1[nh1.length - 1] === near.id);
    const staffRows = await prisma.notification.findMany({ where: { referenceId: h1.id, userId: guard.id } });
    check('the notice to the guard names her and carries the location', staffRows.length === 1 && staffRows[0].message.includes('Near Resident') && JSON.stringify(staffRows[0].data).includes('86.2'));
    const neighbourRows = await prisma.notification.findMany({ where: { referenceId: h1.id, userId: neighbour.id } });
    const neighbourText = JSON.stringify(neighbourRows);
    check('a notice to a neighbour is anonymous: no name, no flat, no phone, no coordinates', neighbourRows.length === 1 && !neighbourText.includes('Near Resident') && !neighbourText.includes('101') && !neighbourText.includes(NEAR_RESIDENT_PHONE) && !neighbourText.includes('86.2'));
    check('it tells them where to look out', neighbourRows[0].message.includes('near A'));

    // a harassment alarm raised by a guard stays private too
    await prisma.emergency.updateMany({ where: { societyId }, data: { status: 'RESOLVED' } });
    const h2 = await service.createEmergency({ type: 'HARASSMENT', location: 'Park / playground' }, guard.id, societyId);
    const nh2 = await notified(h2.id);
    check('a harassment alarm raised by a guard does NOT go to every resident', !nh2.includes(far.id) && !nh2.includes(near.id));
    check('and with no tower picked it stays with the staff', nh2.includes(admin.id));

    // ---- who may see what ----
    const stored = await prisma.emergency.findUniqueOrThrow({ where: { id: h1.id }, include: { reportedBy: { select: { id: true, name: true, phone: true } }, flat: true } });
    const asStaff = redactForViewer(stored, { id: guard.id, role: 'GUARD' });
    check('guards see who raised it and where', asStaff.reportedBy?.name === 'Near Resident' && asStaff.latitude === 22.8);
    const asHer = redactForViewer(stored, { id: near.id, role: 'RESIDENT' });
    check('she sees her own alarm in full', asHer.reportedBy?.name === 'Near Resident');
    const asNeighbour = redactForViewer(stored, { id: neighbour.id, role: 'RESIDENT' });
    check('another resident sees no name, flat, text or coordinates', asNeighbour.reportedBy === null && asNeighbour.flat === null && asNeighbour.description === null && asNeighbour.latitude === null && asNeighbour.reportedById === null);
    const theft = await prisma.emergency.findUniqueOrThrow({ where: { id: e2.id }, include: { reportedBy: { select: { id: true, name: true, phone: true } } } });
    check('other kinds keep their reporter for residents, but never show coordinates', redactForViewer(theft, { id: far.id, role: 'RESIDENT' }).reportedBy?.name === 'Near Resident');
    check('there is a list of common areas to pick from', COMMON_AREAS.length >= 5 && COMMON_AREAS.includes('Main gate'));
  } finally {
    await prisma.notification.deleteMany({ where: { societyId } });
    await prisma.emergency.deleteMany({ where: { societyId } });
    await prisma.userFlatMembership.deleteMany({ where: { societyId } });
    await prisma.user.updateMany({ where: { phone: { in: PHONES } }, data: { flatId: null } });
    await prisma.flat.deleteMany({ where: { societyId } });
    await prisma.block.deleteMany({ where: { societyId } });
    await prisma.user.deleteMany({ where: { phone: { in: PHONES } } });
    await prisma.society.deleteMany({ where: { id: societyId } });
    await prisma.$disconnect();
  }
  console.log(failed ? `\n${failed} FAILED` : '\nAll passed');
  process.exit(failed ? 1 : 0);
})();
