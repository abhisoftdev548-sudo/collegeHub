import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { ValidationError } from '../utils/errors';

export interface ValidationTargets {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

const flattenZodError = (error: ZodError): Array<{ path: string; message: string }> =>
  error.errors.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));

/**
 * Zod request validation. Parsed output replaces the raw input so controllers
 * only ever see validated, coerced data (no trusting client payloads).
 */
export const validate =
  (targets: ValidationTargets): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (targets.params) req.params = targets.params.parse(req.params) as typeof req.params;
      if (targets.query) {
        const parsed = targets.query.parse(req.query);
        Object.defineProperty(req, 'validatedQuery', { value: parsed, writable: true, configurable: true });
      }
      if (targets.body) req.body = targets.body.parse(req.body);
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return next(new ValidationError('Please correct the highlighted fields', flattenZodError(error)));
      }
      return next(error);
    }
  };

/** Typed accessor for validated query params. */
export const validatedQuery = <T>(req: Request): T => (req as Request & { validatedQuery: T }).validatedQuery;
