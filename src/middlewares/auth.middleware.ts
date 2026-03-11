import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/Client';
import { AppError } from '../utils/ResponseHandler';
import { Role } from '../../prisma/generated/prisma/enums';
import type { AuthenticatedUser } from '../types';

// Re-export token operations so existing imports continue to work
export {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  blacklistToken,
  isTokenBlacklisted,
  extractJti,
  isJwtError,
} from '../services/token.service';

import {
  verifyAccessToken,
  isTokenBlacklisted,
  isJwtError,
} from '../services/token.service';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      societyId?: string;
    }
  }
}

// Re-export society middleware so existing route imports still work
export { ensureSameSociety } from './society.middleware';

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
      return next(new AppError('No token provided. Please login.', 401));
    }

    const decoded = verifyAccessToken(token);

    // Check if token is blacklisted
    if (decoded.jti) {
      const isBlacklisted = await isTokenBlacklisted(decoded.jti);
      if (isBlacklisted) {
        return next(new AppError('Token has been revoked. Please login again.', 401));
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { flat: true, society: true },
    });

    if (!user || !user.isActive) {
      return next(new AppError('User not found or inactive', 401));
    }

    // SUPER_ADMIN doesn't need society assignment
    if (user.role !== 'SUPER_ADMIN') {
      if (user.societyId && !user.society?.isActive) {
        return next(new AppError('Society is inactive', 403));
      }
    }

    req.user = user;
    next();
  } catch (error: unknown) {
    if (isJwtError(error)) {
      if (error.name === 'JsonWebTokenError') {
        return next(new AppError('Invalid token', 401));
      }
      if (error.name === 'TokenExpiredError') {
        return next(new AppError('Token expired. Please login again.', 401));
      }
    }
    return next(error);
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

    const decoded = verifyAccessToken(token);

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

    // Allow inactive users for onboarding
    req.user = user;
    next();
  } catch (error: unknown) {
    if (isJwtError(error)) {
      if (error.name === 'JsonWebTokenError') {
        return next(new AppError('Invalid token', 401));
      }
      if (error.name === 'TokenExpiredError') {
        return next(new AppError('Token expired. Please login again.', 401));
      }
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
  await authenticate(req, res, (err?: unknown) => {
    if (err) return next(err);
    if (!req.user) return next(new AppError('Authentication failed', 401));

    const allowedRoles = ['RESIDENT', 'ADMIN', 'SUPER_ADMIN'];
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('Access denied. This is for residents only.', 403));
    }

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
  await authenticate(req, res, (err?: unknown) => {
    if (err) return next(err);
    if (!req.user) return next(new AppError('Authentication failed', 401));

    if (req.user.role !== 'GUARD') {
      return next(new AppError('Access denied. This is for guards only.', 403));
    }

    if (!req.user.societyId) {
      return next(new AppError('Guard must be assigned to a society', 403));
    }

    next();
  });
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
