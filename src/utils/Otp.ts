import Redis from 'ioredis';

// ============================================
// REDIS CLIENT (SINGLETON)
// ============================================

const redis = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => {
    // Retry connection with exponential backoff
    if (times > 10) {
      console.error('❌ Redis connection failed after 10 attempts');
      return null; // Stop retrying
    }
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  lazyConnect: true, // Don't connect immediately
});

// Handle Redis errors gracefully
redis.on('error', (err) => {
  console.warn('⚠️  Redis connection error:', err.message);
  console.warn('⚠️  OTP and rate limiting features may not work properly');
});

redis.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

// Try to connect
redis.connect().catch((err) => {
  console.warn('⚠️  Redis not available:', err.message);
  console.warn('⚠️  App will run without Redis features');
});

// ============================================
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
