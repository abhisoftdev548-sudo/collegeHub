import type { Request, Response } from 'express';
import * as authService from '../services/authService';
import { issueCsrfCookie } from '../middleware/csrf';
import { ok, created } from '../utils/apiResponse';
import { NotFoundError, UnauthorizedError } from '../utils/errors';
import { User } from '../models';
import { recordAudit } from '../utils/audit';

const context = (req: Request) => ({ ip: req.ip, userAgent: req.get('user-agent') ?? undefined });

export const login = async (req: Request, res: Response) => {
  const { user } = await authService.login(res, req.body, context(req));
  issueCsrfCookie(res, req.cookies?.['ch_csrf']);
  recordAudit(req, { action: 'auth.login', entity: 'User', entityId: user.id, description: 'Signed in' });
  return ok(res, { user });
};

export const logout = async (req: Request, res: Response) => {
  await authService.logout(req, res);
  return ok(res, { signedOut: true }, 'Signed out');
};

export const refresh = async (req: Request, res: Response) => {
  const { user } = await authService.rotateSession(req, res);
  issueCsrfCookie(res, req.cookies?.['ch_csrf']);
  return ok(res, { user });
};

export const me = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const profile = await authService.getSessionProfile(req.user.id);
  return ok(res, profile);
};

export const csrf = async (_req: Request, res: Response) => {
  const token = issueCsrfCookie(res);
  return ok(res, { csrfToken: token });
};

export const changePassword = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  await authService.changePassword(req.user.id, req.body);
  recordAudit(req, { action: 'auth.password_changed', entity: 'User', entityId: req.user.id });
  return ok(res, { changed: true }, 'Password updated');
};

export const updateProfile = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { $set: { name: req.body.name, phone: req.body.phone, avatarUrl: req.body.avatarUrl } },
    { new: true, runValidators: true },
  );
  if (!user) throw new NotFoundError('User');
  const profile = await authService.getSessionProfile(req.user.id);
  return ok(res, profile, 'Profile updated');
};

export const register = async (req: Request, res: Response) => {
  const result = await authService.registerSelf(res, req.body);
  return created(
    res,
    result,
    'Registration received. An administrator will activate your account after verification.',
  );
};
