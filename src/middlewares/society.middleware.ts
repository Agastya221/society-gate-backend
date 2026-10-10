import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/ResponseHandler';
import logger from '../utils/logger';

// ============================================
// SOCIETY ISOLATION MIDDLEWARE
// Sets req.societyId (never client-chosen for non-super-admins) and injects it into non-GET bodies
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

    // SUPER_ADMIN can access everything; they name the target society explicitly.
    if (req.user.role === 'SUPER_ADMIN') {
      const body = req.body as RequestBodyWithSociety | undefined;
      const requested = body?.societyId || (req.query.societyId as string | undefined) || req.params.societyId;
      req.societyId = typeof requested === 'string' && requested ? requested : req.user.societyId ?? undefined;
      return next();
    }

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

    // Store computed societyId safely on request. Non-super-admins always get
    // their own society — never a client-supplied value.
    // NOTE: Express 5 re-parses req.query on every read, so assigning to it is a
    // no-op. Controllers must read req.societyId instead of req.query.societyId.
    req.societyId = userSocietyId;

    // IMP-7: Inject societyId into body for non-GET requests
    if (body && typeof body === 'object' && req.method !== 'GET') {
      body.societyId = userSocietyId;
    }

    return next();
  } catch (error) {
    return next(error);
  }
};
