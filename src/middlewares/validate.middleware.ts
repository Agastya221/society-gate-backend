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
        // req.query is a read-only getter in some Express/Node versions — mutate in place
        const parsed = schemas.query.parse(req.query) as Record<string, unknown>;
        for (const key of Object.keys(req.query)) {
          delete (req.query as Record<string, unknown>)[key];
        }
        Object.assign(req.query, parsed);
      }
      if (schemas.params) {
        // Same for req.params
        const parsed = schemas.params.parse(req.params) as Record<string, unknown>;
        for (const key of Object.keys(req.params)) {
          delete (req.params as Record<string, unknown>)[key];
        }
        Object.assign(req.params, parsed);
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
