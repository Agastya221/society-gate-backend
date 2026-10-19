/**
 * Group visits: one request for several people, the resident can allow fewer, the entry keeps the allowed
 * number, a group leaves in parts, a wrongly addressed request moves to another flat, and a trusted
 * visitor skips the prompt. Runs against the real database with the demo society and cleans up after itself.
 * Run: npx ts-node --transpile-only scripts/group-visit-smoke.ts
 */
import 'dotenv/config';
import { prisma } from '../src/utils/Client';
import { entryRequestService } from '../src/modules/entry-request/entry-request.service';
import { approveEntryRequestSchema, checkoutEntrySchema, createEntryRequestSchema } from '../src/schemas';

const GUARD = 'db155cb5-646c-4f07-8f6e-77042ea231c3';
const RESIDENT = '79120472-69bc-4443-8c65-f04ddda9618f';
const SOCIETY = 'edfccafb-62ab-4331-a423-eb4054261508';
const FLAT = '5352aea1-5237-44cb-9dad-76fbd4406af4';

let failed = 0;
const check = (name: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
  if (!ok) failed += 1;
};
const rejects = async (fn: () => Promise<unknown>) => { try { await fn(); return false; } catch { return true; } };

(async () => {
  const requestIds: string[] = [];
  const entryIds: string[] = [];
  const PHONE = '9000000077';
  try {
    const otherFlat = await prisma.flat.findFirst({ where: { societyId: SOCIETY, isActive: true, id: { not: FLAT } }, select: { id: true } });
    check('another flat exists to move a request to', !!otherFlat);

    // validation
    check('people count 0 is refused', !createEntryRequestSchema.safeParse({ type: 'VISITOR', flatId: FLAT, peopleCount: 0 }).success);
    check('people count 21 is refused', !createEntryRequestSchema.safeParse({ type: 'VISITOR', flatId: FLAT, peopleCount: 21 }).success);
    check('approve with no body is fine', approveEntryRequestSchema.safeParse(undefined).success);
    check('checkout with no body is fine', checkoutEntrySchema.safeParse(undefined).success);

    // 1. group of 4, resident allows 2
    const created = await entryRequestService.createEntryRequest(
      { type: 'VISITOR', flatId: FLAT, visitorName: 'Smoke Group', peopleCount: 4, vehicleNumber: 'JH05AB1234' }, GUARD);
    const req1 = created.entryRequest as { id: string; peopleCount: number; vehicleNumber: string };
    requestIds.push(req1.id);
    check('request stores people count and vehicle', req1.peopleCount === 4 && req1.vehicleNumber === 'JH05AB1234');
    check('cannot allow more people than arrived', await rejects(() => entryRequestService.approveEntryRequest(req1.id, RESIDENT, { count: 5 })));
    const approved = await entryRequestService.approveEntryRequest(req1.id, RESIDENT, { count: 2 }) as { approvedCount: number | null };
    check('approving 2 of 4 stores approvedCount 2', approved.approvedCount === 2);
    const admitted = await entryRequestService.admitEntryRequest(req1.id, GUARD);
    entryIds.push(admitted.entry.id);
    check('entry records the 2 that were allowed', admitted.entry.peopleCount === 2 && admitted.entry.vehicleNumber === 'JH05AB1234');

    // 2. group leaves in parts
    const one = await prisma.entry.findUniqueOrThrow({ where: { id: admitted.entry.id } });
    check('new entry starts with nobody out', one.peopleLeft === 0 && one.status === 'CHECKED_IN');

    // 3. approving everyone leaves approvedCount null
    const c2 = await entryRequestService.createEntryRequest({ type: 'VISITOR', flatId: FLAT, visitorName: 'Smoke All', peopleCount: 3 }, GUARD);
    const r2 = (c2.entryRequest as { id: string }).id;
    requestIds.push(r2);
    const a2 = await entryRequestService.approveEntryRequest(r2, RESIDENT, { count: 3 }) as { approvedCount: number | null };
    check('allowing everyone keeps approvedCount empty', a2.approvedCount === null);
    const ad2 = await entryRequestService.admitEntryRequest(r2, GUARD);
    entryIds.push(ad2.entry.id);
    check('entry records all 3', ad2.entry.peopleCount === 3);

    // 4. move to another flat
    if (otherFlat) {
      const c3 = await entryRequestService.createEntryRequest({ type: 'VISITOR', flatId: FLAT, visitorName: 'Smoke Move', peopleCount: 2 }, GUARD);
      const r3 = (c3.entryRequest as { id: string }).id;
      requestIds.push(r3);
      check('cannot move to the same flat', await rejects(() => entryRequestService.moveEntryRequest(r3, GUARD, FLAT)));
      const moved = await entryRequestService.moveEntryRequest(r3, GUARD, otherFlat.id);
      const newReq = moved.entryRequest as { id: string; flatId: string; peopleCount: number; status: string };
      requestIds.push(newReq.id);
      const old = await prisma.entryRequest.findUniqueOrThrow({ where: { id: r3 } });
      check('old request is withdrawn', old.status === 'REJECTED' && old.rejectionReason === 'Cancelled by guard');
      check('new request is pending for the other flat with the same group', newReq.flatId === otherFlat.id && newReq.status === 'PENDING' && newReq.peopleCount === 2);
    }

    // 5. trusted visitor skips the prompt
    await prisma.trustedVisitor.upsert({
      where: { flatId_phone: { flatId: FLAT, phone: PHONE } },
      update: {}, create: { name: 'Smoke Tutor', phone: PHONE, flatId: FLAT, societyId: SOCIETY, createdById: RESIDENT },
    });
    const c4 = await entryRequestService.createEntryRequest({ type: 'VISITOR', flatId: FLAT, visitorName: 'Smoke Tutor', visitorPhone: PHONE }, GUARD);
    requestIds.push((c4.entryRequest as { id: string }).id);
    check('trusted visitor is approved without asking', c4.autoApproved === true && (c4.entryRequest as { status: string }).status === 'APPROVED');
    const c5 = await entryRequestService.createEntryRequest({ type: 'VISITOR', flatId: FLAT, visitorName: 'Stranger', visitorPhone: '9000000078' }, GUARD);
    requestIds.push((c5.entryRequest as { id: string }).id);
    check('an unknown phone still asks the resident', c5.autoApproved === false);
  } finally {
    await prisma.trustedVisitor.deleteMany({ where: { phone: { in: ['9000000077', '9000000078'] } } });
    await prisma.entryRequest.deleteMany({ where: { id: { in: requestIds } } });
    await prisma.entry.deleteMany({ where: { id: { in: entryIds } } });
    await prisma.entry.deleteMany({ where: { visitorName: { startsWith: 'Smoke ' }, societyId: SOCIETY } });
  }
  console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`);
  await prisma.$disconnect();
  process.exit(failed === 0 ? 0 : 1);
})();
