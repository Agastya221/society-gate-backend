import { redis } from "../config/redis";
// OTP + RATE LIMIT UTILS (MATCHES UserService)
// ============================================

export class OtpService {
  // --------------------------------
  // OTP STORAGE (used by UserService)
  // --------------------------------

  async setOtp(phone: string, otp: string, ttlSeconds: number): Promise<void> {
    await redis.set(`otp:${phone}`, otp, 'EX', ttlSeconds);
  }

  async getOtp(phone: string): Promise<string | null> {
    return redis.get(`otp:${phone}`);
  }

  async deleteOtp(phone: string): Promise<void> {
    await redis.del(`otp:${phone}`);
  }

  // --------------------------------
  // RATE LIMIT HELPERS (phone / IP)
  // --------------------------------

  async getCount(key: string): Promise<number> {
    const value = await redis.get(key);
    return value ? Number(value) : 0;
  }

  async increment(key: string, ttlSeconds: number): Promise<void> {
    const pipeline = redis.multi();
    pipeline.incr(key);
    pipeline.expire(key, ttlSeconds);
    await pipeline.exec();
  }

  // --------------------------------
  // OPTIONAL DEBUG / CLEANUP HELPERS
  // --------------------------------

  async clearOtpForPhone(phone: string): Promise<void> {
    await redis.del(`otp:${phone}`);
  }

  async clearRateLimits(phone: string, ip?: string): Promise<void> {
    await redis.del(`otp:attempts:phone:${phone}`);
    if (ip) {
      await redis.del(`otp:attempts:ip:${ip}`);
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
