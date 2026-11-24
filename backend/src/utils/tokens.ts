import crypto from 'node:crypto';
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { UnauthorizedError } from './errors';

export interface AccessTokenPayload extends JwtPayload {
  sub: string;
  role: string;
  name: string;
}

export interface RefreshTokenPayload extends JwtPayload {
  sub: string;
  familyId: string;
}

export const signAccessToken = (payload: { sub: string; role: string; name: string }): string =>
  jwt.sign(payload, env.jwtAccessSecret, {
    expiresIn: env.accessTokenTtl as SignOptions['expiresIn'],
  });

export const signRefreshToken = (payload: { sub: string; familyId: string }): string =>
  jwt.sign(payload, env.jwtRefreshSecret, {
    expiresIn: `${env.refreshTokenTtlDays}d` as SignOptions['expiresIn'],
  });

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  try {
    return jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload;
  } catch {
    throw new UnauthorizedError('Session expired. Please sign in again.');
  }
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  try {
    return jwt.verify(token, env.jwtRefreshSecret) as RefreshTokenPayload;
  } catch {
    throw new UnauthorizedError('Session expired. Please sign in again.');
  }
};

export const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

export const randomToken = (bytes = 32): string => crypto.randomBytes(bytes).toString('hex');
