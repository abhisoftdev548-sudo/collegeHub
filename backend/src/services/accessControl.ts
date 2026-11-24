import { Types } from 'mongoose';
import {
  Course,
  Department,
  Event,
  Section,
  StudentProfile,
  TeacherSubjectScope,
  TeachingAssignment,
} from './accessControlModels';
import { ForbiddenError } from '../utils/errors';
import type { AuthUser } from '../types/express';

const toId = (value: unknown): string => String(value);

export interface TeacherScope {
  departmentIds: string[];
  /** Sections the teacher is explicitly assigned to via teaching assignments. */
  sectionIds: string[];
  /** Courses in the departments the teacher belongs to (for roster browsing). */
  courseIds: string[];
  subjectIds: string[];
  eventIds: string[];
  isAdmin: boolean;
}

const scopeCache = new Map<string, { scope: TeacherScope; expiresAt: number }>();
const SCOPE_TTL_MS = 60_000;

/**
 * Computes the data scope a teacher may access:
 * - departments they belong to (primary) or head
 * - sections they teach (via teaching assignments)
 * - subjects they teach
 * - events they coordinate / are assigned to
 *
 * Admins have unrestricted scope; students/CRs/volunteers are scoped in the
 * individual services to their own section or event.
 */
export const getTeacherScope = async (user: AuthUser): Promise<TeacherScope> => {
  if (user.role === 'admin') {
    return { departmentIds: [], sectionIds: [], courseIds: [], subjectIds: [], eventIds: [], isAdmin: true };
  }

  const cached = scopeCache.get(user.id);
  if (cached && cached.expiresAt > Date.now()) return cached.scope;

  const [departments, assignments, events] = await Promise.all([
    Department.find({ $or: [{ teachers: user.id }, { head: user.id }] }).select('_id').lean(),
    TeachingAssignment.find({ teacher: user.id, isActive: true })
      .select('section subject department')
      .lean(),
    Event.find({ $or: [{ coordinator: user.id }, { teachers: user.id }] }).select('_id').lean(),
  ]);

  const departmentIds = departments.map((d) => toId(d._id));
  const courses = departmentIds.length
    ? await Course.find({ department: { $in: departmentIds }, isActive: true }).select('_id').lean()
    : [];

  const scope: TeacherScope = {
    departmentIds,
    sectionIds: [...new Set(assignments.map((a) => toId(a.section)))],
    courseIds: courses.map((course) => toId(course._id)),
    subjectIds: [...new Set(assignments.map((a) => toId(a.subject)))],
    eventIds: events.map((e) => toId(e._id)),
    isAdmin: false,
  };

  scopeCache.set(user.id, { scope, expiresAt: Date.now() + SCOPE_TTL_MS });
  return scope;
};

/**
 * Section ids a teacher may read rosters for: their explicitly assigned
 * sections plus every section of their department's courses (faculty oversight),
 * optionally narrowed to one requested section.
 */
export const getAccessibleSectionIds = async (user: AuthUser, requestedSection?: string): Promise<string[]> => {
  if (user.role === 'admin') return requestedSection ? [requestedSection] : [];
  const scope = await getTeacherScope(user);
  const sections = await Section.find(
    requestedSection
      ? { _id: requestedSection }
      : {
          $or: [
            { _id: { $in: scope.sectionIds } },
            ...(scope.courseIds.length ? [{ course: { $in: scope.courseIds } }] : []),
          ],
          isActive: true,
        },
  )
    .select('_id')
    .lean();

  const allowed = new Set(scope.sectionIds);
  return sections
    .map((section) => toId(section._id))
    .filter((id) => allowed.has(id) || scope.courseIds.length > 0);
};

export const invalidateScopeCache = (userId?: string): void => {
  if (userId) scopeCache.delete(userId);
  else scopeCache.clear();
};

/** Throws unless the teacher may act on the given section. */
export const assertSectionAccess = async (user: AuthUser, sectionId: string): Promise<void> => {
  if (user.role === 'admin') return;
  const scope = await getTeacherScope(user);
  if (scope.sectionIds.includes(sectionId)) return;

  // Section CRs may act on their own section only.
  const crSection = user.responsibilities.find((r) => r.type === 'cr')?.section;
  if (crSection && crSection === sectionId) return;

  const section = await Section.findById(sectionId).select('department').lean();
  if (section && scope.departmentIds.includes(toId(section.department))) {
    // Department membership alone does not grant section-level grade access.
    throw new ForbiddenError('You are not assigned to this section');
  }
  throw new ForbiddenError('You are not assigned to this section');
};

/** Students (incl. CRs) may only read their own section. */
export const assertSelfSectionAccess = async (user: AuthUser, sectionId: string): Promise<void> => {
  const profile = await StudentProfile.findOne({ user: user.id }).select('section').lean();
  if (!profile || toId(profile.section) !== sectionId) {
    throw new ForbiddenError('You can only access your own section');
  }
};

export const canManageEvent = async (user: AuthUser, eventId: string): Promise<boolean> => {
  if (user.role === 'admin') return true;
  if (user.role !== 'teacher') return false;
  const scope = await getTeacherScope(user);
  if (scope.eventIds.includes(eventId)) return true;
  const event = await Event.findById(eventId).select('department involvesAllDepartments').lean();
  if (!event) return false;
  if (event.department && scope.departmentIds.includes(toId(event.department))) return true;
  return false;
};

export const assertEventManageAccess = async (user: AuthUser, eventId: string): Promise<void> => {
  const allowed = await canManageEvent(user, eventId);
  if (!allowed) throw new ForbiddenError('You cannot manage this event');
};

export const canViewEvent = async (user: AuthUser | undefined, eventId: string): Promise<boolean> => {
  const event = await Event.findById(eventId).select('status isPublic').lean();
  if (!event) return false;
  if (event.isPublic && ['published', 'ongoing', 'completed'].includes(event.status)) return true;
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'teacher') return canManageEvent(user, eventId);
  return true; // students may view non-public event details they can register for
};

export { TeacherSubjectScope };
