/**
 * Undo an approval before the guard lets the visitor in. Demo society, cleans up after itself.
 * Run: npx ts-node --transpile-only scripts/revoke-smoke.ts
 */
import 'dotenv/config';
import { prisma } from '../src/utils/Client';
import { entryRequestService, ENTRY_REQUEST_REVOKED_REASON } from '../src/modules/entry-request/entry-request.service';

const GUARD = 'db155cb5-646c-4f07-8f6e-77042ea231c3';
const RESIDENT = '79120472-69bc-4443-8c65-f04ddda9618f';
const FLAT = '5352aea1-5237-44cb-9dad-76fbd4406af4';
let failed = 0;
const check = (name: string, ok: boolean) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) failed += 1; };
const rejects = async (fn: () => Promise<unknown>) => { try { await fn(); return false; } catch { return true; } };

(async () => {
  const ids: string[] = [];
  const entries: string[] = [];
  try {
    const a = await entryRequestService.createEntryRequest({ type: 'VISITOR', flatId: FLAT, visitorName: 'Smoke Revoke' }, GUARD);
    const id = (a.entryRequest as { id: string }).id; ids.push(id);
    check('a pending request cannot be revoked (nothing was approved yet)', await rejects(() => entryRequestService.revokeEntryRequest(id, RESIDENT)));
    await entryRequestService.approveEntryRequest(id, RESIDENT);
    const done = await entryRequestService.revokeEntryRequest(id, RESIDENT) as { status: string; rejectionReason: string | null };
    check('an approved visitor can be withdrawn', done.status === 'REJECTED' && done.rejectionReason === ENTRY_REQUEST_REVOKED_REASON);
    check('withdrawing twice is refused', await rejects(() => entryRequestService.revokeEntryRequest(id, RESIDENT)));
    check('the guard cannot admit a withdrawn approval', await rejects(() => entryRequestService.admitEntryRequest(id, GUARD)));

    const b = await entryRequestService.createEntryRequest({ type: 'VISITOR', flatId: FLAT, visitorName: 'Smoke Revoke Two' }, GUARD);
    const id2 = (b.entryRequest as { id: string }).id; ids.push(id2);
    await entryRequestService.approveEntryRequest(id2, RESIDENT);
    const admitted = await entryRequestService.admitEntryRequest(id2, GUARD); entries.push(admitted.entry.id);
    check('once the guard has let them in it can no longer be withdrawn', await rejects(() => entryRequestService.revokeEntryRequest(id2, RESIDENT)));
    check('a guard cannot withdraw an approval for a flat', await rejects(() => entryRequestService.revokeEntryRequest(id2, GUARD)));
  } finally {
    await prisma.entryRequest.deleteMany({ where: { id: { in: ids } } });
    await prisma.entry.deleteMany({ where: { id: { in: entries } } });
  }
  console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`);
  await prisma.$disconnect();
  process.exit(failed === 0 ? 0 : 1);
})();
