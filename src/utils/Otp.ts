import { redis, isRedisAvailable } from "../config/redis";
import logger from "./logger";

// In-memory fallback storage (used when Redis is unavailable)
const inMemoryOtpStore = new Map<string, { otp: string; expiresAt: number }>();
const inMemoryCountStore = new Map<string, { count: number; expiresAt: number }>();

// Periodic cleanup of expired entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, entry] of inMemoryOtpStore) {
    if (now > entry.expiresAt) {
      inMemoryOtpStore.delete(key);
      cleaned++;
    }
  }
  for (const [key, entry] of inMemoryCountStore) {
    if (now > entry.expiresAt) {
      inMemoryCountStore.delete(key);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    logger.debug({ cleaned }, 'Cleaned expired in-memory OTP entries');
  }
}, 5 * 60 * 1000);

export class OtpService {
  async setOtp(phone: string, otp: string, ttlSeconds: number): Promise<void> {
    if (isRedisAvailable()) {
      await redis.set(`otp:${phone}`, otp, 'EX', ttlSeconds);
    } else {
      // IMP-4: Loud warning in production
      if (process.env.NODE_ENV === 'production') {
        logger.warn('PRODUCTION: Redis unavailable, using in-memory OTP storage - OTPs will not persist across restarts');
      }
      inMemoryOtpStore.set(phone, {
        otp,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
    }
  }

  async getOtp(phone: string): Promise<string | null> {
    if (isRedisAvailable()) {
      return await redis.get(`otp:${phone}`);
    } else {
      const entry = inMemoryOtpStore.get(phone);
      if (!entry) return null;
      if (Date.now() > entry.expiresAt) {
        inMemoryOtpStore.delete(phone);
        return null;
      }
      return entry.otp;
    }
  }

  async deleteOtp(phone: string): Promise<void> {
    if (isRedisAvailable()) {
      await redis.del(`otp:${phone}`);
    } else {
      inMemoryOtpStore.delete(phone);
    }
  }

  async getCount(key: string): Promise<number> {
    if (isRedisAvailable()) {
      const value = await redis.get(key);
      return value ? Number(value) : 0;
    } else {
      const entry = inMemoryCountStore.get(key);
      if (!entry) return 0;
      if (Date.now() > entry.expiresAt) {
        inMemoryCountStore.delete(key);
        return 0;
      }
      return entry.count;
    }
  }

  async increment(key: string, ttlSeconds: number): Promise<void> {
    if (isRedisAvailable()) {
      const pipeline = redis.multi();
      pipeline.incr(key);
      pipeline.expire(key, ttlSeconds);
      await pipeline.exec();
    } else {
      const entry = inMemoryCountStore.get(key);
      const currentCount = entry && Date.now() <= entry.expiresAt ? entry.count : 0;
      inMemoryCountStore.set(key, {
        count: currentCount + 1,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
    }
  }

  async clearOtpForPhone(phone: string): Promise<void> {
    if (isRedisAvailable()) {
      await redis.del(`otp:${phone}`);
    } else {
      inMemoryOtpStore.delete(phone);
    }
  }

  async clearRateLimits(phone: string, ip?: string): Promise<void> {
    if (isRedisAvailable()) {
      await redis.del(`otp:attempts:phone:${phone}`);
      if (ip) {
        await redis.del(`otp:attempts:ip:${ip}`);
      }
    } else {
      inMemoryCountStore.delete(`otp:attempts:phone:${phone}`);
      if (ip) {
        inMemoryCountStore.delete(`otp:attempts:ip:${ip}`);
      }
    }
  }
}
