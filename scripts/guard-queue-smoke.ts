/**
 * Isolated smoke check against the configured demo database.
 * Creates a few tagged requests and removes every row it creates in finally.
 * Run: npx ts-node scripts/guard-queue-smoke.ts
 */
import assert from 'node:assert/strict';
import { prisma } from '../src/utils/Client';
import { EntryRequestService } from '../src/modules/entry-request/entry-request.service';
import { redis } from '../src/config/redis';

const service = new EntryRequestService();
const requestIds: string[] = [];
const entryIds: string[] = [];

async function makeRequest(guardId: string, societyId: string, flatId: string, old = false) {
  const request = await prisma.entryRequest.create({
    data: {
      type: 'VISITOR', visitorName: 'Guard Queue Smoke', flatId, societyId, guardId,
      status: 'PENDING',
      createdAt: old ? new Date(Date.now() - 46_000) : new Date(),
      expiresAt: new Date(Date.now() + 15 * 60_000),
      targets: { create: [{ flatId, societyId }] },
    },
  });
  requestIds.push(request.id);
  return request.id;
}

async function main() {
  const guard = await prisma.user.findFirst({
    where: { role: 'GUARD', isActive: true, societyId: { not: null } },
    select: { id: true, societyId: true },
  });
  assert(guard?.societyId, 'A demo guard assigned to a society is required');
  const flats = await prisma.flat.findMany({
    where: { societyId: guard.societyId, isActive: true }, select: { id: true }, take: 2,
  });
  assert.equal(flats.length, 2, 'Two demo flats are required');

  const early = await makeRequest(guard.id, guard.societyId, flats[0].id);
  await assert.rejects(service.approveEntryRequest(early, guard.id), /Wait 45 seconds/);

  const requestId = await makeRequest(guard.id, guard.societyId, flats[0].id, true);
  const approved = await service.approveEntryRequest(requestId, guard.id);
  assert.equal(approved.status, 'APPROVED');
  assert.equal(approved.entryId, null, 'Approval must not count as entry');
  const queue = await service.getEntryRequests(guard.id, { awaitingEntry: true, order: 'oldest' });
  assert(queue.entryRequests.some((request) => request.id === requestId));

  const attempts = await Promise.allSettled([
    service.admitEntryRequest(requestId, guard.id),
    service.admitEntryRequest(requestId, guard.id),
  ]);
  assert.equal(attempts.filter((attempt) => attempt.status === 'fulfilled').length, 1);
  const admitted = attempts.find((attempt) => attempt.status === 'fulfilled') as PromiseFulfilledResult<Awaited<ReturnType<typeof service.admitEntryRequest>>>;
  entryIds.push(admitted.value.entry.id);
  assert.equal(admitted.value.entry.status, 'CHECKED_IN');
  assert.equal((await prisma.entryRequest.findUniqueOrThrow({ where: { id: requestId } })).entryId, admitted.value.entry.id);

  const leftId = await makeRequest(guard.id, guard.societyId, flats[0].id, true);
  await service.approveEntryRequest(leftId, guard.id);
  const left = await service.markNoShow(leftId, guard.id);
  assert.equal(left.status, 'EXPIRED');
  await assert.rejects(service.admitEntryRequest(leftId, guard.id));

  await assert.rejects(service.createEntryRequest({ type: 'VISITOR', flatIds: flats.map((flat) => flat.id) }, guard.id), /separate entry request/);
  console.log('PASS: override wait, ready queue, approval without entry, concurrent admit, no-show, separate flat requests');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  try {
    await prisma.entryRequest.deleteMany({ where: { id: { in: requestIds } } });
    await prisma.entry.deleteMany({ where: { id: { in: entryIds } } });
  } catch (error) {
    console.error('Smoke-test cleanup failed', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    redis.disconnect();
    // The backend's Socket.IO utility owns a recurring cleanup timer.
    process.exit(Number(process.exitCode ?? 0));
  }
});
