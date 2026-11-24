import type { Permission, Role } from '../config/constants';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  responsibilities: Array<{
    type: string;
    section?: string;
    event?: string;
    group?: string;
    isPrimary?: boolean;
  }>;
  extraPermissions: string[];
  permissions: Permission[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      /** Correlation id for structured logs */
      id?: string;
    }
  }
}

export {};
