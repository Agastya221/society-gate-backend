/** Read-only authenticated check of guard-only routes against a local server. */
import assert from 'node:assert/strict';
import { prisma } from '../src/utils/Client';
import { redis } from '../src/config/redis';
import { generateAccessToken } from '../src/services/token.service';

const base = `http://127.0.0.1:${process.env.GUARD_SMOKE_PORT ?? '4101'}/api/v1`;

async function main() {
  const guard = await prisma.user.findFirst({
    where: { role: 'GUARD', isActive: true, societyId: { not: null } },
    select: { id: true, role: true, societyId: true, flatId: true },
  });
  assert(guard?.societyId, 'Demo guard required');
  const token = generateAccessToken(guard.id, guard.role, guard.societyId, guard.flatId, 'GUARD_APP');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const flatsResponse = await fetch(`${base}/gate/flats?page=1&limit=100`, { headers });
  assert.equal(flatsResponse.status, 200);
  const flatsBody = await flatsResponse.json() as { data: { flats: { id: string }[] } };
  assert(flatsBody.data.flats.length > 0);

  const queueResponse = await fetch(`${base}/gate/entry-requests?status=APPROVED&awaitingEntry=true&limit=1`, { headers });
  assert.equal(queueResponse.status, 200);

  const serviceResponse = await fetch(`${base}/guard/pre-approved/validate`, {
    method: 'POST', headers,
    body: JSON.stringify({ flatId: flatsBody.data.flats[0].id, type: 'HELP', category: 'PLUMBER' }),
  });
  assert.equal(serviceResponse.status, 200);

  console.log('PASS: scoped flat directory, ready queue and category-specific service validation');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(Number(process.exitCode ?? 0));
});
