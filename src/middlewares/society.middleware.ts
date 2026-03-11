import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/ResponseHandler';
import logger from '../utils/logger';

// ============================================
// SOCIETY ISOLATION MIDDLEWARE
// Fixes IMP-7: Now also injects societyId for GET query params
// ============================================

interface RequestBodyWithSociety {
  societyId?: string;
  [key: string]: unknown;
}

export const ensureSameSociety = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
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

    const body = req.body as RequestBodyWithSociety | undefined;
    const bodySocietyId = body?.societyId;
    const querySocietyId = req.query.societyId as string | undefined;
    const paramSocietyId = req.params.societyId;

    const resourceSocietyId = bodySocietyId || querySocietyId || paramSocietyId;

    // If client provided a societyId, it must match user's society
    if (
      resourceSocietyId &&
      String(resourceSocietyId) !== String(userSocietyId)
    ) {
      logger.warn(
        { userId: req.user.id, userSociety: userSocietyId, requestedSociety: resourceSocietyId },
        'Cross-society access attempt blocked'
      );
      return next(
        new AppError(
          'Access denied. You can only access resources in your society.',
          403
        )
      );
    }

    // Store computed societyId safely on request
    req.societyId = userSocietyId;

    // IMP-7: Inject societyId into body for non-GET requests
    if (body && !bodySocietyId && req.method !== 'GET') {
      body.societyId = userSocietyId;
    }

    // IMP-7: For GET requests, override query.societyId so services pick it up
    if (req.method === 'GET' && !querySocietyId) {
      (req.query as Record<string, string>).societyId = userSocietyId;
    }

    return next();
  } catch (error) {
    return next(error);
  }
};
