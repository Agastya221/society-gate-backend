/**
 * Delivery watch: guards are reminded about deliveries inside for 15+ minutes, the guard can poke the flat or get its
 * resident's number. Builds a throwaway society (nobody has a push token, so nothing is sent out), then removes it.
 * Run: npx ts-node --transpile-only scripts/delivery-overstay-smoke.ts
 */
import 'dotenv/config';
import { prisma } from '../src/utils/Client';
import { flatContact, nudgeFlat, remindOverstayingDeliveries } from '../src/modules/gate-scan/overstay.service';

let failed = 0;
const check = (name: string, ok: boolean, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!ok) failed += 1; };
const status = async (fn: () => Promise<unknown>) => { try { await fn(); return 200; } catch (e: any) { return e?.statusCode ?? e?.status ?? 500; } };

const PHONES = ['9000000401', '9000000402'];

(async () => {
  let societyId = '';
  let otherSocietyId = '';
  try {
    await prisma.user.deleteMany({ where: { phone: { in: PHONES } } });
    const mkSociety = (name: string) => prisma.society.create({ data: { name, address: 'x', city: 'Test', state: 'Test', pincode: '000000', contactName: 'c', contactPhone: '9000000499', isActive: true, nextDueDate: new Date() } });
    societyId = (await mkSociety('Overstay Test Society')).id;
    otherSocietyId = (await mkSociety('Overstay Other Society')).id;
    const block = await prisma.block.create({ data: { societyId, name: 'A' } });
    const flat = await prisma.flat.create({ data: { societyId, blockId: block.id, flatNumber: '101', isOccupied: true } });
    const guard = await prisma.user.create({ data: { name: 'Gate Guard', phone: PHONES[0], role: 'GUARD', societyId, isActive: true } });
    const resident = await prisma.user.create({ data: { name: 'Ravi Resident', phone: PHONES[1], role: 'RESIDENT', societyId, flatId: flat.id, isActive: true } });
    await prisma.userFlatMembership.create({ data: { userId: resident.id, societyId, flatId: flat.id, role: 'RESIDENT', residentType: 'OWNER', isOwner: true, isPrimary: true, isActive: true, isDefault: true } });

    const now = new Date();
    const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000);
    const entry = (name: string, type: 'DELIVERY' | 'CAB', minutes: number, extra: Record<string, unknown> = {}) =>
      prisma.entry.create({ data: { type, status: 'CHECKED_IN', visitorName: name, companyName: name, societyId, flatId: flat.id, createdById: guard.id, checkInTime: ago(minutes), ...extra } });
    const late = await entry('Zomato', 'DELIVERY', 20);
    const fresh = await entry('Swiggy', 'DELIVERY', 5);
    const forgotten = await entry('Amazon', 'DELIVERY', 240);
    const cab = await entry('Ola', 'CAB', 30);
    const gone = await entry('Flipkart', 'DELIVERY', 25, { status: 'CHECKED_OUT', checkOutTime: ago(2) });
    const alerted = (id: string) => prisma.entry.findUniqueOrThrow({ where: { id }, select: { overstayAlertedAt: true } }).then((e) => e.overstayAlertedAt);

    // ---- the reminder ----
    check('one delivery is due: the one inside for 20 min', (await remindOverstayingDeliveries(now)) === 1);
    check('it is marked as reminded', (await alerted(late.id)) !== null);
    check('a delivery inside for only 5 min is left alone', (await alerted(fresh.id)) === null);
    check('a stay of 4 hours is treated as a forgotten exit, no reminder', (await alerted(forgotten.id)) === null);
    check('a cab is not part of the delivery watch', (await alerted(cab.id)) === null);
    check('a delivery that already left is not reminded', (await alerted(gone.id)) === null);
    check('running again straight away does not remind twice', (await remindOverstayingDeliveries(now)) === 0);
    const later = new Date(now.getTime() + 16 * 60_000);
    check('16 minutes on, the same delivery is reminded again', (await remindOverstayingDeliveries(later)) >= 1);
    check('and the 5-minute delivery is due by then too', (await alerted(fresh.id)) !== null);

    // ---- poke the flat ----
    check('the guard can poke the flat about someone inside', (await nudgeFlat(late.id, societyId, now)).sent === true);
    check('poking again right away is refused (429)', (await status(() => nudgeFlat(late.id, societyId, new Date(now.getTime() + 30_000)))) === 429);
    check('two minutes later it works again', (await nudgeFlat(late.id, societyId, new Date(now.getTime() + 125_000))).sent === true);
    check('someone who already left cannot be poked about (409)', (await status(() => nudgeFlat(gone.id, societyId, now))) === 409);
    check('another society\'s guard cannot poke this entry (404)', (await status(() => nudgeFlat(late.id, otherSocietyId, now))) === 404);

    // ---- who to call ----
    const contact = await flatContact(late.id, societyId, guard.id);
    check('the guard gets the flat\'s primary resident to call', contact.contact?.name === 'Ravi Resident' && contact.contact.phone === PHONES[1]);
    check('another society gets nothing (404)', (await status(() => flatContact(late.id, otherSocietyId, guard.id))) === 404);
  } finally {
    await prisma.entry.deleteMany({ where: { societyId: { in: [societyId, otherSocietyId] } } });
    await prisma.userFlatMembership.deleteMany({ where: { societyId: { in: [societyId, otherSocietyId] } } });
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
