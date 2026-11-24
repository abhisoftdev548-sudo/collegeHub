import type { Request, Response } from 'express';
import * as eventService from '../services/eventService';
import * as formService from '../services/formService';
import * as paymentService from '../services/paymentService';
import * as reportService from '../services/reportService';
import { created, ok, paginated, param } from '../utils/apiResponse';
import { recordAudit } from '../utils/audit';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '../utils/errors';
import { canManageEvent, assertEventManageAccess } from '../services/accessControl';
import { toPublicUrl } from '../middleware/upload';

export const list = async (req: Request, res: Response) => {
  const params = {
    page: Number(req.query.page ?? 1),
    limit: Number(req.query.limit ?? 12),
    search: req.query.search as string | undefined,
    status: req.query.status as string | undefined,
    category: req.query.category as string | undefined,
    department: req.query.department as string | undefined,
    upcoming: req.query.upcoming === 'true',
    includeSubEvents: req.query.includeSubEvents !== 'false',
    publicOnly: req.query.publicOnly === 'true',
  };
  const result = await eventService.listEvents(params, req.user);
  return paginated(res, result.items, { page: params.page, limit: params.limit, total: result.total });
};

export const getById = async (req: Request, res: Response) =>
  ok(res, await eventService.getEventById(param(req, 'id'), req.user));

export const create = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const event = await eventService.createEvent(req.body, req.user);
  recordAudit(req, { action: 'event.created', entity: 'Event', entityId: event._id, description: event.title });
  return created(res, event, 'Event created');
};

export const update = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  await assertEventManageAccess(req.user, param(req, 'id'));
  const event = await eventService.updateEvent(param(req, 'id'), req.body);
  recordAudit(req, { action: 'event.updated', entity: 'Event', entityId: event._id, changes: Object.keys(req.body) });
  return ok(res, event, 'Event updated');
};

export const remove = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  await assertEventManageAccess(req.user, param(req, 'id'));
  await eventService.deleteEvent(param(req, 'id'));
  recordAudit(req, { action: 'event.deleted', entity: 'Event', entityId: param(req, 'id') });
  return ok(res, { deleted: true }, 'Event deleted');
};

/* Categories */
export const listCategories = async (req: Request, res: Response) =>
  ok(res, await eventService.listCategories(req.query.includeInactive === 'true'));

export const createCategory = async (req: Request, res: Response) => {
  const category = await eventService.createCategory(req.body);
  return created(res, category, 'Category created');
};

export const updateCategory = async (req: Request, res: Response) =>
  ok(res, await eventService.updateCategory(param(req, 'id'), req.body), 'Category updated');

/* Registration management */
export const listRegistrations = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  await assertEventManageAccess(req.user, param(req, 'id'));
  const params = {
    page: Number(req.query.page ?? 1),
    limit: Number(req.query.limit ?? 20),
    status: req.query.status as string | undefined,
    search: req.query.search as string | undefined,
    competition: req.query.competition as string | undefined,
  };
  const result = await eventService.getEventRegistrations(param(req, 'id'), params);
  return paginated(res, result.items, { page: params.page, limit: params.limit, total: result.total });
};

export const updateRegistrationStatus = async (req: Request, res: Response) => {
  const existing = await eventService.getEventRegistrations(param(req, 'eventId'), { page: 1, limit: 1 });
  void existing;
  const registration = await eventService.updateRegistrationStatus(
    param(req, 'registrationId'),
    req.body.status,
    req.body.notes,
  );
  recordAudit(req, {
    action: 'registration.status_changed',
    entity: 'EventRegistration',
    entityId: registration._id,
    description: `Status set to ${req.body.status}`,
  });
  return ok(res, registration, 'Registration updated');
};

export const exportRegistrations = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  await assertEventManageAccess(req.user, param(req, 'id'));
  const csv = await reportService.exportRegistrationsCsv(param(req, 'id'));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="registrations-${param(req, 'id')}.csv"`);
  return res.send(csv);
};

/* Student-facing registration */
export const register = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  if (req.user.role !== 'student') throw new ForbiddenError('Only students can register for events');

  let answers: Array<{ key: string; label: string; value: unknown }> = [];
  const eventId = param(req, 'id');
  const event = await eventService.getEventById(eventId, req.user);
  const formId = (event.registration as { form?: unknown } | undefined)?.form;

  if (formId) {
    const rawAnswers = (req.body.answers ?? {}) as Record<string, unknown>;
    const validated = await formService.validateAnswers(String(formId), rawAnswers);
    answers = validated.answers;
  } else if (Array.isArray(req.body.answers)) {
    answers = req.body.answers;
  }

  const registration = await eventService.registerForEvent(eventId, req.user.id, {
    answers,
    teamName: req.body.teamName,
    teamMembers: req.body.teamMembers,
    files: req.body.files,
    competitionId: req.body.competitionId,
  });

  recordAudit(req, {
    action: 'registration.created',
    entity: 'EventRegistration',
    entityId: registration._id,
    description: registration.registrationId,
  });

  return created(res, registration, 'Registration submitted successfully');
};

export const myRegistrations = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  return ok(res, await eventService.listMyRegistrations(req.user.id));
};

/* Forms */
export const listForms = async (req: Request, res: Response) =>
  ok(res, await formService.listForms({
    event: req.query.event as string | undefined,
    competition: req.query.competition as string | undefined,
  }));

export const getForm = async (req: Request, res: Response) => ok(res, await formService.getFormById(param(req, 'id')));

export const createForm = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const form = await formService.createForm(req.body, req.user.id);
  return created(res, form, 'Form created');
};

export const updateForm = async (req: Request, res: Response) =>
  ok(res, await formService.updateForm(param(req, 'id'), req.body), 'Form updated');

export const deleteForm = async (req: Request, res: Response) => {
  await formService.deleteForm(param(req, 'id'));
  return ok(res, { deleted: true }, 'Form deleted');
};

/* Payments */
export const createPaymentOrder = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const order = await paymentService.createPaymentOrder(req.body.registrationId, req.user.id);
  return created(res, order, 'Payment details ready');
};

export const submitPaymentReference = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const payment = await paymentService.submitManualReference(
    param(req, 'paymentId'),
    req.user.id,
    req.body.reference,
    req.body.notes,
  );
  return ok(res, payment, 'Payment reference submitted for verification');
};

export const verifyPayment = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const payment = await paymentService.verifyPayment(
    param(req, 'paymentId'),
    req.user.id,
    req.body.outcome,
    req.body.notes,
  );
  recordAudit(req, { action: 'payment.verified', entity: 'Payment', entityId: payment._id, description: req.body.outcome });
  return ok(res, payment, 'Payment updated');
};

export const gatewayCallback = async (req: Request, res: Response) => {
  const payment = await paymentService.verifyGatewayPayment(req.body);
  return ok(res, { verified: true, paymentId: payment.paymentId });
};

export const listPayments = async (req: Request, res: Response) => {
  const params = {
    page: Number(req.query.page ?? 1),
    limit: Number(req.query.limit ?? 20),
    status: req.query.status as string | undefined,
    event: req.query.event as string | undefined,
    search: req.query.search as string | undefined,
  };
  const result = await paymentService.listPayments(params);
  return paginated(res, result.items, { page: params.page, limit: params.limit, total: result.total });
};

export const myPayments = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  return ok(res, await paymentService.listMyPayments(req.user.id));
};

/* Uploads */
export const uploadFile = async (req: Request, res: Response) => {
  if (!req.file) throw new NotFoundError('Upload');
  return created(res, { url: toPublicUrl(req.file), originalName: req.file.originalname, size: req.file.size }, 'File uploaded');
};

export const eventReport = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  if (!(await canManageEvent(req.user, param(req, 'id')))) throw new ForbiddenError('You cannot view this report');
  const report = await reportService.getEventReport(param(req, 'id'));
  if (!report) throw new NotFoundError('Event');
  return ok(res, report);
};
