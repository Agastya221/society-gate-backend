/**
 * The society admin hands the admin role to another number. Builds a throwaway society, then removes it.
 * Run: npx ts-node --transpile-only scripts/admin-handoff-smoke.ts
 */
import 'dotenv/config';
import { prisma } from '../src/utils/Client';
import { handoffAdminRole } from '../src/modules/admin/admin-handoff.service';

let failed = 0;
const check = (name: string, ok: boolean, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!ok) failed += 1; };
const refuses = async (name: string, fn: () => Promise<unknown>, status: number) => {
  try { await fn(); check(name, false, 'did not refuse'); } catch (e: any) { check(name, (e?.statusCode ?? e?.status) === status, `(${e?.statusCode ?? e?.status}: ${e?.message})`); }
};

const PHONES = ['9000000101', '9000000102', '9000000103', '9000000104', '9000000105', '9000000106', '9000000107'];

(async () => {
  const societies: string[] = [];
  try {
    await prisma.user.deleteMany({ where: { phone: { in: PHONES } } });
    const mk = async (name: string) => {
      const s = await prisma.society.create({ data: { name, address: 'x', city: 'Test', state: 'Test', pincode: '000000', contactName: 'c', contactPhone: '9000000199', isActive: true, nextDueDate: new Date() } });
      societies.push(s.id);
      return s;
    };
    const society = await mk('Handoff Test Society');
    const other = await mk('Handoff Other Society');

    // 1. an admin with no flat hands over to a brand-new number
    const a1 = await prisma.user.create({ data: { name: 'Admin One', phone: PHONES[0], role: 'ADMIN', societyId: society.id, isActive: true, refreshToken: 'x' } });
    await prisma.userFlatMembership.create({ data: { userId: a1.id, societyId: society.id, role: 'ADMIN', isActive: true, isDefault: true } });

    await refuses('own number is refused', () => handoffAdminRole(society.id, a1.id, { phone: PHONES[0], name: 'Me' }), 400);
    await prisma.user.create({ data: { name: 'Super', phone: PHONES[5], role: 'SUPER_ADMIN', isActive: true } });
    await refuses('a super admin number is refused', () => handoffAdminRole(society.id, a1.id, { phone: PHONES[5], name: 'S' }), 400);
    await prisma.user.create({ data: { name: 'Guard', phone: PHONES[6], role: 'GUARD', societyId: society.id, isActive: true } });
    await refuses('a guard number is refused', () => handoffAdminRole(society.id, a1.id, { phone: PHONES[6], name: 'G' }), 409);
    await prisma.user.create({ data: { name: 'Elsewhere', phone: PHONES[4], role: 'RESIDENT', societyId: other.id, isActive: true } });
    await refuses('a person of another society is refused', () => handoffAdminRole(society.id, a1.id, { phone: PHONES[4], name: 'E' }), 409);
    const plain = await prisma.user.create({ data: { name: 'Plain', phone: PHONES[3], role: 'RESIDENT', societyId: society.id, isActive: true } });
    await refuses('a non-admin cannot hand over', () => handoffAdminRole(society.id, plain.id, { phone: PHONES[1], name: 'X' }), 403);

    const r1 = await handoffAdminRole(society.id, a1.id, { phone: PHONES[1], name: 'New Admin' });
    const n1 = await prisma.user.findUniqueOrThrow({ where: { phone: PHONES[1] } });
    check('new number becomes an active admin of the society', n1.role === 'ADMIN' && n1.societyId === society.id && n1.isActive && n1.flatId === null);
    const m1 = await prisma.userFlatMembership.findMany({ where: { userId: n1.id, societyId: society.id, role: 'ADMIN', isActive: true } });
    check('and gets the admin context as default', m1.length === 1 && m1[0].isDefault && m1[0].flatId === null);
    const o1 = await prisma.user.findUniqueOrThrow({ where: { id: a1.id } });
    check('old admin with no flat leaves the society and can onboard again', o1.role === 'RESIDENT' && o1.societyId === null && !o1.isActive && o1.refreshToken === null && o1.tokenVersion === 0);
    check('old admin has no active admin membership left', (await prisma.userFlatMembership.count({ where: { userId: a1.id, role: 'ADMIN', isActive: true } })) === 0);
    check('society contact moved to the new admin', (await prisma.society.findUniqueOrThrow({ where: { id: society.id } })).contactPhone === PHONES[1]);
    check('result says the old admin did not stay', r1.oldAdminStaysAsResident === false);
    await refuses('the old admin can no longer hand over again', () => handoffAdminRole(society.id, a1.id, { phone: PHONES[2], name: 'Y' }), 403);

    // 2. an admin who also lives in a flat stays as a resident of it; the new admin is an existing resident
    const block = await prisma.block.create({ data: { societyId: society.id, name: 'A' } });
    const flat = await prisma.flat.create({ data: { societyId: society.id, blockId: block.id, flatNumber: '101', isOccupied: true } });
    const flat2 = await prisma.flat.create({ data: { societyId: society.id, blockId: block.id, flatNumber: '102', isOccupied: true } });
    await prisma.userFlatMembership.create({ data: { userId: n1.id, societyId: society.id, flatId: flat.id, role: 'RESIDENT', residentType: 'OWNER', isOwner: true, isPrimary: true, isActive: true, isDefault: false } });
    const res = await prisma.user.create({ data: { name: 'Resident Raj', phone: PHONES[2], role: 'RESIDENT', societyId: society.id, flatId: flat2.id, isActive: true } });
    await prisma.userFlatMembership.create({ data: { userId: res.id, societyId: society.id, flatId: flat2.id, role: 'RESIDENT', residentType: 'TENANT', isPrimary: true, isActive: true, isDefault: true } });

    const r2 = await handoffAdminRole(society.id, n1.id, { phone: PHONES[2], name: 'Ignored Name' });
    const n2 = await prisma.user.findUniqueOrThrow({ where: { id: res.id } });
    check('existing resident is promoted and keeps his name', n2.role === 'ADMIN' && n2.name === 'Resident Raj' && n2.flatId === null && n2.societyId === society.id);
    const ms = await prisma.userFlatMembership.findMany({ where: { userId: res.id, isActive: true } });
    check('he has both an admin context (default) and his flat as a resident', ms.length === 2 && ms.some((m) => m.role === 'ADMIN' && m.isDefault) && ms.some((m) => m.flatId === flat2.id && m.role === 'RESIDENT' && !m.isDefault));
    const o2 = await prisma.user.findUniqueOrThrow({ where: { id: n1.id } });
    check('old admin who lives here steps back to his flat as a resident', o2.role === 'RESIDENT' && o2.flatId === flat.id && o2.societyId === society.id && o2.isActive && r2.oldAdminStaysAsResident);
    check('his flat membership is now the default', (await prisma.userFlatMembership.findFirstOrThrow({ where: { userId: n1.id, flatId: flat.id } })).isDefault);
  } finally {
    const users = await prisma.user.findMany({ where: { phone: { in: PHONES } }, select: { id: true } });
    const ids = users.map((u) => u.id);
    await prisma.userFlatMembership.deleteMany({ where: { OR: [{ userId: { in: ids } }, { societyId: { in: societies } }] } });
    await prisma.user.updateMany({ where: { id: { in: ids } }, data: { flatId: null } });
    await prisma.flat.deleteMany({ where: { societyId: { in: societies } } });
    await prisma.block.deleteMany({ where: { societyId: { in: societies } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.society.deleteMany({ where: { id: { in: societies } } });
    await prisma.$disconnect();
  }
  console.log(failed ? `\n${failed} FAILED` : '\nAll passed');
  process.exit(failed ? 1 : 0);
})();
