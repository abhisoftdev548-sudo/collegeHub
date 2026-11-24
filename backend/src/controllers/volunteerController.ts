import type { Request, Response } from 'express';
import * as service from '../services/volunteerService';
import { created, ok, paginated, param } from '../utils/apiResponse';
import { recordAudit } from '../utils/audit';
import { UnauthorizedError } from '../utils/errors';

export const listGroups = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const member = req.user.role === 'student' ? req.user.id : (req.query.member as string | undefined);
  return ok(res, await service.listGroups({ event: req.query.event as string | undefined, member }));
};

export const createGroup = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const group = await service.createGroup(req.body, req.user);
  recordAudit(req, { action: 'volunteer_group.created', entity: 'VolunteerGroup', entityId: group._id, description: group.name });
  return created(res, group, 'Volunteer group created');
};

export const updateGroup = async (req: Request, res: Response) =>
  ok(res, await service.updateGroup(param(req, 'id'), req.body), 'Volunteer group updated');

export const removeGroup = async (req: Request, res: Response) => {
  await service.deleteGroup(param(req, 'id'));
  return ok(res, { deleted: true }, 'Volunteer group deleted');
};

export const assign = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const group = await service.assignVolunteer(
    param(req, 'id'),
    req.body.studentId,
    req.user.id,
    Boolean(req.body.asLeader),
  );
  recordAudit(req, { action: 'volunteer.assigned', entity: 'VolunteerGroup', entityId: param(req, 'id'), description: req.body.studentId });
  return ok(res, group, 'Volunteer assigned');
};

export const unassign = async (req: Request, res: Response) => {
  await service.removeVolunteer(param(req, 'id'), param(req, 'studentId'));
  return ok(res, { removed: true }, 'Volunteer removed');
};

export const myGroups = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  return ok(res, await service.listMyGroups(req.user.id));
};

export const listTasks = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const params = {
    event: req.query.event as string | undefined,
    group: req.query.group as string | undefined,
    status: req.query.status as string | undefined,
    assignedTo: req.user.role === 'student' ? req.user.id : (req.query.assignedTo as string | undefined),
    page: Number(req.query.page ?? 1),
    limit: Number(req.query.limit ?? 20),
  };
  const result = await service.listTasks(params);
  return paginated(res, result.items, { page: params.page, limit: params.limit, total: result.total });
};

export const createTask = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const task = await service.createTask(req.body, req.user.id);
  recordAudit(req, { action: 'task.created', entity: 'Task', entityId: task._id, description: task.title });
  return created(res, task, 'Task created');
};

export const updateTask = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const task = await service.updateTask(param(req, 'id'), req.body, req.user.id);
  return ok(res, task, 'Task updated');
};

export const removeTask = async (req: Request, res: Response) => {
  await service.deleteTask(param(req, 'id'));
  return ok(res, { deleted: true }, 'Task deleted');
};

export const myTasks = async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  return ok(res, await service.listMyTasks(req.user.id));
};
