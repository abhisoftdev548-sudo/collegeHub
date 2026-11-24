import type { NextFunction, Request, Response } from 'express';
import { User } from '../models';
import { ACCESS_COOKIE } from '../services/authCookies';
import { UnauthorizedError, ForbiddenError, asyncHandler } from '../utils/errors';
import { describeCapabilities } from '../utils/permissions';
import { verifyAccessToken } from '../utils/tokens';
import { ROLE_VALUES } from '../utils/rbacGuards';

/**
 * Resolves the authenticated user from the HttpOnly access cookie.
 *
 * The token only carries the user id; role, status, responsibilities and
 * permissions are re-read from the database so revoked sessions and changed
 * assignments take effect immediately (never trust client-provided roles).
 */
export const requireAuth = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const token = req.cookies?.[ACCESS_COOKIE] as string | undefined;
  if (!token) throw new UnauthorizedError();

  const payload = verifyAccessToken(token);
  const user = await User.findById(payload.sub).select('+passwordHash');
  if (!user) throw new UnauthorizedError('Session is no longer valid');
  if (user.status !== 'active') throw new ForbiddenError('Your account is not active. Contact the administrator.');

  const capabilities = describeCapabilities({
    role: user.role as never,
    extraPermissions: user.extraPermissions as string[],
    responsibilities: user.responsibilities as never,
  });

  req.user = {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role as never,
    responsibilities: (user.responsibilities ?? []).map((r: { type: string; section?: unknown; event?: unknown; group?: unknown; isPrimary?: boolean }) => ({
      type: r.type as string,
      section: r.section ? String(r.section) : undefined,
      event: r.event ? String(r.event) : undefined,
      group: r.group ? String(r.group) : undefined,
      isPrimary: Boolean(r.isPrimary),
    })),
    extraPermissions: [...(user.extraPermissions ?? [])],
    permissions: capabilities.permissions,
  };

  void ROLE_VALUES;
  next();
});

/** Optional auth: populates req.user when a valid session exists. */
export const optionalAuth = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const token = req.cookies?.[ACCESS_COOKIE] as string | undefined;
  if (!token) return next();
  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub);
    if (user && user.status === 'active') {
      const capabilities = describeCapabilities({
        role: user.role as never,
        extraPermissions: user.extraPermissions as string[],
        responsibilities: user.responsibilities as never,
      });
      req.user = {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role as never,
        responsibilities: (user.responsibilities ?? []).map((r: { type: string; section?: unknown; event?: unknown; group?: unknown; isPrimary?: boolean }) => ({
          type: r.type as string,
          section: r.section ? String(r.section) : undefined,
          event: r.event ? String(r.event) : undefined,
          group: r.group ? String(r.group) : undefined,
          isPrimary: Boolean(r.isPrimary),
        })),
        extraPermissions: [...(user.extraPermissions ?? [])],
        permissions: capabilities.permissions,
      };
    }
  } catch {
    // ignore invalid tokens for optional auth
  }
  return next();
});
