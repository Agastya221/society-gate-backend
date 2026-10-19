/**
 * Guard geofence rules. Creates a temporary located gate in the demo society, checks every verdict, removes it.
 * Run: npx ts-node --transpile-only scripts/geofence-smoke.ts
 */
import 'dotenv/config';
import { prisma } from '../src/utils/Client';
import { clearGateCache, distanceMeters, evaluate, readingFromHeaders, type GeoReading } from '../src/modules/geofence/geofence.service';

const SOCIETY = 'edfccafb-62ab-4331-a423-eb4054261508';
const GATE = { lat: 22.8, lng: 86.2 };
let failed = 0;
const check = (name: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
  if (!ok) failed += 1;
};
// about `m` metres north of the gate
const north = (m: number) => GATE.lat + m / 111_320;
const reading = (over: Partial<GeoReading> = {}): GeoReading => ({
  latitude: GATE.lat, longitude: GATE.lng, accuracy: 10, takenAt: Date.now(), mocked: false, ...over,
});

(async () => {
  check('distance of 100 m north is about 100 m', Math.abs(distanceMeters(GATE.lat, GATE.lng, north(100), GATE.lng) - 100) < 1);

  clearGateCache(SOCIETY);
  const before = await evaluate(SOCIETY, null);
  check('a society with no gate location is not checked', before.enforced === false && before.ok === true);

  const gate = await prisma.gatePoint.create({ data: { societyId: SOCIETY, name: 'Smoke Gate', latitude: GATE.lat, longitude: GATE.lng, radiusMeters: 100 } });
  clearGateCache(SOCIETY);
  try {
    check('at the gate is allowed', (await evaluate(SOCIETY, reading())).ok);
    check('60 m away is allowed', (await evaluate(SOCIETY, reading({ latitude: north(60) }))).ok);
    check('120 m away with good GPS is allowed (within drift allowance)', (await evaluate(SOCIETY, reading({ latitude: north(120), accuracy: 30 }))).ok);
    const far = await evaluate(SOCIETY, reading({ latitude: north(500) }));
    check('500 m away is refused with the distance', !far.ok && far.code === 'GEOFENCE_OUTSIDE' && (far.distanceMeters ?? 0) > 450, far.message);
    check('no location sent is refused', (await evaluate(SOCIETY, null)).code === 'LOCATION_REQUIRED');
    check('a fake-location app is refused', (await evaluate(SOCIETY, reading({ mocked: true }))).code === 'LOCATION_FAKED');
    check('an old reading is refused', (await evaluate(SOCIETY, reading({ takenAt: Date.now() - 5 * 60_000 }))).code === 'LOCATION_STALE');
    check('a poor GPS fix is refused, not guessed', (await evaluate(SOCIETY, reading({ accuracy: 400 }))).code === 'LOCATION_INACCURATE');
    check('accuracy slack is capped: 300 m away with 140 m error is still refused', !(await evaluate(SOCIETY, reading({ latitude: north(300), accuracy: 140 }))).ok);

    const parsed = readingFromHeaders({ 'x-geo-lat': '22.8', 'x-geo-lng': '86.2', 'x-geo-acc': '12', 'x-geo-ts': String(Date.now()), 'x-geo-mock': '1' });
    check('headers are read, including the fake-location flag', !!parsed && parsed.mocked && parsed.accuracy === 12);
    check('garbage headers are treated as no location', readingFromHeaders({ 'x-geo-lat': 'abc' }) === null);
  } finally {
    await prisma.gatePoint.delete({ where: { id: gate.id } });
    clearGateCache(SOCIETY);
  }
  console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`);
  await prisma.$disconnect();
  process.exit(failed === 0 ? 0 : 1);
})();
