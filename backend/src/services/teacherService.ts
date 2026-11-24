import { Types } from 'mongoose';
import { Department, StudentProfile, TeachingAssignment, User } from '../models';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors';
import { generateTemporaryPassword, hashPassword } from '../utils/password';
import { invalidateScopeCache, getTeacherScope } from './accessControl';
import { PERMISSIONS } from '../config/constants';

export interface ListTeacherParams {
  page: number;
  limit: number;
  search?: string;
  department?: string;
  status?: string;
}

export const listTeachers = async (params: ListTeacherParams) => {
  const filter: Record<string, unknown> = { role: 'teacher' };
  if (params.search) {
    const regex = new RegExp(params.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: regex }, { email: regex }, { designation: regex }];
  }
  if (params.status) filter.status = params.status;
  if (params.department) {
    // Teachers belong to a department when they are listed in it or head it.
    const department = await Department.findById(params.department).select('teachers head').lean();
    const memberIds = [...(department?.teachers ?? [])];
    if (department?.head) memberIds.push(department.head);
    filter._id = { $in: memberIds };
  }

  const [items, total] = await Promise.all([
    User.find(filter)
      .select('name email phone designation status extraPermissions createdAt lastLoginAt')
      .sort({ name: 1 })
      .skip((params.page - 1) * params.limit)
      .limit(params.limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  const enriched = await Promise.all(
    items.map(async (teacher) => {
      const [departments, assignments] = await Promise.all([
        Department.find({ $or: [{ head: teacher._id }, { teachers: teacher._id }] }).select('name code').lean(),
        TeachingAssignment.find({ teacher: teacher._id, isActive: true })
          .populate('subject', 'name code')
          .populate('section', 'name')
          .select('subject section')
          .lean(),
      ]);
      return {
        ...teacher,
        departments,
        assignments: assignments.length,
        subjects: assignments.map((a) => ({
          subject: a.subject,
          section: a.section,
        })),
      };
    }),
  );

  return { items: enriched, total };
};

export const createTeacher = async (input: {
  name: string;
  email: string;
  phone?: string;
  designation?: string;
  departmentId?: string;
  extraPermissions?: string[];
}) => {
  const email = input.email.toLowerCase().trim();
  const exists = await User.findOne({ email });
  if (exists) throw new ConflictError('A user with this email already exists');

  const temporaryPassword = generateTemporaryPassword();
  const user = await User.create({
    name: input.name,
    email,
    phone: input.phone,
    designation: input.designation,
    role: 'teacher',
    status: 'active',
    passwordHash: await hashPassword(temporaryPassword),
    mustChangePassword: true,
    extraPermissions: (input.extraPermissions ?? []).filter((p) =>
      (PERMISSIONS as readonly string[]).includes(p),
    ),
  });

  if (input.departmentId) {
    const department = await Department.findById(input.departmentId);
    if (!department) {
      await User.findByIdAndDelete(user._id);
      throw new NotFoundError('Department');
    }
    await Department.updateOne({ _id: department._id }, { $addToSet: { teachers: user._id } });
  }

  invalidateScopeCache(String(user._id));
  return { user, temporaryPassword };
};

export const updateTeacher = async (id: string, input: Record<string, unknown>) => {
  const teacher = await User.findOne({ _id: id, role: { $in: ['teacher', 'admin'] } });
  if (!teacher) throw new NotFoundError('Teacher');

  if (input.email && String(input.email).toLowerCase() !== teacher.email) {
    const exists = await User.findOne({ email: String(input.email).toLowerCase() });
    if (exists) throw new ConflictError('A user with this email already exists');
  }
  if (input.extraPermissions) {
    const invalid = (input.extraPermissions as string[]).filter(
      (p) => !(PERMISSIONS as readonly string[]).includes(p),
    );
    if (invalid.length) throw new ValidationError(`Unknown permissions: ${invalid.join(', ')}`);
  }
  if (input.role && input.role !== 'teacher' && input.role !== 'admin') {
    throw new ValidationError('Invalid role for a staff member');
  }

  Object.assign(teacher, {
    name: input.name ?? teacher.name,
    email: input.email ? String(input.email).toLowerCase() : teacher.email,
    phone: input.phone,
    designation: input.designation,
    status: input.status,
    role: input.role ?? teacher.role,
    extraPermissions: input.extraPermissions ?? teacher.extraPermissions,
  });
  await teacher.save();
  invalidateScopeCache(id);
  return teacher;
};

export const suspendTeacher = async (id: string, suspend: boolean) => {
  const teacher = await User.findOne({ _id: id, role: 'teacher' });
  if (!teacher) throw new NotFoundError('Teacher');
  teacher.status = suspend ? 'suspended' : 'active';
  await teacher.save();
  invalidateScopeCache(id);
  return teacher;
};

export const resetTeacherPassword = async (id: string) => {
  const teacher = await User.findOne({ _id: id, role: { $in: ['teacher', 'admin'] } });
  if (!teacher) throw new NotFoundError('Teacher');
  const temporaryPassword = generateTemporaryPassword();
  teacher.passwordHash = await hashPassword(temporaryPassword);
  teacher.mustChangePassword = true;
  await teacher.save();
  return { temporaryPassword };
};

export const getTeacherOverview = async (teacherId: string) => {
  const scope = await getTeacherScope({
    id: teacherId,
    name: '',
    email: '',
    role: 'teacher',
    responsibilities: [],
    extraPermissions: [],
    permissions: [],
  });

  const [departments, assignments] = await Promise.all([
    Department.find({ $or: [{ head: teacherId }, { teachers: teacherId }] }).select('name code').lean(),
    TeachingAssignment.find({ teacher: teacherId, isActive: true })
      .populate('subject', 'name code')
      .populate({
        path: 'section',
        select: 'name semester',
        populate: { path: 'semester', select: 'number label' },
      })
      .lean(),
  ]);

  const studentCount = await StudentProfile.countDocuments({
    section: { $in: scope.sectionIds.map((id) => new Types.ObjectId(id)) },
    status: 'active',
  });

  return { departments, assignments, scope, studentCount };
};

/** Students visible to a teacher, limited to their assigned sections. */
export const getTeacherStudents = async (
  teacherId: string,
  params: { search?: string; section?: string; page: number; limit: number },
) => {
  const scope = await getTeacherScope({
    id: teacherId,
    name: '',
    email: '',
    role: 'teacher',
    responsibilities: [],
    extraPermissions: [],
    permissions: [],
  });

  const sectionIds = params.section && scope.sectionIds.includes(params.section)
    ? [params.section]
    : scope.sectionIds;

  if (!sectionIds.length) return { items: [], total: 0 };

  const filter: Record<string, unknown> = {
    section: { $in: sectionIds.map((id) => new Types.ObjectId(id)) },
    status: 'active',
  };

  const [items, total] = await Promise.all([
    StudentProfile.find(filter)
      .populate('user', params.search ? 'name email' : 'name email status')
      .populate('section', 'name')
      .populate('semester', 'number')
      .populate('course', 'name code')
      .sort({ enrollmentNumber: 1 })
      .skip((params.page - 1) * params.limit)
      .limit(params.limit)
      .lean(),
    StudentProfile.countDocuments(filter),
  ]);

  if (!params.search) return { items, total };
  const regex = new RegExp(params.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const filtered = items.filter((item) => {
    const user = item.user as unknown as { name?: string; email?: string } | null;
    return (
      regex.test(item.enrollmentNumber) ||
      regex.test(user?.name ?? '') ||
      regex.test(user?.email ?? '')
    );
  });
  return { items: filtered, total: filtered.length };
};
