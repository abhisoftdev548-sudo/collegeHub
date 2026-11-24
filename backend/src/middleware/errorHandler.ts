import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';
import { env } from '../config/env';
import { logger } from '../config/logger';

interface ErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route not found: ${req.method} ${req.originalUrl}` },
  } satisfies ErrorBody);
};

/**
 * Centralised error handler. Translates known error classes into consistent
 * API responses and hides internal details from clients in production.
 */
export const errorHandler = (
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  let statusCode = 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'Something went wrong. Please try again.';
  let details: unknown;

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
    details = error.details;
  } else if (error instanceof ZodError) {
    statusCode = 422;
    code = 'VALIDATION_ERROR';
    message = 'Please correct the highlighted fields';
    details = error.errors.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
  } else if (error instanceof mongoose.Error.CastError) {
    statusCode = 400;
    code = 'INVALID_ID';
    message = `Invalid value for ${error.path}`;
  } else if (error instanceof mongoose.Error.ValidationError) {
    statusCode = 422;
    code = 'VALIDATION_ERROR';
    message = 'Some fields are invalid';
    details = Object.values(error.errors).map((issue) => ({
      path: issue.path,
      message: issue.message,
    }));
  } else if (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: number }).code === 11000
  ) {
    statusCode = 409;
    code = 'DUPLICATE_KEY';
    const keyValue = (error as { keyValue?: Record<string, unknown> }).keyValue ?? {};
    const field = Object.keys(keyValue)[0];
    message = field ? `A record with this ${field} already exists` : 'A record with these values already exists';
    details = keyValue;
  } else if (
    error instanceof SyntaxError &&
    (error as { status?: number }).status === 400 &&
    'body' in error
  ) {
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'The request body contains invalid JSON';
  } else if (typeof error === 'object' && error !== null && (error as { type?: string }).type === 'entity.too.large') {
    statusCode = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'The uploaded content is too large';
  }

  if (statusCode >= 500) {
    logger.error({ err: error, path: req.originalUrl, method: req.method }, 'Unhandled request error');
    if (env.isProduction) details = undefined;
  } else {
    logger.debug({ path: req.originalUrl, method: req.method, code, message }, 'Request rejected');
  }

  res.status(statusCode).json({ success: false, error: { code, message, details } } satisfies ErrorBody);
};
