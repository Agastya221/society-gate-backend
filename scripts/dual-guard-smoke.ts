/**
 * A guard who also lives in the society: guard-app access comes from the guard membership, the resident account
 * is untouched, and the two apps keep separate sessions. Builds a throwaway society, then removes it.
 * Run: npx ts-node --transpile-only scripts/dual-guard-smoke.ts
 */
import 'dotenv/config';
import { prisma } from '../src/utils/Client';
import { UserService } from '../src/modules/user/user.service';
import { generateAccessToken, generateRefreshToken, hashToken, verifyAccessTokenForUser } from '../src/services/token.service';
import { findGuardPost, guardUsersWhere, societyStaffWhere, withGuardPost } from '../src/utils/guard-access';
import { adminResidentsService } from '../src/modules/admin/admin-residents.service';

const users = new UserService();
let failed = 0;
const check = (name: string, ok: boolean, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!ok) failed += 1; };
const throws = async (fn: () => Promise<unknown>) => { try { await fn(); return false; } catch { return true; } };

const PHONES = ['9000000301', '9000000302', '9000000303', '9000000304'];
const [ADMIN_PHONE, RESIDENT_PHONE, OLD_GUARD_PHONE, OUTSIDER_PHONE] = PHONES;

(async () => {
  let societyId = '';
  try {
    await prisma.user.deleteMany({ where: { phone: { in: PHONES } } });
    const society = await prisma.society.create({ data: { name: 'Dual Guard Test Society', address: 'x', city: 'Test', state: 'Test', pincode: '000000', contactName: 'c', contactPhone: '9000000399', isActive: true, nextDueDate: new Date() } });
    societyId = society.id;
    const block = await prisma.block.create({ data: { societyId, name: 'A' } });
    const flat = await prisma.flat.create({ data: { societyId, blockId: block.id, flatNumber: '101', isOccupied: true } });

    const admin = await prisma.user.create({ data: { name: 'Admin', phone: ADMIN_PHONE, role: 'ADMIN', societyId, isActive: true } });
    const resident = await prisma.user.create({ data: { name: 'Ravi Resident', phone: RESIDENT_PHONE, role: 'RESIDENT', societyId, flatId: flat.id, isActive: true } });
    await prisma.userFlatMembership.create({ data: { userId: resident.id, societyId, flatId: flat.id, role: 'RESIDENT', residentType: 'OWNER', isOwner: true, isPrimary: true, isActive: true, isDefault: true } });
    const outsider = await prisma.user.create({ data: { name: 'Pending Person', phone: OUTSIDER_PHONE, role: 'RESIDENT', isActive: false } });

    // ---- 1. an existing resident can be made a guard too ----
    check('before: not a guard', (await findGuardPost(resident.id)) === null);
    const made = await users.createGuard({ name: 'Ravi Resident', phone: RESIDENT_PHONE }, admin.id) as any;
    check('admin can add an existing resident as a guard', made.alsoResident === true);
    const afterAdd = await prisma.user.findUniqueOrThrow({ where: { id: resident.id } });
    check('their resident account is untouched (role, flat, society)', afterAdd.role === 'RESIDENT' && afterAdd.flatId === flat.id && afterAdd.societyId === societyId && afterAdd.isActive);
    const post = await findGuardPost(resident.id);
    check('they now hold a guard post in this society', post?.societyId === societyId);
    check('adding the same person again is harmless', ((await users.createGuard({ name: 'Ravi Resident', phone: RESIDENT_PHONE }, admin.id)) as any).alsoResident === true
      && (await prisma.userFlatMembership.count({ where: { userId: resident.id, role: 'GUARD' } })) === 1);
    check('a number that is not an active resident here is refused', await throws(() => users.createGuard({ name: 'P', phone: OUTSIDER_PHONE }, admin.id)));

    // ---- 2. sessions: guard app sees a GUARD, resident app sees the RESIDENT ----
    const guardAccess = generateAccessToken(resident.id, 'GUARD', societyId, null, 'GUARD_APP');
    const residentAccess = generateAccessToken(resident.id, 'RESIDENT', societyId, flat.id, 'RESIDENT_APP');
    const g = await verifyAccessTokenForUser(guardAccess);
    check('guard-app token: acts as GUARD of the society, no flat', g.user.role === 'GUARD' && g.user.societyId === societyId && g.user.flatId === null);
    const r = await verifyAccessTokenForUser(residentAccess);
    check('resident-app token: still the RESIDENT with the flat', r.user.role === 'RESIDENT' && r.user.flatId === flat.id);
    const asGuard = await withGuardPost({ role: 'RESIDENT', societyId: null as string | null }, resident.id);
    check('gate actions see the person as a guard of the society', asGuard?.role === 'GUARD' && asGuard.societyId === societyId);
    check('but a plain resident is never turned into a guard', (await withGuardPost({ role: 'RESIDENT', societyId: societyId as string | null }, outsider.id))?.role === 'RESIDENT');

    // ---- 3. two apps, two refresh slots ----
    const guardRefresh = generateRefreshToken(resident.id, 'GUARD', societyId, null, 'GUARD_APP');
    const residentRefresh = generateRefreshToken(resident.id, 'RESIDENT', societyId, flat.id, 'RESIDENT_APP');
    await prisma.user.update({ where: { id: resident.id }, data: { guardRefreshToken: hashToken(guardRefresh), refreshToken: hashToken(residentRefresh) } });
    const gr = await users.refreshAccessToken(guardRefresh) as any;
    check('guard app refreshes its own session as a GUARD', gr.user.role === 'GUARD' && gr.user.societyId === societyId);
    const rr = await users.refreshAccessToken(residentRefresh) as any;
    check('and the resident app refreshes independently (no sign-out)', rr.user.role === 'RESIDENT' && rr.user.flatId === flat.id);
    const again = await users.refreshAccessToken(gr.refreshToken) as any;
    check('the guard session keeps rotating', !!again.accessToken);

    // ---- 4. lists and alerts include the dual guard ----
    check('the guard list includes them', (await users.getGuards(societyId)).some((x) => x.id === resident.id));
    check('guard counts include them', (await prisma.user.count({ where: { ...guardUsersWhere(societyId), isActive: true } })) === 1);
    check('staff alerts for guards reach them', (await prisma.user.findMany({ where: societyStaffWhere(societyId, ['GUARD']), select: { id: true } })).some((x) => x.id === resident.id));
    check('and alerts for residents still reach them', (await prisma.user.findMany({ where: societyStaffWhere(societyId, ['RESIDENT']), select: { id: true } })).some((x) => x.id === resident.id));

    // ---- 5. switching off the guard role leaves the resident account alone ----
    await users.toggleUserStatus(resident.id, false, societyId, admin.id, 'ADMIN', 'guard');
    const afterOff = await prisma.user.findUniqueOrThrow({ where: { id: resident.id } });
    check('guard role off: resident account still active', afterOff.isActive && afterOff.role === 'RESIDENT' && afterOff.guardRefreshToken === null);
    check('guard role off: the guard session no longer works', await throws(() => verifyAccessTokenForUser(guardAccess)));
    check('guard role off: the resident session still works', (await verifyAccessTokenForUser(residentAccess)).user.role === 'RESIDENT');
    check('guard role off: they leave the guard list', !(await users.getGuards(societyId)).some((x) => x.id === resident.id));
    await users.createGuard({ name: 'Ravi Resident', phone: RESIDENT_PHONE }, admin.id);
    check('adding them again switches the guard role back on', (await findGuardPost(resident.id))?.societyId === societyId);

    // ---- 6. an ordinary guard (role GUARD) behaves exactly as before ----
    const plain = await users.createGuard({ name: 'Old Style Guard', phone: OLD_GUARD_PHONE }, admin.id) as any;
    check('a brand-new guard is still created as GUARD', plain.role === 'GUARD' && plain.societyId === societyId);
    const plainAccess = generateAccessToken(plain.id, 'GUARD', societyId, null, 'GUARD_APP');
    check('and their guard token works', (await verifyAccessTokenForUser(plainAccess)).user.role === 'GUARD');
    // a session signed in before the separate slot existed (hash still in refreshToken) keeps working once
    const legacyRefresh = generateRefreshToken(plain.id, 'GUARD', societyId, null, 'GUARD_APP');
    await prisma.user.update({ where: { id: plain.id }, data: { refreshToken: hashToken(legacyRefresh), guardRefreshToken: null } });
    const legacy = await users.refreshAccessToken(legacyRefresh) as any;
    check('an older guard session refreshes and moves to the guard slot', !!legacy.accessToken
      && (await prisma.user.findUniqueOrThrow({ where: { id: plain.id } })).guardRefreshToken !== null);
    await users.logout(plainAccess, legacy.refreshToken);
    const loggedOut = await prisma.user.findUniqueOrThrow({ where: { id: plain.id } });
    check('guard logout clears the guard session', loggedOut.guardRefreshToken === null && loggedOut.refreshToken === null);

    // ---- 7. guard first, resident later: the admin adds the guard's number as a resident ----
    const flat2 = await prisma.flat.create({ data: { societyId, blockId: block.id, flatNumber: '102' } });
    await prisma.user.update({ where: { id: plain.id }, data: { isActive: false } });
    check('a switched-off guard cannot be added as a resident', await throws(() => adminResidentsService.create(societyId, { name: 'Old Style Guard', phone: OLD_GUARD_PHONE, flatId: flat2.id, residentType: 'OWNER' }, admin.id)));
    await prisma.user.update({ where: { id: plain.id }, data: { isActive: true } });
    await adminResidentsService.create(societyId, { name: 'Old Style Guard', phone: OLD_GUARD_PHONE, flatId: flat2.id, residentType: 'OWNER' }, admin.id);
    const both = await prisma.user.findUniqueOrThrow({ where: { id: plain.id } });
    check('the guard is now a resident of the flat as well', both.role === 'RESIDENT' && both.flatId === flat2.id && both.isActive);
    check('and keeps the guard post', (await findGuardPost(plain.id))?.societyId === societyId);
    check('the guard app still lets them in as a GUARD', (await verifyAccessTokenForUser(generateAccessToken(plain.id, 'GUARD', societyId, null, 'GUARD_APP'))).user.role === 'GUARD');
    check('the resident app works for them as a RESIDENT', (await verifyAccessTokenForUser(generateAccessToken(plain.id, 'RESIDENT', societyId, flat2.id, 'RESIDENT_APP'))).user.role === 'RESIDENT');
    check('they are still on the guard list', (await users.getGuards(societyId)).some((x) => x.id === plain.id));
  } finally {
    const ids = (await prisma.user.findMany({ where: { phone: { in: PHONES } }, select: { id: true } })).map((u) => u.id);
    await prisma.userFlatMembership.deleteMany({ where: { OR: [{ userId: { in: ids } }, { societyId }] } });
    await prisma.user.updateMany({ where: { id: { in: ids } }, data: { flatId: null } });
    await prisma.flat.deleteMany({ where: { societyId } });
    await prisma.block.deleteMany({ where: { societyId } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.society.deleteMany({ where: { id: societyId } });
    await prisma.$disconnect();
  }
  console.log(failed ? `\n${failed} FAILED` : '\nAll passed');
  process.exit(failed ? 1 : 0);
})();
