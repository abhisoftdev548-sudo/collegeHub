import { Types } from 'mongoose';
import { env } from '../config/env';
import { RefreshSession, StudentProfile, User, type UserDoc } from '../models';
import { clearAuthCookies, setAuthCookies } from './authCookies';
import type { Request, Response } from 'express';
import { ConflictError, UnauthorizedError, ValidationError } from '../utils/errors';
import { hashPassword, verifyPassword } from '../utils/password';
import {
  hashToken,
  randomToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/tokens';
import { describeCapabilities } from '../utils/permissions';
import type { AuthUser } from '../types/express';

const REFRESH_COOKIE = 'ch_refresh';

const buildAuthUser = (user: UserDoc): AuthUser => {
  if (!user) throw new UnauthorizedError();
  const capabilities = describeCapabilities({
    role: user.role as never,
    extraPermissions: user.extraPermissions as string[],
    responsibilities: user.responsibilities as never,
  });
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role as never,
    responsibilities: (user.responsibilities ?? []).map((r) => ({
      type: r.type as string,
      section: r.section ? String(r.section) : undefined,
      event: r.event ? String(r.event) : undefined,
      group: r.group ? String(r.group) : undefined,
      isPrimary: Boolean(r.isPrimary),
    })),
    extraPermissions: [...(user.extraPermissions ?? [])],
    permissions: capabilities.permissions,
  };
};

export interface SessionContext {
  ip?: string;
  userAgent?: string;
}

export const createSession = async (
  res: Response,
  userId: string,
  context: SessionContext,
): Promise<{ user: AuthUser }> => {
  const user = await User.findById(userId);
  if (!user) throw new UnauthorizedError();
  if (user.status !== 'active') throw new UnauthorizedError('Account is not active');

  const authUser = buildAuthUser(user);
  const familyId = randomToken(12);
  const refreshToken = signRefreshToken({ sub: authUser.id, familyId });

  await RefreshSession.create({
    user: new Types.ObjectId(authUser.id),
    tokenHash: hashToken(refreshToken),
    familyId,
    ip: context.ip,
    userAgent: context.userAgent?.slice(0, 300),
    expiresAt: new Date(Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000),
  });

  const accessToken = signAccessToken({ sub: authUser.id, role: authUser.role, name: authUser.name });
  setAuthCookies(res, accessToken, refreshToken);
  await User.updateOne({ _id: authUser.id }, { $set: { lastLoginAt: new Date() } });

  return { user: authUser };
};

export const login = async (
  res: Response,
  input: { email: string; password: string },
  context: SessionContext,
) => {
  const user = await User.findOne({ email: input.email.toLowerCase().trim() }).select('+passwordHash');
  if (!user) throw new UnauthorizedError('Invalid email or password');
  if (user.status === 'suspended') throw new UnauthorizedError('Your account has been suspended');
  if (user.status === 'inactive') throw new UnauthorizedError('Your account is inactive');

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) throw new UnauthorizedError('Invalid email or password');

  return createSession(res, String(user._id), context);
};

export const rotateSession = async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (!token) throw new UnauthorizedError();

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    clearAuthCookies(res);
    throw new UnauthorizedError('Session expired. Please sign in again.');
  }

  const tokenHash = hashToken(token);
  const session = await RefreshSession.findOne({ tokenHash });

  if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
    // Token reuse of a revoked session: revoke the whole family (defence in depth).
    if (session) {
      await RefreshSession.updateMany(
        { familyId: session.familyId, revokedAt: { $exists: false } },
        { $set: { revokedAt: new Date() } },
      );
    }
    clearAuthCookies(res);
    throw new UnauthorizedError('Session expired. Please sign in again.');
  }

  const user = await User.findById(session.user);
  if (!user || user.status !== 'active') {
    clearAuthCookies(res);
    throw new UnauthorizedError('Session expired. Please sign in again.');
  }

  // Rotate: revoke the used token and issue a new refresh token in the same family.
  const newRefreshToken = signRefreshToken({ sub: String(user._id), familyId: session.familyId });
  await RefreshSession.updateOne(
    { _id: session._id },
    { $set: { revokedAt: new Date(), replacedByTokenHash: hashToken(newRefreshToken) } },
  );
  await RefreshSession.create({
    user: user._id,
    tokenHash: hashToken(newRefreshToken),
    familyId: session.familyId,
    ip: req.ip,
    userAgent: req.get('user-agent')?.slice(0, 300),
    expiresAt: new Date(Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000),
  });

  const authUser = buildAuthUser(user);
  const accessToken = signAccessToken({ sub: authUser.id, role: authUser.role, name: authUser.name });
  setAuthCookies(res, accessToken, newRefreshToken);
  void payload;
  return { user: authUser };
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (token) {
    await RefreshSession.updateOne({ tokenHash: hashToken(token) }, { $set: { revokedAt: new Date() } });
  }
  clearAuthCookies(res);
};

export const changePassword = async (
  userId: string,
  input: { currentPassword: string; newPassword: string },
): Promise<void> => {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw new UnauthorizedError();
  const valid = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!valid) throw new ValidationError('Current password is incorrect');
  if (input.currentPassword === input.newPassword) {
    throw new ValidationError('New password must be different from the current password');
  }
  user.passwordHash = await hashPassword(input.newPassword);
  user.mustChangePassword = false;
  await user.save();
  await RefreshSession.updateMany({ user: userId, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
};

/** Profile payload shared by /auth/me and the shell. */
export const getSessionProfile = async (userId: string) => {
  const user = await User.findById(userId).lean();
  if (!user) throw new UnauthorizedError();

  const capabilities = describeCapabilities({
    role: user.role as never,
    extraPermissions: user.extraPermissions as string[],
    responsibilities: user.responsibilities as never,
  });

  const responsibilities = (user.responsibilities ?? []).map(
    (r: { type: string; section?: unknown; event?: unknown; group?: unknown; isPrimary?: boolean }) => ({
      type: r.type,
      section: r.section ? String(r.section) : undefined,
      event: r.event ? String(r.event) : undefined,
      group: r.group ? String(r.group) : undefined,
      isPrimary: Boolean(r.isPrimary),
    }),
  );

  let studentProfile = null;
  if (user.role === 'student') {
    studentProfile = await StudentProfile.findOne({ user: userId })
      .populate('department', 'name code')
      .populate('course', 'name code totalSemesters')
      .populate('semester', 'number label')
      .populate('section', 'name')
      .populate('academicSession', 'name')
      .lean();
  }

  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    avatarUrl: user.avatarUrl,
    designation: user.designation,
    mustChangePassword: Boolean(user.mustChangePassword),
    lastLoginAt: user.lastLoginAt,
    ...capabilities,
    responsibilities,
    studentProfile,
  };
};

export const registerSelf = async (
  res: Response,
  input: { name: string; email: string; password: string; enrollmentNumber: string; phone?: string },
) => {
  const existing = await User.findOne({ email: input.email.toLowerCase() });
  if (existing) throw new ConflictError('An account with this email already exists');
  const passwordHash = await hashPassword(input.password);
  const user = await User.create({
    name: input.name,
    email: input.email,
    phone: input.phone,
    passwordHash,
    role: 'student',
    status: 'inactive', // requires admin approval/assignment
    mustChangePassword: false,
  });
  void input.enrollmentNumber;
  return { userId: String(user._id) };
};
