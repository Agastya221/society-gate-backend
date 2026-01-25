// src/config/redis.ts
import Redis from 'ioredis';

// Redis connection status
let isRedisConnected = false;

export const redis = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    if (times > 10) {
      console.error('❌ Redis connection failed after 10 attempts');
      return null;
    }
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
  lazyConnect: true,
  enableReadyCheck: true,
  connectTimeout: 10000,
});

redis.on('error', (err) => {
  isRedisConnected = false;
  console.warn('⚠️  Redis connection error:', err.message);
});

redis.on('connect', () => {
  isRedisConnected = true;
  console.log('✅ Redis connected successfully');
});

redis.on('close', () => {
  isRedisConnected = false;
  console.warn('⚠️  Redis connection closed');
});

// Connect to Redis
redis.connect().catch((err) => {
  console.warn('⚠️  Redis not available:', err.message);
});

// Export connection status checker
export const isRedisAvailable = (): boolean => isRedisConnected;

// Graceful Redis operation wrapper
export const safeRedisOperation = async <T>(
  operation: () => Promise<T>,
  fallback: T
): Promise<T> => {
  if (!isRedisConnected) {
    return fallback;
  }
  try {
    return await operation();
  } catch (error) {
    console.error('Redis operation failed:', error);
    return fallback;
  }
};
