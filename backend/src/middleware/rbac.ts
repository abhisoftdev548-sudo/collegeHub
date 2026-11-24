import type { NextFunction, Request, Response } from 'express';
import type { Permission, Role } from '../config/constants';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new UnauthorizedError());
    if (!roles.includes(req.user.role)) return next(new ForbiddenError());
    return next();
  };

export const requirePermission =
  (...permissions: Permission[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new UnauthorizedError());
    if (!permissions.every((permission) => req.user!.permissions.includes(permission))) {
      return next(new ForbiddenError());
    }
    return next();
  };

export const requireAnyPermission =
  (...permissions: Permission[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new UnauthorizedError());
    if (!permissions.some((permission) => req.user!.permissions.includes(permission))) {
      return next(new ForbiddenError());
    }
    return next();
  };

export const requireResponsibility =
  (type: 'cr' | 'volunteer') =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new UnauthorizedError());
    if (req.user.role === 'admin') return next();
    if (!req.user.responsibilities.some((responsibility) => responsibility.type === type)) {
      return next(new ForbiddenError(`Requires the ${type.toUpperCase()} responsibility`));
    }
    return next();
  };
