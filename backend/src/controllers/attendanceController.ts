import type { Request, Response } from 'express';
import * as service from '../services/attendanceService';
import { created, ok, paginated, param } from '../utils/apiResponse';
import { recordAudit } from '../utils/audit';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

export const sheet = async (req: Request, res: Response) => {
  const data = await service.getAttendanceSheet({
    subject: String(req.query.subject),
    section: String(req.query.section),
    date: String(req.query.date),
  });
  return ok(res, data);
};

export const roster = async (req: Request, res: Response) =>
  ok(res, await service.getRoster(String(req.query.section)));

export const save = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const attendance = await service.saveAttendance(req.user, req.body);
  recordAudit(req, {
    action: 'attendance.saved',
    entity: 'Attendance',
    entityId: attendance._id,
    description: `${req.body.records.length} students marked`,
  });
  return created(res, attendance, 'Attendance saved');
};

export const history = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const params = {
    subject: req.query.subject as string | undefined,
    section: req.query.section as string | undefined,
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined,
    page: Number(req.query.page ?? 1),
    limit: Number(req.query.limit ?? 20),
  };
  if (req.user.role === 'teacher' && req.query.section) {
    const { assertSectionAccess } = await import('../services/accessControl');
    await assertSectionAccess(req.user, String(req.query.section));
  }
  const result = await service.getAttendanceHistory(params);
  return paginated(res, result.items, { page: params.page, limit: params.limit, total: result.total });
};

export const report = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  if (req.user.role === 'student') {
    const own = await service.getMyAttendance(req.user.id);
    return ok(res, { students: [], personal: own });
  }
  return ok(res, await service.getStudentAttendanceReport({
    section: req.query.section as string | undefined,
    subject: req.query.subject as string | undefined,
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined,
  }));
};

export const exportReport = async (req: Request, res: Response) => {
  const csv = await service.exportAttendanceCsv({
    section: req.query.section as string | undefined,
    subject: req.query.subject as string | undefined,
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined,
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="attendance-report-${new Date().toISOString().slice(0, 10)}.csv"`);
  return res.send(csv);
};

export const myAttendance = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  return ok(res, await service.getMyAttendance(req.user.id));
};

/* Event attendance */
export const eventOverview = async (req: Request, res: Response) =>
  ok(res, await service.getEventAttendanceOverview(param(req, 'eventId')));

export const checkIn = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const attendance = await service.checkInParticipant(req.user, {
    eventId: param(req, 'eventId'),
    registrationId: req.body.registrationId,
    studentId: req.body.studentId,
    notes: req.body.notes,
  });
  recordAudit(req, { action: 'event_attendance.check_in', entity: 'EventAttendance', entityId: attendance._id });
  return created(res, attendance, 'Participant checked in');
};

export const checkInQr = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const registration = await service.checkInByCode(req.user, param(req, 'eventId'), String(req.body.code).trim().toUpperCase());
  return created(res, registration, 'Check-in successful');
};

export const checkInStaff = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const role = req.body.role === 'teacher' ? 'teacher' : 'volunteer';
  const attendance =
    role === 'teacher'
      ? await service.checkInTeacher(req.user, param(req, 'eventId'), req.body.userId)
      : await service.checkInVolunteer(req.user, param(req, 'eventId'), req.body.userId);
  return created(res, attendance, `${role === 'teacher' ? 'Teacher' : 'Volunteer'} checked in`);
};

export const myCheckIns = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  return ok(res, await service.getMyEventCheckIns(req.user.id));
};

export const assertTeacherOnly = async (req: Request): Promise<void> => {
  if (!req.user) throw new UnauthorizedError();
  if (!['teacher', 'admin'].includes(req.user.role)) throw new ForbiddenError('Staff only');
};
