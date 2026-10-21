/** Resident updates are quiet; the waiting-at-the-gate request and the guard's alerts stay loud. */
import { buildPushMessage } from '../src/services/push.service';
let failed = 0;
const check = (n: string, ok: boolean) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}`); if (!ok) failed += 1; };
const quiet = buildPushMessage({ title: 'Visitor entered', body: 'x', data: { type: 'GATE_APPROVED' }, urgent: false }, ['t']) as any;
check('an urgent:false update has no loud channel or custom sound', !quiet.android.notification);
const loud = buildPushMessage({ title: 'Waiting', body: 'x', data: { type: 'GATE_REQUEST' }, urgent: true }, ['t']) as any;
check('a waiting-at-the-gate request keeps the loud channel and custom sound', loud.android.notification.channelId === 'gate-alert-v1' && loud.android.notification.sound === 'gate_alert');
console.log(failed ? `\n${failed} FAILED` : '\nALL PASS'); process.exit(failed ? 1 : 0);
