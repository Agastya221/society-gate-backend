import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// ARCH-1: Zod validation middleware
// Validates req.body, req.query, and/or req.params against Zod schemas.

interface ValidationSchemas {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query) as typeof req.query;
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as typeof req.params;
      }
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const messages = error.issues.map((issue: z.ZodIssue) => {
          const path = issue.path.join('.');
          return path ? `${path}: ${issue.message}` : issue.message;
        });
        return _res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: messages,
        });
      }
      next(error);
    }
  };
}
