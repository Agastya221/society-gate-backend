// src/config/redis.ts
import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL!, {
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
});

redis.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

// Try to connect
redis.connect().catch((err) => {
  console.warn('⚠️  Redis not available:', err.message);
});
