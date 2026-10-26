/**
 * An emergency raised by the gate or the admin reaches everyone; a guard who also lives here raises it as a guard.
 * Builds a throwaway society (nobody has a push token, so nothing leaves the server), then removes it.
 * Run: npx ts-node --transpile-only scripts/emergency-audience-smoke.ts
 */
import 'dotenv/config';
import { prisma } from '../src/utils/Client';
import '../src/listeners/notification.listener';
import { EmergencyService } from '../src/modules/emergency/emergency.service';

const service = new EmergencyService();
let failed = 0;
const check = (name: string, ok: boolean, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!ok) failed += 1; };
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const PHONES = ['9000000501', '9000000502', '9000000503', '9000000504', '9000000505'];
const [GUARD_PHONE, ADMIN_PHONE, FAR_RESIDENT_PHONE, NEAR_RESIDENT_PHONE, DUAL_PHONE] = PHONES;

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
