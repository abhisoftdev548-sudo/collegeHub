import { Types } from 'mongoose';
import {
  Attendance,
  EventAttendance,
  EventRegistration,
  Section,
  StudentProfile,
  Subject,
  TeachingAssignment,
  User,
} from '../models';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import { stringify } from 'csv-stringify/sync';
import type { AuthUser } from '../types/express';
import { getAccessibleSectionIds, getTeacherScope } from './accessControl';
import { refId } from '../utils/ids';

const dateKey = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** The roster a teacher may mark: enrolled, active students of the section. */
export const getRoster = async (sectionId: string) => {
  const section = await Section.findById(sectionId)
    .populate('semester', 'number label')
    .populate('course', 'name code')
    .lean();
  if (!section) throw new NotFoundError('Section');

  const students = await StudentProfile.find({ section: sectionId, status: 'active' })
    .populate('user', 'name email')
    .select('user enrollmentNumber rollNumber')
    .sort({ enrollmentNumber: 1 })
    .lean();

  return {
    section,
    students: students.map((student) => ({
      studentId: refId(student.user),
      enrollmentNumber: student.enrollmentNumber,
      rollNumber: student.rollNumber,
      name: (student.user as unknown as { name?: string })?.name ?? '',
      email: (student.user as unknown as { email?: string })?.email ?? '',
    })),
  };
};

const assertCanMark = async (
  actor: AuthUser,
  sectionId: string,
  subjectId: string,
): Promise<void> => {
  if (actor.role === 'admin') return;
  if (actor.role !== 'teacher') throw new ForbiddenError('Only teachers can mark attendance');

  // Either an explicit assignment for this subject+section, or faculty
  // oversight of the section within the teacher's own department.
  const [assignment, accessible] = await Promise.all([
    TeachingAssignment.findOne({
      teacher: actor.id,
      section: sectionId,
      subject: subjectId,
      isActive: true,
    }),
    getAccessibleSectionIds(actor, sectionId),
  ]);
  if (!assignment && !accessible.length) {
    throw new ForbiddenError('You are not assigned to this subject and section');
  }

  const subject = await Subject.findById(subjectId).select('course').lean();
  const section = await Section.findById(sectionId).select('course').lean();
  if (!subject || !section || String(subject.course) !== String(section.course)) {
    throw new ValidationError('This subject does not belong to the section’s course');
  }
};

export const getAttendanceSheet = async (params: {
  subject: string;
  section: string;
  date: string;
}) => {
  const section = await Section.findById(params.section)
    .populate('course', 'name code')
    .populate('semester', 'number label')
    .lean();
  if (!section) throw new NotFoundError('Section');

  const roster = await StudentProfile.find({ section: params.section, status: 'active' })
    .populate('user', 'name email')
    .select('user enrollmentNumber')
    .sort({ enrollmentNumber: 1 })
    .lean();


  const date = new Date(params.date);
  const existing = await Attendance.findOne({
    subject: params.subject,
    section: params.section,
    dateKey: dateKey(date),
  }).lean();

  return {
    section,
    date: dateKey(date),
    students: roster.map((student) => {
      const record = existing?.records?.find((r) => refId(r.student) === refId(student.user));
      return {
        studentId: refId(student.user),
        enrollmentNumber: student.enrollmentNumber,
        name: (student.user as unknown as { name?: string })?.name ?? '',
        status: record?.status ?? null,
        remarks: record?.remarks ?? '',
      };
    }),
    saved: Boolean(existing),
    savedAt: existing?.updatedAt ?? null,
  };
};

export const saveAttendance = async (
  actor: AuthUser,
  input: {
    subject: string;
    section: string;
    date: string;
    records: Array<{ studentId: string; status: 'present' | 'absent' | 'late'; remarks?: string }>;
  },
) => {
  await assertCanMark(actor, input.section, input.subject);

  const section = await Section.findById(input.section).lean();
  if (!section) throw new NotFoundError('Section');

  const enrolled = await StudentProfile.find({ section: input.section, status: 'active' }).select('user').lean();
  const enrolledIds = new Set(enrolled.map((student) => String(student.user)));
  const submittedIds = new Set(input.records.map((record) => record.studentId));

  if (submittedIds.size !== input.records.length) {
    throw new ValidationError('Each student can only appear once in an attendance sheet');
  }
  for (const studentId of submittedIds) {
    if (!enrolledIds.has(studentId)) throw new ValidationError('Attendance contains a student who is not in this section');
  }

  const date = new Date(input.date);
  const key = dateKey(date);

  const existing = await Attendance.findOne({ subject: input.subject, section: input.section, dateKey: key });

  const records = input.records.map((record) => ({
    student: new Types.ObjectId(record.studentId),
    status: record.status,
    remarks: record.remarks?.slice(0, 200),
    markedAt: new Date(),
  }));

  if (existing) {
    if (existing.teacher.toString() !== actor.id && actor.role !== 'admin') {
      throw new ForbiddenError('Only the teacher who marked this sheet (or an admin) can edit it');
    }
    existing.records = records as never;
    existing.updatedBy = new Types.ObjectId(actor.id);
    await existing.save();
    return existing;
  }

  return Attendance.create({
    subject: input.subject,
    section: input.section,
    semester: section.semester,
    course: section.course,
    department: section.department,
    academicSession: section.academicSession,
    teacher: actor.id,
    date,
    dateKey: key,
    records,
    markedByName: actor.name,
  });
};

export const getAttendanceHistory = async (params: {
  subject?: string;
  section?: string;
  student?: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
}) => {
  const filter: Record<string, unknown> = {};
  if (params.subject) filter.subject = params.subject;
  if (params.section) filter.section = params.section;
  if (params.from || params.to) {
    filter.date = {
      ...(params.from ? { $gte: new Date(params.from) } : {}),
      ...(params.to ? { $lte: new Date(params.to) } : {}),
    };
  }

  const [sheets, total] = await Promise.all([
    Attendance.find(filter)
      .populate('subject', 'name code')
      .populate('section', 'name')
      .populate('teacher', 'name')
      .sort({ date: -1 })
      .skip((params.page - 1) * params.limit)
      .limit(params.limit)
      .lean(),
    Attendance.countDocuments(filter),
  ]);

  return {
    items: sheets.map((sheet) => ({
      ...sheet,
      summary: {
        present: sheet.records.filter((r) => r.status === 'present').length,
        absent: sheet.records.filter((r) => r.status === 'absent').length,
        late: sheet.records.filter((r) => r.status === 'late').length,
        total: sheet.records.length,
      },
    })),
    total,
  };
};

export interface AttendanceReportFilters {
  section?: string;
  subject?: string;
  student?: string;
  from?: string;
  to?: string;
}

/** Percentage report per student (optionally scoped to one subject). */
export const getStudentAttendanceReport = async (filters: AttendanceReportFilters) => {
  const filter: Record<string, unknown> = {};
  if (filters.section) filter.section = filters.section;
  if (filters.subject) filter.subject = filters.subject;
  if (filters.from || filters.to) {
    filter.date = {
      ...(filters.from ? { $gte: new Date(filters.from) } : {}),
      ...(filters.to ? { $lte: new Date(filters.to) } : {}),
    };
  }

  const sheets = await Attendance.find(filter)
    .select('records subject section date')
    .populate('subject', 'name code')
    .populate('section', 'name')
    .lean();

  const tally = new Map<
    string,
    { present: number; absent: number; late: number; total: number; subjects: Set<string>; sections: Set<string> }
  >();

  for (const sheet of sheets) {
    for (const record of sheet.records) {
      const key = String(record.student);
      if (filters.student && key !== filters.student) continue;
      if (!tally.has(key)) {
        tally.set(key, { present: 0, absent: 0, late: 0, total: 0, subjects: new Set(), sections: new Set() });
      }
      const entry = tally.get(key)!;
      entry.total += 1;
      if (record.status === 'present') entry.present += 1;
      else if (record.status === 'absent') entry.absent += 1;
      else entry.late += 1;
      entry.subjects.add(
        (sheet.subject as unknown as { code?: string })?.code ?? String(sheet.subject),
      );
      entry.sections.add((sheet.section as unknown as { name?: string })?.name ?? '');
    }
  }

  const studentIds = [...tally.keys()].map((id) => new Types.ObjectId(id));
  const students = await StudentProfile.find({ user: { $in: studentIds } })
    .populate('user', 'name email')
    .select('user enrollmentNumber section')
    .lean();
  const studentMap = new Map(students.map((student) => [refId(student.user), student]));

  return [...tally.entries()]
    .map(([studentId, entry]) => {
      const student = studentMap.get(studentId);
      // "late" counts as attended for percentage purposes; adjust if policy differs.
      const attended = entry.present + entry.late;
      return {
        studentId,
        name: (student?.user as unknown as { name?: string })?.name ?? 'Unknown',
        enrollmentNumber: student?.enrollmentNumber ?? '',
        present: entry.present,
        absent: entry.absent,
        late: entry.late,
        total: entry.total,
        percentage: entry.total ? Math.round((attended / entry.total) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => a.enrollmentNumber.localeCompare(b.enrollmentNumber));
};

export const exportAttendanceCsv = async (filters: AttendanceReportFilters): Promise<string> => {
  const report = await getStudentAttendanceReport(filters);
  return stringify(
    report.map((row) => ({
      enrollmentNumber: row.enrollmentNumber,
      name: row.name,
      present: row.present,
      absent: row.absent,
      late: row.late,
      classes: row.total,
      percentage: row.percentage,
    })),
    { header: true },
  );
};

/** Students can only ever read their own attendance. */
export const getMyAttendance = async (studentId: string) => {
  const sheets = await Attendance.find({ 'records.student': studentId })
    .populate('subject', 'name code')
    .sort({ date: -1 })
    .lean();

  const entries = sheets.map((sheet) => ({
    subject: (sheet.subject as unknown as { name?: string; code?: string }) ?? null,
    date: sheet.date,
    status: sheet.records.find((record) => String(record.student) === studentId)?.status ?? 'absent',
    remarks: sheet.records.find((record) => String(record.student) === studentId)?.remarks,
  }));

  const present = entries.filter((entry) => entry.status === 'present').length;
  const late = entries.filter((entry) => entry.status === 'late').length;
  const absent = entries.filter((entry) => entry.status === 'absent').length;

  return {
    entries,
    summary: {
      present,
      late,
      absent,
      total: entries.length,
      percentage: entries.length ? Math.round(((present + late) / entries.length) * 1000) / 10 : 0,
    },
  };
};

/* ----------------------------- Event attendance ----------------------------- */

export const getEventAttendanceOverview = async (eventId: string) => {
  const registrations = await EventRegistration.find({ event: eventId, status: { $ne: 'cancelled' } })
    .populate('student', 'name email')
    .select('registrationId student teamName isTeam checkInCode checkedInAt')
    .lean();

  const checkIns = await EventAttendance.find({ event: eventId }).lean();
  const checkInMap = new Map(checkIns.map((checkIn) => [String(checkIn.user), checkIn]));

  return {
    participants: registrations.map((registration) => ({
      registrationId: registration.registrationId,
      studentId: refId(registration.student),
      name: (registration.student as unknown as { name?: string })?.name ?? '',
      email: (registration.student as unknown as { email?: string })?.email ?? '',
      teamName: registration.teamName,
      isTeam: registration.isTeam,
      checkedInAt: checkInMap.get(String((registration.student as unknown as { _id?: unknown })?._id))?.checkInAt ?? null,
    })),
    totals: {
      registered: registrations.length,
      checkedIn: checkIns.filter((c) => c.role === 'participant').length,
      volunteers: checkIns.filter((c) => c.role === 'volunteer').length,
      teachers: checkIns.filter((c) => c.role === 'teacher').length,
    },
  };
};

const recordCheckIn = async (input: {
  eventId: string;
  userId: string;
  role: 'participant' | 'volunteer' | 'teacher';
  method: 'qr' | 'manual';
  actorId: string;
  registrationId?: string;
  notes?: string;
}) => {
  const existing = await EventAttendance.findOne({
    event: input.eventId,
    user: input.userId,
    role: input.role,
  });
  if (existing) {
    throw new ConflictError(`This ${input.role} is already checked in for this event`);
  }

  return EventAttendance.create({
    event: input.eventId,
    user: input.userId,
    role: input.role,
    registration: input.registrationId,
    checkInAt: new Date(),
    method: input.method,
    checkedInBy: input.actorId,
    notes: input.notes,
  });
};

export const checkInParticipant = async (
  actor: AuthUser,
  input: { eventId: string; registrationId?: string; studentId?: string; notes?: string },
) => {
  let registration;
  if (input.registrationId) {
    registration = await EventRegistration.findById(input.registrationId);
  } else if (input.studentId) {
    registration = await EventRegistration.findOne({ event: input.eventId, student: input.studentId });
  }
  if (!registration || String(registration.event) !== input.eventId) {
    throw new NotFoundError('Registration');
  }
  if (registration.status === 'cancelled') throw new ValidationError('This registration was cancelled');

  const attendance = await recordCheckIn({
    eventId: input.eventId,
    userId: refId(registration.student),
    role: 'participant',
    method: 'manual',
    actorId: actor.id,
    registrationId: String(registration._id),
    notes: input.notes,
  });

  registration.checkedInAt = attendance.checkInAt;
  registration.checkedInBy = new Types.ObjectId(actor.id);
  await registration.save();

  return attendance;
};

/** QR check-in: the QR payload is the registration's check-in code. */
export const checkInByCode = async (actor: AuthUser, eventId: string, code: string) => {
  const normalised = code.trim().toUpperCase();
  const registration = await EventRegistration.findOne({ event: eventId, checkInCode: normalised });
  if (!registration) throw new NotFoundError('Registration for this check-in code');
  if (registration.checkedInAt) {
    throw new ConflictError(`Already checked in at ${registration.checkedInAt.toISOString()}`);
  }

  const attendance = await recordCheckIn({
    eventId,
    userId: refId(registration.student),
    role: 'participant',
    method: 'qr',
    actorId: actor.id,
    registrationId: String(registration._id),
  });

  registration.checkedInAt = attendance.checkInAt;
  registration.checkedInBy = new Types.ObjectId(actor.id);
  await registration.save();
  return registration;
};

export const checkInVolunteer = async (actor: AuthUser, eventId: string, studentId: string) => {
  const student = await User.findById(studentId).select('role responsibilities').lean();
  if (!student) throw new NotFoundError('Student');
  const isVolunteer = (student.responsibilities ?? []).some(
    (r: { type?: string; event?: unknown }) => r.type === 'volunteer' && String(r.event) === eventId,
  );
  if (!isVolunteer) throw new ValidationError('This student is not a volunteer for this event');

  return recordCheckIn({ eventId, userId: studentId, role: 'volunteer', method: 'manual', actorId: actor.id });
};

export const checkInTeacher = async (actor: AuthUser, eventId: string, teacherId: string) => {
  const teacher = await User.findById(teacherId).select('role').lean();
  if (!teacher || !['teacher', 'admin'].includes(teacher.role)) {
    throw new ValidationError('Only teachers can be checked in as staff');
  }
  return recordCheckIn({ eventId, userId: teacherId, role: 'teacher', method: 'manual', actorId: actor.id });
};

export const getMyEventCheckIns = async (studentId: string) =>
  EventAttendance.find({ user: studentId }).populate('event', 'title startDate venue').lean();

export { getTeacherScope };
