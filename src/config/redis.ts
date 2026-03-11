import Redis from 'ioredis';
import logger from '../utils/logger';

// Redis connection status
let isRedisConnected = false;

export const redis = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    if (times > 10) {
      logger.error('Redis connection failed after 10 attempts');
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
  // IMP-4: Loud warning in production
  if (process.env.NODE_ENV === 'production') {
    logger.error({ error: err.message }, 'PRODUCTION: Redis connection error - in-memory fallback active, token revocation and caching will not work across instances');
  } else {
    logger.warn({ error: err.message }, 'Redis connection error');
  }
});

redis.on('connect', () => {
  isRedisConnected = true;
  logger.info('Redis connected successfully');
});

redis.on('close', () => {
  isRedisConnected = false;
  logger.warn('Redis connection closed');
});

// Connect to Redis
redis.connect().catch((err) => {
  if (process.env.NODE_ENV === 'production') {
    logger.error({ error: err.message }, 'PRODUCTION: Redis not available - this is dangerous in production');
  } else {
    logger.warn({ error: err.message }, 'Redis not available');
  }
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
    logger.error({ error }, 'Redis operation failed');
    return fallback;
  }
};
