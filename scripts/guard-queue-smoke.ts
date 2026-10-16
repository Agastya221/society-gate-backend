/**
 * Isolated smoke check against the configured demo database.
 * Creates a few tagged requests and removes every row it creates in finally.
 * Run: npx ts-node --files scripts/guard-queue-smoke.ts
 * (--files is required: this project's tsconfig "include" doesn't cover scripts/**,
 * so plain `ts-node scripts/x.ts` drops the Express.Request ambient augmentation.)
 */
import assert from 'node:assert/strict';
import { prisma } from '../src/utils/Client';
import { EntryRequestService } from '../src/modules/entry-request/entry-request.service';
import { GateScanService } from '../src/modules/gate-scan/gate-scan.service';
import { generateUniqueStaffPassCode } from '../src/modules/domestic-staff/domestic-staff.service';
import { generateQRToken } from '../src/utils/QrGenerate';
import { redis } from '../src/config/redis';

const service = new EntryRequestService();
const gateScanService = new GateScanService();
const requestIds: string[] = [];
const entryIds: string[] = [];
const staffIds: string[] = [];

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

  // --- Queue endpoint: shape + filters ---
  const waitingId = await makeRequest(guard.id, guard.societyId, flats[1].id);
  const cancelledId = await makeRequest(guard.id, guard.societyId, flats[1].id);
  await service.cancelEntryRequest(cancelledId, guard.id);

  const queueResult = await service.getGateQueue(guard.id);
  assert.ok(Array.isArray(queueResult.waiting), 'queue.waiting must be an array');
  assert.ok(Array.isArray(queueResult.ready), 'queue.ready must be an array');
  assert.ok(Array.isArray(queueResult.stopped), 'queue.stopped must be an array');
  assert.equal(typeof queueResult.insideCount, 'number');
  assert.ok(typeof queueResult.serverTime === 'string');
  assert.ok(queueResult.waiting.some((r) => r.id === waitingId), 'queue.waiting must include a fresh PENDING request');
  assert.ok(
    !queueResult.stopped.some((r) => r.id === cancelledId),
    'queue.stopped must exclude the guard\'s own cancel (GUARD_OWN_STOP_REASONS)',
  );
  // A resident rejection (not a guard-own reason) must show up in stopped
  const residentRejectId = await makeRequest(guard.id, guard.societyId, flats[1].id);
  await prisma.entryRequest.update({ where: { id: residentRejectId }, data: { status: 'REJECTED', rejectedAt: new Date(), rejectionReason: 'Not expected' } });
  const queueAfterReject = await service.getGateQueue(guard.id);
  assert.ok(queueAfterReject.stopped.some((r) => r.id === residentRejectId), 'a resident rejection must appear in queue.stopped');
  console.log('PASS: /queue shape, waiting/stopped filters, guard-own-stop exclusion');

  // --- Duplicate create idempotency (double-tap / retry within 30s window) ---
  const dup1 = await service.createEntryRequest(
    { type: 'VISITOR', flatId: flats[1].id, visitorName: 'Duplicate Guard Smoke' }, guard.id,
  );
  requestIds.push((dup1.entryRequest as { id: string }).id);
  const dup2 = await service.createEntryRequest(
    { type: 'VISITOR', flatId: flats[1].id, visitorName: 'Duplicate Guard Smoke' }, guard.id,
  );
  assert.equal((dup1.entryRequest as { id: string }).id, (dup2.entryRequest as { id: string }).id, 'retried create must return the same request, not a new one');
  const dupCount = await prisma.entryRequest.count({ where: { visitorName: 'Duplicate Guard Smoke', guardId: guard.id } });
  assert.equal(dupCount, 1, 'exactly one row must exist for the duplicated create');
  console.log('PASS: duplicate-create idempotency');

  // --- Staff scan debounce + passCode scan ---
  const staff = await prisma.domesticStaff.create({
    data: {
      name: 'Guard Smoke Staff',
      phone: `9${Date.now().toString().slice(-9)}`,
      staffType: 'MAID',
      societyId: guard.societyId,
      qrToken: generateQRToken({ type: 'domestic_staff', phone: 'smoke', societyId: guard.societyId }),
      passCode: await generateUniqueStaffPassCode(),
      isActive: true,
      isVerified: true,
      addedById: guard.id,
    },
  });
  staffIds.push(staff.id);

  const firstScan = await gateScanService.scan(staff.qrToken, guard.id, guard.societyId);
  assert.equal(firstScan.allowed, true);
  assert.equal((firstScan.data as { attendanceAction: string }).attendanceAction, 'CHECKED_IN');

  const secondScanImmediate = await gateScanService.scan(staff.qrToken, guard.id, guard.societyId);
  assert.equal(secondScanImmediate.reason, 'Already recorded a moment ago', 'a repeat scan within 20s must be debounced');
  assert.equal((secondScanImmediate.data as { attendanceAction: string }).attendanceAction, 'CHECKED_IN', 'debounced scan must report the previous action, not toggle');

  const passCodeScan = await gateScanService.scan(staff.passCode!, guard.id, guard.societyId);
  assert.equal(passCodeScan.type, 'DOMESTIC_STAFF');
  assert.equal(passCodeScan.reason, 'Already recorded a moment ago', 'passCode must resolve to the same staff member (still inside the debounce window)');
  console.log('PASS: staff scan debounce, passCode scan resolves to the same staff member');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  try {
    await prisma.entryRequest.deleteMany({ where: { id: { in: requestIds } } });
    await prisma.entry.deleteMany({ where: { id: { in: entryIds } } });
    // StaffAttendance rows cascade-delete with the staff row (onDelete: Cascade)
    await prisma.domesticStaff.deleteMany({ where: { id: { in: staffIds } } });
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
