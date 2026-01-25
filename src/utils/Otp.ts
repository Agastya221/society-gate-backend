import { redis, isRedisAvailable, safeRedisOperation } from "../config/redis";
// OTP + RATE LIMIT UTILS (MATCHES UserService)
// ============================================

// In-memory fallback storage (used when Redis is unavailable)
const inMemoryOtpStore = new Map<string, { otp: string; expiresAt: number }>();
const inMemoryCountStore = new Map<string, { count: number; expiresAt: number }>();

export class OtpService {
  // --------------------------------
  // OTP STORAGE (used by UserService)
  // --------------------------------

  async setOtp(phone: string, otp: string, ttlSeconds: number): Promise<void> {
    if (isRedisAvailable()) {
      await redis.set(`otp:${phone}`, otp, 'EX', ttlSeconds);
    } else {
      // Fallback to in-memory storage
      console.warn('⚠️  Redis unavailable, using in-memory OTP storage');
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
      // Fallback to in-memory storage
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

  // --------------------------------
  // RATE LIMIT HELPERS (phone / IP)
  // --------------------------------

  async getCount(key: string): Promise<number> {
    if (isRedisAvailable()) {
      const value = await redis.get(key);
      return value ? Number(value) : 0;
    } else {
      // Fallback to in-memory storage
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
      // Fallback to in-memory storage
      const entry = inMemoryCountStore.get(key);
      const currentCount = entry && Date.now() <= entry.expiresAt ? entry.count : 0;
      inMemoryCountStore.set(key, {
        count: currentCount + 1,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
    }
  }

  // --------------------------------
  // OPTIONAL DEBUG / CLEANUP HELPERS
  // --------------------------------

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

// ============================================
// KEY FORMAT USED (IMPORTANT)
// ============================================
// OTP VALUE:
//   otp:{phone}
//
// RATE LIMIT:
//   otp:attempts:phone:{phone}
//   otp:attempts:ip:{ip}
//
// This EXACTLY matches UserService usage.
