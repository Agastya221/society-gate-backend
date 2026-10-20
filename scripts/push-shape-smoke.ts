/**
 * Shape of the push messages, with the call-style switch off and on.
 * Run: npx ts-node --transpile-only scripts/push-shape-smoke.ts
 */
import { buildPushMessage } from '../src/services/push.service';

let failed = 0;
const check = (name: string, ok: boolean) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) failed += 1; };
const gate = { title: 'Visitor', body: 'Rahul at the gate', data: { type: 'GATE_REQUEST', entryRequestId: 'r1', peopleCount: '1' }, urgent: true };
const other = { title: 'Notice', body: 'Water off', data: { type: 'NOTICE' }, urgent: false };

delete process.env.GATE_CALL_STYLE;
let m: any = buildPushMessage(gate, ['t']);
check('switch off: a gate request is a normal loud notification', !!m.notification && m.android.notification.channelId === 'gate-alert-v1');
process.env.GATE_CALL_STYLE = '1';
m = buildPushMessage(gate, ['t']);
check('switch on: a gate request is data-only (no system notification)', m.notification === undefined);
check('switch on: it carries what the app needs to draw the alert', m.data.callStyle === '1' && m.data.title === 'Visitor' && m.data.body === 'Rahul at the gate' && m.data.entryRequestId === 'r1');
check('switch on: still high priority with a one-minute life', m.android.priority === 'high' && m.android.ttl === 60000);
m = buildPushMessage({ ...gate, data: { ...gate.data, type: 'GATE_APPROVED' } }, ['t']);
check('switch on: other gate messages stay normal notifications', !!m.notification);
m = buildPushMessage(other, ['t']);
check('switch on: ordinary notices are untouched', !!m.notification && m.android.priority === 'high' && !m.android.notification);
console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
