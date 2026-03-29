import { redis, isRedisAvailable, safeRedisOperation } from '../../config/redis';
import { prisma } from '../../utils/Client';
import logger from '../../utils/logger';

interface CachedPreApprovedEntry {
  id: string;
  type: string;
  mode: string;
  scheduleType: string;
  status: string;
  visitorName: string | null;
  visitorPhone: string | null;
  flatId: string;
  userId: string;
  vehicleLast4Digits: string | null;
}

const CACHE_TTL = 300; // 5 minutes
const GUARD_LIST_TTL = 60; // 1 minute

export class AccessControlCache {
  /**
   * Get entries matching vehicle last 4 digits for a society.
   */
  async getByVehicleDigits(societyId: string, last4: string): Promise<CachedPreApprovedEntry[] | null> {
    return safeRedisOperation(async () => {
      const key = `preapproved:society:${societyId}:vehicle:${last4}`;
      const cached = await redis.get(key);
      if (!cached) return null;
      return JSON.parse(cached) as CachedPreApprovedEntry[];
    }, null);
  }

  /**
   * Cache entries by vehicle digits.
   */
  async setByVehicleDigits(societyId: string, last4: string, entries: CachedPreApprovedEntry[]): Promise<void> {
    await safeRedisOperation(async () => {
      const key = `preapproved:society:${societyId}:vehicle:${last4}`;
      await redis.setex(key, CACHE_TTL, JSON.stringify(entries));
    }, undefined);
  }

  /**
   * Get active entries for a flat.
   */
  async getByFlat(societyId: string, flatId: string): Promise<CachedPreApprovedEntry[] | null> {
    return safeRedisOperation(async () => {
      const key = `preapproved:society:${societyId}:flat:${flatId}:active`;
      const cached = await redis.get(key);
      if (!cached) return null;
      return JSON.parse(cached) as CachedPreApprovedEntry[];
    }, null);
  }

  /**
   * Cache active entries for a flat.
   */
  async setByFlat(societyId: string, flatId: string, entries: CachedPreApprovedEntry[]): Promise<void> {
    await safeRedisOperation(async () => {
      const key = `preapproved:society:${societyId}:flat:${flatId}:active`;
      await redis.setex(key, CACHE_TTL, JSON.stringify(entries));
    }, undefined);
  }

  /**
   * Invalidate all caches related to an entry's society and flat.
   */
  async invalidate(societyId: string, flatId: string, vehicleLast4?: string | null): Promise<void> {
    if (!isRedisAvailable()) return;

    try {
      const keysToDelete = [
        `preapproved:society:${societyId}:flat:${flatId}:active`,
        `preapproved:society:${societyId}:all-active`,
      ];

      if (vehicleLast4) {
        keysToDelete.push(`preapproved:society:${societyId}:vehicle:${vehicleLast4}`);
      }

      await redis.del(...keysToDelete);
      logger.debug({ societyId, flatId, vehicleLast4 }, 'Pre-approved entry cache invalidated');
    } catch (error) {
      logger.error({ error }, 'Cache invalidation failed');
    }
  }

  /**
   * Build a cacheable entry from a full DB record.
   */
  static toCached(entry: {
    id: string;
    type: string;
    mode: string;
    scheduleType: string;
    status: string;
    visitorName: string | null;
    visitorPhone: string | null;
    flatId: string;
    userId: string;
    meta?: { vehicleLast4Digits: string | null } | null;
  }): CachedPreApprovedEntry {
    return {
      id: entry.id,
      type: entry.type,
      mode: entry.mode,
      scheduleType: entry.scheduleType,
      status: entry.status,
      visitorName: entry.visitorName,
      visitorPhone: entry.visitorPhone,
      flatId: entry.flatId,
      userId: entry.userId,
      vehicleLast4Digits: entry.meta?.vehicleLast4Digits ?? null,
    };
  }
}

export const accessControlCache = new AccessControlCache();
