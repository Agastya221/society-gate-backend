import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis';

interface CacheOptions {
  ttl?: number; // Time to live in seconds (default: 300 = 5 minutes)
  keyPrefix?: string; // Prefix for cache keys
  varyBy?: string[]; // Fields to vary cache by (e.g., ['userId', 'societyId'])
}

// ============================================
// CACHE MIDDLEWARE
// ============================================

/**
 * Middleware to cache GET requests
 * Usage: router.get('/endpoint', cache({ ttl: 600 }), controller.method)
 */
export const cache = (options: CacheOptions = {}) => {
  const { ttl = 300, keyPrefix = 'api', varyBy = [] } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    try {
      // Generate cache key
      const baseKey = `${keyPrefix}:${req.originalUrl || req.url}`;

      // Add vary parameters if specified
      let varyKey = '';
      if (varyBy.length > 0) {
        const varyValues = varyBy.map(field => {
          if (field === 'userId') return req.user?.id || 'anonymous';
          if (field === 'societyId') return req.user?.societyId || 'none';
          if (field === 'role') return req.user?.role || 'none';
          return req.query[field] || req.params[field] || 'none';
        });
        varyKey = `:${varyValues.join(':')}`;
      }

      const cacheKey = `${baseKey}${varyKey}`;

      // Check if cached data exists
      const cachedData = await redis.get(cacheKey);

      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        return res.json(parsed);
      }

      // Store original json function
      const originalJson = res.json.bind(res);

      // Override json function to cache the response
      res.json = ((body: any) => {
        // Cache the response
        redis.setex(cacheKey, ttl, JSON.stringify(body)).catch(err => {
          console.error('Redis cache set error:', err);
        });

        // Send the response
        return originalJson(body);
      }) as any;

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };
};

// ============================================
// CACHE INVALIDATION HELPERS
// ============================================

/**
 * Clear cache by pattern
 * Example: clearCacheByPattern('api:/api/v1/resident/notifications*')
 */
export const clearCacheByPattern = async (pattern: string): Promise<number> => {
  try {
    let cursor = '0';
    let deletedCount = 0;

    do {
      const [newCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100
      );

      cursor = newCursor;

      if (keys.length > 0) {
        const deleted = await redis.del(...keys);
        deletedCount += deleted;
      }
    } while (cursor !== '0');

    return deletedCount;
  } catch (error) {
    console.error('Clear cache by pattern error:', error);
    return 0;
  }
};

/**
 * Clear cache by exact key
 */
export const clearCache = async (key: string): Promise<boolean> => {
  try {
    const result = await redis.del(key);
    return result > 0;
  } catch (error) {
    console.error('Clear cache error:', error);
    return false;
  }
};

/**
 * Clear all API cache
 */
export const clearAllCache = async (): Promise<number> => {
  return clearCacheByPattern('api:*');
};

/**
 * Middleware to clear cache after mutations
 * Usage: router.post('/endpoint', clearCacheAfter(['api:/api/v1/notifications*']), controller.method)
 */
export const clearCacheAfter = (patterns: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Store original json function
    const originalJson = res.json.bind(res);

    // Override json function to clear cache after response
    res.json = ((body: any) => {
      // Clear cache patterns
      patterns.forEach(pattern => {
        clearCacheByPattern(pattern).catch(err => {
          console.error('Clear cache after mutation error:', err);
        });
      });

      // Send the response
      return originalJson(body);
    }) as any;

    next();
  };
};
