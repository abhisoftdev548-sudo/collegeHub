import { PERMISSIONS, type Permission, type Role } from '../config/constants';

type UserLike = {
  role: Role | string;
  extraPermissions?: string[];
  responsibilities?: Array<{ type: string }> | unknown[];
};

/**
 * Baseline capability sets. Data-scope restrictions (which department,
 * section, subject, or event a user may touch) are enforced separately in
 * `services/accessControl.ts` — permissions say *what*, scopes say *where*.
 */
const TEACHER_BASE: Permission[] = [
  'event:read',
  'student:read',
  'attendance:manage',
  'attendance:read',
  'announcement:manage',
  'announcement:read',
  'task:manage',
  'competition:manage',
  'form:manage',
  'registration:read',
  'submission:review',
  'report:read',
  'event:create',
  'event:update',
  'event:manage_volunteers',
  'cr:assign',
  'student:update',
];

const STUDENT_BASE: Permission[] = ['event:read', 'announcement:read', 'task:update_own'];

const CR_BASE: Permission[] = [
  'attendance:read',
  'announcement:read',
  'task:update_own',
  'event:read',
  'student:read',
];

const VOLUNTEER_BASE: Permission[] = ['event:read', 'task:update_own', 'announcement:read'];

const ROLE_BASE: Record<Role, Permission[]> = {
  admin: [...PERMISSIONS],
  teacher: TEACHER_BASE,
  student: STUDENT_BASE,
};

const RESPONSIBILITY_PERMISSIONS: Record<string, Permission[]> = {
  cr: CR_BASE,
  volunteer: VOLUNTEER_BASE,
};

export const getResponsibilityTypes = (user: UserLike): string[] =>
  (user.responsibilities ?? [])
    .map((r) => (typeof r === 'object' && r !== null ? (r as { type?: string }).type : undefined))
    .filter((t): t is string => Boolean(t));

export const getEffectivePermissions = (user: UserLike): Permission[] => {
  if (user.role === 'admin') return [...PERMISSIONS];

  const set = new Set<Permission>(ROLE_BASE[user.role as Role] ?? []);
  for (const responsibility of getResponsibilityTypes(user)) {
    for (const permission of RESPONSIBILITY_PERMISSIONS[responsibility] ?? []) set.add(permission);
  }
  for (const extra of user.extraPermissions ?? []) {
    if ((PERMISSIONS as readonly string[]).includes(extra)) set.add(extra as Permission);
  }
  return [...set];
};

export const hasPermission = (user: UserLike, permission: Permission): boolean =>
  getEffectivePermissions(user).includes(permission);

export const hasAnyPermission = (user: UserLike, permissions: Permission[]): boolean => {
  const effective = getEffectivePermissions(user);
  return permissions.some((p) => effective.includes(p));
};

/** Capabilities surfaced to the frontend so navigation can adapt. */
export const describeCapabilities = (user: UserLike) => {
  const permissions = getEffectivePermissions(user);
  const responsibilities = getResponsibilityTypes(user);
  return { permissions, responsibilities };
};
