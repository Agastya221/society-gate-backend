import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Role } from '../../prisma/generated/prisma/enums';
import { redis, isRedisAvailable } from '../config/redis';
import logger from '../utils/logger';

// In-memory fallback for token blacklist when Redis is unavailable
const inMemoryBlacklist = new Map<string, number>(); // jti -> expiresAt timestamp

// Periodic cleanup of expired entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [jti, expiresAt] of inMemoryBlacklist) {
    if (now > expiresAt) {
      inMemoryBlacklist.delete(jti);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    logger.debug({ cleaned }, 'Cleaned expired blacklist entries');
  }
}, 5 * 60 * 1000);

export interface JwtPayload {
  userId: string;
  role: Role;
  societyId: string | null;
  flatId: string | null;
  appType: 'RESIDENT_APP' | 'GUARD_APP';
  type: 'access' | 'refresh';
  jti: string;
  iat?: number;
  exp?: number;
}

// Helper to check if error is a JWT error
export function isJwtError(error: unknown): error is Error & { name: string } {
  return error instanceof Error && 'name' in error;
}

// ============================================
// JWT TOKEN GENERATION
// ============================================

export const generateAccessToken = (
  userId: string,
  role: Role,
  societyId: string | null,
  flatId: string | null,
  appType: 'RESIDENT_APP' | 'GUARD_APP',
): string => {
  return jwt.sign(
    {
      userId,
      role,
      societyId,
      flatId,
      appType,
      type: 'access',
      jti: crypto.randomUUID(),
    },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' } // IMP-2: Reduced from 2d to 1h
  );
};

export const generateRefreshToken = (
  userId: string,
  role: Role,
  societyId: string | null,
  flatId: string | null,
  appType: 'RESIDENT_APP' | 'GUARD_APP',
): string => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET must be set separately from JWT_SECRET');
  }
  return jwt.sign(
    {
      userId,
      role,
      societyId,
      flatId,
      appType,
      type: 'refresh',
      jti: crypto.randomUUID(),
    },
    secret,
    { expiresIn: appType === 'RESIDENT_APP' ? '30d' : '7d' }
  );
};

// ============================================
// TOKEN VERIFICATION
// ============================================

export const verifyAccessToken = (token: string): JwtPayload => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

  // Strictly require type === 'access' (fixes IMP-5: no legacy tokens pass through)
  if (decoded.type !== 'access') {
    throw new jwt.JsonWebTokenError('Invalid token type');
  }

  return decoded;
};

export const verifyRefreshToken = (refreshToken: string): JwtPayload => {
  try {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET must be set separately from JWT_SECRET');
    }
    const decoded = jwt.verify(refreshToken, secret) as JwtPayload;

    if (decoded.type !== 'refresh') {
      throw new jwt.JsonWebTokenError('Invalid refresh token type');
    }

    return decoded;
  } catch (error: unknown) {
    if (isJwtError(error)) {
      if (error.name === 'JsonWebTokenError') {
        throw Object.assign(new Error('Invalid refresh token'), { name: 'JsonWebTokenError' });
      }
      if (error.name === 'TokenExpiredError') {
        throw Object.assign(new Error('Refresh token expired. Please login again.'), { name: 'TokenExpiredError' });
      }
    }
    throw error;
  }
};

// ============================================
// TOKEN BLACKLIST (LOGOUT SUPPORT)
// Fixes CRIT-2 & CRIT-3: Always use JTI as key
// ============================================

export const blacklistToken = async (jti: string, expiresIn: number) => {
  if (isRedisAvailable()) {
    try {
      const key = `blacklist:jti:${jti}`;
      await redis.setex(key, expiresIn, '1');
    } catch (error) {
      logger.error({ error }, 'Redis error while blacklisting token');
      inMemoryBlacklist.set(jti, Date.now() + expiresIn * 1000);
    }
  } else {
    if (process.env.NODE_ENV === 'production') {
      logger.warn('Redis unavailable in production - using in-memory token blacklist. Token revocation will not work across instances.');
    }
    inMemoryBlacklist.set(jti, Date.now() + expiresIn * 1000);
  }
};

export const isTokenBlacklisted = async (jti: string): Promise<boolean> => {
  if (isRedisAvailable()) {
    try {
      const key = `blacklist:jti:${jti}`;
      const result = await redis.get(key);
      return result === '1';
    } catch (error) {
      logger.error({ error }, 'Redis error while checking blacklist');
      const expiresAt = inMemoryBlacklist.get(jti);
      if (!expiresAt) return false;
      if (Date.now() > expiresAt) {
        inMemoryBlacklist.delete(jti);
        return false;
      }
      return true;
    }
  } else {
    const expiresAt = inMemoryBlacklist.get(jti);
    if (!expiresAt) return false;
    if (Date.now() > expiresAt) {
      inMemoryBlacklist.delete(jti);
      return false;
    }
    return true;
  }
};

/**
 * Extract JTI from a JWT token string without full verification.
 * Used during logout to get JTI for blacklisting.
 */
export const extractJti = (token: string): { jti?: string; exp?: number } => {
  const decoded = jwt.decode(token) as { jti?: string; exp?: number } | null;
  return decoded || {};
};
