import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/ResponseHandler';
import logger from '../utils/logger';

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  // IMP-8: Structured logging instead of console.error
  logger.error({
    err,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
  }, 'Request error');

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      statusCode: err.statusCode,
    });
  }

  // Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    logger.error({ prismaError: err.message, code: (err as any).code, meta: (err as any).meta }, 'Prisma error');
    return res.status(400).json({
      success: false,
      message: 'Database error occurred',
      error: err.message,
      code: (err as any).code,
    });
  }

  if (err.name === 'PrismaClientValidationError') {
    logger.error({ prismaValidationError: err.message }, 'Prisma validation error');
    return res.status(400).json({
      success: false,
      message: 'Invalid data provided',
      error: err.message,
    });
  }

  // Default error — temporarily expose details for debugging
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: err.message,
    name: err.name,
  });
};
