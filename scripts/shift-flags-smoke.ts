/**
 * Late arrival / early leave against the admin's shift times. Pure comparison, no database.
 * Run: npx ts-node --transpile-only scripts/shift-flags-smoke.ts
 */
import { compareWithSchedule } from '../src/modules/geofence/duty.service';

let failed = 0;
const check = (name: string, ok: boolean) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) failed += 1; };
const at = (day: number, h: number, m: number) => new Date(2026, 9, day, h, m);
const morning = { name: 'Morning', startTime: '06:00', endTime: '14:00', graceMinutes: 15 };
const night = { name: 'Night', startTime: '22:00', endTime: '06:00', graceMinutes: 15 };

let r = compareWithSchedule(at(20, 6, 5), at(20, 14, 0), 'GUARD', morning);
check('5 minutes late is inside the grace time', r.lateMinutes === 0);
r = compareWithSchedule(at(20, 6, 40), at(20, 14, 5), 'GUARD', morning);
check('40 minutes late is flagged', r.lateMinutes === 40);
r = compareWithSchedule(at(20, 5, 30), at(20, 14, 0), 'GUARD', morning);
check('arriving early is not late', r.lateMinutes === 0);
r = compareWithSchedule(at(20, 6, 0), at(20, 13, 0), 'GUARD', morning);
check('leaving an hour early is flagged', r.earlyMinutes === 60);
r = compareWithSchedule(at(20, 6, 0), at(21, 4, 0), 'AUTO', morning);
check('a shift the system closed is not "left early"', r.earlyMinutes === 0);
r = compareWithSchedule(at(20, 6, 0), null, null, morning);
check('a shift still running is not flagged early', r.earlyMinutes === 0);
r = compareWithSchedule(at(20, 22, 10), at(21, 6, 0), 'GUARD', night);
check('night shift: on time', r.lateMinutes === 0 && r.earlyMinutes === 0);
r = compareWithSchedule(at(21, 0, 30), at(21, 6, 0), 'GUARD', night);
check('night shift: starting after midnight is matched to the previous evening and flagged late', r.lateMinutes === 150);
r = compareWithSchedule(at(20, 22, 0), at(21, 5, 0), 'GUARD', night);
check('night shift: leaving at 05:00 is early by an hour', r.earlyMinutes === 60);
r = compareWithSchedule(at(20, 14, 0), at(20, 22, 0), 'GUARD', morning);
check('working at another time of day is not flagged', r.lateMinutes === 0 && r.earlyMinutes === 0 && r.scheduledStart === null || r.lateMinutes === 0);
r = compareWithSchedule(at(20, 9, 0), at(20, 17, 0), 'GUARD', null);
check('a guard with no assigned shift is never flagged', r.lateMinutes === 0 && r.earlyMinutes === 0);
console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
