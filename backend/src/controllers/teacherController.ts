import type { Request, Response } from 'express';
import * as teacherService from '../services/teacherService';
import { created, ok, paginated, param } from '../utils/apiResponse';
import { recordAudit } from '../utils/audit';
import { UnauthorizedError } from '../utils/errors';

const listParams = (req: Request) => ({
  page: Number(req.query.page ?? 1),
  limit: Number(req.query.limit ?? 20),
  search: req.query.search as string | undefined,
  department: req.query.department as string | undefined,
  status: req.query.status as string | undefined,
});

export const list = async (req: Request, res: Response) => {
  const result = await teacherService.listTeachers(listParams(req));
  return paginated(res, result.items, { page: Number(req.query.page ?? 1), limit: Number(req.query.limit ?? 20), total: result.total });
};

export const create = async (req: Request, res: Response) => {
  const result = await teacherService.createTeacher(req.body);
  recordAudit(req, { action: 'teacher.created', entity: 'User', entityId: result.user._id, description: result.user.email });
  return created(
    res,
    { teacher: result.user, temporaryPassword: result.temporaryPassword },
    'Teacher created. Share the temporary password securely — it is shown only once.',
  );
};

export const update = async (req: Request, res: Response) => {
  const teacher = await teacherService.updateTeacher(param(req, 'id'), req.body);
  recordAudit(req, { action: 'teacher.updated', entity: 'User', entityId: teacher._id, changes: Object.keys(req.body) });
  return ok(res, teacher, 'Teacher updated');
};

export const setSuspension = async (req: Request, res: Response) => {
  const teacher = await teacherService.suspendTeacher(param(req, 'id'), Boolean(req.body.suspend));
  recordAudit(req, { action: 'teacher.suspension_changed', entity: 'User', entityId: teacher._id, description: teacher.status });
  return ok(res, teacher, teacher.status === 'suspended' ? 'Teacher suspended' : 'Teacher reactivated');
};

export const resetPassword = async (req: Request, res: Response) => {
  const result = await teacherService.resetTeacherPassword(param(req, 'id'));
  return ok(res, result, 'Temporary password generated. Share it securely — it is shown only once.');
};

export const myOverview = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const overview = await teacherService.getTeacherOverview(req.user.id);
  return ok(res, overview);
};

export const myStudents = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const params = {
    search: req.query.search as string | undefined,
    section: req.query.section as string | undefined,
    page: Number(req.query.page ?? 1),
    limit: Number(req.query.limit ?? 20),
  };
  const result = await teacherService.getTeacherStudents(req.user.id, params);
  return paginated(res, result.items, { page: params.page, limit: params.limit, total: result.total });
};
