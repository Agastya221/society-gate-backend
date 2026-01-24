import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/Client';
import { AppError } from '../utils/ResponseHandler';
import { Role } from '../../prisma/generated/prisma/enums';
import { redis } from '../config/redis';
import crypto from "crypto";

interface JwtPayload {
  userId: string;
  role: Role;
  societyId: string | null;
  flatId: string | null;
  appType: 'RESIDENT_APP' | 'GUARD_APP';
  type?: 'access' | 'refresh';
  jti: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
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
    { expiresIn: '15m' } // Access token expires in 15 minutes
  );
};

export const generateRefreshToken = (
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
      type: 'refresh',
      jti: crypto.randomUUID(),
    },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!,
    { expiresIn: appType === 'RESIDENT_APP' ? '30d' : '7d' } // Refresh token lasts longer
  );
};

// Legacy token generation (for backward compatibility)
export const generateToken = (
  userId: string,
  role: Role,
  societyId: string | null,
  flatId: string | null,
  appType: 'RESIDENT_APP' | 'GUARD_APP'
): string => {
  const expiresIn = appType === 'RESIDENT_APP' ? '30d' : '7d';

  return jwt.sign(
    {
      userId,
      role,
      societyId,
      flatId,
      appType,
      jti: crypto.randomUUID(),
    },
    process.env.JWT_SECRET!,
    { expiresIn }
  );
};

// ============================================
// TOKEN BLACKLIST (LOGOUT SUPPORT)
// ============================================

export const blacklistToken = async (jti: string, expiresIn: number) => {
  try {
    const key = `blacklist:jti:${jti}`;
    await redis.setex(key, expiresIn, '1');
  } catch (error) {
    console.error('Redis error while blacklisting token:', error);
  }
};

export const isTokenBlacklisted = async (jti: string): Promise<boolean> => {
  try {
    const key = `blacklist:jti:${jti}`;
    const result = await redis.get(key);
    return result === '1';
  } catch (error) {
    console.error('Redis error while checking blacklist:', error);
    return false;
  }
};

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      throw new AppError('No token provided. Please login.', 401);
    }


    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    // Check if token is blacklisted (logged out)
    if (decoded.jti) {
      const isBlacklisted = await isTokenBlacklisted(decoded.jti);
      if (isBlacklisted) {
        throw new AppError('Token has been revoked. Please login again.', 401);
      }
    }
    // Ensure this is an access token if using the new token system
    if (decoded.type && decoded.type !== 'access') {
      throw new AppError('Invalid token type', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { flat: true, society: true },
    });

    if (!user || !user.isActive) {
      throw new AppError('User not found or inactive', 401);
    }

    // SUPER_ADMIN doesn't need society assignment
    // Other roles need an active society
    if (user.role !== 'SUPER_ADMIN') {
      if (user.societyId && !user.society?.isActive) {
        throw new AppError('Society is inactive', 403);
      }
    }

    req.user = user;
    next();
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token', 401));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Token expired. Please login again.', 401));
    }
    next(error);
  }
};

// ============================================
// ONBOARDING AUTHENTICATION (Allows inactive users)
// ============================================

export const authenticateForOnboarding = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      throw new AppError('No token provided. Please login.', 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    // Check if token is blacklisted (logged out)
    if (decoded.jti) {
      const isBlacklisted = await isTokenBlacklisted(decoded.jti);
      if (isBlacklisted) {
        throw new AppError('Token has been revoked. Please login again.', 401);
      }
    }


    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { flat: true, society: true },
    });

    if (!user) {
      throw new AppError('User not found', 401);
    }

    // Allow inactive users for onboarding - they need to complete onboarding to become active
    // Only check if user exists, not if they're active

    req.user = user;
    next();
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token', 401));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Token expired. Please login again.', 401));
    }
    next(error);
  }
};

// ============================================
// APP-SPECIFIC AUTHENTICATION
// ============================================

export const authenticateResidentApp = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // First authenticate
  await authenticate(req, res, (err?: any) => {
    // If authentication failed, propagate the error
    if (err) {
      return next(err);
    }

    // If no user (shouldn't happen after successful auth), return error
    if (!req.user) {
      return next(new AppError('Authentication failed', 401));
    }

    // Check role - Allow RESIDENT, ADMIN, and SUPER_ADMIN
    const allowedRoles = ['RESIDENT', 'ADMIN', 'SUPER_ADMIN'];
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('Access denied. This is for residents only.', 403));
    }

    // Ensure resident has a flat assigned (except for ADMIN/SUPER_ADMIN)
    if (req.user.role === 'RESIDENT' && !req.user.flatId) {
      return next(new AppError('User must have a flat assigned', 403));
    }

    next();
  });
};

export const authenticateGuardApp = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // First authenticate
  await authenticate(req, res, (err?: any) => {
    // If authentication failed, propagate the error
    if (err) {
      return next(err);
    }

    // If no user (shouldn't happen after successful auth), return error
    if (!req.user) {
      return next(new AppError('Authentication failed', 401));
    }

    // Check role - Only GUARD allowed
    if (req.user.role !== 'GUARD') {
      return next(new AppError('Access denied. This is for guards only.', 403));
    }

    // Ensure guard has a society assigned
    if (!req.user.societyId) {
      return next(new AppError('Guard must be assigned to a society', 403));
    }

    next();
  });
};

// ============================================
// REFRESH TOKEN VERIFICATION
// ============================================

export const verifyRefreshToken = (refreshToken: string): JwtPayload => {
  try {
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!
    ) as JwtPayload;

    if (decoded.type && decoded.type !== 'refresh') {
      throw new AppError('Invalid refresh token', 401);
    }

    return decoded;
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      throw new AppError('Invalid refresh token', 401);
    }
    if (error.name === 'TokenExpiredError') {
      throw new AppError('Refresh token expired. Please login again.', 401);
    }
    throw error;
  }
};

// ============================================
// AUTHORIZATION MIDDLEWARE (Role-based)
// ============================================

export const authorize = (...allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('User not authenticated', 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          `Access denied. Required role: ${allowedRoles.join(' or ')}`,
          403
        )
      );
    }

    next();
  };
};

// ============================================
// SOCIETY ISOLATION MIDDLEWARE
// ============================================

export const ensureSameSociety = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // If authenticate middleware hasn't run or failed, req.user won't exist
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    // SUPER_ADMIN can access any society
    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    const userSocietyId = req.user.societyId;

    // Ensure user has a society
    if (!userSocietyId) {
      throw new AppError('User must be assigned to a society', 403);
    }

    const resourceSocietyId = req.body.societyId || req.params.societyId || req.query.societyId;

    if (resourceSocietyId && resourceSocietyId !== userSocietyId) {
      throw new AppError('Access denied. You can only access resources in your society.', 403);
    }

    next();
  } catch (error) {
    next(error);
  }
};