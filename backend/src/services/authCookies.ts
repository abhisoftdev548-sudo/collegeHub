import type { Response } from 'express';
import { env } from '../config/env';

export const ACCESS_COOKIE = 'ch_access';
export const REFRESH_COOKIE = 'ch_refresh';

const baseCookie = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.cookieSecure,
  path: '/',
};

export const setAuthCookies = (res: Response, accessToken: string, refreshToken: string): void => {
  res.cookie(ACCESS_COOKIE, accessToken, { ...baseCookie, maxAge: 1000 * 60 * 30 });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...baseCookie,
    path: '/api/auth',
    maxAge: 1000 * 60 * 60 * 24 * env.refreshTokenTtlDays,
  });
};

export const clearAuthCookies = (res: Response): void => {
  res.clearCookie(ACCESS_COOKIE, { ...baseCookie });
  res.clearCookie(REFRESH_COOKIE, { ...baseCookie, path: '/api/auth' });
};
