import type { Request, Response } from 'express';
import * as studentService from '../services/studentService';
import * as promotionService from '../services/promotionService';
import { created, ok, paginated, param } from '../utils/apiResponse';
import { recordAudit } from '../utils/audit';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';
import { getAccessibleSectionIds, getTeacherScope } from '../services/accessControl';

const listParams = (req: Request) => ({
  page: Number(req.query.page ?? 1),
  limit: Number(req.query.limit ?? 20),
  search: req.query.search as string | undefined,
  department: req.query.department as string | undefined,
  course: req.query.course as string | undefined,
  semester: req.query.semester as string | undefined,
  section: req.query.section as string | undefined,
  session: req.query.session as string | undefined,
  status: req.query.status as string | undefined,
  isCR: req.query.isCR === 'true',
});

export const list = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const params = listParams(req);

  // Teachers only ever see students inside their assigned sections.
  if (req.user.role === 'teacher') {
    const sectionsToQuery = await getAccessibleSectionIds(req.user, params.section ?? undefined);
    if (params.section && !sectionsToQuery.length) {
      throw new ForbiddenError('You are not assigned to this section');
    }
    if (!sectionsToQuery.length) {
      return paginated(res, [], { page: params.page, limit: params.limit, total: 0 });
    }

    const results = await Promise.all(
      sectionsToQuery.map((sectionId) =>
        studentService.listStudents({ ...params, section: sectionId, page: 1, limit: 100 }),
      ),
    );
    const merged = results.flatMap((result) => result.items);
    const start = (params.page - 1) * params.limit;
    return paginated(res, merged.slice(start, start + params.limit), {
      page: params.page,
      limit: params.limit,
      total: merged.length,
    });
  }

  // Students may only read their own record.
  if (req.user.role === 'student') {
    return paginated(res, [], { page: params.page, limit: params.limit, total: 0 });
  }

  const result = await studentService.listStudents(params);
  return paginated(res, result.items, { page: params.page, limit: params.limit, total: result.total });
};

export const getById = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const id = param(req, 'id');
  const student = await studentService.getStudentById(id);

  if (req.user.role === 'teacher') {
    const sectionId = String((student.section as unknown as { _id?: unknown })?._id ?? student.section);
    const allowed = await getAccessibleSectionIds(req.user, sectionId);
    if (!allowed.length) throw new ForbiddenError('This student is outside your assigned sections');
  }
  if (req.user.role === 'student' && String((student.user as unknown as { _id?: unknown })?._id) !== req.user.id) {
    throw new ForbiddenError('You may only view your own profile');
  }
  return ok(res, student);
};

export const getHistory = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const history = await studentService.getStudentHistory(param(req, 'id'));
  return ok(res, history);
};

export const create = async (req: Request, res: Response) => {
  const result = await studentService.createStudent(req.body);
  recordAudit(req, {
    action: 'student.created',
    entity: 'StudentProfile',
    entityId: result.profile._id,
    description: `Student ${req.body.enrollmentNumber} created`,
    changes: { email: req.body.email, section: req.body.section },
  });
  return created(
    res,
    { student: result.profile, temporaryPassword: result.temporaryPassword },
    result.temporaryPassword
      ? 'Student created. Share the temporary password securely — it is shown only once.'
      : 'Student created',
  );
};

export const update = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const student = await studentService.updateStudent(param(req, 'id'), req.body, req.user.id);
  recordAudit(req, {
    action: 'student.updated',
    entity: 'StudentProfile',
    entityId: student._id,
    changes: Object.keys(req.body),
  });
  return ok(res, student, 'Student updated');
};

export const setStatus = async (req: Request, res: Response) => {
  const id = param(req, 'id');
  const activate = req.body.status === 'active';
  await (activate ? studentService.activateStudent(id) : studentService.deactivateStudent(id));
  recordAudit(req, { action: activate ? 'student.activated' : 'student.deactivated', entity: 'StudentProfile', entityId: id });
  return ok(res, { status: activate ? 'active' : 'inactive' }, `Student ${activate ? 'activated' : 'deactivated'}`);
};

export const resetPassword = async (req: Request, res: Response) => {
  const result = await studentService.resetStudentPassword(param(req, 'id'));
  recordAudit(req, { action: 'student.password_reset', entity: 'StudentProfile', entityId: param(req, 'id') });
  return ok(res, result, 'Temporary password generated. Share it securely — it is shown only once.');
};

export const importCsv = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const csv = typeof req.body?.csv === 'string' ? req.body.csv : '';
  const result = await studentService.importStudentsFromCsv(csv, req.user.id);
  recordAudit(req, {
    action: 'student.imported',
    entity: 'StudentProfile',
    description: `${result.created} students imported, ${result.failed} failed`,
  });
  return ok(res, result, `${result.created} student(s) imported`);
};

export const importTemplate = async (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="student-import-template.csv"');
  return res.send(studentService.getStudentImportTemplate());
};

export const exportCsv = async (req: Request, res: Response) => {
  const csv = await studentService.exportStudentsCsv(listParams(req));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="students-${new Date().toISOString().slice(0, 10)}.csv"`);
  return res.send(csv);
};

/* ------------------------------- Promotion --------------------------------- */

export const promotionPreview = async (req: Request, res: Response) => {
  const preview = await promotionService.previewPromotion(req.body);
  return ok(res, preview);
};

export const promotionCreate = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const { name, ...scope } = req.body;
  const result = await promotionService.createPromotionBatch(scope, req.user.id, name);
  recordAudit(req, {
    action: 'promotion.previewed',
    entity: 'PromotionBatch',
    entityId: result.batch._id,
    description: `${result.preview.summary.total} students evaluated`,
  });
  return created(res, result.batch, 'Promotion preview created. Review before approving.');
};

export const promotionList = async (_req: Request, res: Response) =>
  ok(res, await promotionService.listPromotionBatches());

export const promotionGet = async (req: Request, res: Response) =>
  ok(res, await promotionService.getPromotionBatch(param(req, 'id')));

export const promotionApprove = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const batch = await promotionService.approvePromotionBatch(param(req, 'id'), req.user.id);
  recordAudit(req, {
    action: 'promotion.approved',
    entity: 'PromotionBatch',
    entityId: batch._id,
    description: `${batch.summary.promoted} students promoted`,
  });
  return ok(res, batch, 'Promotion approved. Academic history has been recorded.');
};

export const promotionCancel = async (req: Request, res: Response) => {
  const batch = await promotionService.cancelPromotionBatch(param(req, 'id'));
  return ok(res, batch, 'Promotion batch cancelled');
};

export const placementCorrection = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const placement = await promotionService.correctStudentPlacement(
    param(req, 'id'),
    req.body,
    req.user.id,
    req.body.remarks,
  );
  recordAudit(req, {
    action: 'student.placement_corrected',
    entity: 'StudentProfile',
    entityId: param(req, 'id'),
    description: req.body.remarks,
  });
  return ok(res, placement, 'Placement corrected and recorded in academic history');
};
