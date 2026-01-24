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
      return next(new AppError('No token provided. Please login.', 401)); // ✅ return here
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    
    // Check if token is blacklisted
    if (decoded.jti) {
      const isBlacklisted = await isTokenBlacklisted(decoded.jti);
      if (isBlacklisted) {
        return next(new AppError('Token has been revoked. Please login again.', 401)); // ✅ return here
      }
    }
    
    // Ensure this is an access token
    if (decoded.type && decoded.type !== 'access') {
      return next(new AppError('Invalid token type', 401)); // ✅ return here
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { flat: true, society: true },
    });

    if (!user || !user.isActive) {
      return next(new AppError('User not found or inactive', 401)); // ✅ return here
    }

    // SUPER_ADMIN doesn't need society assignment
    // Other roles need an active society
    if (user.role !== 'SUPER_ADMIN') {
      if (user.societyId && !user.society?.isActive) {
        return next(new AppError('Society is inactive', 403)); // ✅ return here
      }
    }

    req.user = user;
    next();
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token', 401)); // ✅ return here
    }
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Token expired. Please login again.', 401)); // ✅ return here
    }
    return next(error); // ✅ return here
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

// If you have a global type augmentation already, put this there instead.
// This is the simplest local-safe way:
type ReqWithSociety = Request & { societyId?: string };

export const ensureSameSociety = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Must have req.user (set by authenticate)
    if (!req.user) {
      return next(
        new AppError('Authentication required. User not found in request.', 401)
      );
    }

    // SUPER_ADMIN can access everything
    if (req.user.role === 'SUPER_ADMIN') return next();

    const userSocietyId = req.user.societyId;
    if (!userSocietyId) {
      return next(new AppError('User must be assigned to a society', 403));
    }

    // Read societyId from incoming request WITHOUT mutating req.query
    const bodySocietyId = (req.body as any)?.societyId;
    const querySocietyId = (req.query as any)?.societyId;
    const paramSocietyId = (req.params as any)?.societyId;

    const resourceSocietyId = bodySocietyId || querySocietyId || paramSocietyId;

    // If client provided a societyId, it must match user's society
    if (
      resourceSocietyId &&
      String(resourceSocietyId) !== String(userSocietyId)
    ) {
      return next(
        new AppError(
          'Access denied. You can only access resources in your society.',
          403
        )
      );
    }

    // ✅ Store computed societyId safely on request (no mutation of query)
    (req as ReqWithSociety).societyId = userSocietyId;

    // ✅ For non-GET requests, you may also inject into body IF body exists
    if (req.body && !bodySocietyId) {
      (req.body as any).societyId = userSocietyId;
    }

    return next();
  } catch (error) {
    return next(error);
  }
};
