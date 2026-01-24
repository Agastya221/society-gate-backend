// In error.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/ResponseHandler';

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // ✅ Log full error details for debugging
  console.error('=== ERROR DETAILS ===');
  console.error('Error name:', err.name);
  console.error('Error message:', err.message);
  console.error('Error stack:', err.stack);
  console.error('Request path:', req.path);
  console.error('Request method:', req.method);
  console.error('Request user:', req.user?.id);
  console.error('====================');

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  // Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    return res.status(400).json({
      success: false,
      message: 'Database error occurred',
      ...(process.env.NODE_ENV === 'development' && { error: err.message }),
    });
  }

  // ✅ Add more Prisma error types
  if (err.name === 'PrismaClientValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid data provided',
      ...(process.env.NODE_ENV === 'development' && { error: err.message }),
    });
  }

  // Default error - but include details in development
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { 
      error: err.message,
      stack: err.stack 
    }),
  });
};