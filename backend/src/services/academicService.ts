import { Types } from 'mongoose';
import {
  AcademicSession,
  Course,
  Department,
  Section,
  Semester,
  StudentProfile,
  Subject,
  TeachingAssignment,
  User,
} from '../models';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors';
import { invalidateScopeCache } from './accessControl';

/* ---------------------------------- Sessions -------------------------------- */

export const listSessions = async () => {
  const sessions = await AcademicSession.find().sort({ startDate: -1 }).lean();
  return sessions;
};

export const createSession = async (input: {
  name: string;
  startDate: string;
  endDate: string;
  status?: string;
  notes?: string;
  createdBy?: string;
}) => {
  const start = new Date(input.startDate);
  const end = new Date(input.endDate);
  if (end <= start) throw new ValidationError('End date must be after the start date');

  const exists = await AcademicSession.findOne({ name: input.name });
  if (exists) throw new ConflictError('An academic session with this name already exists');

  return AcademicSession.create({ ...input, startDate: start, endDate: end });
};

export const updateSession = async (id: string, input: Record<string, unknown>) => {
  const session = await AcademicSession.findById(id);
  if (!session) throw new NotFoundError('Academic session');

  if (input.startDate && input.endDate) {
    const start = new Date(String(input.startDate));
    const end = new Date(String(input.endDate));
    if (end <= start) throw new ValidationError('End date must be after the start date');
  }
  Object.assign(session, input);
  await session.save();
  return session;
};

export const setCurrentSession = async (id: string) => {
  const session = await AcademicSession.findById(id);
  if (!session) throw new NotFoundError('Academic session');
  await AcademicSession.updateMany({}, { $set: { isCurrent: false } });
  session.isCurrent = true;
  if (session.status === 'upcoming') session.status = 'active';
  await session.save();
  return session;
};

/* -------------------------------- Departments ------------------------------- */

export const listDepartments = async (params: { search?: string; activeOnly?: boolean }) => {
  const filter: Record<string, unknown> = {};
  if (params.search) filter.name = new RegExp(params.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  if (params.activeOnly) filter.isActive = true;

  const departments = await Department.find(filter)
    .populate('head', 'name email designation')
    .populate('teachers', 'name email designation')
    .sort({ name: 1 })
    .lean();

  const counts = await Promise.all(
    departments.map(async (department) => {
      const [courses, students, subjects] = await Promise.all([
        Course.countDocuments({ department: department._id, isActive: true }),
        StudentProfile.countDocuments({ department: department._id, status: 'active' }),
        Subject.countDocuments({ department: department._id, isActive: true }),
      ]);
      return { departmentId: String(department._id), courses, students, subjects };
    }),
  );

  return departments.map((department) => {
    const count = counts.find((c) => c.departmentId === String(department._id));
    return { ...department, stats: { courses: count?.courses ?? 0, students: count?.students ?? 0, subjects: count?.subjects ?? 0 } };
  });
};

export const createDepartment = async (input: {
  name: string;
  code: string;
  description?: string;
  head?: string;
  teachers?: string[];
}) => {
  const exists = await Department.findOne({ code: input.code.toUpperCase() });
  if (exists) throw new ConflictError('A department with this code already exists');

  const department = await Department.create({
    name: input.name,
    code: input.code.toUpperCase(),
    description: input.description,
    head: input.head || undefined,
    teachers: input.teachers ?? [],
  });

  if (input.head) {
    await User.updateOne({ _id: input.head }, { $set: { role: 'teacher' } });
  }
  if (input.head || input.teachers?.length) {
    await User.updateMany(
      { _id: { $in: [input.head, ...(input.teachers ?? [])].filter(Boolean) } },
      { $set: { role: 'teacher' } },
    );
    for (const teacherId of [input.head, ...(input.teachers ?? [])]) {
      if (teacherId) invalidateScopeCache(teacherId);
    }
  }
  return department;
};

export const updateDepartment = async (id: string, input: Record<string, unknown>) => {
  const department = await Department.findById(id);
  if (!department) throw new NotFoundError('Department');

  if (input.code && String(input.code).toUpperCase() !== department.code) {
    const exists = await Department.findOne({ code: String(input.code).toUpperCase() });
    if (exists) throw new ConflictError('A department with this code already exists');
  }

  const teacherIds = [...((input.teachers as string[] | undefined) ?? [])];
  if (input.head) teacherIds.push(String(input.head));
  if (teacherIds.length) {
    await User.updateMany({ _id: { $in: teacherIds } }, { $set: { role: 'teacher' } });
    teacherIds.forEach((teacherId) => invalidateScopeCache(teacherId));
  }

  Object.assign(department, {
    ...input,
    ...(input.code ? { code: String(input.code).toUpperCase() } : {}),
    head: input.head === '' ? undefined : input.head,
  });
  await department.save();
  return department;
};

export const deleteDepartment = async (id: string) => {
  const [courses, students, subjects] = await Promise.all([
    Course.countDocuments({ department: id }),
    StudentProfile.countDocuments({ department: id }),
    Subject.countDocuments({ department: id }),
  ]);
  if (courses || students || subjects) {
    throw new ConflictError(
      'This department still has courses, subjects or students. Deactivate it instead of deleting.',
    );
  }
  await Department.findByIdAndDelete(id);
};

/* ---------------------------------- Courses --------------------------------- */

export const listCourses = async (params: { search?: string; department?: string; activeOnly?: boolean }) => {
  const filter: Record<string, unknown> = {};
  if (params.search) filter.$or = [
    { name: new RegExp(params.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
    { code: new RegExp(params.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
  ];
  if (params.department) filter.department = params.department;
  if (params.activeOnly) filter.isActive = true;

  const courses = await Course.find(filter).populate('department', 'name code').sort({ name: 1 }).lean();

  const withCounts = await Promise.all(
    courses.map(async (course) => ({
      ...course,
      stats: {
        students: await StudentProfile.countDocuments({ course: course._id, status: 'active' }),
        subjects: await Subject.countDocuments({ course: course._id, isActive: true }),
        sections: await Section.countDocuments({ course: course._id, isActive: true }),
      },
    })),
  );
  return withCounts;
};

export const createCourse = async (input: {
  name: string;
  code: string;
  department: string;
  description?: string;
  durationYears: number;
  totalSemesters: number;
  degreeLevel?: string;
}) => {
  const department = await Department.findById(input.department);
  if (!department) throw new NotFoundError('Department');
  const exists = await Course.findOne({ code: input.code.toUpperCase() });
  if (exists) throw new ConflictError('A course with this code already exists');
  if (input.totalSemesters % 2 !== 0 && input.totalSemesters < 2) {
    throw new ValidationError('A course must have at least 2 semesters');
  }
  return Course.create({ ...input, code: input.code.toUpperCase() });
};

export const updateCourse = async (id: string, input: Record<string, unknown>) => {
  const course = await Course.findById(id);
  if (!course) throw new NotFoundError('Course');
  if (input.code && String(input.code).toUpperCase() !== course.code) {
    const exists = await Course.findOne({ code: String(input.code).toUpperCase() });
    if (exists) throw new ConflictError('A course with this code already exists');
  }
  if (input.totalSemesters && Number(input.totalSemesters) < course.totalSemesters) {
    const used = await Semester.findOne({ course: id, number: { $gt: Number(input.totalSemesters) } });
    if (used) throw new ConflictError('Cannot reduce semesters below existing semester offerings');
  }
  Object.assign(course, input, input.code ? { code: String(input.code).toUpperCase() } : {});
  await course.save();
  return course;
};

export const deleteCourse = async (id: string) => {
  const [students, semesters] = await Promise.all([
    StudentProfile.countDocuments({ course: id }),
    Semester.countDocuments({ course: id }),
  ]);
  if (students || semesters) throw new ConflictError('This course has students or semester offerings. Deactivate it instead.');
  await Course.findByIdAndDelete(id);
};

/* --------------------------------- Semesters -------------------------------- */

export const listSemesters = async (params: {
  course?: string;
  session?: string;
  department?: string;
}) => {
  const filter: Record<string, unknown> = {};
  if (params.course) filter.course = params.course;
  if (params.session) filter.academicSession = params.session;

  const semesters = await Semester.find(filter)
    .populate('course', 'name code department totalSemesters')
    .populate('academicSession', 'name isCurrent status')
    .sort({ number: 1 })
    .lean();

  if (params.department) {
    return semesters.filter(
      (semester) =>
        String((semester.course as unknown as { department?: unknown })?.department) === params.department,
    );
  }

  const withSections = await Promise.all(
    semesters.map(async (semester) => ({
      ...semester,
      sections: await Section.countDocuments({ semester: semester._id, isActive: true }),
    })),
  );
  return withSections;
};

/**
 * Generates the full semester ladder for a course session, avoiding duplicates.
 * Semesters are concrete offerings (course + session + number) rather than a
 * hardcoded enum, so any course duration is supported.
 */
export const generateSemesters = async (input: { course: string; academicSession: string }) => {
  const [course, session] = await Promise.all([
    Course.findById(input.course),
    AcademicSession.findById(input.academicSession),
  ]);
  if (!course) throw new NotFoundError('Course');
  if (!session) throw new NotFoundError('Academic session');

  const created: unknown[] = [];
  for (let number = 1; number <= course.totalSemesters; number += 1) {
    const existing = await Semester.findOne({
      course: course._id,
      academicSession: session._id,
      number,
    });
    if (existing) continue;
    created.push(
      await Semester.create({
        course: course._id,
        academicSession: session._id,
        number,
        label: `${course.code} Semester ${number} (${session.name})`,
      }),
    );
  }
  return { created: created.length, semesters: await listSemesters({ course: input.course, session: input.academicSession }) };
};

export const deleteSemester = async (id: string) => {
  const [sections, students] = await Promise.all([
    Section.countDocuments({ semester: id }),
    StudentProfile.countDocuments({ semester: id }),
  ]);
  if (sections || students) throw new ConflictError('This semester has sections or students and cannot be deleted');
  await Semester.findByIdAndDelete(id);
};

/* --------------------------------- Sections --------------------------------- */

export const listSections = async (params: {
  semester?: string;
  course?: string;
  department?: string;
  session?: string;
}) => {
  const filter: Record<string, unknown> = {};
  if (params.semester) filter.semester = params.semester;
  if (params.course) filter.course = params.course;
  if (params.department) filter.department = params.department;
  if (params.session) filter.academicSession = params.session;

  const sections = await Section.find(filter)
    .populate('semester', 'number label')
    .populate('course', 'name code')
    .populate('department', 'name code')
    .populate('academicSession', 'name')
    .populate('crStudents', 'name email')
    .sort({ name: 1 })
    .lean();

  return Promise.all(
    sections.map(async (section) => ({
      ...section,
      studentCount: await StudentProfile.countDocuments({ section: section._id, status: 'active' }),
    })),
  );
};

export const createSection = async (input: {
  name: string;
  semester: string;
  capacity?: number;
}) => {
  const semester = await Semester.findById(input.semester);
  if (!semester) throw new NotFoundError('Semester');

  const existing = await Section.findOne({ semester: semester._id, name: input.name });
  if (existing) throw new ConflictError(`Section ${input.name} already exists for this semester`);

  return Section.create({
    name: input.name,
    semester: semester._id,
    course: semester.course,
    department: (await Course.findById(semester.course).select('department').lean())?.department,
    academicSession: semester.academicSession,
    capacity: input.capacity ?? 60,
  });
};

export const updateSection = async (id: string, input: Record<string, unknown>) => {
  const section = await Section.findById(id);
  if (!section) throw new NotFoundError('Section');
  Object.assign(section, input);
  await section.save();
  return section;
};

export const deleteSection = async (id: string) => {
  const students = await StudentProfile.countDocuments({ section: id });
  if (students) throw new ConflictError('Move students out of this section before deleting it');
  await Section.findByIdAndDelete(id);
};

/* --------------------------------- Subjects --------------------------------- */

export const listSubjects = async (params: {
  course?: string;
  department?: string;
  semesterNumber?: number;
  search?: string;
}) => {
  const filter: Record<string, unknown> = {};
  if (params.course) filter.course = params.course;
  if (params.department) filter.department = params.department;
  if (params.semesterNumber) filter.semesterNumber = params.semesterNumber;
  if (params.search) {
    const regex = new RegExp(params.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: regex }, { code: regex }];
  }

  return Subject.find(filter)
    .populate('course', 'name code')
    .populate('department', 'name code')
    .populate('teachers', 'name email designation')
    .sort({ semesterNumber: 1, name: 1 })
    .lean();
};

export const createSubject = async (input: {
  name: string;
  code: string;
  course: string;
  semesterNumber: number;
  credits?: number;
  teachers?: string[];
  description?: string;
}) => {
  const course = await Course.findById(input.course);
  if (!course) throw new NotFoundError('Course');
  if (input.semesterNumber > course.totalSemesters) {
    throw new ValidationError(`This course only has ${course.totalSemesters} semesters`);
  }
  const exists = await Subject.findOne({ code: input.code.toUpperCase(), course: course._id });
  if (exists) throw new ConflictError('A subject with this code already exists for this course');

  if (input.teachers?.length) {
    await User.updateMany({ _id: { $in: input.teachers } }, { $set: { role: 'teacher' } });
  }

  return Subject.create({
    ...input,
    code: input.code.toUpperCase(),
    department: course.department,
  });
};

export const updateSubject = async (id: string, input: Record<string, unknown>) => {
  const subject = await Subject.findById(id);
  if (!subject) throw new NotFoundError('Subject');
  if (Array.isArray(input.teachers) && input.teachers.length) {
    await User.updateMany({ _id: { $in: input.teachers } }, { $set: { role: 'teacher' } });
  }
  Object.assign(subject, input, input.code ? { code: String(input.code).toUpperCase() } : {});
  await subject.save();
  return subject;
};

export const deleteSubject = async (id: string) => {
  const [assignments, attendance] = await Promise.all([
    TeachingAssignment.countDocuments({ subject: id }),
    // Attendance uses a separate collection (academic attendance sheets)
    Section.countDocuments({ _id: { $exists: false } }), // placeholder to keep parallel shape
  ]);
  void attendance;
  if (assignments) throw new ConflictError('Remove teaching assignments for this subject before deleting it');
  await Subject.findByIdAndDelete(id);
};

/* --------------------------- Teaching assignments --------------------------- */

export const listTeachingAssignments = async (params: { teacher?: string; section?: string; subject?: string }) => {
  const filter: Record<string, unknown> = { isActive: true };
  if (params.teacher) filter.teacher = params.teacher;
  if (params.section) filter.section = params.section;
  if (params.subject) filter.subject = params.subject;

  return TeachingAssignment.find(filter)
    .populate('teacher', 'name email designation')
    .populate('subject', 'name code semesterNumber')
    .populate({
      path: 'section',
      select: 'name semester course',
      populate: [
        { path: 'semester', select: 'number label' },
        { path: 'course', select: 'name code' },
      ],
    })
    .populate('academicSession', 'name')
    .lean();
};

export const createTeachingAssignment = async (input: {
  teacher: string;
  subject: string;
  section: string;
  assignedBy?: string;
}) => {
  const [teacher, subject, section] = await Promise.all([
    User.findById(input.teacher),
    Subject.findById(input.subject),
    Section.findById(input.section),
  ]);
  if (!teacher) throw new NotFoundError('Teacher');
  if (!subject) throw new NotFoundError('Subject');
  if (!section) throw new NotFoundError('Section');
  if (teacher.role === 'admin') throw new ValidationError('Administrators do not take teaching assignments');
  if (String(subject.course) !== String(section.course)) {
    throw new ValidationError('This subject does not belong to the section’s course');
  }

  const existing = await TeachingAssignment.findOne({
    teacher: input.teacher,
    subject: input.subject,
    section: input.section,
    academicSession: section.academicSession,
  });
  if (existing) {
    if (!existing.isActive) {
      existing.isActive = true;
      await existing.save();
      invalidateScopeCache(String(teacher._id));
      return existing;
    }
    throw new ConflictError('This teacher is already assigned to that subject and section');
  }

  const assignment = await TeachingAssignment.create({
    teacher: teacher._id,
    subject: subject._id,
    section: section._id,
    semester: section.semester,
    course: section.course,
    department: section.department,
    academicSession: section.academicSession,
    assignedBy: input.assignedBy,
  });

  if (teacher.role === 'student') throw new ValidationError('Students cannot be assigned as teachers');
  if (teacher.role !== 'teacher') {
    teacher.role = 'teacher';
    await teacher.save();
  }
  invalidateScopeCache(String(teacher._id));
  return assignment;
};

export const removeTeachingAssignment = async (id: string) => {
  const assignment = await TeachingAssignment.findByIdAndUpdate(id, { $set: { isActive: false } }, { new: true });
  if (!assignment) throw new NotFoundError('Teaching assignment');
  invalidateScopeCache(String(assignment.teacher));
  return assignment;
};

/* ------------------------------ CR assignments ------------------------------ */

export const assignClassRepresentative = async (input: {
  studentId: string;
  sectionId: string;
  assignedBy: string;
  isPrimary?: boolean;
}) => {
  const [student, section] = await Promise.all([
    User.findById(input.studentId),
    Section.findById(input.sectionId),
  ]);
  if (!student) throw new NotFoundError('Student');
  if (!section) throw new NotFoundError('Section');
  if (student.role !== 'student') throw new ValidationError('Only students can be class representatives');

  const profile = await StudentProfile.findOne({ user: student._id });
  if (!profile || String(profile.section) !== String(section._id)) {
    throw new ValidationError('The student is not enrolled in this section');
  }

  // Keep a single primary CR per section by demoting other primary CRs.
  if (input.isPrimary) {
    const otherPrimaries = await User.find({
      _id: { $ne: student._id },
      responsibilities: { $elemMatch: { type: 'cr', section: section._id, isPrimary: true } },
    });

    for (const other of otherPrimaries) {
      const changed = (other.responsibilities ?? []).some((r) => {
        if (r.type === 'cr' && String(r.section) === String(section._id) && r.isPrimary) {
          r.isPrimary = false;
          return true;
        }
        return false;
      });
      if (changed) {
        other.markModified('responsibilities');
        await other.save();
      }
    }
  }

  const responsibilities = student.responsibilities ?? [];
  const existing = responsibilities.find((r) => r.type === 'cr' && String(r.section) === String(section._id));

  if (existing) {
    existing.isPrimary = Boolean(input.isPrimary);
    existing.assignedBy = new Types.ObjectId(input.assignedBy);
  } else {
    responsibilities.push({
      type: 'cr',
      section: section._id,
      isPrimary: Boolean(input.isPrimary),
      assignedBy: new Types.ObjectId(input.assignedBy),
      assignedAt: new Date(),
    } as never);
  }
  student.responsibilities = responsibilities as never;
  student.markModified('responsibilities');
  await student.save();

  await Section.updateOne({ _id: section._id }, { $addToSet: { crStudents: student._id } });
  return User.findById(student._id).populate('responsibilities.section', 'name');
};

export const removeClassRepresentative = async (studentId: string, sectionId: string) => {
  await User.updateOne(
    { _id: studentId },
    { $pull: { responsibilities: { type: 'cr', section: new Types.ObjectId(sectionId) } } },
  );
  await Section.updateOne({ _id: sectionId }, { $pull: { crStudents: new Types.ObjectId(studentId) } });
};

export const listClassRepresentatives = async () => {
  const students = await User.find({ 'responsibilities.type': 'cr' })
    .select('name email responsibilities')
    .populate('responsibilities.section', 'name')
    .sort({ name: 1 })
    .lean();

  const enriched = await Promise.all(
    students.map(async (student) => {
      const profile = await StudentProfile.findOne({ user: student._id })
        .populate('course', 'name code')
        .populate('semester', 'number label')
        .populate('section', 'name')
        .populate('department', 'name code')
        .lean();
      return { ...student, profile };
    }),
  );
  return enriched;
};
