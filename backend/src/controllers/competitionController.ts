import type { Request, Response } from 'express';
import * as service from '../services/competitionService';
import { created, ok, paginated, param } from '../utils/apiResponse';
import { recordAudit } from '../utils/audit';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

export const list = async (req: Request, res: Response) => {
  const params = {
    event: req.query.event as string | undefined,
    status: req.query.status as string | undefined,
    search: req.query.search as string | undefined,
    page: Number(req.query.page ?? 1),
    limit: Number(req.query.limit ?? 20),
  };
  const result = await service.listCompetitions(params);
  return paginated(res, result.items, { page: params.page, limit: params.limit, total: result.total });
};

export const getById = async (req: Request, res: Response) => ok(res, await service.getCompetition(param(req, 'id')));

export const create = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const competition = await service.createCompetition(req.body, req.user.id);
  recordAudit(req, { action: 'competition.created', entity: 'Competition', entityId: competition._id, description: competition.title });
  return created(res, competition, 'Competition created');
};

export const update = async (req: Request, res: Response) =>
  ok(res, await service.updateCompetition(param(req, 'id'), req.body), 'Competition updated');

export const remove = async (req: Request, res: Response) => {
  await service.deleteCompetition(param(req, 'id'));
  return ok(res, { deleted: true }, 'Competition deleted');
};

export const submit = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  if (req.user.role !== 'student') throw new ForbiddenError('Only students can submit competition entries');
  const submission = await service.submitEntry(param(req, 'id'), req.user.id, req.body);
  return created(res, submission, 'Entry submitted');
};

export const review = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const submission = await service.reviewSubmission(param(req, 'submissionId'), req.user.id, req.body);
  recordAudit(req, { action: 'submission.reviewed', entity: 'CompetitionSubmission', entityId: submission._id, description: req.body.status });
  return ok(res, submission, 'Submission reviewed');
};

export const declareResult = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const result = await service.declareResult(param(req, 'id'), req.user.id, req.body);
  return ok(res, result, 'Result saved');
};

export const publishResults = async (req: Request, res: Response) => {
  const competition = await service.publishResults(param(req, 'id'));
  recordAudit(req, { action: 'competition.results_published', entity: 'Competition', entityId: competition._id });
  return ok(res, competition, 'Results published and participants notified');
};

export const mySubmissions = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  return ok(res, await service.listMySubmissions(req.user.id));
};

export const myResults = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  return ok(res, await service.listMyResults(req.user.id));
};
