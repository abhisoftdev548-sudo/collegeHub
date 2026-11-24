import { Types } from 'mongoose';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import {
  AcademicSession,
  Course,
  Department,
  Section,
  Semester,
  StudentEnrollment,
  StudentProfile,
  User,
} from '../models';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors';
import { generateTemporaryPassword, hashPassword } from '../utils/password';
import { paginated } from '../utils/apiResponse';
import { invalidateScopeCache } from './accessControl';

export interface StudentListParams {
  page: number;
  limit: number;
  search?: string;
  department?: string;
  course?: string;
  semester?: string;
  section?: string;
  session?: string;
  status?: string;
  isCR?: boolean;
}

const buildStudentFilter = (params: StudentListParams): Record<string, unknown> => {
  const filter: Record<string, unknown> = {};
  if (params.department) filter.department = params.department;
  if (params.course) filter.course = params.course;
  if (params.semester) filter.semester = params.semester;
  if (params.section) filter.section = params.section;
  if (params.session) filter.academicSession = params.session;
  if (params.status) filter.status = params.status;
  return filter;
};

export const listStudents = async (params: StudentListParams) => {
  const filter = buildStudentFilter(params);

  if (params.search) {
    const regex = new RegExp(params.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const matchingUsers = await User.find({ role: 'student', $or: [{ name: regex }, { email: regex }] })
      .select('_id')
      .limit(500)
      .lean();
    filter.$or = [
      { enrollmentNumber: regex },
      { rollNumber: regex },
      { user: { $in: matchingUsers.map((u) => u._id) } },
    ];
  }

  if (params.isCR) {
    const crUsers = await User.find({ role: 'student', 'responsibilities.type': 'cr' }).select('_id').lean();
    filter.user = { $in: crUsers.map((u) => u._id) };
  }

  const [items, total] = await Promise.all([
    StudentProfile.find(filter)
      .populate('user', 'name email phone status responsibilities')
      .populate('department', 'name code')
      .populate('course', 'name code totalSemesters')
      .populate('semester', 'number label')
      .populate('section', 'name')
      .populate('academicSession', 'name')
      .sort({ enrollmentNumber: 1 })
      .skip((params.page - 1) * params.limit)
      .limit(params.limit)
      .lean(),
    StudentProfile.countDocuments(filter),
  ]);

  return { items, total };
};

export const getStudentById = async (id: string) => {
  const profile = await StudentProfile.findOne({ $or: [{ _id: id }, { user: id }] })
    .populate('user', 'name email phone status responsibilities avatarUrl createdAt lastLoginAt')
    .populate('department', 'name code')
    .populate('course', 'name code totalSemesters')
    .populate('semester', 'number label')
    .populate('section', 'name')
    .populate('academicSession', 'name')
    .lean();
  if (!profile) throw new NotFoundError('Student');
  return profile;
};

/**
 * Enrollment history is keyed by the student's *user* id, while routes accept
 * either the StudentProfile id or the user id (both are surfaced to clients).
 * Resolve whichever id was supplied before querying.
 */
export const getStudentHistory = async (studentId: string) => {
  const profile = await StudentProfile.findOne({ $or: [{ _id: studentId }, { user: studentId }] })
    .select('user')
    .lean();
  const userId = profile?.user ? String(profile.user) : studentId;

  return StudentEnrollment.find({ student: userId })
    .populate('academicSession', 'name')
    .populate('course', 'name code')
    .populate('semester', 'number label')
    .populate('section', 'name')
    .sort({ effectiveFrom: -1 })
    .lean();
};

export interface CreateStudentInput {
  name: string;
  email: string;
  phone?: string;
  enrollmentNumber: string;
  rollNumber?: string;
  department: string;
  course: string;
  semester: string;
  section: string;
  academicSession: string;
  admissionYear: number;
  guardianName?: string;
  guardianPhone?: string;
  gender?: string;
  dateOfBirth?: string;
  address?: string;
  bloodGroup?: string;
  password?: string;
}

/**
 * Creates the user account + academic profile + the first history record.
 * Passwords are never returned to the client for existing accounts; when an
 * admin does not supply one, a temporary password is generated and returned
 * exactly once so it can be handed to the student.
 */
export const createStudent = async (input: CreateStudentInput) => {
  const [department, course, semester, section, session] = await Promise.all([
    Department.findById(input.department),
    Course.findById(input.course),
    Semester.findById(input.semester),
    Section.findById(input.section),
    AcademicSession.findById(input.academicSession),
  ]);
  if (!department) throw new NotFoundError('Department');
  if (!course) throw new NotFoundError('Course');
  if (!semester) throw new NotFoundError('Semester');
  if (!section) throw new NotFoundError('Section');
  if (!session) throw new NotFoundError('Academic session');

  if (String(semester.course) !== String(course._id)) throw new ValidationError('Semester does not belong to the selected course');
  if (String(section.semester) !== String(semester._id)) throw new ValidationError('Section does not belong to the selected semester');
  if (String(course.department) !== String(department._id)) throw new ValidationError('Course does not belong to the selected department');

  const email = input.email.toLowerCase().trim();
  const enrollmentNumber = input.enrollmentNumber.toUpperCase().trim();

  const [emailExists, enrollmentExists] = await Promise.all([
    User.findOne({ email }),
    StudentProfile.findOne({ enrollmentNumber }),
  ]);
  if (emailExists) throw new ConflictError('A user with this email already exists');
  if (enrollmentExists) throw new ConflictError(`Enrollment number ${enrollmentNumber} is already in use`);

  const temporaryPassword = input.password ?? generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  const user = await User.create({
    name: input.name,
    email,
    phone: input.phone,
    passwordHash,
    role: 'student',
    status: 'active',
    mustChangePassword: true,
  });

  try {
    const profile = await StudentProfile.create({
      user: user._id,
      enrollmentNumber,
      rollNumber: input.rollNumber,
      department: department._id,
      course: course._id,
      academicSession: session._id,
      semester: semester._id,
      section: section._id,
      admissionYear: input.admissionYear,
      guardianName: input.guardianName,
      guardianPhone: input.guardianPhone,
      gender: input.gender,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
      address: input.address,
      bloodGroup: input.bloodGroup,
    });

    await StudentEnrollment.create({
      student: user._id,
      academicSession: session._id,
      department: department._id,
      course: course._id,
      semester: semester._id,
      semesterNumber: semester.number,
      section: section._id,
      event: 'admission',
      status: 'active',
      effectiveFrom: new Date(),
    });

    invalidateScopeCache();
    return { profile, user, temporaryPassword: input.password ? undefined : temporaryPassword };
  } catch (error) {
    await User.findByIdAndDelete(user._id);
    throw error;
  }
};

export const updateStudent = async (
  id: string,
  input: Record<string, unknown>,
  actorId: string,
) => {
  const profile = await StudentProfile.findOne({ $or: [{ _id: id }, { user: id }] });
  if (!profile) throw new NotFoundError('Student');

  const userFields = ['name', 'email', 'phone'];
  const userUpdate: Record<string, unknown> = {};
  for (const field of userFields) {
    if (input[field] !== undefined) userUpdate[field] = input[field];
  }
  if (Object.keys(userUpdate).length) {
    if (userUpdate.email) {
      const exists = await User.findOne({ email: String(userUpdate.email).toLowerCase(), _id: { $ne: profile.user } });
      if (exists) throw new ConflictError('A user with this email already exists');
    }
    await User.updateOne({ _id: profile.user }, { $set: userUpdate }, { runValidators: true });
  }

  if (input.status) {
    await User.updateOne({ _id: profile.user }, { $set: { status: input.status === 'inactive' ? 'inactive' : 'active' } });
  }

  // Section / semester changes are recorded in academic history.
  if (input.section && String(input.section) !== String(profile.section)) {
    const section = await Section.findById(input.section);
    if (!section) throw new NotFoundError('Section');
    if (String(section.course) !== String(profile.course)) {
      throw new ValidationError('The new section belongs to a different course');
    }
    const previous = await StudentEnrollment.findOne({ student: profile.user }).sort({ effectiveFrom: -1 });
    if (previous && !previous.effectiveTo) previous.effectiveTo = new Date();
    if (previous) await previous.save();

    profile.section = section._id;
    profile.semester = section.semester;
    profile.academicSession = section.academicSession;

    await StudentEnrollment.create({
      student: profile.user,
      academicSession: section.academicSession,
      department: section.department,
      course: section.course,
      semester: section.semester,
      semesterNumber: (await Semester.findById(section.semester).select('number').lean())?.number ?? 1,
      section: section._id,
      event: 'section_change',
      status: 'active',
      remarks: 'Section updated by administrator',
      recordedBy: new Types.ObjectId(actorId),
    });
    invalidateScopeCache();
  }

  const profileFields = [
    'rollNumber',
    'guardianName',
    'guardianPhone',
    'gender',
    'address',
    'bloodGroup',
    'status',
    'promotionHold',
  ];
  for (const field of profileFields) {
    if (input[field] !== undefined) (profile as unknown as Record<string, unknown>)[field] = input[field];
  }
  if (input.dateOfBirth !== undefined) {
    profile.dateOfBirth = input.dateOfBirth ? new Date(String(input.dateOfBirth)) : undefined;
  }
  await profile.save();
  return profile;
};

export const deactivateStudent = async (id: string) => {
  const profile = await StudentProfile.findOne({ $or: [{ _id: id }, { user: id }] });
  if (!profile) throw new NotFoundError('Student');
  await User.updateOne({ _id: profile.user }, { $set: { status: 'inactive' } });
  profile.status = 'inactive';
  await profile.save();
  invalidateScopeCache();
};

export const activateStudent = async (id: string) => {
  const profile = await StudentProfile.findOne({ $or: [{ _id: id }, { user: id }] });
  if (!profile) throw new NotFoundError('Student');
  await User.updateOne({ _id: profile.user }, { $set: { status: 'active' } });
  profile.status = 'active';
  await profile.save();
};

export const resetStudentPassword = async (id: string) => {
  const profile = await StudentProfile.findOne({ $or: [{ _id: id }, { user: id }] });
  if (!profile) throw new NotFoundError('Student');
  const temporaryPassword = generateTemporaryPassword();
  await User.updateOne(
    { _id: profile.user },
    { $set: { passwordHash: await hashPassword(temporaryPassword), mustChangePassword: true } },
  );
  return { temporaryPassword };
};

/* ------------------------------- CSV import -------------------------------- */

const REQUIRED_CSV_HEADERS = ['name', 'email', 'enrollmentNumber', 'departmentCode', 'courseCode', 'semesterNumber', 'sectionName', 'admissionYear'];

export const importStudentsFromCsv = async (csvContent: string, actorId: string) => {
  let rows: Record<string, string>[];
  try {
    rows = parse(csvContent, { columns: true, skip_empty_lines: true, trim: true, bom: true });
  } catch {
    throw new ValidationError('The CSV file could not be parsed. Check the format and try again.');
  }
  if (!rows.length) throw new ValidationError('The CSV file contains no rows');
  if (rows.length > 1000) throw new ValidationError('Please import at most 1000 students per file');

  const headers = Object.keys(rows[0]);
  const missing = REQUIRED_CSV_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length) {
    throw new ValidationError(`Missing required columns: ${missing.join(', ')}`);
  }

  const session = await AcademicSession.findOne({ isCurrent: true });
  if (!session) throw new ValidationError('Set a current academic session before importing students');

  const results = { created: 0, failed: 0, errors: [] as Array<{ row: number; message: string }>, credentials: [] as Array<{ email: string; temporaryPassword: string }> };

  for (const [index, row] of rows.entries()) {
    try {
      const [department, course] = await Promise.all([
        Department.findOne({ code: row.departmentCode.toUpperCase() }),
        Course.findOne({ code: row.courseCode.toUpperCase() }),
      ]);
      if (!department) throw new Error(`Unknown department code "${row.departmentCode}"`);
      if (!course) throw new Error(`Unknown course code "${row.courseCode}"`);

      const semester = await Semester.findOne({
        course: course._id,
        academicSession: session._id,
        number: Number(row.semesterNumber),
      });
      if (!semester) throw new Error(`Semester ${row.semesterNumber} is not set up for ${course.code} in ${session.name}`);

      const section = await Section.findOne({ semester: semester._id, name: row.sectionName });
      if (!section) throw new Error(`Section "${row.sectionName}" does not exist for ${course.code} semester ${row.semesterNumber}`);

      const result = await createStudent({
        name: row.name,
        email: row.email,
        phone: row.phone || undefined,
        enrollmentNumber: row.enrollmentNumber,
        rollNumber: row.rollNumber || undefined,
        department: String(department._id),
        course: String(course._id),
        semester: String(semester._id),
        section: String(section._id),
        academicSession: String(session._id),
        admissionYear: Number(row.admissionYear),
        guardianName: row.guardianName || undefined,
        guardianPhone: row.guardianPhone || undefined,
        gender: row.gender || undefined,
      });
      results.created += 1;
      if (result.temporaryPassword) {
        results.credentials.push({ email: row.email, temporaryPassword: result.temporaryPassword });
      }
    } catch (error) {
      results.failed += 1;
      results.errors.push({ row: index + 2, message: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  void actorId;
  return results;
};

export const getStudentImportTemplate = (): string =>
  stringify(
    [
      {
        name: 'Student Name',
        email: 'student@example.com',
        enrollmentNumber: 'PDPSC2025001',
        rollNumber: '25CSE001',
        departmentCode: 'CSE',
        courseCode: 'BTECH',
        semesterNumber: '1',
        sectionName: 'A',
        admissionYear: '2025',
        phone: '',
        guardianName: '',
        guardianPhone: '',
        gender: '',
      },
    ],
    { header: true },
  );

export const exportStudentsCsv = async (params: StudentListParams): Promise<string> => {
  const { items } = await listStudents({ ...params, page: 1, limit: 5000 });
  const rows = items.map((item) => {
    const user = item.user as unknown as { name?: string; email?: string; phone?: string; status?: string } | null;
    const department = item.department as unknown as { name?: string } | null;
    const course = item.course as unknown as { name?: string } | null;
    const semester = item.semester as unknown as { number?: number } | null;
    const section = item.section as unknown as { name?: string } | null;
    return {
      enrollmentNumber: item.enrollmentNumber,
      name: user?.name ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      department: department?.name ?? '',
      course: course?.name ?? '',
      semester: semester?.number ?? '',
      section: section?.name ?? '',
      admissionYear: item.admissionYear,
      status: item.status,
      accountStatus: user?.status ?? '',
    };
  });
  return stringify(rows, { header: true });
};

export { paginated };
