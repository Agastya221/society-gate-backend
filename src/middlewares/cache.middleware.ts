import { Request, Response, NextFunction } from 'express';
import { redis, isRedisAvailable } from '../config/redis';
import logger from '../utils/logger';

interface CacheOptions {
  ttl?: number;
  keyPrefix?: string;
  varyBy?: string[];
}

// ============================================
// CACHE MIDDLEWARE
// ============================================

export const cache = (options: CacheOptions = {}) => {
  const { ttl = 300, keyPrefix = 'api', varyBy = [] } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') {
      return next();
    }

    if (!isRedisAvailable()) {
      return next();
    }

    try {
      const baseKey = `${keyPrefix}:${req.originalUrl || req.url}`;

      let varyKey = '';
      if (varyBy.length > 0) {
        const varyValues = varyBy.map(field => {
          if (field === 'userId') return req.user?.id || 'anonymous';
          if (field === 'societyId') return req.user?.societyId || 'none';
          if (field === 'role') return req.user?.role || 'none';
          const qVal = req.query[field];
          const pVal = req.params[field];
          const resolvedQ = Array.isArray(qVal) ? (qVal[0] as string) : (qVal as string | undefined);
          return resolvedQ || pVal || 'none';
        });
        varyKey = `:${varyValues.join(':')}`;
      }

      const cacheKey = `${baseKey}${varyKey}`;

      const cachedData = await redis.get(cacheKey);

      if (cachedData) {
        logger.info({ cacheKey, url: req.originalUrl || req.url }, '🟢 [REDIS CACHE HIT]');
        const parsed = JSON.parse(cachedData);
        return res.json(parsed);
      }

      logger.info({ cacheKey, url: req.originalUrl || req.url }, '🔴 [REDIS CACHE MISS]');

      const originalJson = res.json.bind(res);

      res.json = ((body: unknown) => {
        redis.setex(cacheKey, ttl, JSON.stringify(body)).catch(err => {
          logger.error({ error: err, cacheKey }, '❌ [REDIS CACHE SET ERROR]');
        });
        return originalJson(body);
      }) as typeof res.json;

      next();
    } catch (error) {
      logger.error({ error }, 'Cache middleware error');
      next();
    }
  };
};

// ============================================
// CACHE INVALIDATION HELPERS
// ============================================

export const clearCacheByPattern = async (pattern: string): Promise<number> => {
  try {
    let cursor = '0';
    let deletedCount = 0;

    do {
      const [newCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = newCursor;

      if (keys.length > 0) {
        const deleted = await redis.del(...keys);
        deletedCount += deleted;
      }
    } while (cursor !== '0');

    return deletedCount;
  } catch (error) {
    logger.error({ error, pattern }, 'Clear cache by pattern error');
    return 0;
  }
};

export const clearCache = async (key: string): Promise<boolean> => {
  try {
    const result = await redis.del(key);
    return result > 0;
  } catch (error) {
    logger.error({ error, key }, 'Clear cache error');
    return false;
  }
};

export const clearAllCache = async (): Promise<number> => {
  return clearCacheByPattern('api:*');
};

export const clearCacheAfter = (patterns: string[]) => {
  return async (_req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);

    res.json = ((body: unknown) => {
      patterns.forEach(pattern => {
        clearCacheByPattern(pattern).then(deletedCount => {
          logger.info({ pattern, deletedCount }, '🧹 [REDIS CACHE INVALIDATED]');
        }).catch(err => {
          logger.error({ error: err, pattern }, '❌ [REDIS CACHE INVALIDATION ERROR]');
        });
      });
      return originalJson(body);
    }) as typeof res.json;

    next();
  };
};
