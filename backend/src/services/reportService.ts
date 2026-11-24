import { Types } from 'mongoose';
import { stringify } from 'csv-stringify/sync';
import {
  Attendance,
  Course,
  Department,
  Event,
  EventAttendance,
  EventRegistration,
  Payment,
  Section,
  StudentProfile,
  Task,
  TeachingAssignment,
  User,
} from '../models';
import type { AuthUser } from '../types/express';
import { getTeacherScope } from './accessControl';

export const attendanceSummaryForStudent = async (studentId: string) => {
  const sheets = await Attendance.find({ 'records.student': studentId })
    .select('records subject dateKey')
    .populate('subject', 'name code')
    .lean();

  let present = 0;
  let absent = 0;
  let late = 0;
  const bySubject = new Map<string, { subject: string; present: number; absent: number; late: number; total: number }>();

  for (const sheet of sheets) {
    const record = sheet.records.find((item) => String(item.student) === studentId);
    if (!record) continue;
    if (record.status === 'present') present += 1;
    else if (record.status === 'absent') absent += 1;
    else late += 1;

    const subject = sheet.subject as unknown as { name?: string; code?: string };
    const key = subject?.code ?? String(sheet.subject);
    if (!bySubject.has(key)) {
      bySubject.set(key, { subject: `${subject?.name ?? 'Subject'}`, present: 0, absent: 0, late: 0, total: 0 });
    }
    const entry = bySubject.get(key)!;
    entry.total += 1;
    if (record.status === 'present') entry.present += 1;
    else if (record.status === 'absent') entry.absent += 1;
    else entry.late += 1;
  }

  const total = present + absent + late;
  return {
    present,
    absent,
    late,
    total,
    percentage: total ? Math.round(((present + late) / total) * 1000) / 10 : 0,
    bySubject: [...bySubject.values()].map((entry) => ({
      ...entry,
      percentage: entry.total ? Math.round(((entry.present + entry.late) / entry.total) * 1000) / 10 : 0,
    })),
  };
};

export const getAcademicReport = async (params: {
  department?: string;
  course?: string;
  session?: string;
}) => {
  const filter: Record<string, unknown> = { status: 'active' };
  if (params.department) filter.department = params.department;
  if (params.course) filter.course = params.course;
  if (params.session) filter.academicSession = params.session;

  const grouped = await StudentProfile.aggregate([
    { $match: filter },
    {
      $group: {
        _id: { course: '$course', semester: '$semester', section: '$section' },
        count: { $sum: 1 },
      },
    },
  ]);

  const [courses, sections] = await Promise.all([
    Course.find({ _id: { $in: grouped.map((row) => row._id.course) } }).select('name code').lean(),
    Section.find({ _id: { $in: grouped.map((row) => row._id.section) } }).populate('semester', 'number').select('name semester').lean(),
  ]);
  const courseMap = new Map(courses.map((course) => [String(course._id), course]));
  const sectionMap = new Map(sections.map((section) => [String(section._id), section]));

  return grouped.map((row) => ({
    course: courseMap.get(String(row._id.course))?.name ?? 'Unknown',
    courseCode: courseMap.get(String(row._id.course))?.code ?? '',
    semester: (sectionMap.get(String(row._id.section))?.semester as unknown as { number?: number })?.number ?? null,
    section: sectionMap.get(String(row._id.section))?.name ?? '',
    students: row.count,
  }));
};

export const getEventReport = async (eventId: string) => {
  const event = await Event.findById(eventId)
    .populate('category', 'name')
    .populate('coordinator', 'name')
    .lean();
  if (!event) return null;

  const [registrations, checkIns, payments, volunteers, tasks] = await Promise.all([
    EventRegistration.find({ event: eventId }).select('status paymentStatus feeAmount teamName').lean(),
    EventAttendance.find({ event: eventId }).select('role checkInAt method').lean(),
    Payment.find({ event: eventId }).select('status amount').lean(),
    EventRegistration.countDocuments({ event: eventId }),
    Task.find({ event: eventId }).select('status').lean(),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const registration of registrations) {
    statusCounts[registration.status] = (statusCounts[registration.status] ?? 0) + 1;
  }
  const paymentStatusCounts: Record<string, number> = {};
  let collected = 0;
  for (const payment of payments) {
    paymentStatusCounts[payment.status] = (paymentStatusCounts[payment.status] ?? 0) + 1;
    if (payment.status === 'paid') collected += payment.amount;
  }
  const taskStatusCounts: Record<string, number> = {};
  for (const task of tasks) taskStatusCounts[task.status] = (taskStatusCounts[task.status] ?? 0) + 1;

  return {
    event,
    registrations: {
      total: registrations.length,
      statusCounts,
      teams: registrations.filter((registration) => registration.teamName).length,
    },
    attendance: {
      participants: checkIns.filter((checkIn) => checkIn.role === 'participant').length,
      volunteers: checkIns.filter((checkIn) => checkIn.role === 'volunteer').length,
      teachers: checkIns.filter((checkIn) => checkIn.role === 'teacher').length,
      qr: checkIns.filter((checkIn) => checkIn.method === 'qr').length,
      manual: checkIns.filter((checkIn) => checkIn.method === 'manual').length,
    },
    payments: { statusCounts: paymentStatusCounts, collected },
    volunteerRegistrations: volunteers,
    tasks: { statusCounts: taskStatusCounts },
  };
};

export const exportRegistrationsCsv = async (eventId: string): Promise<string> => {
  const registrations = await EventRegistration.find({ event: eventId })
    .populate('student', 'name email')
    .sort({ submittedAt: 1 })
    .lean();

  return stringify(
    registrations.map((registration) => ({
      registrationId: registration.registrationId,
      name: (registration.student as unknown as { name?: string })?.name ?? '',
      email: (registration.student as unknown as { email?: string })?.email ?? '',
      team: registration.teamName ?? '',
      status: registration.status,
      paymentStatus: registration.paymentStatus,
      fee: registration.feeAmount,
      checkedInAt: registration.checkedInAt ? new Date(registration.checkedInAt).toISOString() : '',
      answers: registration.answers
        .map((answer) => `${answer.label}: ${Array.isArray(answer.value) ? answer.value.join('/') : String(answer.value ?? '')}`)
        .join(' | '),
    })),
    { header: true },
  );
};

export const exportAttendanceReportCsv = async (params: {
  department?: string;
  course?: string;
  session?: string;
}) => {
  const rows = await getAcademicReport(params);
  return stringify(rows, { header: true });
};

/** Participation report for the signed-in student. */
export const getStudentActivityReport = async (studentId: string) => {
  const [registrations, checkIns, attendance, profile] = await Promise.all([
    EventRegistration.find({ student: studentId }).populate('event', 'title').lean(),
    EventAttendance.find({ user: studentId }).populate('event', 'title').lean(),
    attendanceSummaryForStudent(studentId),
    StudentProfile.findOne({ user: studentId }).select('enrollmentNumber').lean(),
  ]);
  return { enrollmentNumber: profile?.enrollmentNumber, registrations, checkIns, attendance };
};

export const getTeacherWorkloadReport = async (params: { department?: string }) => {
  const filter: Record<string, unknown> = { role: 'teacher', status: 'active' };
  const teachers = await User.find(filter).select('name email designation').lean();
  void params;

  return Promise.all(
    teachers.map(async (teacher) => {
      const [assignments, subjects, events] = await Promise.all([
        TeachingAssignment.countDocuments({ teacher: teacher._id, isActive: true }),
        TeachingAssignment.distinct('section', { teacher: teacher._id, isActive: true }),
        Event.countDocuments({ $or: [{ coordinator: teacher._id }, { teachers: teacher._id }] }),
      ]);
      return {
        id: String(teacher._id),
        name: teacher.name,
        email: teacher.email,
        designation: teacher.designation,
        assignments,
        sections: subjects.length,
        events,
      };
    }),
  );
};

export const getEngagementOverview = async () => {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [newRegistrations, checkInRate, activeStudents] = await Promise.all([
    EventRegistration.countDocuments({ submittedAt: { $gte: weekAgo } }),
    EventRegistration.countDocuments({ checkedInAt: { $exists: true, $ne: null } }),
    User.countDocuments({ role: 'student', status: 'active' }),
  ]);
  return {
    newRegistrations,
    checkInRate,
    activeStudents,
    eventCheckIns: await EventAttendance.countDocuments(),
    departments: await Department.countDocuments({ isActive: true }),
    sections: await Section.countDocuments({ isActive: true }),
  };
};

/** Safely scopes reports to a teacher's assignments when required. */
export const resolveReportScope = async (user: AuthUser, requestedSection?: string) => {
  if (user.role === 'admin') return { sectionIds: requestedSection ? [requestedSection] : undefined };
  if (user.role !== 'teacher') return { sectionIds: [] as string[] };
  const scope = await getTeacherScope(user);
  if (requestedSection) {
    return { sectionIds: scope.sectionIds.includes(requestedSection) ? [requestedSection] : [] };
  }
  return { sectionIds: scope.sectionIds };
};

export { Types };
