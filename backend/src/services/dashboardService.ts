import { Types } from 'mongoose';
import {
  AcademicSession,
  Announcement,
  Attendance,
  Competition,
  Course,
  Department,
  Event,
  EventAttendance,
  EventRegistration,
  Section,
  StudentProfile,
  Subject,
  Task,
  TeachingAssignment,
  User,
  VolunteerGroup,
  Payment,
  AuditLog,
} from '../models';
import type { AuthUser } from '../types/express';
import { getTeacherScope } from './accessControl';
import { attendanceSummaryForStudent } from './reportService';

const objectIds = (ids: string[]) => ids.map((id) => new Types.ObjectId(id));

/**
 * Every figure here is computed from MongoDB at request time.
 * No sample/fake analytics are ever returned.
 */
export const getAdminDashboard = async () => {
  const now = new Date();
  const [
    totalStudents,
    totalTeachers,
    totalDepartments,
    totalCourses,
    activeEvents,
    upcomingEvents,
    pendingRegistrations,
    totalCRs,
    totalVolunteers,
    confirmedRegistrations,
    eventCheckIns,
    pendingPayments,
    collectedPayments,
  ] = await Promise.all([
    StudentProfile.countDocuments({ status: 'active' }),
    User.countDocuments({ role: 'teacher', status: 'active' }),
    Department.countDocuments({ isActive: true }),
    Course.countDocuments({ isActive: true }),
    Event.countDocuments({ status: 'ongoing' }),
    Event.countDocuments({ startDate: { $gte: now }, status: 'published' }),
    EventRegistration.countDocuments({ status: 'pending' }),
    User.countDocuments({ role: 'student', 'responsibilities.type': 'cr' }),
    User.countDocuments({ role: 'student', 'responsibilities.type': 'volunteer' }),
    EventRegistration.countDocuments({ status: 'confirmed' }),
    EventAttendance.countDocuments({ role: 'participant' }),
    Payment.countDocuments({ status: 'pending' }),
    Payment.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);

  const studentsByDepartment = await StudentProfile.aggregate([
    { $match: { status: 'active' } },
    { $group: { _id: '$department', count: { $sum: 1 } } },
  ]);
  const departments = await Department.find({ _id: { $in: studentsByDepartment.map((row) => row._id) } })
    .select('name code')
    .lean();
  const departmentMap = new Map(departments.map((department) => [String(department._id), department]));

  const attendanceByDay = await Attendance.aggregate([
    { $match: { date: { $gte: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) } } },
    { $unwind: '$records' },
    {
      $group: {
        _id: { date: '$dateKey', status: '$records.status' },
        count: { $sum: 1 },
      },
    },
  ]);

  const upcoming = await Event.find({ startDate: { $gte: now }, status: { $in: ['published', 'ongoing'] } })
    .populate('category', 'name color')
    .sort({ startDate: 1 })
    .limit(5)
    .lean();

  const recentActivity = await AuditLog.find()
    .populate('actor', 'name role')
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  const recentStudents = await StudentProfile.find({ status: 'active' })
    .populate('user', 'name email')
    .populate('course', 'code')
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  return {
    counts: {
      totalStudents,
      totalTeachers,
      totalDepartments,
      totalCourses,
      activeEvents,
      upcomingEvents,
      pendingRegistrations,
      totalCRs,
      totalVolunteers,
      confirmedRegistrations,
      eventCheckIns,
      pendingPayments,
      collectedPayments: collectedPayments[0]?.total ?? 0,
    },
    studentsByDepartment: studentsByDepartment.map((row) => ({
      name: departmentMap.get(String(row._id))?.name ?? 'Unassigned',
      code: departmentMap.get(String(row._id))?.code ?? '',
      count: row.count,
    })),
    attendanceByDay,
    upcomingEvents: upcoming,
    recentActivity,
    recentStudents,
  };
};

export const getTeacherDashboard = async (user: AuthUser) => {
  const scope = await getTeacherScope(user);
  const now = new Date();

  const sectionIds = objectIds(scope.sectionIds);
  const eventIds = objectIds(scope.eventIds);

  const [assignments, studentCount, events, announcementCount, pendingTasks] = await Promise.all([
    TeachingAssignment.find({ teacher: user.id, isActive: true })
      .populate('subject', 'name code semesterNumber')
      .populate({ path: 'section', select: 'name semester', populate: { path: 'semester', select: 'number label' } })
      .lean(),
    StudentProfile.countDocuments({ section: { $in: sectionIds }, status: 'active' }),
    Event.find({ _id: { $in: eventIds } })
      .populate('category', 'name color')
      .sort({ startDate: -1 })
      .limit(6)
      .lean(),
    Announcement.countDocuments({
      $or: [{ createdBy: user.id }, { audience: 'college' }],
      published: true,
    }),
    Task.find({ createdBy: user.id, status: { $in: ['pending', 'in_progress', 'blocked'] } })
      .populate('event', 'title')
      .sort({ dueDate: 1 })
      .limit(5)
      .lean(),
  ]);

  const [attendanceSheets, registrations, unreadNotifications] = await Promise.all([
    Attendance.find({ section: { $in: sectionIds }, date: { $gte: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) } })
      .select('records dateKey date subject section')
      .lean(),
    EventRegistration.countDocuments({ event: { $in: eventIds } }),
    import('../models').then(({ Notification }) =>
      Notification.countDocuments({ user: user.id, read: false }),
    ),
  ]);

  let present = 0;
  let total = 0;
  for (const sheet of attendanceSheets) {
    for (const record of sheet.records) {
      total += 1;
      if (record.status === 'present' || record.status === 'late') present += 1;
    }
  }

  const sections = await Section.find({ _id: { $in: sectionIds } })
    .populate('semester', 'number label')
    .populate('course', 'name code')
    .lean();

  return {
    assignments,
    sections,
    counts: {
      studentCount,
      eventCount: events.length,
      registrationCount: registrations,
      announcementCount,
      pendingTaskCount: pendingTasks.length,
      attendancePercentage: total ? Math.round((present / total) * 1000) / 10 : 0,
      unreadNotifications,
    },
    events,
    pendingTasks,
  };
};

export const getStudentDashboard = async (user: AuthUser) => {
  const { Notification } = await import('../models');
  const [profile, registrations, announcements, tasks, notifications, upcomingEvents, attendance] = await Promise.all([
    StudentProfile.findOne({ user: user.id })
      .populate('department', 'name code')
      .populate('course', 'name code totalSemesters')
      .populate('semester', 'number label')
      .populate('section', 'name')
      .populate('academicSession', 'name')
      .lean(),
    EventRegistration.find({ student: user.id })
      .populate('event', 'title startDate venue status')
      .populate('competition', 'title')
      .sort({ submittedAt: -1 })
      .limit(5)
      .lean(),
    Announcement.find({ published: true, audience: 'college' }).sort({ publishAt: -1 }).limit(5).lean(),
    Task.find({ assignedTo: user.id, status: { $in: ['pending', 'in_progress', 'blocked'] } })
      .populate('event', 'title')
      .sort({ dueDate: 1 })
      .limit(5)
      .lean(),
    Notification.countDocuments({ user: user.id, read: false }),
    Event.find({ status: 'published', startDate: { $gte: new Date() }, isPublic: true })
      .populate('category', 'name color')
      .sort({ startDate: 1 })
      .limit(4)
      .lean(),
    attendanceSummaryForStudent(user.id),
  ]);

  let subjects: unknown[] = [];
  if (profile) {
    subjects = await TeachingAssignment.find({ section: profile.section, isActive: true })
      .populate('subject', 'name code credits')
      .populate('teacher', 'name email designation')
      .select('subject teacher')
      .lean();
  }

  const CR = user.responsibilities.find((responsibility) => responsibility.type === 'cr');
  const volunteerGroups = await VolunteerGroup.find({ members: user.id })
    .populate('event', 'title startDate')
    .select('name event')
    .lean();

  return {
    profile,
    subjects,
    registrations,
    announcements,
    tasks,
    upcomingEvents,
    attendance,
    counts: {
      unreadNotifications: notifications,
      registrations: registrations.length,
      pendingTasks: tasks.length,
    },
    isCR: Boolean(CR),
    crSection: CR?.section,
    volunteerGroups,
  };
};

export const getVolunteerDashboard = async (user: AuthUser) => {
  const groups = await VolunteerGroup.find({ members: user.id })
    .populate('event', 'title startDate endDate venue status')
    .populate('coordinator', 'name email')
    .populate('leader', 'name email')
    .lean();

  const eventIds = groups.map((group) => group.event).filter(Boolean);
  const [tasks, checkIns] = await Promise.all([
    Task.find({ assignedTo: user.id })
      .populate('event', 'title')
      .populate('group', 'name')
      .sort({ dueDate: 1 })
      .lean(),
    EventAttendance.find({ user: user.id }).populate('event', 'title').lean(),
  ]);

  void eventIds;
  return { groups, tasks, checkIns };
};

export const getCRDashboard = async (user: AuthUser) => {
  const cr = user.responsibilities.find((responsibility) => responsibility.type === 'cr');
  if (!cr?.section) {
    return { section: null, classmates: [], attendance: null, announcements: [], tasks: [] };
  }

  const section = await Section.findById(cr.section)
    .populate('semester', 'number label')
    .populate('course', 'name code')
    .populate('department', 'name code')
    .populate('academicSession', 'name')
    .lean();

  const [classmates, announcements, tasks, attendance, subjects] = await Promise.all([
    StudentProfile.find({ section: cr.section, status: 'active' })
      .populate('user', 'name email phone')
      .select('user enrollmentNumber rollNumber')
      .sort({ enrollmentNumber: 1 })
      .lean(),
    Announcement.find({
      published: true,
      $or: [{ audience: 'college' }, { audience: 'section', section: cr.section }, { audience: 'semester', semester: section?.semester }],
    })
      .sort({ publishAt: -1 })
      .limit(10)
      .lean(),
    Task.find({ assignedTo: user.id }).populate('event', 'title').sort({ dueDate: 1 }).lean(),
    Attendance.find({ section: cr.section })
      .select('records date dateKey subject')
      .populate('subject', 'name code')
      .sort({ date: -1 })
      .limit(30)
      .lean(),
    TeachingAssignment.find({ section: cr.section, isActive: true })
      .populate('subject', 'name code')
      .populate('teacher', 'name email')
      .lean(),
  ]);

  let present = 0;
  let total = 0;
  for (const sheet of attendance) {
    for (const record of sheet.records) {
      total += 1;
      if (record.status === 'present' || record.status === 'late') present += 1;
    }
  }

  return {
    section,
    classmates,
    announcements,
    tasks,
    subjects,
    attendance: {
      sheets: attendance.length,
      percentage: total ? Math.round((present / total) * 1000) / 10 : 0,
    },
  };
};

export const getCompetitionStats = async () => {
  const [total, open, published] = await Promise.all([
    Competition.countDocuments(),
    Competition.countDocuments({ status: 'open' }),
    Competition.countDocuments({ resultsPublished: true }),
  ]);
  return { total, open, published };
};

export { Subject, Types };
