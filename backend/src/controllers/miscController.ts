import type { Request, Response } from 'express';
import { z } from 'zod';
import * as announcementService from '../services/announcementService';
import * as dashboardService from '../services/dashboardService';
import * as reportService from '../services/reportService';
import * as notificationService from '../services/notificationService';
import * as settingsService from '../services/settingsService';
import { Settings, AuditLog, Event, StudentProfile, User } from '../models';
import { created, ok, paginated, param } from '../utils/apiResponse';
import { recordAudit } from '../utils/audit';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';
import { ANNOUNCEMENT_AUDIENCES } from '../config/constants';
import { getTeacherScope } from '../services/accessControl';

/* ------------------------------- Announcements ------------------------------ */

export const listAnnouncements = async (req: Request, res: Response) => {
  const params = {
    page: Number(req.query.page ?? 1),
    limit: Number(req.query.limit ?? 20),
    audience: req.query.audience as string | undefined,
    search: req.query.search as string | undefined,
    includeExpired: req.query.includeExpired === 'true',
  };
  const result = await announcementService.listAnnouncements(params);
  return paginated(res, result.items, { page: params.page, limit: params.limit, total: result.total });
};

export const myAnnouncements = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const result = await announcementService.listAnnouncementsForUser(req.user, Number(req.query.limit ?? 20));
  return ok(res, result);
};

export const createAnnouncement = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const announcement = await announcementService.createAnnouncement(req.body, req.user);
  recordAudit(req, { action: 'announcement.created', entity: 'Announcement', entityId: announcement._id, description: announcement.title });
  return created(res, announcement, 'Announcement published');
};

export const updateAnnouncement = async (req: Request, res: Response) =>
  ok(res, await announcementService.updateAnnouncement(param(req, 'id'), req.body), 'Announcement updated');

export const deleteAnnouncement = async (req: Request, res: Response) => {
  await announcementService.deleteAnnouncement(param(req, 'id'));
  return ok(res, { deleted: true }, 'Announcement deleted');
};

export const markAnnouncementRead = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  await announcementService.markAnnouncementRead(param(req, 'id'), req.user.id);
  return ok(res, { read: true });
};

export const announcementAudiences = async (_req: Request, res: Response) =>
  ok(res, ANNOUNCEMENT_AUDIENCES);

/* -------------------------------- Notifications ----------------------------- */

export const listNotifications = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const result = await notificationService.listMyNotifications(req.user.id, {
    unreadOnly: req.query.unreadOnly === 'true',
    limit: Number(req.query.limit ?? 30),
  });
  return ok(res, result);
};

export const markNotificationsRead = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  await notificationService.markNotificationsRead(req.user.id, req.body.ids);
  return ok(res, { updated: true });
};

/* --------------------------------- Dashboards ------------------------------- */

export const dashboard = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  switch (req.user.role) {
    case 'admin':
      return ok(res, await dashboardService.getAdminDashboard());
    case 'teacher': {
      const teacher = await dashboardService.getTeacherDashboard(req.user);
      const isCR = req.user.responsibilities.some((responsibility) => responsibility.type === 'cr');
      const isVolunteer = req.user.responsibilities.some((responsibility) => responsibility.type === 'volunteer');
      return ok(res, {
        ...teacher,
        volunteer: isVolunteer ? await dashboardService.getVolunteerDashboard(req.user) : null,
        cr: isCR ? await dashboardService.getCRDashboard(req.user) : null,
      });
    }
    default: {
      const isCR = req.user.responsibilities.some((responsibility) => responsibility.type === 'cr');
      const isVolunteer = req.user.responsibilities.some((responsibility) => responsibility.type === 'volunteer');
      return ok(res, {
        ...(await dashboardService.getStudentDashboard(req.user)),
        cr: isCR ? await dashboardService.getCRDashboard(req.user) : null,
        volunteer: isVolunteer ? await dashboardService.getVolunteerDashboard(req.user) : null,
      });
    }
  }
};

/* ----------------------------------- Reports -------------------------------- */

export const academicReport = async (req: Request, res: Response) =>
  ok(res, await reportService.getAcademicReport({
    department: req.query.department as string | undefined,
    course: req.query.course as string | undefined,
    session: req.query.session as string | undefined,
  }));

export const exportAcademicReport = async (req: Request, res: Response) => {
  const csv = await reportService.exportAttendanceReportCsv({
    department: req.query.department as string | undefined,
    course: req.query.course as string | undefined,
    session: req.query.session as string | undefined,
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="academic-report.csv"');
  return res.send(csv);
};

export const teacherWorkload = async (_req: Request, res: Response) =>
  ok(res, await reportService.getTeacherWorkloadReport({}));

export const engagement = async (_req: Request, res: Response) =>
  ok(res, await reportService.getEngagementOverview());

export const studentActivity = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  return ok(res, await reportService.getStudentActivityReport(req.user.id));
};

export const auditLogs = async (req: Request, res: Response) => {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 30);
  const filter: Record<string, unknown> = {};
  if (req.query.entity) filter.entity = req.query.entity;
  const [items, total] = await Promise.all([
    AuditLog.find(filter).populate('actor', 'name role').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  return paginated(res, items, { page, limit, total });
};

/* ---------------------------------- Settings -------------------------------- */

export const getSettings = async (_req: Request, res: Response) => {
  const settings = await settingsService.getPlatformSettings();
  const { paymentConfig, ...rest } = settings ?? ({} as Record<string, unknown>);
  void paymentConfig;
  return ok(res, rest);
};

export const getPublicSettings = async (_req: Request, res: Response) =>
  ok(res, await settingsService.getPublicSettings());

export const updateSettings = async (req: Request, res: Response) => {
  const settings = await Settings.findOneAndUpdate(
    { key: 'platform' },
    { $set: req.body },
    { new: true, runValidators: true },
  );
  recordAudit(req, { action: 'settings.updated', entity: 'Settings', description: 'Platform settings updated' });
  return ok(res, settings, 'Settings saved');
};

/* ----------------------------------- Search --------------------------------- */

/**
 * Cross-entity quick search used by the dashboard topbar.
 *
 * Results respect data scope: students/teachers are only searched for users who
 * may read them, and teachers only match inside their own sections and events.
 */
export const globalSearch = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();

  const term = String(req.query.q ?? '').trim();
  if (term.length < 2) {
    return ok(res, { term, students: [], teachers: [], events: [], competitions: [], announcements: [] });
  }

  const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const actor = req.user;
  const canReadStudents = actor.role === 'admin' || actor.role === 'teacher';
  const canReadTeachers = actor.role === 'admin';

  const scope = actor.role === 'teacher' ? await getTeacherScope(actor) : null;

  const [students, teachers, events, competitions, announcements] = await Promise.all([
    canReadStudents
      ? (async () => {
          const userFilter: Record<string, unknown> = { role: 'student', $or: [{ name: regex }, { email: regex }] };
          const profiles = await StudentProfile.find({
            $or: [{ enrollmentNumber: regex }, { rollNumber: regex }],
            ...(scope && !scope.isAdmin ? { section: { $in: scope.sectionIds } } : {}),
          })
            .populate('user', 'name email')
            .select('user enrollmentNumber section')
            .limit(5)
            .lean();

          const users = await User.find(userFilter).select('_id').limit(5).lean();
          const byUser = users.length
            ? await StudentProfile.find({
                user: { $in: users.map((user) => user._id) },
                ...(scope && !scope.isAdmin ? { section: { $in: scope.sectionIds } } : {}),
              })
                .populate('user', 'name email')
                .select('user enrollmentNumber section')
                .limit(5)
                .lean()
            : [];

          const seen = new Set<string>();
          return [...profiles, ...byUser]
            .filter((profile) => {
              const key = String(profile._id);
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            })
            .slice(0, 5)
            .map((profile) => ({
              _id: profile._id,
              name: (profile.user as unknown as { name?: string })?.name ?? '',
              email: (profile.user as unknown as { email?: string })?.email ?? '',
              enrollmentNumber: profile.enrollmentNumber,
            }));
        })()
      : Promise.resolve([]),
    canReadTeachers
      ? User.find({ role: 'teacher', $or: [{ name: regex }, { email: regex }, { designation: regex }] })
          .select('name email designation')
          .limit(5)
          .lean()
      : Promise.resolve([]),
    Event.find({
      $or: [{ title: regex }, { slug: regex }, { venue: regex }],
      ...(scope && !scope.isAdmin && scope.eventIds.length ? { _id: { $in: scope.eventIds } } : {}),
      ...(actor.role === 'student' ? { isPublic: true } : {}),
    })
      .select('title slug startDate status venue')
      .limit(5)
      .lean(),
    actor.role === 'student'
      ? Promise.resolve([])
      : (await import('../models')).Competition.find({ $or: [{ title: regex }, { category: regex }] })
          .select('title category status event')
          .limit(5)
          .lean(),
    // Only announcements the user can actually see, matched on title/body.
    announcementService
      .listAnnouncementsForUser(actor, 100)
      .then(({ items }) =>
        items
          .filter((item) => regex.test(item.title) || regex.test(item.body))
          .slice(0, 5)
          .map((item) => ({ _id: item._id, title: item.title, audience: item.audience, priority: item.priority })),
      )
      .catch(() => []),
  ]);

  return ok(res, { term, students, teachers, events, competitions, announcements });
};

export { z, ForbiddenError };
