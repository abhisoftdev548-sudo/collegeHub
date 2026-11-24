import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError } from '../utils/errors';

export const CSRF_COOKIE = 'ch_csrf';
export const CSRF_HEADER = 'x-csrf-token';

/**
 * Double-submit-cookie CSRF protection: the readable cookie value must match
 * the request header on every state-changing request. Combined with
 * SameSite=Lax auth cookies and strict CORS this blocks cross-site writes.
 */
export const issueCsrfCookie = (res: Response, existing?: string): string => {
  const token = existing ?? crypto.randomBytes(24).toString('hex');
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  });
  return token;
};

export const csrfProtection = (req: Request, _res: Response, next: NextFunction): void => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const cookieToken = req.cookies?.[CSRF_COOKIE] as string | undefined;
  const headerToken = req.get(CSRF_HEADER);
  if (!cookieToken || !headerToken) {
    return next(new ForbiddenError('Missing CSRF token. Refresh the page and try again.'));
  }
  const a = Buffer.from(cookieToken);
  const b = Buffer.from(headerToken);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return next(new ForbiddenError('Invalid CSRF token. Refresh the page and try again.'));
  }
  return next();
};
