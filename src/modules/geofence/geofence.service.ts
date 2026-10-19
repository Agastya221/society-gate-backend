import { prisma } from '../../utils/Client';
import logger from '../../utils/logger';

/**
 * Keeps guard actions at the gate. A society turns this on by saving a location for at least one gate
 * (the admin stands at the gate and taps "Set this gate's location"). From then on every sensitive guard
 * action must carry a fresh phone location (x-geo-* headers) that is near one of the gates. Societies with
 * no gate location are not checked, so nothing changes until the admin sets one.
 */
export const DEFAULT_RADIUS_METERS = 100;
/** A reading older than this is not "where the guard is now" */
const MAX_AGE_MS = 90_000;
/** Poorer than this and the position could be anywhere: ask for a better fix instead of guessing */
const MAX_ACCURACY_METERS = 150;
/** Benefit of the doubt for GPS drift, never more than this */
const ACCURACY_ALLOWANCE_METERS = 60;
const GATES_CACHE_MS = 30_000;

export interface GeoReading {
  latitude: number;
  longitude: number;
  accuracy: number;
  takenAt: number;
  mocked: boolean;
}

export type GeoCode =
  | 'LOCATION_REQUIRED'
  | 'LOCATION_FAKED'
  | 'LOCATION_STALE'
  | 'LOCATION_INACCURATE'
  | 'GEOFENCE_OUTSIDE';

export interface GeoVerdict {
  enforced: boolean;
  ok: boolean;
  code?: GeoCode;
  message?: string;
  distanceMeters?: number;
  radiusMeters?: number;
  gateName?: string;
}

interface GateLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

const cache = new Map<string, { at: number; gates: GateLocation[] }>();

export function clearGateCache(societyId: string): void {
  cache.delete(societyId);
}

export function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

export async function getGateLocations(societyId: string): Promise<GateLocation[]> {
  const hit = cache.get(societyId);
  if (hit && Date.now() - hit.at < GATES_CACHE_MS) return hit.gates;
  const rows = await prisma.gatePoint.findMany({
    where: { societyId, isActive: true, latitude: { not: null }, longitude: { not: null } },
    select: { id: true, name: true, latitude: true, longitude: true, radiusMeters: true },
  });
  const gates = rows.map((g) => ({
    id: g.id,
    name: g.name,
    latitude: g.latitude as number,
    longitude: g.longitude as number,
    radiusMeters: g.radiusMeters,
  }));
  cache.set(societyId, { at: Date.now(), gates });
  return gates;
}

/** Reads the reading the app attaches to each request; null when it is missing or not numbers. */
export function readingFromHeaders(headers: Record<string, string | string[] | undefined>): GeoReading | null {
  const one = (name: string) => {
    const v = headers[name];
    return Array.isArray(v) ? v[0] : v;
  };
  const latitude = Number(one('x-geo-lat'));
  const longitude = Number(one('x-geo-lng'));
  const accuracy = Number(one('x-geo-acc'));
  const takenAt = Number(one('x-geo-ts'));
  if (![latitude, longitude, accuracy, takenAt].every(Number.isFinite)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude, accuracy, takenAt, mocked: one('x-geo-mock') === '1' };
}

export async function evaluate(societyId: string, reading: GeoReading | null, now = Date.now()): Promise<GeoVerdict> {
  const gates = await getGateLocations(societyId);
  if (gates.length === 0) return { enforced: false, ok: true };

  if (!reading) {
    return { enforced: true, ok: false, code: 'LOCATION_REQUIRED', message: 'Turn on location so the app can confirm you are at the gate.' };
  }
  if (reading.mocked) {
    return { enforced: true, ok: false, code: 'LOCATION_FAKED', message: 'A fake-location app is on. Turn it off to continue.' };
  }
  if (now - reading.takenAt > MAX_AGE_MS || reading.takenAt - now > MAX_AGE_MS) {
    return { enforced: true, ok: false, code: 'LOCATION_STALE', message: 'Your location is out of date. Wait a moment and try again.' };
  }
  if (reading.accuracy > MAX_ACCURACY_METERS) {
    return { enforced: true, ok: false, code: 'LOCATION_INACCURATE', message: 'The phone cannot find your position well enough. Move near the gate with a clear sky and try again.' };
  }

  let nearest = gates[0];
  let nearestDistance = Infinity;
  for (const gate of gates) {
    const d = distanceMeters(reading.latitude, reading.longitude, gate.latitude, gate.longitude);
    if (d < nearestDistance) { nearest = gate; nearestDistance = d; }
  }
  const allowed = nearest.radiusMeters + Math.min(reading.accuracy, ACCURACY_ALLOWANCE_METERS);
  const rounded = Math.round(nearestDistance);
  if (nearestDistance > allowed) {
    return {
      enforced: true, ok: false, code: 'GEOFENCE_OUTSIDE',
      message: `You are about ${rounded} m from ${nearest.name}. Go to the gate to do this.`,
      distanceMeters: rounded, radiusMeters: nearest.radiusMeters, gateName: nearest.name,
    };
  }
  return { enforced: true, ok: true, distanceMeters: rounded, radiusMeters: nearest.radiusMeters, gateName: nearest.name };
}

export async function logViolation(
  societyId: string,
  guardId: string,
  action: string,
  verdict: GeoVerdict,
  reading: GeoReading | null,
): Promise<void> {
  try {
    await prisma.geofenceViolation.create({
      data: {
        societyId,
        guardId,
        action,
        code: verdict.code ?? 'UNKNOWN',
        distanceMeters: verdict.distanceMeters ?? null,
        latitude: reading?.latitude ?? null,
        longitude: reading?.longitude ?? null,
        accuracy: reading?.accuracy ?? null,
      },
    });
  } catch (err) {
    logger.error({ err }, 'Could not record the geofence violation');
  }
}
