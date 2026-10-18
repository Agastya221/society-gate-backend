/**
 * Proves the alert rule: in-app first (only when the app confirms it SHOWED the alert), push otherwise.
 * Runs the real socket server and push service against the demo database, with real socket clients.
 * The FCM send itself is replaced by a recorder, so nothing is pushed to any phone.
 * Run: npx ts-node --files scripts/alert-delivery-smoke.ts
 */
import 'dotenv/config';
import { createServer } from 'http';
import { AddressInfo } from 'net';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { io as connect, type Socket } from 'socket.io-client';
import { initializeSocketIO } from '../src/utils/socket';
import { pushService } from '../src/services/push.service';
import { createStaffAccessToken } from '../src/modules/staff-app/staff-app.token';
import { prisma } from '../src/utils/Client';

const SOCIETY = 'edfccafb-62ab-4331-a423-eb4054261508';
const RESIDENT = '79120472-69bc-4443-8c65-f04ddda9618f'; // Agastya, A101
const GUARD = 'db155cb5-646c-4f07-8f6e-77042ea231c3';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures++;
};

const userToken = (userId: string, role: string, appType: string, flatId: string | null) =>
  jwt.sign(
    { userId, role, societyId: SOCIETY, flatId, appType, type: 'access', jti: crypto.randomUUID() },
    process.env.JWT_SECRET!, { algorithm: 'HS256', audience: 'sgate-user', expiresIn: '10m' },
  );

async function main() {
  // This machine has no Firebase credentials: pretend it does, and record pushes instead of sending them
  (require('../src/config/firebase') as { isFirebaseAvailable: () => boolean }).isFirebaseAvailable = () => true;
  const pushed: Array<{ ids: string[]; urgent: boolean; channel?: string }> = [];
  (pushService as any).sendPush = async (targets: Array<{ id: string }>, alert: { urgent: boolean }) => {
    pushed.push({ ids: targets.map((t) => t.id), urgent: alert.urgent });
  };
  // The real recipients must have a token for the push fallback to be attempted
  const before = await prisma.user.findMany({ where: { id: { in: [RESIDENT, GUARD] } }, select: { id: true, fcmToken: true } });
  const fakeToken = 'smoke-test-token';
  await prisma.user.updateMany({ where: { id: { in: [RESIDENT, GUARD] }, fcmToken: null }, data: { fcmToken: fakeToken } });

  const server = createServer();
  initializeSocketIO(server);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const open: Socket[] = [];
  const client = (token: string) => {
    const socket = connect(url, { transports: ['websocket'], auth: { token }, reconnection: false });
    open.push(socket);
    return new Promise<Socket>((resolve, reject) => {
      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', (err) => reject(err));
    });
  };

  try {
    const alert = { title: 'Visitor at gate', body: 'Test', data: { type: 'GATE_REQUEST', entryRequestId: 'smoke-1' } };

    // 1. App open on screen and it shows the alert -> delivered in-app, NO push
    const resident = await client(userToken(RESIDENT, 'RESIDENT', 'RESIDENT_APP', '5352aea1-5237-44cb-9dad-76fbd4406af4'));
    let received: any = null;
    resident.on('alert', (payload, ack) => { received = payload; ack({ shown: true }); });
    resident.emit('app-state', 'active');
    await sleep(300);
    pushed.length = 0;
    await pushService.sendToUser(RESIDENT, alert);
    check('open app that shows the alert: delivered in-app, no push', received?.title === 'Visitor at gate' && received?.urgent === true && pushed.length === 0, `urgent=${received?.urgent}, pushes=${pushed.length}`);

    // 2. App goes to the background -> push
    resident.emit('app-state', 'background');
    await sleep(300);
    pushed.length = 0;
    await pushService.sendToUser(RESIDENT, alert);
    check('app in background: push is sent', pushed.length === 1 && pushed[0].urgent === true, `pushes=${pushed.length}`);

    // 3. App says it is open but does NOT show the alert (shown:false) -> push
    resident.removeAllListeners('alert');
    resident.on('alert', (_payload, ack) => ack({ shown: false }));
    resident.emit('app-state', 'active');
    await sleep(300);
    pushed.length = 0;
    await pushService.sendToUser(RESIDENT, alert);
    check('app open but did not show it: push is sent', pushed.length === 1, `pushes=${pushed.length}`);

    // 4. App open but frozen (never answers) -> push after the 2.5 s wait
    resident.removeAllListeners('alert');
    resident.on('alert', () => { /* never acknowledges */ });
    pushed.length = 0;
    const started = Date.now();
    await pushService.sendToUser(RESIDENT, alert);
    const waited = Date.now() - started;
    check('app open but not answering: push after a short wait', pushed.length === 1 && waited >= 2000 && waited < 4500, `waited ${waited} ms`);

    // 5. Nobody connected -> push; a closed app never blocks the alert
    resident.disconnect();
    await sleep(300);
    pushed.length = 0;
    await pushService.sendToUser(RESIDENT, alert);
    check('no connection at all: push is sent', pushed.length === 1, `pushes=${pushed.length}`);

    // 6. Non-urgent alert is flagged as normal
    pushed.length = 0;
    await pushService.sendToUser(RESIDENT, { title: 'Notice', body: 'Water cut', data: { type: 'BROADCAST' } });
    check('ordinary notice is not marked urgent', pushed.length === 1 && pushed[0].urgent === false);

    // 7. Staff app connects with its own token and receives in-app alerts
    const staff = await prisma.staffAccount.findFirst({ where: { isActive: true }, select: { id: true, domesticStaffId: true, domesticStaff: { select: { societyId: true } } } });
    if (staff) {
      const staffSocket = await client(createStaffAccessToken(staff.id, staff.domesticStaffId, staff.domesticStaff.societyId));
      let staffGot: any = null;
      staffSocket.on('alert', (payload, ack) => { staffGot = payload; ack({ shown: true }); });
      staffSocket.emit('app-state', 'active');
      await sleep(300);
      pushed.length = 0;
      await pushService.sendToStaff(staff.domesticStaffId, { title: 'New work request', body: 'x', data: { type: 'STAFF_BOOKING' } });
      check('staff app: delivered in-app, no push', staffGot?.title === 'New work request' && pushed.length === 0);
    }

    // 8. A bad token is refused
    let refused = false;
    try { await client('not-a-token'); } catch { refused = true; }
    check('invalid token is refused', refused);
  } finally {
    for (const socket of open) socket.disconnect();
    server.close();
    // Put the real tokens back exactly as they were
    for (const row of before) {
      if (row.fcmToken === null) await prisma.user.update({ where: { id: row.id }, data: { fcmToken: null } });
    }
    await prisma.$disconnect();
  }
  console.log(failures === 0 ? 'ALL PASSED' : `${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
